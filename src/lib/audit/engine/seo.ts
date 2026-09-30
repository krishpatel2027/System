import type { AuditResult, Finding, Strength } from "../types";
import { type Ctx, type ModuleOut, finding as F, strength as S, list, path, pagesLike, plural } from "./context";

// Technical + on-page SEO, structured data, and local SEO.

const dupes = <T,>(items: { key: T; url: string }[]) => {
  const m = new Map<T, string[]>();
  for (const i of items) m.set(i.key, [...(m.get(i.key) ?? []), i.url]);
  return [...m.entries()].filter(([, v]) => v.length > 1);
};

export function seo(ctx: Ctx): ModuleOut {
  const f: Finding[] = [];
  const s: Strength[] = [];
  const pages = ctx.pages;
  const home = ctx.home;
  const hp = home ? [home.finalUrl] : [];

  // Crawl directives
  if (ctx.site.robots.disallowAll) f.push(F("seo.robots_block", "critical", "seo", "robots.txt blocks the whole site", "robots.txt disallows all crawling for general bots (User-agent: * / Disallow: /).", "Search engines are told not to crawl any page.", "Remove the site-wide Disallow unless the site is intentionally private.", { affects: ["seo"], source: "crawl" }));
  if (!ctx.site.robots.found) f.push(F("seo.no_robots", "low", "seo", "No robots.txt file", `${ctx.site.origin}/robots.txt returned ${ctx.site.robots.status ?? "no file"}.`, "robots.txt is where search engines look for your sitemap and crawl rules.", "Add a robots.txt that allows crawling and lists the sitemap URL.", { affects: ["seo"], source: "crawl" }));
  if (!ctx.site.sitemap.found) f.push(F("seo.no_sitemap", "medium", "seo", "No XML sitemap found", `No sitemap at /sitemap.xml, /sitemap_index.xml${ctx.site.robots.sitemaps.length ? " or the robots.txt sitemap" : ""}.`, "Search engines may miss or be slow to discover pages.", "Generate an XML sitemap and submit it in Google Search Console.", { affects: ["seo"], source: "crawl" }));
  else s.push(S("seo", `XML sitemap with ${ctx.site.sitemap.count} URLs`));
  const noindex = pages.filter((p) => /noindex/i.test(p.robotsMeta ?? ""));
  if (noindex.some((p) => p === home)) f.push(F("seo.noindex_home", "critical", "seo", "Homepage is set to noindex", `The homepage has robots directive "${home?.robotsMeta}".`, "Google is told not to show the homepage in search results.", "Remove noindex from the homepage (and other pages meant to rank).", { pages: hp, affects: ["seo"] }));
  else if (noindex.length) f.push(F("seo.noindex", "medium", "seo", `${plural(noindex.length, "page")} set to noindex`, `${list(noindex.map((p) => path(p.finalUrl)))} carry a noindex directive.`, "These pages won't appear in search results — confirm that's intended.", "Remove noindex from any page that should rank.", { pages: noindex.map((p) => p.finalUrl), affects: ["seo"] }));
  if (ctx.site.https && ctx.site.httpRedirectsToHttps === false) f.push(F("seo.http_redirect", "medium", "security", "HTTP version doesn't redirect to HTTPS", `http://${ctx.site.host}/ did not redirect to the secure version.`, "Visitors and search engines can reach an insecure duplicate of the site.", "Force a 301 redirect from http:// to https://.", { affects: ["security", "seo"], source: "crawl" }));

  // Titles & descriptions
  const noTitle = pages.filter((p) => !p.title);
  if (noTitle.length) f.push(F("seo.no_title", noTitle.includes(home!) ? "high" : "medium", "seo", `${plural(noTitle.length, "page")} without a title`, `Missing <title>: ${list(noTitle.map((p) => path(p.finalUrl)))}.`, "The title is the headline Google shows in results.", "Write a unique title per page with the service and city (50–60 characters).", { pages: noTitle.map((p) => p.finalUrl), affects: ["seo"] }));
  const badLen = pages.filter((p) => p.title && (p.title.length < 20 || p.title.length > 65));
  if (badLen.length) f.push(F("seo.title_length", "low", "seo", `${plural(badLen.length, "title")} too short or too long`, `${list(badLen.map((p) => `${path(p.finalUrl)}: "${p.title!.slice(0, 50)}" (${p.title!.length} chars)`), 3)}.`, "Very short titles waste the opportunity; long ones get cut off in results.", "Aim for 30–60 characters including the main keyword and brand.", { pages: badLen.map((p) => p.finalUrl), affects: ["seo"] }));
  const dupT = dupes(pages.filter((p) => p.title).map((p) => ({ key: p.title!.toLowerCase(), url: p.finalUrl })));
  if (dupT.length) f.push(F("seo.dup_titles", "medium", "seo", `${plural(dupT.length, "title")} used on multiple pages`, `e.g. "${dupT[0][0].slice(0, 60)}" is used on ${list(dupT[0][1].map(path))}.`, "Pages compete with each other and Google can't tell them apart.", "Give each page a unique, descriptive title.", { pages: dupT.flatMap(([, v]) => v), affects: ["seo"] }));
  const noDesc = pages.filter((p) => !p.metaDescription);
  if (noDesc.length) f.push(F("seo.no_description", noDesc.includes(home!) ? "medium" : "low", "seo", `${plural(noDesc.length, "page")} without a meta description`, `${noDesc.includes(home!) ? "Including the homepage. " : ""}${list(noDesc.map((p) => path(p.finalUrl)))}.`, "Google writes its own snippet from random page text.", "Add a unique 140–160 character description aligned with each page's search intent.", { pages: noDesc.map((p) => p.finalUrl), affects: ["seo", "conversion"] }));
  const dupD = dupes(pages.filter((p) => p.metaDescription).map((p) => ({ key: p.metaDescription!.toLowerCase(), url: p.finalUrl })));
  if (dupD.length) f.push(F("seo.dup_descriptions", "low", "seo", "Duplicate meta descriptions", `${plural(dupD.length, "description")} repeated across pages (e.g. on ${list(dupD[0][1].map(path))}).`, "Duplicate snippets make results look identical.", "Write a unique description for each important page.", { pages: dupD.flatMap(([, v]) => v), affects: ["seo"] }));
  if (pages.length && !noTitle.length && !noDesc.length && !dupT.length) s.push(S("seo", "Every page has a unique title and meta description"));

  // Headings
  const noH1 = pages.filter((p) => !p.headings.h1.length);
  if (noH1.length) f.push(F("seo.no_h1", noH1.includes(home!) ? "medium" : "low", "seo", `${plural(noH1.length, "page")} without an H1`, `${list(noH1.map((p) => path(p.finalUrl)))}.`, "The H1 tells visitors and Google what the page is about.", "Add one descriptive H1 per page.", { pages: noH1.map((p) => p.finalUrl), affects: ["seo", "accessibility"] }));
  const multiH1 = pages.filter((p) => p.headings.h1.length > 1);
  if (multiH1.length) f.push(F("seo.multi_h1", "low", "seo", `${plural(multiH1.length, "page")} with several H1s`, `e.g. ${path(multiH1[0].finalUrl)}: ${list(multiH1[0].headings.h1.map((h) => `"${h.slice(0, 30)}"`), 3)}.`, "Multiple main headings blur the page topic.", "Keep one H1 and use H2/H3 for sections.", { pages: multiH1.map((p) => p.finalUrl), affects: ["seo"] }));
  const skips = pages.filter((p) => p.headings.skips > 0);
  if (skips.length >= 3) f.push(F("seo.heading_order", "low", "accessibility", "Heading levels skip", `${plural(skips.length, "page")} jump heading levels (e.g. H2 → H4).`, "Screen-reader users navigate by headings; skipped levels confuse structure.", "Use headings in order and style them with CSS instead.", { pages: skips.map((p) => p.finalUrl), affects: ["accessibility", "seo"] }));

  // Content depth & links
  const thin = pages.filter((p) => p.wordCount < 250 && p !== home && !/contact|thank|privacy|terms|login|cart/i.test(path(p.finalUrl)));
  if (thin.length >= 2) f.push(F("seo.thin", "medium", "content", `${plural(thin.length, "page")} with thin content`, `Under 250 words: ${list(thin.map((p) => `${path(p.finalUrl)} (${p.wordCount})`))}.`, "Pages with little text rarely rank and don't answer visitor questions.", "Expand key pages with specifics: what's included, process, pricing guidance, FAQs, examples.", { pages: thin.map((p) => p.finalUrl), affects: ["seo", "content"], kind: "business", effort: "project" }));
  const orphanish = pages.filter((p) => p.internalLinks.length < 3 && p !== home);
  if (orphanish.length >= 3) f.push(F("seo.internal_links", "low", "seo", "Weak internal linking", `${plural(orphanish.length, "page")} link to fewer than 3 other pages on the site.`, "Internal links spread ranking signals and guide visitors onward.", "Link related services, projects and the contact page from every page.", { pages: orphanish.map((p) => p.finalUrl), affects: ["seo", "ux"] }));
  if (ctx.site.sitemap.urls.length) {
    const linked = new Set(ctx.pages.flatMap((p) => p.internalLinks.map((l) => path(l.url).replace(/\/$/, ""))));
    const orphan = ctx.site.sitemap.urls.filter((u) => { const p = path(u).replace(/\/$/, ""); return p && !linked.has(p) && p !== ""; });
    if (orphan.length && ctx.pages.length >= 5) f.push(F("seo.orphans", "low", "seo", `${plural(orphan.length, "sitemap URL")} not linked from crawled pages`, `e.g. ${list(orphan.slice(0, 4).map(path))}. (Orphan-like: listed in the sitemap but no link found in the ${ctx.pages.length} crawled pages.)`, "Pages without internal links are hard for visitors and Google to reach.", "Link these pages from relevant pages or remove them from the sitemap.", { affects: ["seo"], source: "crawl", samples: orphan.slice(0, 20) }));
  }
  const dupContent = dupes(pages.filter((p) => p.wordCount > 50).map((p) => ({ key: p.textHash, url: p.finalUrl })));
  if (dupContent.length) f.push(F("seo.duplicate_pages", "medium", "seo", `${plural(dupContent.length, "set")} of duplicate pages`, `Identical text on ${list(dupContent[0][1].map(path))}.`, "Duplicate pages split ranking signals.", "Consolidate duplicates or add canonical tags pointing to the main version.", { pages: dupContent.flatMap(([, v]) => v), affects: ["seo"] }));

  // Canonical
  const noCanon = pages.filter((p) => !p.canonical);
  if (noCanon.length > pages.length / 2 && pages.length > 2) f.push(F("seo.canonical", "low", "seo", "Canonical tags missing", `${noCanon.length} of ${pages.length} pages have no rel="canonical".`, "Without canonicals, URL variants (tracking parameters, www/non-www) can be indexed as duplicates.", "Add a self-referencing canonical to every page.", { pages: noCanon.slice(0, 10).map((p) => p.finalUrl), affects: ["seo"] }));
  const offsite = pages.filter((p) => { if (!p.canonical) return false; try { return new URL(p.canonical, p.finalUrl).hostname.replace(/^www\./, "") !== ctx.site.host.replace(/^www\./, ""); } catch { return false; } });
  if (offsite.length) f.push(F("seo.canonical_offsite", "high", "seo", "Canonical points to another domain", `${path(offsite[0].finalUrl)} → ${offsite[0].canonical}.`, "Google may index the other domain instead of this one.", "Point canonicals at this site's own URLs.", { pages: offsite.map((p) => p.finalUrl), affects: ["seo"] }));

  // URLs
  const uglyUrls = pages.filter((p) => { const x = path(p.finalUrl); return /[A-Z]/.test(x) || /_/.test(x) || x.length > 100 || /\?(page_id|p|id)=\d/.test(x); });
  if (uglyUrls.length >= 3) f.push(F("seo.urls", "low", "seo", "Unfriendly URL structure", `e.g. ${list(uglyUrls.map((p) => path(p.finalUrl)), 3)}.`, "Clear, lowercase, hyphenated URLs are easier to read and share.", "Use short lowercase URLs with hyphens (e.g. /services/modular-kitchens).", { pages: uglyUrls.map((p) => p.finalUrl), affects: ["seo"], effort: "project" }));

  // Language, social previews
  if (home && !home.lang) f.push(F("seo.lang", "low", "accessibility", "Page language not declared", "The <html> tag has no lang attribute.", "Screen readers and search engines can't tell the language.", "Add lang=\"en\" (or the right language) to <html>.", { pages: hp, affects: ["accessibility", "seo"] }));
  if (home && !home.og) f.push(F("seo.og", "low", "seo", "No social sharing preview", "No Open Graph tags on the homepage.", "Links shared on WhatsApp, LinkedIn or Facebook show no image or summary.", "Add og:title, og:description and og:image.", { pages: hp, affects: ["seo", "conversion"], kind: "business" }));
  const hreflang = pages.filter((p) => p.hreflang.length);
  if (hreflang.length && !hreflang.some((p) => p.hreflang.includes("x-default"))) f.push(F("seo.hreflang", "info", "seo", "hreflang without x-default", `Language alternates are declared (${list([...new Set(hreflang.flatMap((p) => p.hreflang))])}) but no x-default.`, "Visitors in other regions may get the wrong version.", "Add an x-default alternate.", { affects: ["seo"] }));

  // Structured data
  const types = [...new Set(pages.flatMap((p) => p.schema.types))];
  if (types.length) s.push(S("seo", `Structured data detected: ${list(types, 6)}`));
  const invalid = pages.reduce((a, p) => a + p.schema.invalid, 0);
  if (invalid) f.push(F("seo.schema_invalid", "medium", "seo", "Invalid structured data", `${plural(invalid, "JSON-LD block")} couldn't be parsed.`, "Broken markup is ignored by Google.", "Fix the JSON-LD syntax (validate with Google's Rich Results Test).", { affects: ["seo"] }));
  const missing: string[] = [];
  if (ctx.isLocal && !types.some((t) => /LocalBusiness|Organization|Store|Restaurant|Medical|Dentist|Hotel|RealEstate|LegalService|ProfessionalService|HomeAndConstruction|EducationalOrganization/.test(t))) missing.push("LocalBusiness (name, address, phone, hours)");
  if (!ctx.isLocal && !types.some((t) => /Organization|Corporation/.test(t))) missing.push("Organization (name, logo, social profiles)");
  if (ctx.ecommerce && !types.includes("Product")) missing.push("Product (price, availability, reviews)");
  if (pagesLike(ctx, /faq/).length && !types.includes("FAQPage")) missing.push("FAQPage");
  if (ctx.pages.some((p) => p.depth >= 2) && !types.includes("BreadcrumbList")) missing.push("BreadcrumbList");
  if (pagesLike(ctx, /blog|news|article/).length && !types.some((t) => /Article|BlogPosting/.test(t))) missing.push("Article / BlogPosting");
  if (missing.length) f.push(F("seo.schema_missing", ctx.isLocal && missing[0].startsWith("LocalBusiness") ? "medium" : "low", "seo", "Structured data opportunities", `Detected: ${types.length ? list(types, 6) : "none"}. Not detected: ${missing.join("; ")}.`, "Structured data helps Google show rich results (ratings, hours, prices, FAQs).", `Add ${missing.map((m) => m.split(" ")[0]).join(", ")} markup in JSON-LD.`, { affects: ["seo"], effort: "quick" }));

  return { findings: f, strengths: s };
}

