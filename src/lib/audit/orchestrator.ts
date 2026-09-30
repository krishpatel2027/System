import type { AiAnalysis, AuditRaw, BreakpointRow, BrowserRun, LinkCheck, PageData, PageSpeedData, SiteData } from "./types";
import { crawlKey, crawlable, importance, sameSite } from "./urls";

// Drives a deep audit step by step. Each step is a short server call, so no
// single request runs long (serverless-safe) and results appear progressively.
// The transport is injected: the app uses the /api/audit/* endpoints.

export type StageId = "connect" | "tech" | "crawl" | "structure" | "performance" | "mobile" | "seo" | "accessibility" | "ux" | "conversion" | "content" | "security" | "leadgen" | "opportunity";
export const STAGES: { id: StageId; label: string }[] = [
  { id: "connect", label: "Connecting to website" },
  { id: "tech", label: "Detecting technology" },
  { id: "crawl", label: "Crawling pages" },
  { id: "structure", label: "Analyzing page structure" },
  { id: "performance", label: "Testing performance" },
  { id: "mobile", label: "Checking mobile experience" },
  { id: "seo", label: "Analyzing SEO" },
  { id: "accessibility", label: "Inspecting accessibility" },
  { id: "ux", label: "Evaluating UX & checking links" },
  { id: "conversion", label: "Detecting conversion opportunities" },
  { id: "content", label: "Analyzing content" },
  { id: "security", label: "Checking security" },
  { id: "leadgen", label: "Evaluating lead generation" },
  { id: "opportunity", label: "Building Arkria opportunity report" },
];

export type StageStatus = "pending" | "running" | "done" | "skipped" | "failed";
export interface StageState { status: StageStatus; detail?: string; progress?: { done: number; total: number } }

export interface Transport {
  site(url: string): Promise<{ site: SiteData; start: string }>;
  page(url: string, rootHost: string, depth: number): Promise<PageData>;
  browser(url: string, viewport: "mobile" | "desktop", full: boolean): Promise<{ run: BrowserRun; shots: Record<string, string> } | { unavailable: string }>;
  breakpoints(url: string): Promise<{ rows: BreakpointRow[]; shots: Record<string, string> } | { unavailable: string }>;
  pagespeed(url: string): Promise<PageSpeedData>;
  links(links: { url: string; foundOn: string }[]): Promise<LinkCheck[]>;
  ai(input: { url: string; desktopShot?: string; mobileShot?: string; pages: { url: string; title?: string; h1?: string; text: string }[]; facts: string[] }): Promise<AiAnalysis | { disabled: true } | { error: string }>;
}

