import type { AuditResult, Finding, Strength, VitalRating } from "../types";
import { type Ctx, type ModuleOut, finding as F, strength as S, kb, ms, path, plural, list } from "./context";

// Performance, Core Web Vitals, images, fonts, JavaScript and CSS.

const TH = { lcp: [2500, 4000], inp: [200, 500], cls: [0.1, 0.25], ttfb: [800, 1800], fcp: [1800, 3000] } as const;
export const rate = (k: keyof typeof TH, v?: number): VitalRating | undefined => (v === undefined ? undefined : v <= TH[k][0] ? "good" : v <= TH[k][1] ? "needs-improvement" : "poor");

export function vitals(ctx: Ctx): AuditResult["vitals"] {
  const field = ctx.psi?.field;
  const lab = ctx.psi?.lab;
  const br = ctx.mob?.metrics ?? ctx.desk?.metrics;
  const brLabel = ctx.mob?.metrics ? "Arkria browser, mobile (lab, unthrottled)" : "Arkria browser, desktop (lab, unthrottled)";
  const fieldLabel = field ? `Real users — Chrome UX Report (${field.scope === "page" ? "this page" : "whole site"})` : "";
  const pick = (k: "lcp" | "cls" | "ttfb" | "fcp", fv?: number, lv?: number, bv?: number) =>
    fv !== undefined ? { value: fv, source: fieldLabel } : lv !== undefined ? { value: lv, source: "Google Lighthouse lab, mobile (PageSpeed)" } : bv !== undefined ? { value: bv, source: brLabel } : { value: undefined, source: "Not measured" };
  const rows: AuditResult["vitals"] = [];
  const lcp = pick("lcp", field?.lcp, lab?.lcp, br?.lcp);
  rows.push({ key: "lcp", label: "Largest Contentful Paint", unit: "ms", ...lcp, rating: rate("lcp", lcp.value) });
  rows.push({ key: "inp", label: "Interaction to Next Paint", unit: "ms", value: field?.inp, source: field?.inp !== undefined ? fieldLabel : "Not measured — needs real-user data (Chrome UX Report)", rating: rate("inp", field?.inp) });
  const cls = pick("cls", field?.cls, lab?.cls, br?.cls);
  rows.push({ key: "cls", label: "Cumulative Layout Shift", unit: "", ...cls, rating: rate("cls", cls.value) });
  const ttfb = pick("ttfb", field?.ttfb, lab?.ttfb, br?.ttfb ?? ctx.home?.ttfbMs);
  rows.push({ key: "ttfb", label: "Time to First Byte", unit: "ms", ...ttfb, source: ttfb.value !== undefined && field?.ttfb === undefined && lab?.ttfb === undefined && br?.ttfb === undefined ? "Arkria server (single request)" : ttfb.source, rating: rate("ttfb", ttfb.value) });
  const fcp = pick("fcp", field?.fcp, lab?.fcp, br?.fcp);
  rows.push({ key: "fcp", label: "First Contentful Paint", unit: "ms", ...fcp, rating: rate("fcp", fcp.value) });
  return rows;
}

