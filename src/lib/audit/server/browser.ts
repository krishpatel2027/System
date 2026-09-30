import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright-core";
import type { BreakpointRow, BrowserImage, BrowserRun, ResourceRow } from "../types";
import { scriptPurpose } from "../technology";
import { guardActive, guardHost, hostAllowed, normalizeUrl, robotsCheck, AnalyzeError } from "./net";

// Headless-browser measurements. Uses a Chromium-based browser already on the
// machine (Chrome, Edge or Chromium) — nothing is downloaded. When no browser
// is available (e.g. serverless hosting) these checks report "Not measured".
// Every request the page makes is filtered through the same internal-address
// guard as the crawler; downloads and service workers are blocked.

const UA_MOBILE = "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36 ArkriaAuditBot/1.0";
const UA_DESKTOP = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 ArkriaAuditBot/1.0";

function candidates(): string[] {
  const e = process.env;
  const list = [
    e.AUDIT_BROWSER_PATH,
    e.PROGRAMFILES && `${e.PROGRAMFILES}\\Google\\Chrome\\Application\\chrome.exe`,
    e["PROGRAMFILES(X86)"] && `${e["PROGRAMFILES(X86)"]}\\Google\\Chrome\\Application\\chrome.exe`,
    e.LOCALAPPDATA && `${e.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
    e["PROGRAMFILES(X86)"] && `${e["PROGRAMFILES(X86)"]}\\Microsoft\\Edge\\Application\\msedge.exe`,
    e.PROGRAMFILES && `${e.PROGRAMFILES}\\Microsoft\\Edge\\Application\\msedge.exe`,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium", "/usr/bin/chromium-browser", "/usr/bin/microsoft-edge", "/snap/bin/chromium",
  ];
  try { list.push(chromium.executablePath()); } catch {}
  return list.filter((x): x is string => !!x);
}

export function browserStatus(): { available: boolean; path?: string; reason?: string } {
  if (process.env.AUDIT_BROWSER === "off") return { available: false, reason: "Browser checks are turned off (AUDIT_BROWSER=off)." };
  const path = candidates().find((p) => { try { return existsSync(p); } catch { return false; } });
  return path ? { available: true, path } : { available: false, reason: "No Chrome, Edge or Chromium browser was found on this server. Browser-based checks (Core Web Vitals, screenshots, rendering) need one — they run when the app runs on a computer with Chrome or Edge installed, or set AUDIT_BROWSER_PATH." };
}

// axe-core is injected into the audited page as a script, never run in Node.
let axeSource: string | null | undefined;
function getAxe(): string | null {
  if (axeSource === undefined) {
    try { axeSource = readFileSync(path.join(process.cwd(), "node_modules", "axe-core", "axe.min.js"), "utf-8"); } catch { axeSource = null; }
  }
  return axeSource;
}

let browserP: Promise<Browser> | null = null;
let idleTimer: ReturnType<typeof setTimeout> | null = null;
let queue: Promise<unknown> = Promise.resolve();

function exclusive<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.catch(() => {});
  return run;
}

async function getBrowser(): Promise<Browser> {
  if (idleTimer) clearTimeout(idleTimer);
  if (!browserP) {
    const st = browserStatus();
    if (!st.available) throw new AnalyzeError(st.reason ?? "No browser available");
    const root = typeof process.getuid === "function" && process.getuid() === 0;
    browserP = chromium.launch({
      executablePath: st.path,
      headless: true,
      args: ["--disable-dev-shm-usage", "--disable-gpu", "--mute-audio", "--no-first-run", "--no-default-browser-check", ...(root ? ["--no-sandbox"] : [])],
    }).catch((e) => { browserP = null; throw e; });
  }
  return browserP;
}

function scheduleClose() {
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(() => { const b = browserP; browserP = null; b?.then((x) => x.close()).catch(() => {}); }, 90_000);
}

const INIT = `(() => {
  const s = window.__ark = { lcp: 0, lcpEl: "", cls: 0, lt: [] };
  const desc = (el) => { if (!el || !el.tagName) return ""; let d = el.tagName.toLowerCase(); if (el.id) d += "#" + el.id; else if (typeof el.className === "string" && el.className.trim()) d += "." + el.className.trim().split(/\\s+/).slice(0, 2).join("."); if (el.tagName === "IMG") d += " (" + String(el.currentSrc || el.src).split("/").pop().slice(0, 60) + ")"; return d.slice(0, 120); };
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) { s.lcp = e.startTime; s.lcpEl = desc(e.element); } }).observe({ type: "largest-contentful-paint", buffered: true }); } catch (e) {}
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) s.cls += e.value; }).observe({ type: "layout-shift", buffered: true }); } catch (e) {}
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) s.lt.push([e.startTime, e.duration]); }).observe({ type: "longtask", buffered: true }); } catch (e) {}
})();`;

async function newContext(b: Browser, viewport: "mobile" | "desktop" | "plain"): Promise<BrowserContext> {
  const ctx = await b.newContext({
    ...(viewport === "mobile"
      ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: UA_MOBILE }
      : { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, userAgent: UA_DESKTOP }),
    bypassCSP: true,
    acceptDownloads: false,
    serviceWorkers: "block",
    locale: "en-IN",
    timezoneId: "Asia/Kolkata",
  });
  await ctx.addInitScript(INIT);
  if (guardActive()) {
    await ctx.route("**/*", async (route) => {
      const url = route.request().url();
      if (!/^https?:/i.test(url)) return route.continue();
      return (await hostAllowed(new URL(url))) ? route.continue() : route.abort("blockedbyclient");
    });
  }
  return ctx;
}

const sameSite = (a: string, host: string) => { try { return new URL(a).hostname.replace(/^www\./, "").endsWith(host.replace(/^www\./, "")); } catch { return false; } };

function disjointUsed(fns: { ranges: { startOffset: number; endOffset: number; count: number }[] }[]) {
  const points: { offset: number; type: 0 | 1; range: { startOffset: number; endOffset: number; count: number } }[] = [];
  for (const f of fns) for (const r of f.ranges) { points.push({ offset: r.startOffset, type: 0, range: r }); points.push({ offset: r.endOffset, type: 1, range: r }); }
  points.sort((a, b) => {
    if (a.offset !== b.offset) return a.offset - b.offset;
    if (a.type !== b.type) return b.type - a.type;
    const al = a.range.endOffset - a.range.startOffset;
    const bl = b.range.endOffset - b.range.startOffset;
    return a.type === 0 ? bl - al : al - bl;
  });
  const stack: number[] = [];
  let used = 0;
  let last = 0;
  for (const p of points) {
    if (stack.length && last < p.offset && stack[stack.length - 1] > 0) used += p.offset - last;
    last = p.offset;
    if (p.type === 0) stack.push(p.range.count); else stack.pop();
  }
  return used;
}

async function screenshot(page: Page, quality = 55): Promise<string> {
  await page.evaluate(() => window.scrollTo(0, 0)).catch(() => {});
  await page.waitForTimeout(300);
  const buf = await page.screenshot({ type: "jpeg", quality, scale: "css", timeout: 10_000 });
  return `data:image/jpeg;base64,${buf.toString("base64")}`;
}

// Shared in-page helpers (serialised into the page).
const HELPERS = `
  window.__arkDesc = (el) => { if (!el || !el.tagName) return ""; let d = el.tagName.toLowerCase(); if (el.id) d += "#" + el.id; else if (typeof el.className === "string" && el.className.trim()) d += "." + el.className.trim().split(/\\s+/).slice(0, 2).join("."); return d.slice(0, 80); };
  window.__arkVis = (el) => { const cs = getComputedStyle(el); if (cs.visibility === "hidden" || cs.display === "none" || Number(cs.opacity) === 0) return null; const r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return null; return { cs, r }; };
  window.__arkRgb = (c) => { const m = String(c).match(/rgba?\\(([^)]+)\\)/); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
  window.__arkLum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
  window.__arkRatio = (a, b) => { const l1 = window.__arkLum(a), l2 = window.__arkLum(b); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); };
  window.__arkBg = (el) => { let e = el; while (e && e.nodeType === 1) { const cs = getComputedStyle(e); if (cs.backgroundImage && cs.backgroundImage !== "none") return null; const c = window.__arkRgb(cs.backgroundColor); if (c && c.a >= 0.9) return c; e = e.parentElement; } return { r: 255, g: 255, b: 255, a: 1 }; };
  window.__arkCta = /\\b(contact|call|whatsapp|book|appointment|enquire|enquiry|inquire|get (a )?(free )?quote|get started|buy|shop|order|schedule|consult|demo|sign ?up|try|request|talk to|let'?s talk)\\b/i;
`;

interface RunOpts { url: string; viewport: "mobile" | "desktop"; axe?: boolean; coverage?: boolean; screenshot?: boolean; lite?: boolean }

async function runOnce(opts: RunOpts): Promise<{ run: BrowserRun; shots: Record<string, string> }> {
  const u = normalizeUrl(opts.url);
  await guardHost(u);
  if (!(await robotsCheck(u))) return { run: { url: opts.url, viewport: opts.viewport, ok: false, error: "robots.txt asks automated tools not to read this page." }, shots: {} };
  const b = await getBrowser();
  const ctx = await newContext(b, opts.viewport);
  const shots: Record<string, string> = {};
  try {
    const page = await ctx.newPage();
    page.setDefaultTimeout(20_000);
    const consoleErrors: string[] = [];
    page.on("pageerror", (e) => consoleErrors.length < 8 && consoleErrors.push(String(e.message).slice(0, 200)));
    // Resource 404s are reported separately (broken images/links), not as script errors.
    page.on("console", (m) => m.type() === "error" && !/^Failed to load resource/i.test(m.text()) && consoleErrors.length < 8 && consoleErrors.push(m.text().slice(0, 200)));
    const host = u.hostname;
    const pending: Promise<void>[] = [];
    const rows: ResourceRow[] = [];
    page.on("requestfinished", (req) => {
      pending.push((async () => {
        try {
          const res = await req.response();
          if (!res) return;
          const sizes = await req.sizes();
          const h = await res.allHeaders();
          const cc = h["cache-control"] ?? "";
          const maxAge = Number(cc.match(/max-age=(\d+)/)?.[1] ?? 0);
          rows.push({
            url: req.url(), type: req.resourceType(), bytes: sizes.responseBodySize + sizes.responseHeadersSize, status: res.status(),
            thirdParty: !sameSite(req.url(), host), cacheable: /immutable/.test(cc) || maxAge >= 7 * 86400 || !!h["expires"] && new Date(h["expires"]).getTime() - Date.now() > 7 * 86400e3,
            encoding: h["content-encoding"], protocol: undefined,
          });
        } catch {}
      })());
    });
    if (opts.coverage) {
      await page.coverage.startJSCoverage({ resetOnNavigation: false, reportAnonymousScripts: false });
      await page.coverage.startCSSCoverage({ resetOnNavigation: false });
    }
    const resp = await page.goto(u.toString(), { waitUntil: "load", timeout: 30_000 });
    await page.waitForLoadState("networkidle", { timeout: 6_000 }).catch(() => {});
    await page.waitForTimeout(1500);
    await page.addScriptTag({ content: HELPERS }).catch(() => page.evaluate(HELPERS));

    const perf = await page.evaluate(() => {
      const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
      const fcp = performance.getEntriesByType("paint").find((p) => p.name === "first-contentful-paint")?.startTime;
      const s = (window as unknown as { __ark?: { lcp: number; lcpEl: string; cls: number; lt: [number, number][] } }).__ark;
      const tbt = (s?.lt ?? []).filter(([st]) => fcp === undefined || st >= fcp).reduce((a, [, d]) => a + Math.max(0, d - 50), 0);
      return {
        ttfb: nav ? Math.round(nav.responseStart) : undefined, fcp: fcp !== undefined ? Math.round(fcp) : undefined,
        lcp: s?.lcp ? Math.round(s.lcp) : undefined, lcpElement: s?.lcpEl || undefined, cls: s ? Math.round(s.cls * 1000) / 1000 : undefined,
        tbt: Math.round(tbt), load: nav ? Math.round(nav.loadEventEnd) : undefined, protocol: nav?.nextHopProtocol || "",
        domNodes: document.getElementsByTagName("*").length, words: (document.body?.innerText ?? "").split(/\s+/).filter(Boolean).length,
        scripts: [...document.scripts].filter((x) => x.src).map((x) => ({ src: x.src, blocking: !x.async && !x.defer && x.type !== "module" && !!x.closest("head") })),
        sheets: [...document.querySelectorAll('link[rel~="stylesheet"]')].map((l) => ({ href: (l as HTMLLinkElement).href, blocking: !!l.closest("head") && !(l as HTMLLinkElement).media?.match(/print/) })),
      };
    });

    const firstViewport = await page.evaluate(() => {
      const w = window as unknown as { __arkVis: (e: Element) => { r: DOMRect } | null; __arkCta: RegExp };
      const H = innerHeight;
      const h1 = document.querySelector("h1")?.textContent?.replace(/\s+/g, " ").trim();
      const parts: string[] = [];
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let n: Node | null;
      while ((n = walker.nextNode()) && parts.join(" ").length < 700) {
        const t = n.textContent?.replace(/\s+/g, " ").trim();
        const el = n.parentElement;
        if (!t || !el || /SCRIPT|STYLE|NOSCRIPT/.test(el.tagName)) continue;
        const v = w.__arkVis(el);
        if (v && v.r.top < H && v.r.bottom > 0) parts.push(t);
      }
      const ctas = [...document.querySelectorAll("a[href], button")].filter((el) => { const v = w.__arkVis(el); return v && v.r.top < H && v.r.bottom > 0 && (w.__arkCta.test(el.textContent ?? "") || /^tel:|wa\.me|whatsapp/i.test(el.getAttribute("href") ?? "")); }).map((el) => (el.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 50) || el.getAttribute("href")?.slice(0, 50) || "").filter(Boolean).slice(0, 8);
      return { h1: h1?.slice(0, 160), text: parts.join(" ").slice(0, 700), ctas };
    });

    let mobile: BrowserRun["mobile"];
    if (opts.viewport === "mobile") {
      mobile = await page.evaluate(() => {
        const w = window as unknown as { __arkVis: (e: Element) => { r: DOMRect; cs: CSSStyleDeclaration } | null; __arkDesc: (e: Element) => string; __arkCta: RegExp };
        const W = innerWidth, H = innerHeight;
        const overflowPx = Math.max(0, document.documentElement.scrollWidth - W);
        const clipped = (el: Element) => { let e = el.parentElement; while (e && e !== document.body) { const o = getComputedStyle(e).overflowX; if (o === "hidden" || o === "auto" || o === "scroll" || o === "clip") return true; e = e.parentElement; } return false; };
        const all = [...document.body.querySelectorAll("*")].slice(0, 4000);
        const offenders = all.map((el) => ({ el, r: el.getBoundingClientRect() })).filter(({ el, r }) => r.width > 0 && r.right > W + 2 && !clipped(el)).sort((a, b) => b.r.right - a.r.right).slice(0, 5).map(({ el, r }) => `${w.__arkDesc(el)} (${Math.round(r.right - W)}px past the edge)`);
        const small: string[] = [];
        let smallText = 0;
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        let n: Node | null;
        const seen = new Set<Element>();
        while ((n = walker.nextNode())) {
          const el = n.parentElement;
          const t = n.textContent?.trim();
          if (!el || !t || t.length < 3 || seen.has(el) || /SCRIPT|STYLE|NOSCRIPT/.test(el.tagName)) continue;
          seen.add(el);
          const v = w.__arkVis(el);
          if (v && parseFloat(v.cs.fontSize) < 12) { smallText++; if (small.length < 4) small.push(`"${t.slice(0, 40)}" at ${parseFloat(v.cs.fontSize)}px`); }
        }
        const taps = [...document.querySelectorAll('a[href], button, input:not([type="hidden"]), select, textarea, [role="button"]')];
        const tapSamples: string[] = [];
        let tapSmall = 0;
        for (const el of taps) {
          const v = w.__arkVis(el);
          if (!v) continue;
          if (el.tagName === "A" && /^(P|LI|SPAN|TD)$/.test(el.parentElement?.tagName ?? "") && (el.parentElement?.textContent?.length ?? 0) > (el.textContent?.length ?? 0) + 20) continue; // inline text links are exempt
          if (v.r.width < 24 || v.r.height < 24) { tapSmall++; if (tapSamples.length < 4) tapSamples.push(`${(el.textContent || el.getAttribute("aria-label") || w.__arkDesc(el)).trim().slice(0, 30)} (${Math.round(v.r.width)}×${Math.round(v.r.height)}px)`); }
        }
        let fixedArea = 0;
        const popups: string[] = [];
        for (const el of all) {
          const cs = getComputedStyle(el);
          if (cs.position !== "fixed" && cs.position !== "sticky") continue;
          const v = w.__arkVis(el);
          if (!v) continue;
          const r = v.r;
          const vis = Math.max(0, Math.min(r.right, W) - Math.max(r.left, 0)) * Math.max(0, Math.min(r.bottom, H) - Math.max(r.top, 0));
          if (vis / (W * H) > 0.4 && cs.position === "fixed") popups.push((el.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 70) || w.__arkDesc(el));
          else fixedArea += vis;
        }
        const ctaAboveFold = [...document.querySelectorAll("a[href], button")].filter((el) => { const v = w.__arkVis(el); return v && v.r.top < H && v.r.bottom > 0 && (w.__arkCta.test(el.textContent ?? "") || /^tel:|wa\.me|whatsapp/i.test(el.getAttribute("href") ?? "")); }).map((el) => (el.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 40) || el.getAttribute("href")?.slice(0, 40) || "").slice(0, 5);
        const navToggle = [...document.querySelectorAll('button, [role="button"], a, label, div')].slice(0, 3000).some((el) => { const s = `${el.getAttribute("aria-label") ?? ""} ${typeof (el as HTMLElement).className === "string" ? (el as HTMLElement).className : ""} ${el.id}`; return /menu|hamburger|burger|nav-?toggle|navbar-toggler|mobile-nav/i.test(s) && !!w.__arkVis(el); });
        return { overflowPx, offenders, smallText, smallTextSamples: small, tapSmall, tapSamples, fixedCoverage: Math.min(1, fixedArea / (W * H)), ctaAboveFold, navToggle, popups: popups.slice(0, 3) };
      });
    }

    let design: BrowserRun["design"];
    if (opts.viewport === "desktop" && !opts.lite) {
      design = await page.evaluate(() => {
        type RGB = { r: number; g: number; b: number; a: number };
        const w = window as unknown as { __arkVis: (e: Element) => { r: DOMRect; cs: CSSStyleDeclaration } | null; __arkRgb: (c: string) => RGB | null; __arkRatio: (a: RGB, b: RGB) => number; __arkBg: (e: Element) => RGB | null; __arkCta: RegExp };
        const H = innerHeight;
        const fam = new Map<string, number>(), sizes = new Map<number, number>(), colors = new Map<string, number>(), bgs = new Map<string, number>();
        const bodySizes = new Map<number, number>();
        const lhs: number[] = [];
        const fails: { text: string; ratio: number; fg: string; bg: string; large: boolean }[] = [];
        let checked = 0;
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        let n: Node | null;
        const seen = new Set<Element>();
        let count = 0;
        while ((n = walker.nextNode()) && count < 1500) {
          const el = n.parentElement;
          const t = n.textContent?.trim();
          if (!el || !t || t.length < 2 || seen.has(el) || /SCRIPT|STYLE|NOSCRIPT|OPTION/.test(el.tagName)) continue;
          seen.add(el);
          const v = w.__arkVis(el);
          if (!v) continue;
          count++;
          const cs = v.cs;
          const f = cs.fontFamily.split(",")[0].replace(/["']/g, "").trim();
          fam.set(f, (fam.get(f) ?? 0) + 1);
          const size = Math.round(parseFloat(cs.fontSize));
          sizes.set(size, (sizes.get(size) ?? 0) + 1);
          colors.set(cs.color, (colors.get(cs.color) ?? 0) + 1);
          if (/^(P|LI)$/.test(el.tagName) && t.length > 40) {
            bodySizes.set(size, (bodySizes.get(size) ?? 0) + 1);
            lhs.push(cs.lineHeight === "normal" ? 1.2 : parseFloat(cs.lineHeight) / parseFloat(cs.fontSize));
          }
          if (v.r.top < H && v.r.bottom > 0 && checked < 200) {
            const fg = w.__arkRgb(cs.color);
            const bg = w.__arkBg(el);
            if (fg && bg && fg.a > 0.5) {
              checked++;
              const ratio = w.__arkRatio(fg, bg);
              const large = size >= 24 || (size >= 18.66 && Number(cs.fontWeight) >= 700);
              if (ratio < (large ? 3 : 4.5) && fails.length < 12) fails.push({ text: t.slice(0, 50), ratio: Math.round(ratio * 100) / 100, fg: cs.color, bg: `rgb(${bg.r}, ${bg.g}, ${bg.b})`, large });
            }
          }
        }
        for (const el of [...document.querySelectorAll("section, header, footer, main > *, body > div > div")].slice(0, 60)) {
          const c = w.__arkRgb(getComputedStyle(el).backgroundColor);
          if (c && c.a > 0.5) { const k = `rgb(${c.r}, ${c.g}, ${c.b})`; bgs.set(k, (bgs.get(k) ?? 0) + 1); }
        }
        const btns = new Map<string, { count: number; sample: string }>();
        for (const el of [...document.querySelectorAll('button, input[type="submit"], a[class*="btn" i], a[class*="button" i], [role="button"]')].slice(0, 200)) {
          const v = w.__arkVis(el);
          if (!v) continue;
          const cs = v.cs;
          const sig = `${cs.backgroundColor}|${cs.borderRadius}|${Math.round(parseFloat(cs.fontSize))}px|${cs.borderTopWidth} ${cs.borderTopStyle}`;
          const cur = btns.get(sig) ?? { count: 0, sample: (el.textContent ?? "").trim().slice(0, 30) };
          cur.count++;
          btns.set(sig, cur);
        }
        const pads = [...new Set([...document.querySelectorAll("section, main > section, main > div, body > section")].slice(0, 60).map((el) => Math.round(parseFloat(getComputedStyle(el).paddingTop))).filter((x) => x > 0))];
        let ctaContrast: { text: string; ratio: number } | undefined;
        for (const el of document.querySelectorAll("a[href], button")) {
          const v = w.__arkVis(el);
          if (!v || v.r.top > H || !w.__arkCta.test(el.textContent ?? "")) continue;
          const own = w.__arkRgb(v.cs.backgroundColor);
          const around = el.parentElement ? w.__arkBg(el.parentElement) : null;
          if (own && own.a >= 0.9 && around) ctaContrast = { text: (el.textContent ?? "").trim().slice(0, 40), ratio: Math.round(w.__arkRatio(own, around) * 100) / 100 };
          break;
        }
        const top = <K,>(m: Map<K, number>) => [...m.entries()].sort((a, b) => b[1] - a[1]);
        const h1 = document.querySelector("h1");
        const median = lhs.sort((a, b) => a - b)[Math.floor(lhs.length / 2)];
        return {
          fontFamilies: top(fam).slice(0, 8).map(([family, c]) => ({ family, count: c })),
          fontSizes: top(sizes).slice(0, 30).map(([size, c]) => ({ size, count: c })),
          bodySize: top(bodySizes)[0]?.[0],
          h1Size: h1 ? Math.round(parseFloat(getComputedStyle(h1).fontSize)) : undefined,
          lineHeightRatio: median ? Math.round(median * 100) / 100 : undefined,
          textColors: top(colors).slice(0, 20).map(([color, c]) => ({ color, count: c })),
          bgColors: top(bgs).slice(0, 12).map(([color, c]) => ({ color, count: c })),
          buttonStyles: [...btns.entries()].sort((a, b) => b[1].count - a[1].count).slice(0, 10).map(([signature, v]) => ({ signature, count: v.count, sample: v.sample })),
          contrastFails: fails, contrastChecked: checked, sectionPaddings: pads.slice(0, 30), ctaContrast,
        };
      });
    }

    // Scroll through the page so lazy images load, then measure images.
    if (!opts.lite) {
      await page.evaluate(async () => {
        const step = innerHeight * 0.9;
        for (let y = 0; y < Math.min(document.body.scrollHeight, 25000); y += step) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 120)); }
        window.scrollTo(0, 0);
      }).catch(() => {});
      await page.waitForTimeout(800);
    }
    await Promise.all(pending.splice(0));
    const bytesBy = new Map(rows.map((r) => [r.url, r]));

    let images: BrowserImage[] | undefined;
    let bgImages: BrowserRun["bgImages"];
    let fonts: BrowserRun["fonts"];
    let fontDisplay: BrowserRun["fontDisplay"];
    if (!opts.lite) {
      const imgRaw = await page.evaluate(() => {
        const H = innerHeight, W = innerWidth;
        const imgs = [...document.images].slice(0, 150).map((img, i) => {
          const r = img.getBoundingClientRect();
          const top = r.top + scrollY;
          const s = `${img.currentSrc || img.src} ${img.alt} ${typeof img.className === "string" ? img.className : ""}`;
          const role = /logo/i.test(s) || (!!img.closest("header") && r.height < 120) ? "logo" : r.width <= 64 && r.height <= 64 ? "icon" : img.closest('[class*="product" i]') ? "product" : i < 8 && top < H && r.width >= W * 0.5 ? "hero" : "content";
          return { src: img.currentSrc || img.src, naturalW: img.naturalWidth, naturalH: img.naturalHeight, renderedW: Math.round(r.width), renderedH: Math.round(r.height), alt: img.getAttribute("alt"), lazy: img.loading === "lazy", inViewport: top < H, broken: img.complete && img.naturalWidth === 0 && !!(img.currentSrc || img.src), hasDims: img.hasAttribute("width") && img.hasAttribute("height"), srcset: !!img.srcset || img.parentElement?.tagName === "PICTURE", role };
        });
        const bg: { url: string; w: number; h: number }[] = [];
        for (const el of [...document.body.querySelectorAll("*")].slice(0, 2500)) {
          if (bg.length >= 20) break;
          const b = getComputedStyle(el).backgroundImage;
          const m = b && b !== "none" ? b.match(/url\(["']?([^"')]+)["']?\)/) : null;
          if (!m) continue;
          const r = el.getBoundingClientRect();
          if (r.width >= 200 && r.height >= 150) bg.push({ url: m[1], w: Math.round(r.width), h: Math.round(r.height) });
        }
        const fonts: { family: string; weight: string; style: string; status: string }[] = [];
        document.fonts.forEach((f) => fonts.push({ family: f.family.replace(/["']/g, ""), weight: f.weight, style: f.style, status: f.status }));
        let display: { family: string; display: string }[] | null = [];
        let readable = 0, blocked = 0;
        for (const sh of [...document.styleSheets]) {
          try {
            for (const rule of [...sh.cssRules]) if (rule instanceof CSSFontFaceRule) display.push({ family: rule.style.getPropertyValue("font-family").replace(/["']/g, ""), display: rule.style.getPropertyValue("font-display") || "auto" });
            readable++;
          } catch { blocked++; }
        }
        if (!readable && blocked) display = null;
        return { imgs, bg, fonts, display };
      });
      const fmt = (url: string) => {
        if (url.startsWith("data:image/")) return url.slice(11, url.search(/[;,]/));
        const ext = url.split("?")[0].match(/\.(avif|webp|jpe?g|png|gif|svg)$/i)?.[1]?.toLowerCase();
        return ext === "jpeg" ? "jpg" : ext ?? "unknown";
      };
      images = imgRaw.imgs.map((i) => ({ ...i, role: i.role as BrowserImage["role"], bytes: bytesBy.get(i.src)?.bytes, format: fmt(i.src) }));
      bgImages = imgRaw.bg.map((x) => { let url = x.url; try { url = new URL(x.url, u).toString(); } catch {} return { ...x, url }; });
      const seenFont = new Set<string>();
      fonts = imgRaw.fonts.filter((f) => { const k = `${f.family}|${f.weight}|${f.style}`; if (seenFont.has(k)) return false; seenFont.add(k); return true; }).slice(0, 40);
      fontDisplay = imgRaw.display ? imgRaw.display.slice(0, 40) : null;
    }

    let jsCov: Map<string, { total: number; unused: number }> | undefined;
    let cssCov: Map<string, { total: number; unused: number }> | undefined;
    if (opts.coverage) {
      const [js, css] = await Promise.all([page.coverage.stopJSCoverage(), page.coverage.stopCSSCoverage()]);
      jsCov = new Map();
      for (const e of js) {
        if (!e.url || !e.source) continue;
        const total = e.source.length;
        const used = disjointUsed(e.functions);
        const cur = jsCov.get(e.url) ?? { total: 0, unused: 0 };
        jsCov.set(e.url, { total: cur.total + total, unused: cur.unused + Math.max(0, total - used) });
      }
      cssCov = new Map();
      for (const e of css) {
        if (!e.url || !e.text) continue;
        const used = e.ranges.reduce((a, r) => a + (r.end - r.start), 0);
        cssCov.set(e.url, { total: e.text.length, unused: Math.max(0, e.text.length - used) });
      }
    }

    // Resource totals
    const byType: Record<string, { count: number; bytes: number }> = {};
    let third = 0, thirdN = 0, uncached = 0, statics = 0, uncompressed = 0, transfer = 0;
    for (const r of rows) {
      const t = ["script", "stylesheet", "image", "font", "document", "media", "fetch", "xhr"].includes(r.type) ? (r.type === "fetch" || r.type === "xhr" ? "data" : r.type) : "other";
      byType[t] = { count: (byType[t]?.count ?? 0) + 1, bytes: (byType[t]?.bytes ?? 0) + r.bytes };
      transfer += r.bytes;
      if (r.thirdParty) { third += r.bytes; thirdN++; }
      if (["script", "stylesheet", "image", "font"].includes(r.type) && !r.thirdParty) { statics++; if (!r.cacheable) uncached++; }
      if (["script", "stylesheet", "document"].includes(r.type) && !r.thirdParty && r.bytes > 20_000 && !r.encoding) uncompressed++;
    }
    const scripts = rows.filter((r) => r.type === "script").map((r) => {
      const cov = jsCov?.get(r.url);
      return { url: r.url, bytes: r.bytes, thirdParty: r.thirdParty, purpose: scriptPurpose(r.url), unusedBytes: cov && cov.total ? Math.round(r.bytes * (cov.unused / cov.total)) : undefined, blocking: perf.scripts.some((s) => s.src === r.url && s.blocking) };
    }).sort((a, b) => b.bytes - a.bytes).slice(0, 40);
    const stylesheets = rows.filter((r) => r.type === "stylesheet").map((r) => {
      const cov = cssCov?.get(r.url);
      return { url: r.url, bytes: r.bytes, unusedBytes: cov && cov.total ? Math.round(r.bytes * (cov.unused / cov.total)) : undefined, blocking: perf.sheets.some((s) => s.href === r.url && s.blocking) };
    }).sort((a, b) => b.bytes - a.bytes).slice(0, 25);

    let axeOut: BrowserRun["axe"];
    const axeJs = opts.axe ? getAxe() : null;
    if (axeJs) {
      try {
        await page.addScriptTag({ content: axeJs });
        axeOut = await page.evaluate(async () => {
          const ax = (window as unknown as { axe: { run: (ctx: Document, o: object) => Promise<{ violations: { id: string; impact: string; help: string; tags: string[]; nodes: { target: string[] }[] }[]; passes: unknown[]; incomplete: unknown[] }> } }).axe;
          const r = await ax.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"] }, resultTypes: ["violations"] });
          return { violations: r.violations.map((v) => ({ id: v.id, impact: v.impact ?? "minor", help: v.help, nodes: v.nodes.length, sample: (v.nodes[0]?.target ?? []).join(" ").slice(0, 120), tags: v.tags.filter((t) => /^wcag/.test(t)) })), passes: r.passes.length, incomplete: r.incomplete.length };
        });
      } catch {}
    }

    if (opts.screenshot) shots[`${opts.viewport}:${u.pathname}`] = await screenshot(page, opts.viewport === "desktop" ? 50 : 55);
    if (opts.viewport === "mobile" && mobile && mobile.overflowPx > 5 && !opts.screenshot) shots[`mobile:${u.pathname}`] = await screenshot(page, 50);

    const protocols: Record<string, number> = {};
    if (perf.protocol) protocols[perf.protocol] = 1;

    const run: BrowserRun = {
      url: opts.url,
      viewport: opts.viewport,
      ok: !!resp && resp.status() < 400,
      error: resp && resp.status() >= 400 ? `HTTP ${resp.status()}` : undefined,
      metrics: {
        ttfb: perf.ttfb, fcp: perf.fcp, lcp: perf.lcp, lcpElement: perf.lcpElement, cls: perf.cls, tbt: perf.tbt, load: perf.load,
        domNodes: perf.domNodes, requests: rows.length, transferBytes: transfer, byType, thirdPartyBytes: third, thirdPartyRequests: thirdN,
        protocols, uncachedStatic: uncached, staticCount: statics, uncompressedText: uncompressed,
      },
      resources: rows.sort((a, b) => b.bytes - a.bytes).slice(0, 60),
      scripts, stylesheets, images, bgImages, fonts,
      fontFiles: rows.filter((r) => r.type === "font").map((r) => ({ url: r.url, bytes: r.bytes, format: r.url.split("?")[0].split(".").pop()?.toLowerCase() ?? "" })).slice(0, 30),
      fontDisplay, consoleErrors, renderedWords: perf.words, mobile, design, firstViewport, axe: axeOut,
      screenshot: Object.keys(shots)[0],
    };
    return { run, shots };
  } finally {
    await ctx.close().catch(() => {});
    scheduleClose();
  }
}

function withTimeout<T>(p: Promise<T>, ms: number, what: string): Promise<T> {
  return Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new AnalyzeError(`${what} timed out`)), ms))]);
}

export function runBrowser(opts: RunOpts) {
  return exclusive(() => withTimeout(runOnce(opts), 52_000, "Browser check")).catch((e) => ({
    run: { url: opts.url, viewport: opts.viewport, ok: false, error: e instanceof AnalyzeError ? e.message : `Browser check failed: ${(e as Error).message.split("\n")[0].slice(0, 160)}` } as BrowserRun,
    shots: {} as Record<string, string>,
  }));
}

const WIDTHS = [320, 375, 390, 414, 768, 1024, 1280, 1440];

export function runBreakpoints(url: string): Promise<{ rows: BreakpointRow[]; shots: Record<string, string> }> {
  return exclusive(() => withTimeout((async () => {
    const u = normalizeUrl(url);
    await guardHost(u);
    if (!(await robotsCheck(u))) throw new AnalyzeError("robots.txt asks automated tools not to read this page.");
    const b = await getBrowser();
    const ctx = await newContext(b, "plain");
    const shots: Record<string, string> = {};
    try {
      const page = await ctx.newPage();
      await page.goto(u.toString(), { waitUntil: "load", timeout: 30_000 });
      await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});
      await page.addScriptTag({ content: HELPERS }).catch(() => page.evaluate(HELPERS));
      const rows: BreakpointRow[] = [];
      for (const width of WIDTHS) {
        await page.setViewportSize({ width, height: 900 });
        await page.waitForTimeout(600);
        const m = await page.evaluate(() => {
          const w = window as unknown as { __arkDesc: (e: Element) => string };
          const W = innerWidth;
          const clipped = (el: Element) => { let e = el.parentElement; while (e && e !== document.body) { const o = getComputedStyle(e).overflowX; if (o === "hidden" || o === "auto" || o === "scroll" || o === "clip") return true; e = e.parentElement; } return false; };
          const offenders = [...document.body.querySelectorAll("*")].slice(0, 4000).map((el) => ({ el, r: el.getBoundingClientRect() })).filter(({ el, r }) => r.width > 0 && r.right > W + 2 && !clipped(el)).sort((a, b) => b.r.right - a.r.right).slice(0, 4).map(({ el, r }) => `${w.__arkDesc(el)} (+${Math.round(r.right - W)}px)`);
          return { overflowPx: Math.max(0, document.documentElement.scrollWidth - W), offenders };
        });
        const row: BreakpointRow = { width, ok: true, overflowPx: m.overflowPx, offenders: m.offenders };
        if ([390, 768, 1440].includes(width) || m.overflowPx > 5) {
          const key = `bp:${width}`;
          shots[key] = await screenshot(page, 45);
          row.screenshot = key;
        }
        rows.push(row);
      }
      return { rows, shots };
    } finally {
      await ctx.close().catch(() => {});
      scheduleClose();
    }
  })(), 52_000, "Breakpoint test"));
}