export interface RunOptions {
  url: string;
  crawlLimit: number;
  light?: boolean; // competitor mode: fewer pages, no breakpoints/PageSpeed/AI
  capabilities: { browser: boolean; ai: boolean };
  onStage?: (id: StageId, s: StageState) => void;
  onRaw?: (raw: AuditRaw) => void;
  cancelled?: () => boolean;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function runAudit(t: Transport, o: RunOptions): Promise<AuditRaw> {
  const stage = (id: StageId, s: StageState) => o.onStage?.(id, s);
  const raw: AuditRaw = { site: null as unknown as SiteData, pages: [], browser: [], breakpoints: [], pagespeed: null, links: [], ai: null, screenshots: {}, notes: [], browserAvailable: o.capabilities.browser };
  const emit = () => o.onRaw?.({ ...raw, pages: [...raw.pages], browser: [...raw.browser] });

  // 1. Connect
  stage("connect", { status: "running" });
  const { site, start } = await t.site(o.url);
  raw.site = site;
  const root = new URL(start);
  stage("connect", { status: "done", detail: `${site.https ? "HTTPS" : "HTTP"} · ${root.hostname}${site.robots.found ? " · robots.txt found" : ""}${site.sitemap.found ? ` · sitemap (${site.sitemap.count} URLs)` : ""}` });

  // 2. Homepage + technology
  stage("tech", { status: "running" });
  const home = await t.page(start, root.hostname, 0);
  raw.pages.push(home);
  if (!home.ok) throw new Error(home.error ?? `The homepage returned HTTP ${home.status}.`);
  stage("tech", { status: "done", detail: home.tech.length ? home.tech.slice(0, 4).map((x) => x.name).join(", ") + (home.tech.length > 4 ? ` +${home.tech.length - 4}` : "") : "Nothing identifiable in the homepage" });
  emit();

  // 3. Crawl
  const limit = Math.max(1, Math.min(100, o.crawlLimit));
  stage("crawl", { status: "running", progress: { done: 1, total: limit } });
  const seen = new Set<string>([crawlKey(new URL(home.finalUrl)), crawlKey(root)]);
  const queue: { url: string; depth: number; score: number }[] = [];
  const enqueue = (href: string, depth: number, fromSitemap: boolean) => {
    let u: URL;
    try { u = new URL(href); } catch { return; }
    if (!sameSite(u, root) || !crawlable(u) || depth > 4) return;
    const k = crawlKey(u);
    if (seen.has(k)) return;
    seen.add(k);
    queue.push({ url: u.toString(), depth, score: importance(u, depth, fromSitemap) });
  };
  home.internalLinks.forEach((l) => enqueue(l.url, 1, false));
  site.sitemap.urls.slice(0, 300).forEach((u) => enqueue(u, 2, true));
  const delay = site.robots.crawlDelay ? Math.min(5, site.robots.crawlDelay) * 1000 : 0;
  const workers = delay ? 1 : 3;
  let done = 1;
  await Promise.all(Array.from({ length: workers }, async () => {
    while (raw.pages.length < limit && queue.length && !o.cancelled?.()) {
      queue.sort((a, b) => b.score - a.score);
      const next = queue.shift()!;
      if (delay) await sleep(delay);
      const p = await t.page(next.url, root.hostname, next.depth).catch((e) => ({ ...home, url: next.url, finalUrl: next.url, ok: false, status: 0, error: String((e as Error).message) } as PageData));
      if (raw.pages.length >= limit) break;
      // A redirect can land on an already-crawled URL.
      if (p.ok && p.finalUrl !== next.url && raw.pages.some((x) => crawlKey(new URL(x.finalUrl)) === crawlKey(new URL(p.finalUrl)))) continue;
      raw.pages.push(p);
      done++;
      if (p.ok) p.internalLinks.forEach((l) => enqueue(l.url, next.depth + 1, false));
      stage("crawl", { status: "running", progress: { done, total: Math.min(limit, done + queue.length) }, detail: new URL(p.finalUrl).pathname });
      if (done % 3 === 0) emit();
    }
  }));
  const okPages = raw.pages.filter((p) => p.ok).length;
  stage("crawl", { status: "done", detail: `${okPages} page${okPages === 1 ? "" : "s"} read${raw.pages.length > okPages ? `, ${raw.pages.length - okPages} with errors` : ""}${queue.length ? ` · ${queue.length} more found (crawl limit ${limit})` : ""}` });
  stage("structure", { status: "done", detail: `${raw.pages.reduce((a, p) => a + p.internalLinks.length, 0)} internal links mapped` });
  emit();

  const addRun = (r: Awaited<ReturnType<Transport["browser"]>>) => {
    if ("unavailable" in r) return;
    raw.browser.push(r.run);
    Object.assign(raw.screenshots, r.shots);
  };

  // 4. Performance: PageSpeed (field + lab) and a real desktop render.
  stage("performance", { status: "running" });
  const perfJobs: Promise<void>[] = [];
  if (!o.light) perfJobs.push(t.pagespeed(home.finalUrl).then((p) => { raw.pagespeed = p; if (!p.ok) raw.notes.push(`Google PageSpeed: ${p.error}`); }).catch(() => { raw.notes.push("Google PageSpeed couldn't be reached."); }));
  if (o.capabilities.browser) perfJobs.push(t.browser(home.finalUrl, "desktop", true).then(addRun).catch(() => { raw.notes.push("The desktop browser check failed."); }));
  await Promise.all(perfJobs);
  const desk = raw.browser.find((b) => b.viewport === "desktop");
  stage("performance", { status: "done", detail: [raw.pagespeed?.ok ? `PageSpeed ${raw.pagespeed.scores?.performance}/100` : null, desk?.ok && desk.metrics?.lcp ? `LCP ${(desk.metrics.lcp / 1000).toFixed(1)}s (Arkria browser)` : null, desk && !desk.ok ? desk.error : null].filter(Boolean).join(" · ") || "Server timing only" });
  emit();

  // 5. Mobile: real phone render, key pages, breakpoints.
  stage("mobile", { status: "running" });
  if (o.capabilities.browser) {
    await t.browser(home.finalUrl, "mobile", true).then(addRun).catch(() => raw.notes.push("The mobile browser check failed."));
    if (!o.light) {
      const key = raw.pages.filter((p) => p.ok && p !== home && /\/(contact|services?|book|appointment|products?|shop)/i.test(new URL(p.finalUrl).pathname)).slice(0, 2);
      for (const p of key) await t.browser(p.finalUrl, "mobile", false).then(addRun).catch(() => {});
      const bp = await t.breakpoints(home.finalUrl).catch(() => null);
      if (bp && !("unavailable" in bp)) { raw.breakpoints = bp.rows; Object.assign(raw.screenshots, bp.shots); }
    }
    const mob = raw.browser.find((b) => b.viewport === "mobile");
    stage("mobile", { status: "done", detail: mob?.ok ? `Rendered at 390px${raw.breakpoints.length ? ` · ${raw.breakpoints.length} breakpoints tested` : ""}` : mob?.error ?? "Browser check failed" });
  } else {
    raw.notes.push("Browser-based checks (rendering, Core Web Vitals lab data, screenshots, breakpoints, contrast, axe-core) were not run: no Chrome/Edge browser on this server.");
    stage("mobile", { status: "done", detail: "HTML checks only — no browser available" });
  }
  emit();

  stage("seo", { status: "done", detail: `${raw.pages.filter((p) => p.ok && p.title).length}/${okPages} pages with titles · ${[...new Set(raw.pages.flatMap((p) => p.schema.types))].length} schema types` });
  const axe = desk?.axe;
  stage("accessibility", { status: "done", detail: axe ? `${axe.violations.length} automated rule violations (axe-core)` : "HTML checks only" });

  // 6. Links (broken outbound links on the crawled pages).
  stage("ux", { status: "running" });
  if (!o.light) {
    const ext = new Map<string, string>();
    for (const p of raw.pages.filter((x) => x.ok)) for (const l of p.externalLinks) if (!ext.has(l.url) && !/wa\.me|whatsapp|tel:|mailto:|facebook\.com\/sharer|twitter\.com\/intent|linkedin\.com\/share/i.test(l.url)) ext.set(l.url, p.finalUrl);
    raw.links = await t.links([...ext.entries()].slice(0, 25).map(([url, foundOn]) => ({ url, foundOn }))).catch(() => []);
  }
  stage("ux", { status: "done", detail: raw.links.length ? `${raw.links.filter((l) => !l.ok).length} broken of ${raw.links.length} outbound links checked` : "Navigation and journeys mapped" });
  stage("conversion", { status: "done" });

  // 7. Content (optional AI interpretation).
  if (!o.light && o.capabilities.ai) {
    stage("content", { status: "running", detail: "AI analysis of screenshots and copy" });
    const shotFor = (vp: string) => raw.browser.find((b) => b.viewport === vp && b.screenshot)?.screenshot;
    const d = shotFor("desktop"), m = shotFor("mobile");
    const facts = [
      `Pages read: ${okPages}`,
      ...(desk?.metrics?.lcp ? [`Largest Contentful Paint (Arkria browser, desktop): ${(desk.metrics.lcp / 1000).toFixed(1)}s`] : []),
      `Contact options found: ${[...new Set(raw.pages.flatMap((p) => p.ctas.map((c) => c.kind)))].join(", ") || "none"}`,
      `Forms found: ${raw.pages.flatMap((p) => p.forms).filter((f) => f.purpose !== "search").length}`,
    ];
    const ai = await t.ai({ url: home.finalUrl, desktopShot: d ? raw.screenshots[d] : undefined, mobileShot: m ? raw.screenshots[m] : undefined, pages: raw.pages.filter((p) => p.ok).slice(0, 6).map((p) => ({ url: p.finalUrl, title: p.title, h1: p.headings.h1[0], text: p.text })), facts }).catch((e) => ({ error: (e as Error).message }));
    if ("firstImpression" in ai) { raw.ai = ai; stage("content", { status: "done", detail: "Includes AI ANALYSIS" }); }
    else { if ("error" in ai) raw.notes.push(`AI analysis unavailable: ${ai.error}`); stage("content", { status: "done", detail: "Rule-based (AI unavailable)" }); }
  } else stage("content", { status: "done", detail: o.light ? undefined : "Rule-based (AI not configured)" });

  stage("security", { status: "done", detail: `${site.https ? (site.tls?.valid ? "Valid certificate" : "Certificate problem") : "No HTTPS"}` });
  stage("leadgen", { status: "done" });
  emit();
  return raw;
}

// Keeps the saved record under hosting upload limits.
export function trimForStorage<T extends { raw: AuditRaw; competitors: { raw: AuditRaw }[] }>(rec: T, maxBytes = 3_800_000): T {
  const size = () => JSON.stringify(rec).length;
  if (size() <= maxBytes) return rec;
  const all = [rec.raw, ...rec.competitors.map((c) => c.raw)];
  for (const r of all) for (const k of Object.keys(r.screenshots)) if (k.startsWith("bp:") && !r.breakpoints.some((b) => b.screenshot === k && b.overflowPx > 5)) { delete r.screenshots[k]; r.breakpoints.forEach((b) => { if (b.screenshot === k) b.screenshot = undefined; }); }
  if (size() <= maxBytes) return rec;
  for (const r of all.slice(1)) r.screenshots = {};
  if (size() <= maxBytes) return rec;
  for (const r of all) for (const p of r.pages) { p.text = p.text.slice(0, 400); p.internalLinks = p.internalLinks.slice(0, 40); p.externalLinks = p.externalLinks.slice(0, 10); }
  for (const r of all) for (const b of r.browser) { b.resources = b.resources?.slice(0, 20); }
  if (size() <= maxBytes) return rec;
  for (const r of all) for (const k of Object.keys(r.screenshots)) if (k.startsWith("bp:")) delete r.screenshots[k];
  return rec;
}
