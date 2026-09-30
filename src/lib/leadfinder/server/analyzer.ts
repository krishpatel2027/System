import { parse, type HTMLElement } from "node-html-parser";
import type { Finding, WebsiteAudit } from "../../types";
import { AnalyzeError, guardedFetch, normalizeUrl, readCapped as readBody, robotsCheck } from "../../audit/server/net";

// Reads a business's public homepage and reports what's missing, with evidence.
// Only the homepage and robots.txt are requested, as an identified bot, and a
// robots.txt disallow is honoured. Private/internal addresses are refused.

export { AnalyzeError, normalizeUrl, robotsAllows, USER_AGENT } from "../../audit/server/net";

const get = async (u: URL, accept: string) => { const r = await guardedFetch(u, { accept, timeout: 12_000 }); return { res: r.res, url: r.url }; };
const readCapped = async (res: Response) => (await readBody(res, 2_000_000)).text;

// ---------- page analysis ----------

const CTA_RE = /\b(contact|enquir|inquir|book|appointment|schedule|call now|call us|get (a )?quote|request|whatsapp|chat with|get started|free consultation|visit us|order now|shop now|buy now)\b/i;
const CHAT_RE = /tawk\.to|crisp\.chat|intercom|zendesk|zopim|freshchat|wati\.io|interakt|tidio|drift\.com|hs-scripts|livechat|botpress|landbot|gallabox|aisensy|chatbase|voiceflow/i;
const CART_RE = /add[\s-]to[\s-](cart|bag)|\/cart\b|checkout|woocommerce|cdn\.shopify|shopify\.com|razorpay|cashfree|instamojo|wix-ecommerce|bigcommerce|magento/i;
const PRODUCT_RE = /(₹|rs\.?|inr)\s?\d[\d,]*|"@type"\s*:\s*"product"|\bshop\b|\bproducts?\b|\bcollections?\b|\bcatalog(ue)?\b/i;
const PHONE_RE = /(?:\+91[\s-]?|\b0)?[6-9]\d{4}[\s-]?\d{5}\b/g;
const EMAIL_RE = /\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/gi;

const SOCIAL: [keyof WebsiteAudit["found"]["socials"], RegExp][] = [
  ["instagram", /instagram\.com\/(?!p\/|reel\/|explore)[\w.]+/i],
  ["facebook", /facebook\.com\/(?!sharer|share|dialog|plugins|tr\b)[\w.-]+/i],
  ["linkedin", /linkedin\.com\/(company|in)\/[\w-]+/i],
  ["youtube", /youtube\.com\/(@|c\/|channel\/|user\/)[\w-]+/i],
  ["x", /(twitter|x)\.com\/(?!intent|share|home)\w+/i],
];