export function performance(ctx: Ctx): ModuleOut {
  const f: Finding[] = [];
  const s: Strength[] = [];
  const home = ctx.home;
  const hp = home ? [home.finalUrl] : [];
  const m = ctx.desk?.metrics;
  const mm = ctx.mob?.metrics;

  // --- Core Web Vitals ---
  for (const v of vitals(ctx)) {
    if (v.value === undefined || v.key === "fcp") continue;
    const val = v.key === "cls" ? v.value.toFixed(2) : ms(v.value);
    const label = `${v.label} is ${val}`;
    const src = v.source.startsWith("Real users") ? "crux" : v.source.startsWith("Google") ? "pagespeed" : v.source.startsWith("Arkria browser") ? "browser" : "crawl";
    if (v.rating === "poor" || v.rating === "needs-improvement") {
      const poor = v.rating === "poor";
      const rec = {
        lcp: "Serve the main (hero) image or heading faster: compress and preload the hero image, cut render-blocking CSS/JS, and use a CDN.",
        inp: "Break up long JavaScript tasks, defer non-essential scripts and reduce third-party code so taps respond quickly.",
        cls: "Reserve space for images, embeds and banners (width/height or aspect-ratio) and avoid inserting content above existing content.",
        ttfb: "Improve server response: enable full-page caching, upgrade hosting or add a CDN close to your visitors.",
      }[v.key as "lcp" | "inp" | "cls" | "ttfb"];
      f.push(F(`vitals.${v.key}`, poor ? "high" : "medium", "vitals", `${label} (${poor ? "poor" : "needs improvement"})`,
        `${label} — ${v.source}. Google's "good" threshold is ${v.key === "cls" ? "0.1" : ms(TH[v.key as "lcp"][0])}.`,
        v.key === "lcp" ? "Visitors wait longer to see the main content; slow pages lose visitors and rank lower." : v.key === "inp" ? "The page feels sluggish when people tap or type." : v.key === "cls" ? "Content jumps while loading, causing mis-taps and a cheap feel." : "Every page starts loading late, delaying everything else.",
        rec, { pages: hp, affects: ["performance", "mobile", "ux", "seo"], source: src, effort: "project" }));
    } else if (v.rating === "good") s.push(S("vitals", `${v.label} is good (${val})`, v.source));
  }
  if (m?.lcpElement && (m.lcp ?? 0) > 2500) f.push(F("perf.lcp_element", "info", "performance", "Largest element on the first screen", `The largest element measured was ${m.lcpElement}, painted at ${ms(m.lcp)} in Arkria's browser.`, "This element decides when the page looks loaded.", "Prioritise it: preload it if it's an image, avoid lazy-loading it, and keep it small.", { pages: hp, source: "browser" }));

  // --- Server response (crawler, every page) ---
  const slow = ctx.pages.filter((p) => (p.ttfbMs ?? 0) > 1800);
  if (slow.length) f.push(F("perf.slow_server", slow.length > ctx.pages.length / 2 ? "high" : "medium", "performance", `Slow server response on ${plural(slow.length, "page")}`,
    `Server took over 1.8 s to respond: ${list(slow.map((p) => `${path(p.finalUrl)} (${ms(p.ttfbMs)})`))}. Measured from Arkria's server.`,
    "Pages start rendering late on every visit.", "Enable caching (page cache plugin or CDN), and review hosting performance.", { pages: slow.map((p) => p.finalUrl), affects: ["performance", "seo"], source: "crawl", effort: "project" }));

  // --- Redirects ---
  const chains = ctx.pages.filter((p) => p.redirects.length >= 2);
  if (chains.length) f.push(F("perf.redirect_chain", "medium", "performance", "Redirect chains", `${plural(chains.length, "page")} redirect more than once before loading, e.g. ${chains[0].redirects.map((r) => `${path(r.url)} (${r.status})`).join(" → ")} → ${path(chains[0].finalUrl)}.`, "Each hop adds a network round trip before anything shows.", "Point links and redirects straight at the final URL.", { pages: chains.map((p) => p.finalUrl), affects: ["performance", "seo"], source: "crawl" }));

  // --- Compression (HTML) ---
  const uncompressed = ctx.pages.filter((p) => (p.htmlBytes ?? 0) > 15_000 && !p.encoding);
  if (uncompressed.length) f.push(F("perf.no_compression", "medium", "performance", "Text compression not enabled", `${plural(uncompressed.length, "page")} served HTML without gzip/brotli (e.g. ${path(uncompressed[0].finalUrl)}: ${kb(uncompressed[0].htmlBytes)}).`, "Uncompressed pages take longer to download, especially on mobile data.", "Enable gzip or brotli compression on the server or CDN.", { pages: uncompressed.map((p) => p.finalUrl), affects: ["performance"], source: "headers" }));
  else if (ctx.pages.length && ctx.pages.every((p) => p.encoding)) s.push(S("performance", "Pages are served compressed", `Content-Encoding: ${ctx.pages[0].encoding}`));

  const heavyHtml = ctx.pages.filter((p) => (p.htmlBytes ?? 0) > 400_000);
  if (heavyHtml.length) f.push(F("perf.heavy_html", "low", "performance", "Very large HTML documents", `${list(heavyHtml.map((p) => `${path(p.finalUrl)} (${kb(p.htmlBytes)})`))}.`, "Large HTML delays parsing, often from inlined data or builder markup.", "Reduce inline scripts/styles and page-builder bloat.", { pages: heavyHtml.map((p) => p.finalUrl), affects: ["performance"], source: "crawl" }));

  // --- Browser: weight, requests, caching, third parties ---
  const src = mm ?? m;
  if (src) {
    const which = mm ? "mobile" : "desktop";
    if (src.transferBytes > 5_000_000) f.push(F("perf.page_weight", "high", "performance", `Heavy page: ${kb(src.transferBytes)} downloaded`, `The homepage downloaded ${kb(src.transferBytes)} across ${src.requests} requests (${which}). Images ${kb(src.byType.image?.bytes)}, scripts ${kb(src.byType.script?.bytes)}, fonts ${kb(src.byType.font?.bytes)}.`, "Heavy pages are slow on mobile networks and use visitors' data.", "Compress and resize images, remove unused scripts and limit third-party tags.", { pages: hp, affects: ["performance", "mobile"], source: "browser", effort: "project" }));
    else if (src.transferBytes > 3_000_000) f.push(F("perf.page_weight", "medium", "performance", `Page weight ${kb(src.transferBytes)}`, `The homepage downloaded ${kb(src.transferBytes)} across ${src.requests} requests (${which}).`, "More data means slower loads on mobile.", "Trim the largest resources first (see the image and JavaScript audits).", { pages: hp, affects: ["performance", "mobile"], source: "browser" }));
    else if (src.transferBytes < 1_500_000) s.push(S("performance", `Lightweight homepage (${kb(src.transferBytes)})`, `${src.requests} requests`));
    if (src.requests > 120) f.push(F("perf.requests", "medium", "performance", `${src.requests} network requests`, `The homepage made ${src.requests} requests (${which}).`, "Many requests compete for bandwidth and delay important content.", "Bundle assets, remove unused plugins and lazy-load below-the-fold content.", { pages: hp, affects: ["performance"], source: "browser" }));
    if (src.staticCount >= 5 && src.uncachedStatic / src.staticCount > 0.5) f.push(F("perf.caching", "medium", "performance", "Static files aren't cached for long", `${src.uncachedStatic} of ${src.staticCount} same-site images, scripts, styles and fonts have a cache lifetime under 7 days.`, "Returning visitors re-download files they already have.", "Set Cache-Control: max-age of at least 30 days (with versioned file names) for static assets.", { pages: hp, affects: ["performance"], source: "browser" }));
    if (src.uncompressedText) f.push(F("perf.asset_compression", "medium", "performance", "Scripts/styles served uncompressed", `${plural(src.uncompressedText, "same-site text file")} over 20 KB had no Content-Encoding.`, "Uncompressed JS/CSS downloads 3–5× more data.", "Enable gzip/brotli for text assets.", { pages: hp, affects: ["performance"], source: "browser" }));
    if (src.thirdPartyBytes > 500_000) f.push(F("perf.third_party", "medium", "performance", `Third-party code: ${kb(src.thirdPartyBytes)}`, `${src.thirdPartyRequests} requests to other domains added ${kb(src.thirdPartyBytes)}.`, "Third-party widgets and trackers slow the page and are outside your control.", "Remove tags you don't use; load chat and analytics after the page is interactive.", { pages: hp, affects: ["performance"], source: "browser" }));
    if (src.domNodes > 3000) f.push(F("perf.dom_size", "high", "performance", `Very large page structure (${src.domNodes} elements)`, `The homepage has ${src.domNodes} DOM elements.`, "A large DOM slows rendering and interaction, especially on phones.", "Simplify sections, remove hidden duplicate mobile/desktop markup and reduce page-builder nesting.", { pages: hp, affects: ["performance", "mobile"], source: "browser", effort: "project" }));
    else if (src.domNodes > 1500) f.push(F("perf.dom_size", "medium", "performance", `Large page structure (${src.domNodes} elements)`, `The homepage has ${src.domNodes} DOM elements (Lighthouse flags over 1,400).`, "A large DOM slows rendering and interaction.", "Simplify nested page-builder sections.", { pages: hp, affects: ["performance"], source: "browser" }));
    const tbt = (mm ?? m)?.tbt;
    if (tbt !== undefined && tbt > 600 && !ctx.psi?.lab?.tbt) f.push(F("perf.tbt", tbt > 1200 ? "high" : "medium", "javascript", `Main thread blocked for ${ms(tbt)}`, `Long JavaScript tasks blocked the page for ${ms(tbt)} in Arkria's browser (lab estimate, unthrottled — real phones are slower).`, "The page can't respond to taps while scripts run.", "Defer non-critical scripts and remove heavy libraries.", { pages: hp, affects: ["performance", "mobile", "ux"], source: "browser", effort: "project" }));
    const proto = Object.keys(src.protocols)[0];
    if (proto && /http\/1/i.test(proto)) f.push(F("perf.http1", "low", "technical", "Served over HTTP/1.1", `The homepage document was delivered over ${proto}.`, "HTTP/2 and HTTP/3 load many files in parallel over one connection.", "Enable HTTP/2 (most CDNs and modern hosts do this by default).", { pages: hp, affects: ["performance"], source: "browser" }));
  }
  if (ctx.psi?.lab?.tbt !== undefined && ctx.psi.lab.tbt > 600) f.push(F("perf.tbt", ctx.psi.lab.tbt > 1200 ? "high" : "medium", "javascript", `Total Blocking Time ${ms(ctx.psi.lab.tbt)}`, `Google Lighthouse (mobile) measured ${ms(ctx.psi.lab.tbt)} of blocking time; good is under 200 ms.`, "The page can't respond to taps while scripts run.", "Defer non-critical JavaScript and reduce third-party scripts.", { pages: hp, affects: ["performance", "mobile", "ux"], source: "pagespeed", effort: "project" }));
  if (ctx.psi?.scores) {
    const p = ctx.psi.scores.performance;
    if (p >= 90) s.push(S("performance", `Google PageSpeed mobile performance ${p}/100`));
    if (!ctx.desk && !ctx.mob) for (const o of ctx.psi.opportunities ?? []) f.push(F(`psi.${o.id}`, (o.savingsMs ?? 0) > 1500 ? "high" : (o.savingsMs ?? 0) > 500 ? "medium" : "low", "performance", o.title, `Google PageSpeed estimates ${o.savingsMs ? `${ms(o.savingsMs)}` : ""}${o.savingsMs && o.savingsBytes ? " and " : ""}${o.savingsBytes ? kb(o.savingsBytes) : ""} of savings.`, "Slower loading on mobile.", o.title, { pages: hp, affects: ["performance"], source: "pagespeed" }));
  }

  // --- Render-blocking (HTML) ---
  if (home) {
    const blocking = home.scripts.filter((x) => x.src && x.inHead && !x.async && !x.defer && !x.module);
    if (blocking.length > 2) f.push(F("perf.render_blocking_js", "medium", "javascript", `${plural(blocking.length, "render-blocking script")} in <head>`, `Scripts without async/defer in the head: ${list(blocking.map((x) => (x.src ?? "").split("/").pop()!.split("?")[0]))}.`, "The browser can't show anything until these download and run.", "Add defer (or async) to scripts that aren't needed for first paint, or move them to the end of the body.", { pages: hp, affects: ["performance"], source: "html" }));
    const css = home.stylesheets.filter((x) => x.inHead);
    if (css.length > 6) f.push(F("perf.render_blocking_css", "low", "css", `${css.length} stylesheets block rendering`, `The homepage loads ${css.length} separate stylesheets in <head>.`, "Each stylesheet must download before the page paints.", "Combine stylesheets and inline the critical CSS for the first screen.", { pages: hp, affects: ["performance"], source: "html" }));
    if (!home.preconnects && home.scripts.filter((x) => x.src && !x.src.includes(ctx.site.host)).length > 3) f.push(F("perf.preconnect", "info", "performance", "No preconnect hints for third-party origins", "The page loads several third-party scripts but declares no preconnect/dns-prefetch.", "Connections to other domains start late.", "Add <link rel=\"preconnect\"> for the most important third-party origins (fonts, CDN).", { pages: hp, source: "html" }));
  }

  // --- Images ---
  const imgs = (ctx.mob?.images ?? ctx.desk?.images ?? []).filter((i) => !i.broken && i.naturalW > 0);
  const dpr = ctx.mob?.images ? 2 : 1;
  if (imgs.length) {
    const oversized = imgs.filter((i) => i.renderedW > 0 && i.naturalW > i.renderedW * dpr * 1.5 && (i.bytes ?? 0) > 80_000 && i.format !== "svg");
    const oversizedSet = new Set(oversized.map((i) => i.src));
    if (oversized.length) {
      const waste = oversized.reduce((a, i) => a + (i.bytes ?? 0) * (1 - Math.min(1, ((i.renderedW * dpr) / i.naturalW) ** 2)), 0);
      const x = oversized.sort((a, b) => (b.bytes ?? 0) - (a.bytes ?? 0))[0];
      f.push(F("img.oversized", waste > 1_000_000 ? "high" : "medium", "images", `${plural(oversized.length, "oversized image")}`,
        `Image displayed at ${x.renderedW}px but downloaded at ${x.naturalW}px (${x.src.split("/").pop()!.split("?")[0].slice(0, 50)}, ${kb(x.bytes)}). About ${kb(waste)} could be saved.`,
        "Visitors download far more pixels than they see.", "Resize images to their displayed size (×2 for retina) and serve responsive srcset sizes.",
        { pages: hp, affects: ["performance", "mobile"], source: "browser", samples: oversized.slice(0, 6).map((i) => `${i.src.split("/").pop()!.split("?")[0].slice(0, 50)}: shown ${i.renderedW}px, file ${i.naturalW}px, ${kb(i.bytes)}`) }));
    }
    const heavy = imgs.filter((i) => (i.bytes ?? 0) > 400_000 && !oversizedSet.has(i.src));
    if (heavy.length) f.push(F("img.heavy", heavy.some((i) => (i.bytes ?? 0) > 1_000_000) ? "high" : "medium", "images", `${plural(heavy.length, "image")} over 400 KB`, `Largest: ${list(heavy.sort((a, b) => (b.bytes ?? 0) - (a.bytes ?? 0)).map((i) => `${i.src.split("/").pop()!.split("?")[0].slice(0, 40)} (${kb(i.bytes)})`), 3)}.`, "Large images are the most common cause of slow pages.", "Compress (quality 70–80) and convert to WebP/AVIF.", { pages: hp, affects: ["performance", "mobile"], source: "browser" }));
    const legacy = imgs.filter((i) => ["jpg", "png"].includes(i.format) && (i.bytes ?? 0) > 100_000);
    if (legacy.length >= 2 && !imgs.some((i) => ["webp", "avif"].includes(i.format))) f.push(F("img.formats", "medium", "images", "No modern image formats", `${plural(legacy.length, "JPEG/PNG image")} over 100 KB and no WebP/AVIF images were found.`, "WebP/AVIF are typically 25–50% smaller at the same quality.", "Serve WebP or AVIF (most CMSs and CDNs can convert automatically).", { pages: hp, affects: ["performance"], source: "browser" }));
    else if (imgs.some((i) => ["webp", "avif"].includes(i.format))) s.push(S("images", "Uses modern image formats (WebP/AVIF)"));
    const noLazy = imgs.filter((i) => !i.inViewport && !i.lazy && i.role !== "icon");
    if (noLazy.length >= 5) f.push(F("img.lazy", "low", "images", `${plural(noLazy.length, "below-the-fold image")} not lazy-loaded`, `${noLazy.length} images below the first screen load immediately.`, "They compete with the first screen for bandwidth.", "Add loading=\"lazy\" to images below the first screen.", { pages: hp, affects: ["performance"], source: "browser" }));
    const hero = imgs.find((i) => i.role === "hero");
    if (hero?.lazy) f.push(F("img.lazy_hero", "medium", "images", "Main (hero) image is lazy-loaded", `The first-screen image ${hero.src.split("/").pop()!.split("?")[0].slice(0, 50)} has loading="lazy".`, "Lazy-loading the hero delays the largest paint.", "Remove loading=\"lazy\" from the hero image and add fetchpriority=\"high\".", { pages: hp, affects: ["performance"], source: "browser" }));
    const noDims = imgs.filter((i) => !i.hasDims && i.role !== "icon");
    if (noDims.length >= 5) f.push(F("img.dimensions", "low", "images", `${plural(noDims.length, "image")} without width/height`, `${noDims.length} images have no width and height attributes.`, "The layout shifts as images load (CLS).", "Set width and height (or CSS aspect-ratio) on images.", { pages: hp, affects: ["performance", "ux"], source: "browser" }));
    const noSrcset = imgs.filter((i) => !i.srcset && i.renderedW >= 300 && (i.bytes ?? 0) > 150_000);
    if (noSrcset.length >= 3) f.push(F("img.srcset", "low", "images", "Large images without responsive sizes", `${noSrcset.length} large images have no srcset, so phones download the desktop size.`, "Mobile visitors download oversized files.", "Provide srcset/sizes (or a CDN image service).", { pages: hp, affects: ["performance", "mobile"], source: "browser" }));
  }
  const broken = (ctx.desk?.images ?? []).concat(ctx.mob?.images ?? []).filter((i) => i.broken);
  if (broken.length) f.push(F("img.broken", "medium", "images", `${plural(new Set(broken.map((b) => b.src)).size, "broken image")}`, `These images failed to load: ${list([...new Set(broken.map((i) => i.src.split("/").pop()!.slice(0, 50)))])}.`, "Broken images look unprofessional.", "Fix or remove the missing image files.", { pages: hp, affects: ["ux", "trust"], source: "browser" }));
  const stock = ctx.pages.reduce((a, p) => a + p.trust.stockImages, 0);
  if (stock >= 3) f.push(F("img.stock", "info", "images", "Stock photography detected", `${stock} images are served from stock-photo libraries.`, "Stock images can feel generic; real photos of the team and work build trust.", "Replace key stock images with real photography.", { affects: ["trust", "design"], kind: "business", source: "html" }));

  // --- Fonts ---
  const run = ctx.desk ?? ctx.mob;
  if (run?.fonts) {
    const loaded = run.fonts.filter((x) => x.status === "loaded");
    const families = [...new Set(loaded.map((x) => x.family))].filter((x) => !/icon|awesome|material|eicons|dashicons|glyph/i.test(x));
    const variants = loaded.filter((x) => families.includes(x.family)).length;
    const fontBytes = run.fontFiles?.reduce((a, x) => a + x.bytes, 0) ?? 0;
    if (families.length > 3) f.push(F("fonts.families", "low", "fonts", `${families.length} font families loaded`, `Loaded: ${list(families, 5)}.`, "Extra families add download time and weaken visual consistency.", "Use one or two families (one for headings, one for text).", { pages: hp, affects: ["performance", "design"], source: "browser" }));
    if (variants > 8) f.push(F("fonts.variants", "low", "fonts", `${variants} font weights/styles loaded`, `${variants} font variants were loaded for ${list(families)}.`, "Each weight is a separate download.", "Keep to 3–4 weights (e.g. 400, 500, 700).", { pages: hp, affects: ["performance"], source: "browser" }));
    if (fontBytes > 300_000) f.push(F("fonts.bytes", "medium", "fonts", `Fonts weigh ${kb(fontBytes)}`, `${plural(run.fontFiles?.length ?? 0, "font file")} totalling ${kb(fontBytes)}.`, "Text may appear late or shift while fonts load.", "Subset fonts, use WOFF2 and drop unused weights.", { pages: hp, affects: ["performance"], source: "browser" }));
    const legacyFmt = run.fontFiles?.filter((x) => /ttf|otf|eot|woff$/.test(x.format)) ?? [];
    if (legacyFmt.length) f.push(F("fonts.format", "low", "fonts", "Fonts not in WOFF2", `${list(legacyFmt.map((x) => x.url.split("/").pop()!.split("?")[0]))} use older formats.`, "WOFF2 is ~30% smaller.", "Serve fonts as WOFF2.", { pages: hp, affects: ["performance"], source: "browser" }));
    if (run.fontDisplay) {
      const blocking = run.fontDisplay.filter((x) => !/swap|optional|fallback/.test(x.display) && !/icon|awesome/i.test(x.family));
      if (blocking.length) f.push(F("fonts.display", "low", "fonts", "Text hidden while fonts load", `@font-face rules without font-display: swap: ${list([...new Set(blocking.map((x) => x.family))])}.`, "Text can stay invisible for up to 3 seconds on slow connections.", "Add font-display: swap to @font-face rules (for Google Fonts, add &display=swap).", { pages: hp, affects: ["performance", "ux"], source: "browser" }));
    }
    if (families.length && families.length <= 2) s.push(S("fonts", `Focused typography (${families.join(", ")})`));
  }

  // --- JavaScript ---
  if (ctx.desk?.scripts) {
    const js = ctx.desk.scripts;
    const total = js.reduce((a, x) => a + x.bytes, 0);
    const unused = js.reduce((a, x) => a + (x.unusedBytes ?? 0), 0);
    if (total > 1_000_000) f.push(F("js.bytes", "high", "javascript", `${kb(total)} of JavaScript`, `${plural(js.length, "script")} downloaded ${kb(total)} on the homepage.`, "JavaScript is the most expensive resource for phones to process.", "Remove unused libraries and plugins; split code per page.", { pages: hp, affects: ["performance", "mobile"], source: "browser", effort: "project" }));
    else if (total > 500_000) f.push(F("js.bytes", "medium", "javascript", `${kb(total)} of JavaScript`, `${plural(js.length, "script")} downloaded ${kb(total)} on the homepage.`, "Heavy scripts delay interactivity on phones.", "Audit plugins and third-party tags; remove what isn't needed.", { pages: hp, affects: ["performance"], source: "browser" }));
    if (unused > 200_000 && total && unused / total > 0.4) f.push(F("js.unused", "medium", "javascript", `About ${kb(unused)} of JavaScript is unused on load`, `Chrome code coverage: ${Math.round((unused / total) * 100)}% of downloaded JavaScript didn't run on the homepage.`, "Visitors download and parse code the page doesn't use.", "Load scripts only on pages that need them; remove unused plugins.", { pages: hp, affects: ["performance"], source: "browser", samples: js.filter((x) => (x.unusedBytes ?? 0) > 30_000).slice(0, 5).map((x) => `${x.url.split("/").pop()!.split("?")[0].slice(0, 50)}: ${kb(x.unusedBytes)} unused of ${kb(x.bytes)}`) }));
    const heavy = js.filter((x) => x.bytes > 300_000);
    if (heavy.length) f.push(F("js.heavy", "low", "javascript", `${plural(heavy.length, "very large script")}`, list(heavy.map((x) => `${x.url.split("/").pop()!.split("?")[0].slice(0, 40)} (${kb(x.bytes)})`)), "Single large scripts block the main thread.", "Split or replace heavy dependencies.", { pages: hp, affects: ["performance"], source: "browser" }));
    const jq = js.filter((x) => /jquery[.-]?\d?[\d.]*(\.min)?\.js/i.test(x.url) && !/migrate|ui|plugin/i.test(x.url));
    if (jq.length > 1) f.push(F("js.duplicate_jquery", "medium", "javascript", "jQuery loaded more than once", `${jq.length} copies: ${list(jq.map((x) => x.url.split("/").pop()!))}.`, "Duplicate libraries waste bandwidth and can conflict.", "Load a single jQuery version.", { pages: hp, affects: ["performance", "technical"], source: "browser" }));
  }
  const errs = [...(ctx.desk?.consoleErrors ?? []), ...(ctx.mob?.consoleErrors ?? [])];
  if (errs.length) f.push(F("js.errors", errs.length >= 3 ? "medium" : "low", "technical", `${plural(new Set(errs).size, "JavaScript error")} on the homepage`, `Browser console: ${[...new Set(errs)].slice(0, 2).map((e) => `"${e.slice(0, 120)}"`).join("; ")}.`, "Errors can break sliders, menus or forms for some visitors.", "Have a developer fix the errors shown in the browser console.", { pages: hp, affects: ["technical", "ux"], source: "browser", samples: [...new Set(errs)].slice(0, 6) }));
  if (home && ctx.desk?.renderedWords && home.wordCount < 80 && ctx.desk.renderedWords > 250) f.push(F("js.csr", "medium", "seo", "Content only appears after JavaScript runs", `The raw HTML contains ${home.wordCount} words; after JavaScript the page shows ${ctx.desk.renderedWords}.`, "Search engines and link previews may see an almost empty page, and first paint is delayed.", "Use server-side rendering or static generation for main content.", { pages: hp, affects: ["seo", "performance"], source: "browser", effort: "project" }));

  // --- CSS ---
  if (ctx.desk?.stylesheets) {
    const css = ctx.desk.stylesheets;
    const total = css.reduce((a, x) => a + x.bytes, 0);
    const unused = css.reduce((a, x) => a + (x.unusedBytes ?? 0), 0);
    if (total > 300_000) f.push(F("css.bytes", "medium", "css", `${kb(total)} of CSS`, `${plural(css.length, "stylesheet")} totalling ${kb(total)}.`, "All of this must download before the page renders.", "Remove unused theme/plugin CSS and minify.", { pages: hp, affects: ["performance"], source: "browser" }));
    if (unused > 100_000 && total && unused / total > 0.6) f.push(F("css.unused", "low", "css", `About ${Math.round((unused / total) * 100)}% of CSS is unused`, `Chrome coverage: ~${kb(unused)} of ${kb(total)} CSS wasn't used on the homepage.`, "Unused CSS still blocks rendering.", "Purge unused CSS or split styles per page.", { pages: hp, affects: ["performance"], source: "browser" }));
  }
  if (home && home.inlineStyleBytes > 80_000) f.push(F("css.inline", "low", "css", `${kb(home.inlineStyleBytes)} of inline CSS`, `The homepage HTML embeds ${kb(home.inlineStyleBytes)} of <style> rules.`, "Inline CSS can't be cached between pages.", "Move shared styles to a cached stylesheet; keep only critical CSS inline.", { pages: hp, affects: ["performance"], source: "html" }));

  return { findings: f, strengths: s };
}