export function localSeo(ctx: Ctx): ModuleOut & { local: AuditResult["localSeo"] } {
  const f: Finding[] = [];
  const s: Strength[] = [];
  if (!ctx.isLocal) return { findings: f, strengths: s, local: { applicable: false, rating: "Fair", present: [], missing: [] } };
  const any = (fn: (p: (typeof ctx.pages)[number]) => boolean) => ctx.pages.some(fn);
  const contactPage = pagesLike(ctx, /contact|reach|locat/)[0];
  const phones = [...new Set(ctx.pages.flatMap((p) => p.contact.phones.map((x) => x.replace(/\D/g, "").slice(-10))))];
  const checks: [string, boolean][] = [
    ["Address with PIN code", any((p) => !!p.contact.address)],
    ["Phone number", phones.length > 0],
    ["Opening hours", any((p) => p.contact.hours)],
    ["Embedded map", any((p) => p.contact.mapEmbed)],
    ["Google Business Profile link", any((p) => p.contact.gbpLink)],
    ["LocalBusiness structured data", any((p) => p.schema.types.some((t) => /LocalBusiness|Store|Restaurant|Medical|Dentist|Hotel|RealEstate|LegalService|ProfessionalService|HomeAndConstruction|EducationalOrganization/.test(t)))],
    ["Contact / location page", !!contactPage],
    ["Location or service-area pages", pagesLike(ctx, /locations?|areas?-we-serve|service-areas?|branches|near-me|in-[a-z]+$/).length > 0],
    ["Reviews or testimonials", any((p) => p.trust.testimonials || p.trust.reviews)],
  ];
  const present = checks.filter(([, ok]) => ok).map(([k]) => k);
  const missingList = checks.filter(([, ok]) => !ok).map(([k]) => k);
  if (phones.length > 1) f.push(F("local.phone_consistency", "low", "localSeo", "Different phone numbers across pages", `${phones.length} different numbers found: ${list(phones.map((p) => `…${p.slice(-6)}`))}.`, "Inconsistent contact details (NAP) confuse customers and weaken local rankings.", "Use one primary number consistently, matching the Google Business Profile.", { affects: ["seo", "trust"], kind: "business" }));
  const importantMissing = missingList.filter((m) => /Address|Opening hours|LocalBusiness|Embedded map|Google Business/.test(m));
  if (importantMissing.length) f.push(F("local.missing", importantMissing.length >= 3 ? "medium" : "low", "localSeo", "Local search signals missing", `Not found on the site: ${importantMissing.join(", ")}.`, "Local customers search \"near me\"; these signals help Google show the business in local results and maps.", "Add full address, hours and a map on the contact page and footer, link the Google Business Profile, and add LocalBusiness markup.", { affects: ["seo", "trust", "leadGeneration"], kind: "business" }));
  if (present.length >= 6) s.push(S("localSeo", `Strong local signals (${present.length} of ${checks.length})`));
  return { findings: f, strengths: s, local: { applicable: true, rating: present.length >= 7 ? "Strong" : present.length >= 4 ? "Fair" : "Weak", present, missing: missingList } };
}