// Tags become spaces so adjacent elements never fuse into one "word" (which
// could otherwise produce emails or phone numbers that aren't on the page).
function visibleText(markup: string) {
  return markup
    .replace(/<(script|style|noscript|template|svg)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&copy;/gi, "©").replace(/&#169;/g, "©").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/&#64;|&commat;/gi, "@")
    .replace(/\s+/g, " ");
}

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

export function analyzeHtml(html: string, ctx: { url: string; finalUrl: string; status: number; responseMs: number }): Omit<WebsiteAudit, "analyzedAt" | "url"> {
  const root = parse(html, { comment: false, blockTextElements: { script: true, style: true, noscript: false, pre: true } });
  const $ = (s: string) => root.querySelector(s);
  const $$ = (s: string) => root.querySelectorAll(s);
  const attr = (el: HTMLElement | null, a: string) => el?.getAttribute(a)?.trim() ?? "";
  const findings: Finding[] = [];
  const add = (f: Finding) => findings.push(f);
  const htmlKb = Math.round(Buffer.byteLength(html) / 1024);
  const final = new URL(ctx.finalUrl);
  const bodyText = visibleText(($("body") ?? root).toString());
  const links = $$("a[href]").map((a) => ({ href: attr(a, "href"), text: a.textContent.replace(/\s+/g, " ").trim() }));
  const scripts = $$("script");
  const scriptSrcs = scripts.map((s) => attr(s, "src")).filter(Boolean);
  const inlineJs = scripts.filter((s) => !attr(s, "src")).map((s) => s.textContent).join("\n");

  // --- content & SEO ---
  const title = $("title")?.textContent.trim() ?? "";
  const description = attr($('meta[name="description"]'), "content") || attr($('meta[name="Description"]'), "content");
  const h1s = $$("h1").filter((h) => h.textContent.trim());
  const imgs = $$("img");
  const noAlt = imgs.filter((i) => i.getAttribute("alt") === undefined).length;
  const hasJsonLd = $$('script[type="application/ld+json"]').length > 0;
  const hasOg = !!$('meta[property="og:title"]') || !!$('meta[property="og:image"]');
  const lang = attr($("html"), "lang");
  let seo = 100;
  if (!title) { seo -= 30; add({ id: "no_title", category: "seo", severity: "high", issue: "Missing page title", evidence: "The homepage has no <title>, so Google has nothing to show as the headline.", improvement: "Add a title with the business name, service and city (50–60 characters)." }); }
  else if (title.length < 15 || title.length > 70) { seo -= 8; add({ id: "title_length", category: "seo", severity: "low", issue: "Page title length", evidence: `The title "${title.slice(0, 80)}" is ${title.length} characters; 30–60 displays best in search.`, improvement: "Rewrite the title to include the main service and city within 60 characters." }); }
  if (!description) { seo -= 20; add({ id: "no_meta_description", category: "seo", severity: "medium", issue: "No meta description", evidence: "No <meta name=\"description\"> tag was found, so Google picks random page text for the snippet.", improvement: "Add a 140–160 character description that sells the business and includes the city." }); }
  if (!h1s.length) { seo -= 15; add({ id: "no_h1", category: "seo", severity: "medium", issue: "No main heading (H1)", evidence: "The homepage has no <h1> heading, which weakens what search engines think the page is about.", improvement: "Add a single, descriptive H1 such as \"Premium interiors in Ahmedabad\"." }); }
  else if (h1s.length > 1) { seo -= 5; add({ id: "multi_h1", category: "seo", severity: "low", issue: "Multiple H1 headings", evidence: `Found ${h1s.length} <h1> headings on the homepage.`, improvement: "Keep one H1 for the page's main topic; use H2/H3 for sections." }); }
  if (!hasJsonLd) { seo -= 10; add({ id: "no_schema", category: "seo", severity: "low", issue: "No structured data", evidence: "No schema.org (JSON-LD) markup found, so Google can't show rich details like hours or ratings.", improvement: "Add LocalBusiness structured data with address, phone and opening hours." }); }
  if (!hasOg) { seo -= 5; add({ id: "no_og", category: "content", severity: "low", issue: "No social sharing preview", evidence: "No Open Graph tags found, so links shared on WhatsApp or social media show no image or summary.", improvement: "Add og:title, og:description and og:image tags." }); }

  // --- mobile ---
  const viewport = attr($('meta[name="viewport"]'), "content");
  let mobile = 100;
  if (!viewport) { mobile -= 60; add({ id: "no_viewport", category: "mobile", severity: "high", issue: "Not mobile-friendly", evidence: "No <meta name=\"viewport\"> tag, so phones show the desktop layout zoomed out.", improvement: "Rebuild the layout responsively so it adapts to phone screens." }); }
  else if (/user-scalable\s*=\s*no|maximum-scale\s*=\s*1(\.0)?\b/i.test(viewport)) { mobile -= 10; add({ id: "zoom_disabled", category: "accessibility", severity: "low", issue: "Pinch-zoom disabled", evidence: `The viewport tag (${viewport}) blocks zooming on phones.`, improvement: "Allow zoom so visitors can read small text." }); }
  const fixedWidth = /(?:^|[;{\s])(?:min-)?width\s*:\s*(9[6-9]\d|1[0-9]{3})px/i.test($$("style").map((s) => s.textContent).join("\n"));
  if (fixedWidth && viewport) { mobile -= 15; add({ id: "fixed_width", category: "mobile", severity: "medium", issue: "Fixed-width layout", evidence: "Styles set a fixed page width of 960px or more, which overflows on phones.", improvement: "Use fluid widths and breakpoints." }); }

  // --- legacy signals ---
  const legacyTags = ["font", "center", "marquee", "frameset", "frame", "blink"].filter((t) => $$(t).length);
  const flash = $$("embed, object").some((e) => /\.swf|shockwave/i.test(e.toString()));
  const oldJq = scriptSrcs.map((s) => s.match(/jquery[.-]?(1\.\d+|2\.\d+)/i)?.[1]).find(Boolean);
  const tableLayout = $$("table").some((t) => /width\s*=\s*"?(7|8|9|10)\d{2}/i.test(t.rawAttrs));
  if (legacyTags.length || flash || tableLayout) {
    add({ id: "legacy_markup", category: "content", severity: "medium", issue: "Built with outdated techniques", evidence: [legacyTags.length ? `uses obsolete <${legacyTags.join(">, <")}> tags` : "", flash ? "embeds Flash content" : "", tableLayout ? "uses fixed-width tables for layout" : ""].filter(Boolean).join("; ").replace(/^./, (c) => c.toUpperCase()) + ".", improvement: "Rebuild on a modern, responsive stack." });
  }
  if (oldJq) add({ id: "old_jquery", category: "security", severity: "low", issue: "Outdated JavaScript library", evidence: `Loads jQuery ${oldJq}, which is several major versions behind and has known issues.`, improvement: "Update or remove old libraries." });

  // --- copyright year ---
  const years = [...bodyText.matchAll(/(?:©|&copy;|copyright)\s*(?:\d{4}\s*[-–]\s*)?(\d{4})/gi)].map((m) => parseInt(m[1], 10)).filter((y) => y > 1995 && y <= new Date().getFullYear() + 1);
  const copyrightYear = years.length ? Math.max(...years) : undefined;
  const nowY = new Date().getFullYear();
  if (copyrightYear && copyrightYear <= nowY - 3) add({ id: "stale_copyright", category: "content", severity: "low", issue: "Looks unmaintained", evidence: `The footer says © ${copyrightYear}, suggesting the site hasn't been updated since.`, improvement: "Refresh content and keep the footer current." });

  // --- security ---
  let security = 100;
  if (final.protocol !== "https:") { security -= 60; add({ id: "no_https", category: "security", severity: "high", issue: "No HTTPS", evidence: `The site loads over http://${final.host}, so browsers mark it "Not secure".`, improvement: "Install an SSL certificate and redirect all traffic to https." }); }
  const mixed = final.protocol === "https:" && $$("img[src], script[src], link[href]").some((e) => /^http:\/\//i.test(attr(e, "src") || attr(e, "href")));
  if (mixed) { security -= 15; add({ id: "mixed_content", category: "security", severity: "medium", issue: "Insecure assets", evidence: "Some images, scripts or styles load over http:// on a secure page.", improvement: "Serve every asset over https." }); }
  if (oldJq) security -= 10;

  // --- performance (lightweight; PageSpeed gives the real number) ---
  let performance = 100;
  if (ctx.responseMs > 3000) { performance -= 35; add({ id: "slow_response", category: "performance", severity: "high", issue: "Slow server response", evidence: `The homepage took ${(ctx.responseMs / 1000).toFixed(1)}s to download.`, improvement: "Move to faster hosting, add caching and a CDN." }); }
  else if (ctx.responseMs > 1500) { performance -= 15; add({ id: "slowish_response", category: "performance", severity: "medium", issue: "Sluggish server response", evidence: `The homepage took ${(ctx.responseMs / 1000).toFixed(1)}s to download.`, improvement: "Enable caching and compression." }); }
  if (htmlKb > 500) { performance -= 20; add({ id: "heavy_html", category: "performance", severity: "medium", issue: "Heavy page", evidence: `The homepage HTML alone is ${htmlKb} KB.`, improvement: "Trim inline code and lazy-load sections." }); }
  const blocking = $$('head link[rel="stylesheet"]').length + $$("head script[src]").filter((s) => s.getAttribute("async") === undefined && s.getAttribute("defer") === undefined && attr(s, "type") !== "module").length;
  if (blocking > 12) { performance -= 15; add({ id: "render_blocking", category: "performance", severity: "medium", issue: "Many render-blocking files", evidence: `${blocking} stylesheets/scripts must load before anything shows.`, improvement: "Bundle, defer or async non-critical files." }); }
  const lazy = imgs.filter((i) => attr(i, "loading") === "lazy").length;
  if (imgs.length > 15 && lazy === 0) { performance -= 10; add({ id: "no_lazy_images", category: "performance", severity: "low", issue: "Images load all at once", evidence: `${imgs.length} images and none use lazy loading.`, improvement: "Lazy-load below-the-fold images and serve WebP/AVIF." }); }

  // --- contact & conversion ---
  const telLinks = links.filter((l) => /^tel:/i.test(l.href)).map((l) => decodeURIComponent(l.href.slice(4)).trim());
  const textPhones = [...bodyText.matchAll(PHONE_RE)].map((m) => m[0].trim());
  const phones = [...new Set([...telLinks, ...textPhones].map((p) => p.replace(/[^\d+]/g, "")).filter((p) => p.replace(/\D/g, "").length >= 10))].slice(0, 3);
  const mailLinks = links.filter((l) => /^mailto:/i.test(l.href)).map((l) => decodeURIComponent(l.href.slice(7).split("?")[0]).trim().toLowerCase());
  const textEmails = [...bodyText.matchAll(EMAIL_RE)].map((m) => m[0].toLowerCase());
  // Only addresses the business publishes; never constructed or guessed.
  const emails = [...new Set([...mailLinks, ...textEmails])].filter((e) => !/\.(png|jpe?g|gif|webp|svg)$/i.test(e) && !/example\.|sentry|wixpress|domain\.com/i.test(e)).slice(0, 3);
  const waLink = links.find((l) => /wa\.me\/|api\.whatsapp\.com|whatsapp:\/\/|web\.whatsapp\.com/i.test(l.href))?.href;
  const socials: WebsiteAudit["found"]["socials"] = {};
  for (const [k, re] of SOCIAL) {
    const hit = links.find((l) => re.test(l.href));
    if (hit) socials[k] = hit.href.startsWith("http") ? hit.href : `https://${hit.href.replace(/^\/\//, "")}`;
  }
  const hasForm = $$("form").some((f) => f.querySelectorAll("input, textarea").filter((i) => !/hidden|submit|search/i.test(attr(i, "type"))).length >= 2 && !/search/i.test(attr(f, "role") + attr(f, "action")));
  const buttonsText = [...$$("button"), ...$$("a[href]"), ...$$('input[type="submit"]')].map((e) => e.textContent + " " + attr(e, "value")).join(" | ");
  const hasCta = CTA_RE.test(buttonsText) || telLinks.length > 0 || !!waLink;
  const hasChatWidget = CHAT_RE.test(scriptSrcs.join(" ") + inlineJs.slice(0, 200_000));
  const hasCart = CART_RE.test(html.slice(0, 1_500_000));
  const sellsProducts = hasCart || PRODUCT_RE.test(bodyText.slice(0, 200_000)) && /(₹|rs\.?|inr)\s?\d/i.test(bodyText);

  let conversion = 100;
  if (!hasCta) { conversion -= 35; add({ id: "no_cta", category: "conversion", severity: "high", issue: "No clear call to action", evidence: "No call, WhatsApp, book or enquire button was found on the homepage.", improvement: "Add a prominent enquiry button above the fold and repeat it down the page." }); }
  if (!hasForm) { conversion -= 20; add({ id: "no_form", category: "conversion", severity: "medium", issue: "No enquiry form", evidence: "No contact or enquiry form on the homepage.", improvement: "Add a short 3-field enquiry form that sends leads to email and WhatsApp." }); }
  if (!waLink) { conversion -= 15; add({ id: "no_whatsapp", category: "conversion", severity: "medium", issue: "No WhatsApp button", evidence: "No WhatsApp chat link was found.", improvement: "Add a click-to-WhatsApp button — most Indian customers prefer it." }); }
  if (!phones.length && !telLinks.length) { conversion -= 10; add({ id: "no_phone", category: "conversion", severity: "low", issue: "Phone number hard to find", evidence: "No phone number or tap-to-call link on the homepage.", improvement: "Show a tap-to-call number in the header." }); }

  // --- accessibility ---
  let accessibility = 100;
  if (imgs.length && noAlt / imgs.length > 0.3) { accessibility -= 25; seo -= 5; add({ id: "img_alt", category: "accessibility", severity: "low", issue: "Images missing descriptions", evidence: `${noAlt} of ${imgs.length} images have no alt text.`, improvement: "Describe each image with alt text (helps SEO and screen readers)." }); }
  if (!lang) accessibility -= 10;

  const generator = attr($('meta[name="generator"]'), "content") || undefined;
  const internalLinks = new Set(links.map((l) => { try { const u = new URL(l.href, final); return u.host === final.host ? u.pathname : ""; } catch { return ""; } }).filter((p) => p && p !== "/")).size;
  if (internalLinks < 3 && bodyText.length < 1500) add({ id: "thin_content", category: "content", severity: "medium", issue: "Very little content", evidence: `The site has ${internalLinks} internal page link${internalLinks === 1 ? "" : "s"} and little text on the homepage.`, improvement: "Add service, portfolio and about pages that answer customer questions." });

  return {
    finalUrl: final.toString(),
    ok: true,
    httpStatus: ctx.status,
    responseMs: ctx.responseMs,
    htmlKb,
    scores: { performance: clamp(performance), mobile: clamp(mobile), seo: clamp(seo), security: clamp(security), conversion: clamp(conversion), accessibility: clamp(accessibility) },
    findings,
    found: { title: title || undefined, description: description || undefined, phones, emails, whatsapp: waLink, socials, hasViewport: !!viewport, hasForm, hasCta, hasChatWidget, hasCart, sellsProducts, copyrightYear, generator, internalLinks },
  };
}

const emptyFound: WebsiteAudit["found"] = { phones: [], emails: [], socials: {}, hasViewport: false, hasForm: false, hasCta: false, hasChatWidget: false, hasCart: false, sellsProducts: false, internalLinks: 0 };

export async function analyzeWebsite(input: string): Promise<WebsiteAudit> {
  const u = normalizeUrl(input);
  const base = { url: u.toString(), analyzedAt: new Date().toISOString(), scores: {}, findings: [], found: emptyFound };
  try {
    if (!(await robotsCheck(u))) return { ...base, ok: false, blockedByRobots: true, error: "The site's robots.txt asks automated tools not to read this page, so it wasn't checked." };
    const t0 = Date.now();
    let got: Awaited<ReturnType<typeof get>>;
    try {
      got = await get(u, "text/html,application/xhtml+xml");
    } catch (e) {
      // Many small-business sites only work on http.
      if (u.protocol === "https:" && !(e instanceof AnalyzeError)) got = await get(new URL(u.toString().replace(/^https:/, "http:")), "text/html");
      else throw e;
    }
    const { res, url } = got;
    if (!res.ok) return { ...base, ok: false, httpStatus: res.status, error: `The site responded with HTTP ${res.status}.` };
    const type = res.headers.get("content-type") ?? "";
    if (type && !/html|xml/i.test(type)) return { ...base, ok: false, httpStatus: res.status, error: `The address returned ${type.split(";")[0]}, not a web page.` };
    const html = await readCapped(res);
    const responseMs = Date.now() - t0;
    if (!html.trim()) return { ...base, ok: false, httpStatus: res.status, error: "The page was empty." };
    return { ...base, ...analyzeHtml(html, { url: u.toString(), finalUrl: url.toString(), status: res.status, responseMs }) };
  } catch (e) {
    if (e instanceof AnalyzeError) return { ...base, ok: false, error: e.message };
    const err = e as Error & { cause?: { code?: string } };
    const code = err.cause?.code ?? err.name;
    const msg = code === "TimeoutError" ? "The site took too long to respond." : code === "ENOTFOUND" ? "The domain doesn't resolve (it may have expired)." : code === "ECONNREFUSED" ? "The server refused the connection." : /CERT|SSL|TLS/i.test(String(code)) ? "The site's SSL certificate is invalid." : "The site couldn't be reached.";
    return { ...base, ok: false, error: msg };
  }
}

// ---------- Google PageSpeed Insights (optional) ----------

export async function pagespeed(url: string): Promise<WebsiteAudit["pagespeed"] | null> {
  const key = (process.env.GOOGLE_PAGESPEED_API_KEY ?? "").trim();
  if (!key) return null;
  const q = new URLSearchParams({ url, strategy: "mobile", key });
  for (const c of ["performance", "accessibility", "seo", "best-practices"]) q.append("category", c);
  const res = await fetch(`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${q}`, { signal: AbortSignal.timeout(55_000), cache: "no-store" });
  if (!res.ok) throw new AnalyzeError(`PageSpeed returned ${res.status}`);
  const j = (await res.json()) as { lighthouseResult?: { categories?: Record<string, { score: number | null }>; audits?: Record<string, { numericValue?: number }> } };
  const c = j.lighthouseResult?.categories ?? {};
  const s = (k: string) => Math.round((c[k]?.score ?? 0) * 100);
  return { strategy: "mobile", performance: s("performance"), accessibility: s("accessibility"), seo: s("seo"), bestPractices: s("best-practices"), lcpMs: j.lighthouseResult?.audits?.["largest-contentful-paint"]?.numericValue, fetchedAt: new Date().toISOString() };
}
