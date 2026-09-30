import { createHash } from "node:crypto";
import { parse, type HTMLElement } from "node-html-parser";
import type { Cta, CtaKind, FormInfo, PageData } from "../types";
import { detectTech } from "../technology";
import { AnalyzeError, guardedFetch, readCapped, robotsCheck } from "./net";
import { sameSite } from "../urls";

// Fetches one public page (robots.txt respected) and extracts everything the
// analyzers need from its HTML and response headers. Forms are never submitted.

const KEEP_HEADERS = [
  "content-type", "content-encoding", "cache-control", "server", "x-powered-by", "strict-transport-security",
  "content-security-policy", "x-content-type-options", "referrer-policy", "permissions-policy", "x-frame-options",
  "cf-ray", "x-vercel-id", "x-nf-request-id", "x-amz-cf-id", "x-served-by", "x-cache", "x-generator", "x-aspnet-version",
  "x-shopid", "x-wix-request-id", "x-firebase-hosting", "via", "age", "last-modified", "etag", "x-robots-tag",
];

const clean = (s: string) => s.replace(/\s+/g, " ").trim();

function visibleText(markup: string) {
  return markup
    .replace(/<(script|style|noscript|template|svg)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&copy;/gi, "©").replace(/&#169;/g, "©").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/&#64;|&commat;/gi, "@").replace(/&#39;|&apos;/gi, "'").replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function ctaKind(text: string, href: string): CtaKind | null {
  const t = `${text} ${href}`.toLowerCase();
  if (/^tel:/.test(href)) return "call";
  if (/wa\.me\/|api\.whatsapp\.com|whatsapp:\/\/|web\.whatsapp\.com/.test(href)) return "whatsapp";
  if (/^mailto:/.test(href)) return "email";
  if (/\b(book|appointment|schedule|reserve|reservation|table booking)\b/.test(t)) return "booking";
  if (/\b(demo)\b/.test(t)) return "demo";
  if (/\b(get (a )?(free )?(quote|estimate|proposal)|request (a )?(quote|callback|call back)|enquire|enquiry|inquire|inquiry)\b/.test(t)) return "quote";
  if (/\b(buy now|shop now|add to (cart|bag)|order now|order online)\b/.test(t)) return "buy";
  if (/\b(sign ?up|start (free|now|your)|try (it )?(free|now)|get started|create (an )?account|register)\b/.test(t)) return "signup";
  if (/\b(download|brochure|catalog(ue)?)\b/.test(text.toLowerCase())) return "download";
  if (/\b(contact|get in touch|talk to|let'?s talk|call (us|now)|whatsapp|chat with|free consultation|consult)\b/.test(t)) return "contact";
  return null;
}

function formInfo(f: HTMLElement, root: HTMLElement): FormInfo {
  const attr = (el: HTMLElement, a: string) => el.getAttribute(a)?.trim() ?? "";
  const ids = new Set(root.querySelectorAll("label[for]").map((l) => attr(l, "for")));
  const inputs = f.querySelectorAll("input, textarea, select").filter((i) => !/^(hidden|submit|button|reset|image)$/i.test(attr(i, "type")));
  const fields = inputs.map((i) => {
    const type = (i.tagName === "INPUT" ? attr(i, "type") || "text" : i.tagName.toLowerCase()).toLowerCase();
    const id = attr(i, "id");
    const wrapped = !!i.closest("label");
    const label = (id && ids.has(id)) || wrapped || !!attr(i, "aria-label") || !!attr(i, "aria-labelledby") || !!attr(i, "title");
    return {
      name: attr(i, "name") || attr(i, "id") || attr(i, "placeholder") || type,
      type,
      label,
      placeholderOnly: !label && !!attr(i, "placeholder"),
      required: i.getAttribute("required") !== undefined || attr(i, "aria-required") === "true",
      autocomplete: !!attr(i, "autocomplete") && attr(i, "autocomplete") !== "off",
    };
  });
  const html = f.toString().toLowerCase();
  const text = `${attr(f, "id")} ${attr(f, "class")} ${attr(f, "action")} ${attr(f, "role")} ${fields.map((x) => x.name).join(" ")}`.toLowerCase();
  const submit = f.querySelector('button[type=submit], input[type=submit], button:not([type])');
  const submitText = clean(submit ? submit.textContent || attr(submit, "value") : "");
  const purpose: FormInfo["purpose"] =
    /search|\bq\b|\bs\b/.test(text) && fields.length <= 2 ? "search"
      : /password/.test(fields.map((x) => x.type).join(" ")) ? "login"
        : /newsletter|subscribe|mailchimp|mc-embedded/.test(text + submitText.toLowerCase()) && fields.length <= 3 ? "newsletter"
          : /checkout|billing|payment/.test(text) ? "checkout"
            : /book|appointment|reserv|date/.test(text + submitText.toLowerCase()) ? "booking"
              : fields.some((x) => x.type === "email" || x.type === "tel" || /mail|phone|mobile|name|message/.test(x.name.toLowerCase())) ? "contact" : "other";
  return {
    purpose,
    fields,
    captcha: /g-recaptcha|recaptcha|h-captcha|cf-turnstile|captcha/.test(html),
    honeypot: /honeypot|hp-|_gotcha|ak_hp|wpcf7-hp|display:\s*none/.test(html) && inputs.length > 0,
    submitText,
    action: attr(f, "action"),
  };
}

function schemaTypes(root: HTMLElement) {
  const types = new Set<string>();
  let invalid = 0;
  const walk = (v: unknown) => {
    if (Array.isArray(v)) return v.forEach(walk);
    if (v && typeof v === "object") {
      const o = v as Record<string, unknown>;
      const t = o["@type"];
      if (typeof t === "string") types.add(t);
      if (Array.isArray(t)) t.forEach((x) => typeof x === "string" && types.add(x));
      if (o["@graph"]) walk(o["@graph"]);
      for (const k of ["mainEntity", "itemListElement", "offers", "aggregateRating", "review", "address"]) if (o[k]) walk(o[k]);
    }
  };
  for (const s of root.querySelectorAll('script[type="application/ld+json"]')) {
    try { walk(JSON.parse(s.textContent)); } catch { invalid++; }
  }
  for (const el of root.querySelectorAll("[itemtype]")) {
    const t = el.getAttribute("itemtype")?.split("/").pop();
    if (t) types.add(t);
  }
  return { types: [...types], invalid };
}

export function extractPage(html: string, ctx: { url: string; finalUrl: string; status: number; depth: number; headers: Record<string, string>; ttfbMs?: number; htmlBytes: number; redirects: { url: string; status: number }[]; rootHost: string }): PageData {
  const root = parse(html, { comment: false, blockTextElements: { script: true, style: true, noscript: false, pre: true } });
  const $ = (s: string) => root.querySelector(s);
  const $$ = (s: string) => root.querySelectorAll(s);
  const attr = (el: HTMLElement | null, a: string) => el?.getAttribute(a)?.trim() ?? "";
  const base = new URL(ctx.finalUrl);
  const rootHost = new URL(`https://${ctx.rootHost}`);
  const body = $("body") ?? root;
  const text = visibleText(body.toString());
  const lower = text.toLowerCase();
  const headersLower = Object.fromEntries(Object.entries(ctx.headers).map(([k, v]) => [k.toLowerCase(), v]));

  // Links
  const internal: { url: string; text: string }[] = [];
  const external: { url: string; text: string }[] = [];
  let genericAnchors = 0;
  const allHrefs: string[] = [];
  for (const a of $$("a[href]")) {
    const href = attr(a, "href");
    allHrefs.push(href);
    const t = clean(a.textContent || attr(a, "aria-label") || attr(a, "title"));
    if (/^(click here|here|read more|more|learn more|link)$/i.test(t)) genericAnchors++;
    let u: URL;
    try { u = new URL(href, base); } catch { continue; }
    if (!/^https?:$/.test(u.protocol)) continue;
    u.hash = "";
    (sameSite(u, rootHost) ? internal : external).push({ url: u.toString(), text: t.slice(0, 80) });
  }
  const uniq = <T extends { url: string }>(l: T[]) => [...new Map(l.map((x) => [x.url, x])).values()];

  // Headings
  const hs = $$("h1, h2, h3, h4, h5, h6");
  let skips = 0;
  let prev = 0;
  for (const h of hs) {
    const lvl = Number(h.tagName[1]);
    if (prev && lvl > prev + 1) skips++;
    prev = lvl;
  }
  const hText = (tag: string) => $$(tag).map((h) => clean(h.textContent)).filter(Boolean);

  // Images
  const images = $$("img").map((i) => {
    const src = attr(i, "src") || attr(i, "data-src") || attr(i, "data-lazy-src");
    let abs = src;
    try { abs = new URL(src, base).toString(); } catch {}
    return { src: abs, alt: i.getAttribute("alt") === undefined ? null : attr(i, "alt"), width: attr(i, "width") || undefined, height: attr(i, "height") || undefined, loading: attr(i, "loading") || undefined, srcset: !!attr(i, "srcset") || !!i.closest("picture") };
  });

  // Scripts & styles
  const headEl = $("head");
  const inHead = (el: HTMLElement) => !!headEl && el.closest("head") === headEl;
  const scripts = $$("script").filter((s) => !/json|template|text\/x-/i.test(attr(s, "type"))).map((s) => {
    const src = attr(s, "src");
    let abs: string | undefined;
    if (src) { try { abs = new URL(src, base).toString(); } catch { abs = src; } }
    return { src: abs, inHead: inHead(s), async: s.getAttribute("async") !== undefined, defer: s.getAttribute("defer") !== undefined, module: attr(s, "type") === "module", inlineBytes: src ? undefined : s.textContent.length };
  });
  const stylesheets = $$('link[rel~="stylesheet"]').map((l) => { let h = attr(l, "href"); try { h = new URL(h, base).toString(); } catch {} return { href: h, inHead: inHead(l) }; });
  const styleText = $$("style").map((s) => s.textContent).join("\n");
  const mediaQueries = (styleText.match(/@media\b/g) ?? []).length;

  // Forms & CTAs
  const forms = $$("form").map((f) => formInfo(f, root));
  const headerEl = $("header") ?? $('[role="banner"]');
  const ctas: Cta[] = [];
  for (const el of [...$$("a[href]"), ...$$("button"), ...$$('input[type="submit"]')]) {
    const t = clean(el.textContent || attr(el, "value") || attr(el, "aria-label"));
    const href = attr(el, "href");
    if (!t && !href) continue;
    const kind = ctaKind(t, href);
    if (!kind) continue;
    ctas.push({ text: t.slice(0, 60) || href.slice(0, 60), href: href.slice(0, 200), kind, inHeader: !!headerEl && el.closest("header") === headerEl });
  }

  // Contact & local
  const telLinks = $$("a[href^='tel:']").map((a) => decodeURIComponent(attr(a, "href").slice(4)).replace(/[^\d+]/g, ""));
  const textPhones = [...text.matchAll(/(?:\+91[\s-]?|\b0)?[6-9]\d{4}[\s-]?\d{5}\b|\b0\d{2,4}[\s-]\d{6,8}\b/g)].map((m) => m[0].replace(/[^\d+]/g, ""));
  const phones = [...new Set([...telLinks, ...textPhones].filter((p) => p.replace(/\D/g, "").length >= 10))].slice(0, 5);
  const mails = [...$$("a[href^='mailto:']").map((a) => decodeURIComponent(attr(a, "href").slice(7).split("?")[0]).toLowerCase()), ...[...text.matchAll(/\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/gi)].map((m) => m[0].toLowerCase())];
  const emails = [...new Set(mails)].filter((e) => !/\.(png|jpe?g|gif|webp|svg)$/i.test(e) && !/example\.|sentry|wixpress|domain\.com/.test(e)).slice(0, 5);
  const wa = allHrefs.find((h) => /wa\.me\/|api\.whatsapp\.com|whatsapp:\/\/|web\.whatsapp\.com/i.test(h));
  const addr = text.match(/[A-Z0-9][^.|]{10,140}?\b\d{3}\s?\d{3}\b/)?.[0];
  const iframes = $$("iframe").map((f) => attr(f, "src") || attr(f, "data-src"));

  // Trust
  const socials = [...new Set(allHrefs.map((h) => h.match(/(instagram|facebook|linkedin|youtube|twitter|x|pinterest)\.com\//i)?.[1]?.toLowerCase()).filter((x): x is string => !!x))];
  const policies = [...new Set(allHrefs.concat($$("a").map((a) => a.textContent)).map((h) => h.toLowerCase().match(/privacy|terms|refund|return|shipping|cancellation|cookie/)?.[0]).filter((x): x is string => !!x))];
  const imgHosts = images.map((i) => i.src);

  const nav = $("nav") ?? $('[role="navigation"]');
  const navItems = nav ? nav.querySelectorAll("a").map((a) => clean(a.textContent)).filter((t) => t && t.length < 40) : [];
  const footer = $("footer") ?? $('[role="contentinfo"]');
  const years = [...text.matchAll(/(?:©|copyright)\s*(?:\d{4}\s*[-–]\s*)?(\d{4})/gi)].map((m) => parseInt(m[1], 10)).filter((y) => y > 1995 && y <= new Date().getFullYear() + 1);
  const legacy = ["font", "center", "marquee", "frameset", "blink"].filter((t) => $$(t).length);
  if ($$("embed, object").some((e) => /\.swf|shockwave/i.test(e.toString()))) legacy.push("flash");
  if ($$("table").some((t) => /width\s*=\s*"?(7|8|9|10)\d{2}/i.test(t.rawAttrs))) legacy.push("fixed-width tables");
  const mixed = base.protocol === "https:" ? $$("img[src], script[src], link[href], iframe[src], source[src]").map((e) => attr(e, "src") || attr(e, "href")).filter((u) => /^http:\/\//i.test(u)).slice(0, 10) : [];

  const placeholder = lower.match(/lorem ipsum|dolor sit amet|sample text|your (company|business) name here|coming soon|under construction/)?.[0];
  const title = clean($("title")?.textContent ?? "");
  const metaDescription = attr($('meta[name="description" i]'), "content") || attr($('meta[name="Description"]'), "content");
  const viewport = attr($('meta[name="viewport"]'), "content");
  const labelIds = new Set($$("label[for]").map((l) => attr(l, "for")));

  const tech = detectTech({
    html: html.slice(0, 1_500_000),
    urls: [...scripts.map((s) => s.src ?? ""), ...stylesheets.map((s) => s.href), ...iframes, ...$$("link[href]").map((l) => attr(l, "href"))].filter(Boolean),
    headers: ctx.headers,
    cookies: (ctx.headers["set-cookie"] ?? "").split(/,(?=\s*\w+=)/),
  });

  return {
    url: ctx.url,
    finalUrl: ctx.finalUrl,
    status: ctx.status,
    ok: ctx.status >= 200 && ctx.status < 300,
    redirects: ctx.redirects,
    ttfbMs: ctx.ttfbMs,
    htmlBytes: ctx.htmlBytes,
    contentType: headersLower["content-type"],
    encoding: headersLower["content-encoding"],
    depth: ctx.depth,
    headers: Object.fromEntries(KEEP_HEADERS.filter((k) => headersLower[k] !== undefined).map((k) => [k, headersLower[k].slice(0, 400)])),
    title: title || undefined,
    metaDescription: metaDescription || undefined,
    canonical: attr($('link[rel="canonical"]'), "href") || undefined,
    robotsMeta: [attr($('meta[name="robots" i]'), "content"), headersLower["x-robots-tag"] ?? ""].filter(Boolean).join(", ") || undefined,
    lang: attr($("html"), "lang") || undefined,
    viewport: viewport || undefined,
    hreflang: $$('link[rel="alternate"][hreflang]').map((l) => attr(l, "hreflang")),
    og: !!$('meta[property="og:title"]') || !!$('meta[property="og:image"]'),
    headings: { h1: hText("h1").slice(0, 5), h2: hText("h2").slice(0, 15), h3: hText("h3").slice(0, 15), skips },
    wordCount: text ? text.split(/\s+/).length : 0,
    text: text.slice(0, 1500),
    textHash: createHash("sha1").update(text.replace(/\d+/g, "")).digest("hex").slice(0, 16),
    placeholderText: placeholder,
    internalLinks: uniq(internal).slice(0, 150),
    externalLinks: uniq(external).slice(0, 60),
    genericAnchors,
    images: images.slice(0, 60),
    imageCount: images.length,
    scripts: scripts.slice(0, 60),
    stylesheets: stylesheets.slice(0, 30),
    inlineStyleBytes: styleText.length,
    mediaQueries,
    preloads: $$('link[rel="preload"]').length,
    preconnects: $$('link[rel="preconnect"], link[rel="dns-prefetch"]').length,
    forms,
    ctas: ctas.slice(0, 60),
    contact: {
      phones, emails, whatsapp: wa, address: addr?.trim(),
      mapEmbed: iframes.some((s) => /google\.[a-z.]+\/maps|maps\.google|maps\/embed/i.test(s)),
      hours: /\b(mon|monday|tue|tuesday|opening hours|business hours|working hours|timings|open (daily|all days))\b[^.]{0,40}\b\d{1,2}(:\d{2})?\s?(am|pm)\b/i.test(text),
      gbpLink: allHrefs.some((h) => /g\.page\/|maps\.app\.goo\.gl|goo\.gl\/maps|google\.[a-z.]+\/maps\/place|business\.google\.com/i.test(h)),
    },
    schema: schemaTypes(root),
    trust: {
      testimonials: /\btestimonials?\b|what (our )?(clients|customers) say|client stories|happy (clients|customers)/.test(lower),
      reviews: /\breviews?\b|★|rated \d|google rating|\d(\.\d)? (out of|\/) 5/.test(lower),
      caseStudies: /case stud(y|ies)|success stor(y|ies)/.test(lower) || allHrefs.some((h) => /case-stud/i.test(h)),
      portfolio: /\bportfolio\b|our (work|projects)|recent (work|projects)|gallery/.test(lower) || allHrefs.some((h) => /portfolio|projects|gallery|our-work/i.test(h)),
      clientLogos: /(our )?(clients|partners|trusted by|brands we('ve)? worked with|as seen in)/.test(lower) && images.filter((i) => /logo|client|partner|brand/i.test(`${i.src} ${i.alt}`)).length >= 3,
      certifications: /\biso ?\d{4,5}\b|certified|accredited|registered with|rera|nabh|nabl|fssai|gst(in)?:? ?\d/i.test(text),
      awards: /\baward(s|ed)?\b|winner of|recogni[sz]ed by/.test(lower),
      team: /our team|meet the team|founder|co-founder|our doctors|our experts|leadership/.test(lower),
      history: /since (19|20)\d{2}|established in|founded in|\d{1,3}\+? years (of )?(experience|in business)/.test(lower),
      guarantees: /guarantee|warranty|money.?back|no questions asked|free (revision|consultation|site visit)/.test(lower),
      badges: /secure (checkout|payment)|ssl secured|verified|trusted (by|seller)/.test(lower),
      stockImages: imgHosts.filter((s) => /shutterstock|istockphoto|gettyimages|unsplash|pexels|pixabay|freepik|depositphotos|adobestock/i.test(s)).length,
      policies,
      socials,
    },
    ecommerce: {
      cart: allHrefs.some((h) => /\/cart\b|\/basket\b/i.test(h)) || /\bcart\b/.test(navItems.join(" ").toLowerCase()),
      addToCart: /add to (cart|bag)|buy now/.test(lower),
      productSchema: /"@type"\s*:\s*"Product"|itemtype="https?:\/\/schema\.org\/Product"/i.test(html),
      prices: (text.match(/(₹|rs\.?|inr)\s?\d[\d,]*/gi) ?? []).length,
      checkoutLink: allHrefs.some((h) => /checkout/i.test(h)),
      wishlist: /wishlist|wish list/.test(lower),
      filters: /\b(filter by|sort by|price range|refine)\b/.test(lower),
    },
    a11y: {
      imgNoAlt: images.filter((i) => i.alt === null).length,
      inputsNoLabel: $$("input, select, textarea").filter((i) => !/^(hidden|submit|button|reset|image)$/i.test(attr(i, "type")) && !(attr(i, "id") && labelIds.has(attr(i, "id"))) && !i.closest("label") && !attr(i, "aria-label") && !attr(i, "aria-labelledby") && !attr(i, "title")).length,
      buttonsNoName: $$("button").filter((b) => !clean(b.textContent) && !attr(b, "aria-label") && !attr(b, "title") && !b.querySelector("img[alt]")).length,
      linksNoText: $$("a[href]").filter((a) => !clean(a.textContent) && !attr(a, "aria-label") && !attr(a, "title") && !a.querySelectorAll("img").some((i) => attr(i, "alt"))).length,
      skipLink: $$("a[href^='#']").slice(0, 5).some((a) => /skip|main content/i.test(a.textContent)),
      landmarks: ["header", "nav", "main", "footer"].filter((t) => $(t) || $(`[role="${t === "header" ? "banner" : t === "footer" ? "contentinfo" : t === "nav" ? "navigation" : "main"}"]`)),
      positiveTabindex: $$("[tabindex]").filter((e) => Number(attr(e, "tabindex")) > 0).length,
      zoomDisabled: /user-scalable\s*=\s*(no|0)|maximum-scale\s*=\s*1(\.0)?\b/i.test(viewport),
    },
    nav: { present: !!nav, items: [...new Set(navItems)].slice(0, 40) },
    footerLinks: footer ? footer.querySelectorAll("a").length : 0,
    breadcrumbs: !!$('[aria-label*="breadcrumb" i], .breadcrumb, .breadcrumbs, nav.woocommerce-breadcrumb') || /BreadcrumbList/.test(html),
    search: $$('input[type="search"], form[role="search"]').length > 0 || $$("form").some((f) => /search/i.test(f.toString().slice(0, 500))),
    newsletter: forms.some((f) => f.purpose === "newsletter") || /subscribe to (our )?newsletter|join our (mailing|email) list/.test(lower),
    leadMagnet: /free (guide|e-?book|checklist|download|audit|consultation|trial|site visit|quote)|download (the |our )?(brochure|catalog|guide)/.test(lower),
    chatWidget: tech.some((t) => /Chat|WhatsApp|AI chat/.test(t.category)),
    copyrightYear: years.length ? Math.max(...years) : undefined,
    legacy,
    mixedContent: mixed,
    tech,
    keywords: `${title} ${hText("h1").join(" ")} ${metaDescription} ${navItems.join(" ")} ${hText("h2").slice(0, 6).join(" ")}`.toLowerCase().slice(0, 2000),
  };
}

function failed(url: string, depth: number, error: string, extra: Partial<PageData> = {}): PageData {
  return {
    url, finalUrl: url, status: 0, ok: false, error, depth, redirects: [], hreflang: [], og: false,
    headings: { h1: [], h2: [], h3: [], skips: 0 }, wordCount: 0, text: "", textHash: "", internalLinks: [], externalLinks: [], genericAnchors: 0,
    images: [], imageCount: 0, scripts: [], stylesheets: [], inlineStyleBytes: 0, mediaQueries: 0, preloads: 0, preconnects: 0, forms: [], ctas: [],
    contact: { phones: [], emails: [], mapEmbed: false, hours: false, gbpLink: false }, schema: { types: [], invalid: 0 },
    trust: { testimonials: false, reviews: false, caseStudies: false, portfolio: false, clientLogos: false, certifications: false, awards: false, team: false, history: false, guarantees: false, badges: false, stockImages: 0, policies: [], socials: [] },
    ecommerce: { cart: false, addToCart: false, productSchema: false, prices: 0, checkoutLink: false, wishlist: false, filters: false },
    a11y: { imgNoAlt: 0, inputsNoLabel: 0, buttonsNoName: 0, linksNoText: 0, skipLink: false, landmarks: [], positiveTabindex: 0, zoomDisabled: false },
    nav: { present: false, items: [] }, footerLinks: 0, breadcrumbs: false, search: false, newsletter: false, leadMagnet: false, chatWidget: false,
    legacy: [], mixedContent: [], tech: [], keywords: "",
    ...extra,
  };
}

const pageCache = new Map<string, { at: number; data: PageData }>();

export async function fetchPage(input: string, rootHost: string, depth: number): Promise<PageData> {
  let u: URL;
  try { u = new URL(input); } catch { return failed(input, depth, "Invalid URL"); }
  const key = `${input}|${depth}`;
  const hit = pageCache.get(key);
  if (hit && Date.now() - hit.at < 10 * 60_000) return hit.data;
  try {
    if (!(await robotsCheck(u))) return failed(input, depth, "Skipped: robots.txt asks automated tools not to read this page.", { blockedByRobots: true });
    let got: Awaited<ReturnType<typeof guardedFetch>> | null = null;
    for (let attempt = 0; attempt < 2 && !got; attempt++) {
      try { got = await guardedFetch(u, { timeout: 15_000 }); } catch (e) { if (e instanceof AnalyzeError || attempt === 1) throw e; }
    }
    const { res, url, chain, ttfbMs } = got!;
    const headers: Record<string, string> = {};
    res.headers.forEach((v, k) => { headers[k] = v; });
    const type = res.headers.get("content-type") ?? "";
    if (!/html|xml/i.test(type) && type) {
      await res.body?.cancel().catch(() => {});
      return failed(input, depth, `Not a web page (${type.split(";")[0]})`, { status: res.status, finalUrl: url.toString(), redirects: chain });
    }
    const body = await readCapped(res, 3_000_000);
    const data = extractPage(body.text, { url: input, finalUrl: url.toString(), status: res.status, depth, headers, ttfbMs, htmlBytes: body.bytes, redirects: chain, rootHost });
    pageCache.set(key, { at: Date.now(), data });
    if (pageCache.size > 500) pageCache.delete(pageCache.keys().next().value!);
    return data;
  } catch (e) {
    const err = e as Error & { cause?: { code?: string } };
    const code = err.cause?.code ?? err.name;
    const msg = e instanceof AnalyzeError ? e.message : code === "TimeoutError" ? "Timed out" : code === "ENOTFOUND" ? "Domain doesn't resolve" : code === "ECONNREFUSED" ? "Connection refused" : /CERT|SSL|TLS/i.test(String(code)) ? "Invalid SSL certificate" : "Couldn't be reached";
    return failed(input, depth, msg);
  }
}
