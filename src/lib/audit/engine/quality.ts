import type { AuditResult, Finding, Strength } from "../types";
import { type Ctx, type ModuleOut, finding as F, strength as S, list, path, pagesLike, linkedLike, plural } from "./context";

// Content, trust & credibility, accessibility, security, business-type
// adaptation and e-commerce.

function flesch(text: string) {
  const sentences = text.split(/[.!?]+\s/).filter((x) => x.trim().split(/\s+/).length > 3);
  const words = text.split(/\s+/).filter((w) => /[a-z]/i.test(w));
  if (sentences.length < 5 || words.length < 120) return null;
  const syl = (w: string) => Math.max(1, (w.toLowerCase().replace(/[^a-z]/g, "").replace(/e$/, "").match(/[aeiouy]+/g) ?? []).length);
  const s = words.reduce((a, w) => a + syl(w), 0);
  return Math.round(206.835 - 1.015 * (words.length / sentences.length) - 84.6 * (s / words.length));
}

export function content(ctx: Ctx): ModuleOut & { answers: AuditResult["contentAnswers"] } {
  const f: Finding[] = [];
  const s: Strength[] = [];
  const home = ctx.home;
  const hp = home ? [home.finalUrl] : [];
  const ph = ctx.pages.filter((p) => p.placeholderText);
  if (ph.length) f.push(F("content.placeholder", "high", "content", "Placeholder text is live", `${list(ph.map((p) => `"${p.placeholderText}" on ${path(p.finalUrl)}`))}.`, "Unfinished content signals a neglected or template site and damages trust immediately.", "Replace placeholder text with real content.", { pages: ph.map((p) => p.finalUrl), affects: ["content", "trust"], kind: "business" }));
  if (home && home.wordCount < 150) f.push(F("content.home_thin", "medium", "content", `Homepage has only ${home.wordCount} words`, `The homepage text is ${home.wordCount} words (visible HTML).`, "Visitors and search engines get little information about what you offer.", "Add clear sections: what you do, who it's for, proof (work, reviews), and next steps.", { pages: hp, affects: ["content", "seo"], kind: "business", effort: "project" }));
  const expected: [string, RegExp][] = [["About", /about|who-we-are|our-story|company/], ["Services / products", /services?|solutions?|products?|what-we-do|treatments?|menu|courses?|rooms|propert/], ["Contact", /contact|reach|get-in-touch/]];
  const missing = expected.filter(([, re]) => !pagesLike(ctx, re).length && !linkedLike(ctx, re)).map(([n]) => n);
  if (missing.length) f.push(F("content.missing_pages", missing.includes("Contact") ? "medium" : "low", "content", `Missing expected pages: ${missing.join(", ")}`, `No ${missing.join(" or ")} page was found or linked in ${plural(ctx.pages.length, "crawled page")}.`, "Visitors look for these pages to decide whether to trust and contact a business.", `Add ${missing.join(", ")} page${missing.length > 1 ? "s" : ""}.`, { affects: ["content", "trust", "ux"], kind: "business", effort: "project" }));
  if (home?.copyrightYear && home.copyrightYear <= new Date().getFullYear() - 2) f.push(F("content.stale", "low", "content", "Site looks unmaintained", `The footer says © ${home.copyrightYear}.`, "An old date suggests the business or site isn't active.", "Update the footer year (automatically) and refresh dated content.", { pages: hp, affects: ["trust", "content"], kind: "business" }));
  if (home?.legacy.length) f.push(F("content.legacy", "medium", "technical", "Built with outdated techniques", `The homepage uses ${list(home.legacy.map((x) => /^(font|center|marquee|frameset|blink)$/.test(x) ? `<${x}>` : x))}.`, "Legacy markup is hard to maintain and usually not responsive.", "Rebuild on a modern, responsive stack.", { pages: hp, affects: ["technical", "mobile", "design"], effort: "project" }));
  const long = ctx.pages.map((p) => ({ p, score: flesch(p.text) })).filter((x) => x.score !== null && x.score < 30);
  if (long.length >= 2) f.push(F("content.readability", "low", "content", "Copy is hard to read", `Readability score (Flesch) under 30 on ${list(long.map((x) => `${path(x.p.finalUrl)} (${x.score})`))}, based on the first part of each page.`, "Long sentences and complex words lose visitors, especially on phones.", "Use shorter sentences, plain words and scannable bullet points.", { pages: long.map((x) => x.p.finalUrl), affects: ["content", "ux"], kind: "business" }));
  const svc = pagesLike(ctx, /services?|solutions?|products?|treatments?/).filter((p) => p !== home);
  if (svc.length && svc.every((p) => p.wordCount >= 400)) s.push(S("content", "Detailed service pages (400+ words)"));
  for (const i of ctx.ai?.content.issues ?? []) f.push(F(`ai.content.${f.length}`, i.severity === "critical" ? "high" : i.severity, "content", "Copy: AI analysis", i.observation, "Clear, specific copy helps visitors decide.", "Rewrite the affected copy.", { pages: hp, affects: ["content"], source: "ai", kind: "business" }));

  // Does the content answer the five key questions?
  const ai = ctx.ai;
  const lowerAll = ctx.pages.map((p) => p.text.toLowerCase()).join(" ");
  const answers: AuditResult["contentAnswers"] = [
    ai ? { question: "What do they do?", answer: ai.firstImpression.whatTheyDo.answer, basis: "ai" }
      : { question: "What do they do?", answer: home?.metaDescription || home?.headings.h1[0] ? `Stated in ${home?.headings.h1[0] ? `the H1: "${home.headings.h1[0].slice(0, 100)}"` : `the description: "${home?.metaDescription?.slice(0, 100)}"`}` : "No H1 or description states it", basis: home?.headings.h1[0] || home?.metaDescription ? "detected" : "not_verified" },
    ai ? { question: "Who is it for?", answer: ai.content.whoFor.answer, basis: "ai" } : { question: "Who is it for?", answer: "Not verified — needs AI analysis or a manual read", basis: "not_verified" },
    ai ? { question: "Why choose them?", answer: ai.content.whyChoose.answer, basis: "ai" }
      : { question: "Why choose them?", answer: /why (choose|us)|what makes us|our promise|years of experience/.test(lowerAll) ? "A \"why choose us\"-type section was found" : "No \"why choose us\" section detected", basis: "detected" },
    ai ? { question: "What makes them different?", answer: ai.content.whatsDifferent.answer, basis: "ai" } : { question: "What makes them different?", answer: "Not verified — needs AI analysis or a manual read", basis: "not_verified" },
    ai ? { question: "What should the visitor do next?", answer: ai.content.nextStep.answer, basis: "ai" }
      : { question: "What should the visitor do next?", answer: home?.ctas.length ? `Homepage actions: ${list([...new Set(home.ctas.map((c) => `"${c.text}"`))], 3)}` : "No call-to-action found on the homepage", basis: "detected" },
  ];
  return { findings: f, strengths: s, answers };
}

export function trust(ctx: Ctx): ModuleOut {
  const f: Finding[] = [];
  const s: Strength[] = [];
  const any = (k: keyof (typeof ctx.pages)[number]["trust"]) => ctx.pages.some((p) => !!p.trust[k] && (!Array.isArray(p.trust[k]) || (p.trust[k] as string[]).length > 0));
  const items: [string, boolean][] = [
    ["Testimonials", any("testimonials")], ["Reviews / ratings", any("reviews")], ["Case studies", any("caseStudies")], ["Portfolio / our work", any("portfolio")],
    ["Client logos", any("clientLogos")], ["Certifications / registrations", any("certifications")], ["Awards", any("awards")], ["Team", any("team")],
    ["Company history", any("history")], ["Guarantees", any("guarantees")], ["Social profiles", ctx.pages.some((p) => p.trust.socials.length > 0)],
    ["Privacy policy", ctx.pages.some((p) => p.trust.policies.includes("privacy"))],
  ];
  for (const [k, ok] of items) if (ok) s.push(S("trust", k));
  const socialProof = any("testimonials") || any("reviews") || any("caseStudies");
  if (!socialProof) f.push(F("trust.social_proof", "high", "trust", "No testimonials, reviews or case studies", `None were found across ${plural(ctx.pages.length, "page")}.`, "Social proof is one of the strongest reasons people choose a business.", "Add 3–6 real testimonials with names/photos, embed Google reviews, and publish 2–3 short case studies.", { affects: ["trust", "conversion"], kind: "business" }));
  const portfolioTypes = ["agency", "interior", "real_estate", "portfolio", "manufacturer"];
  if (portfolioTypes.includes(ctx.business.type) && !any("portfolio") && !any("caseStudies")) f.push(F("trust.portfolio", "medium", "trust", "No portfolio or project gallery", `For a ${ctx.business.label.toLowerCase()} business, no portfolio, projects or gallery page was found.`, "Buyers want to see past work before they enquire.", "Add a projects/portfolio section with photos and short descriptions.", { affects: ["trust", "conversion"], kind: "business", effort: "project" }));
  if (!any("team") && !pagesLike(ctx, /about|team/).length) f.push(F("trust.team", "low", "trust", "No team or about information", "No about page or team section was found.", "People buy from people; a faceless site feels less trustworthy.", "Add an about page with the founder/team, story and photos.", { affects: ["trust"], kind: "business" }));
  const hasForms = ctx.pages.some((p) => p.forms.some((x) => x.purpose !== "search"));
  if (hasForms && !ctx.pages.some((p) => p.trust.policies.includes("privacy"))) f.push(F("trust.privacy", "medium", "trust", "No privacy policy", "The site collects details through forms but no privacy policy link was found.", "Visitors (and India's data protection rules) expect to know how personal data is used.", "Publish a privacy policy and link it in the footer and next to forms.", { affects: ["trust", "security"], kind: "business" }));
  if (!ctx.pages.some((p) => p.trust.socials.length)) f.push(F("trust.socials", "low", "trust", "No social media links", "No links to Instagram, Facebook, LinkedIn or YouTube were found.", "Active social profiles reassure visitors the business is real and current.", "Link active social profiles in the header or footer.", { affects: ["trust"], kind: "business" }));
  return { findings: f, strengths: s };
}

const AXE_SEV: Record<string, Finding["severity"]> = { critical: "high", serious: "medium", moderate: "low", minor: "low" };

export function accessibility(ctx: Ctx): ModuleOut {
  const f: Finding[] = [];
  const s: Strength[] = [];
  const run = ctx.desk?.axe ? ctx.desk : undefined;
  if (run?.axe) {
    for (const v of run.axe.violations.slice(0, 20)) f.push(F(`a11y.axe.${v.id}`, AXE_SEV[v.impact] ?? "low", "accessibility", `${v.help} (automated finding)`, `axe-core flagged ${plural(v.nodes, "element")} on the homepage${v.sample ? `, e.g. ${v.sample}` : ""}.${v.tags.length ? ` WCAG: ${v.tags.slice(0, 3).join(", ")}.` : ""}`, "Some visitors — including people using screen readers, keyboards or zoom — may struggle with this.", `See the axe rule "${v.id}" guidance and fix the flagged elements.`, { pages: [run.url], affects: ["accessibility"], source: "axe", kind: "ux" }));
    if (!run.axe.violations.length) s.push(S("accessibility", `No automated WCAG violations found by axe-core on the homepage (${run.axe.passes} rule groups passed)`));
  } else {
    const noAlt = ctx.pages.reduce((a, p) => a + p.a11y.imgNoAlt, 0);
    if (noAlt) f.push(F("a11y.alt", noAlt > 10 ? "medium" : "low", "accessibility", `${plural(noAlt, "image")} without alt text (automated finding)`, `Images with no alt attribute across ${plural(ctx.pages.filter((p) => p.a11y.imgNoAlt).length, "page")}.`, "Screen readers can't describe them and Google can't understand them.", "Add short descriptive alt text; use alt=\"\" for purely decorative images.", { affects: ["accessibility", "seo"], kind: "ux" }));
    const noLabel = ctx.pages.reduce((a, p) => a + p.a11y.inputsNoLabel, 0);
    if (noLabel) f.push(F("a11y.labels", "medium", "accessibility", `${plural(noLabel, "form field")} without a label (automated finding)`, "Inputs without a <label>, aria-label or title.", "Screen-reader users can't tell what to type.", "Give every field a visible label.", { affects: ["accessibility", "conversion"], kind: "ux" }));
    const noName = ctx.pages.reduce((a, p) => a + p.a11y.buttonsNoName + p.a11y.linksNoText, 0);
    if (noName) f.push(F("a11y.names", "medium", "accessibility", `${plural(noName, "button/link")} without an accessible name (automated finding)`, "Icon-only buttons or links with no text or aria-label.", "Assistive tech announces them as just \"button\" or \"link\".", "Add aria-label to icon buttons and links.", { affects: ["accessibility"], kind: "ux" }));
  }
  const d = ctx.desk?.design;
  if (d && d.contrastFails.length >= 3 && !run?.axe?.violations.some((v) => v.id === "color-contrast")) f.push(F("a11y.contrast", "medium", "accessibility", `Low text contrast (${d.contrastFails.length} of ${d.contrastChecked} checked, automated finding)`, `e.g. "${d.contrastFails[0].text}" at ${d.contrastFails[0].ratio}:1 (needs ${d.contrastFails[0].large ? "3" : "4.5"}:1).`, "Low-contrast text is hard to read in sunlight and for people with low vision.", "Darken text or lighten backgrounds to meet WCAG AA contrast.", { pages: ctx.home ? [ctx.home.finalUrl] : [], affects: ["accessibility", "design"], source: "browser", kind: "ux", samples: d.contrastFails.map((c) => `"${c.text}" ${c.ratio}:1 (${c.fg} on ${c.bg})`) }));
  if (ctx.home && !ctx.home.a11y.skipLink && ctx.home.nav.items.length > 5) f.push(F("a11y.skip", "low", "accessibility", "No skip-to-content link (automated finding)", "Keyboard users must tab through the whole menu on every page.", "Slower navigation for keyboard and screen-reader users.", "Add a \"Skip to main content\" link as the first focusable element.", { pages: [ctx.home.finalUrl], affects: ["accessibility"], kind: "ux" }));
  if (ctx.home && !ctx.home.a11y.landmarks.includes("main")) f.push(F("a11y.main", "low", "accessibility", "No <main> landmark (automated finding)", "The homepage has no <main> element or role=\"main\".", "Screen-reader users can't jump to the main content.", "Wrap the page content in <main>.", { pages: [ctx.home.finalUrl], affects: ["accessibility"], kind: "ux" }));
  const tab = ctx.pages.reduce((a, p) => a + p.a11y.positiveTabindex, 0);
  if (tab) f.push(F("a11y.tabindex", "low", "accessibility", "Custom tab order (automated finding)", `${plural(tab, "element")} use a positive tabindex.`, "Keyboard focus jumps around unpredictably.", "Remove positive tabindex values and rely on document order.", { affects: ["accessibility"], kind: "ux" }));
  return { findings: f, strengths: s };
}

export function security(ctx: Ctx): ModuleOut {
  const f: Finding[] = [];
  const s: Strength[] = [];
  const h = Object.fromEntries(Object.entries(ctx.site.headers).map(([k, v]) => [k.toLowerCase(), v]));
  const hasForms = ctx.pages.some((p) => p.forms.some((x) => x.purpose !== "search"));
  if (!ctx.site.https) f.push(F("sec.https", hasForms ? "critical" : "high", "security", "No HTTPS", `The site loads over http://${ctx.site.host}${hasForms ? " and collects form data" : ""}.`, "Browsers mark it \"Not secure\"; form data travels unencrypted.", "Install a free SSL certificate (e.g. Let's Encrypt or Cloudflare) and redirect all traffic to https.", { affects: ["security", "trust", "seo"], source: "headers", kind: "technical" }));
  if (ctx.site.tls) {
    const t = ctx.site.tls;
    if (!t.valid) f.push(F("sec.cert", "critical", "security", "SSL certificate problem", `Certificate check failed: ${t.error ?? "not trusted"}.`, "Visitors see a full-page security warning.", "Renew or reissue the certificate for this domain.", { affects: ["security", "trust"], source: "tls" }));
    else if ((t.daysLeft ?? 99) < 14) f.push(F("sec.cert_expiry", "high", "security", `SSL certificate expires in ${t.daysLeft} days`, `Issued by ${t.issuer ?? "unknown"}, valid until ${t.validTo?.slice(0, 10)}.`, "When it expires, visitors will see a security warning.", "Renew now and enable auto-renewal.", { affects: ["security"], source: "tls" }));
    else s.push(S("security", `Valid SSL certificate (${t.issuer ?? "issuer unknown"}, ${t.protocol ?? ""})`, `Expires ${t.validTo?.slice(0, 10)}`));
  }
  const mixed = ctx.pages.filter((p) => p.mixedContent.length);
  if (mixed.length) f.push(F("sec.mixed", "medium", "security", "Insecure (http) resources on secure pages", `e.g. ${mixed[0].mixedContent[0]} on ${path(mixed[0].finalUrl)}.`, "Browsers block or warn about mixed content.", "Load every image, script and style over https.", { pages: mixed.map((p) => p.finalUrl), affects: ["security"] }));
  if (ctx.site.https) {
    const missing: string[] = [];
    if (!h["strict-transport-security"]) missing.push("Strict-Transport-Security (HSTS)");
    if (!h["content-security-policy"]) missing.push("Content-Security-Policy");
    if (!h["x-content-type-options"]) missing.push("X-Content-Type-Options");
    if (!h["referrer-policy"]) missing.push("Referrer-Policy");
    if (!h["x-frame-options"] && !/frame-ancestors/i.test(h["content-security-policy"] ?? "")) missing.push("X-Frame-Options / frame-ancestors");
    if (!h["permissions-policy"]) missing.push("Permissions-Policy");
    if (missing.length >= 3) f.push(F("sec.headers", missing.length >= 5 ? "medium" : "low", "security", `${plural(missing.length, "security header")} missing`, `Not set on the homepage response: ${missing.join(", ")}.`, "These headers protect visitors against clickjacking, content sniffing and downgrade attacks.", "Add the missing headers at the server or CDN (Cloudflare can add most in minutes).", { affects: ["security"], source: "headers" }));
    else if (missing.length === 0) s.push(S("security", "All common security headers are set"));
  }
  const cookies = ctx.site.cookies.filter((c) => !c.secure || !c.httpOnly);
  if (ctx.site.https && cookies.length) f.push(F("sec.cookies", "low", "security", "Cookies without Secure/HttpOnly flags", `${list(cookies.map((c) => `${c.name}${!c.secure ? " (no Secure)" : ""}${!c.httpOnly ? " (no HttpOnly)" : ""}`))}.`, "Cookies may be exposed to scripts or sent over insecure connections.", "Set Secure and HttpOnly (and SameSite) on session cookies.", { affects: ["security"], source: "headers" }));
  const exposed = [h["server"], h["x-powered-by"]].filter((v) => v && /\d/.test(v)) as string[];
  if (exposed.length) f.push(F("sec.versions", "low", "security", "Server software versions exposed", `Response headers reveal: ${exposed.join("; ")}.`, "Version numbers help attackers look up known vulnerabilities.", "Hide version numbers in Server and X-Powered-By headers.", { affects: ["security"], source: "headers" }));
  const php = (h["x-powered-by"] ?? "").match(/PHP\/(\d+)\.(\d+)/i);
  if (php && (Number(php[1]) < 8 || (Number(php[1]) === 8 && Number(php[2]) < 1))) f.push(F("sec.php_eol", "medium", "security", `End-of-life PHP version (${php[0]})`, `X-Powered-By: ${h["x-powered-by"]}. This PHP version no longer receives security updates.`, "Unpatched server software is a security risk.", "Upgrade to a supported PHP version (8.2+) with your host.", { affects: ["security", "technical"], source: "headers", effort: "project" }));
  const jq = ctx.pages.flatMap((p) => p.tech).find((t) => t.name === "jQuery" && t.version);
  if (jq?.version) {
    const [a, b] = jq.version.split(".").map(Number);
    if (a < 3 || (a === 3 && b < 5)) f.push(F("sec.jquery", "medium", "security", `Outdated jQuery ${jq.version}`, `${jq.evidence}. jQuery versions before 3.5 have publicly documented XSS issues.`, "Known-vulnerable libraries are a common security weakness.", "Update jQuery (and plugins that depend on it) to 3.7+.", { affects: ["security", "technical"] }));
  }
  const wp = ctx.pages.flatMap((p) => p.tech).find((t) => t.name === "WordPress" && t.version);
  if (wp?.version) f.push(F("sec.wp_version", "low", "security", `WordPress version publicly visible (${wp.version})`, `The generator tag reveals WordPress ${wp.version}.`, "Publishing the exact version makes targeted attacks easier.", "Remove the generator meta tag and keep WordPress updated.", { affects: ["security"] }));
  return { findings: f, strengths: s };
}

// Business-type specific expectations.
const EXPECT: Partial<Record<Ctx["business"]["type"], { what: string; re: RegExp; why: string }[]>> = {
  real_estate: [
    { what: "property listings / projects", re: /propert|projects?|listings?|apartments?|villas?|plots?|bhk|floor plan/, why: "Buyers want to browse available properties." },
    { what: "property details (area, configuration, price)", re: /sq\.? ?ft|sqft|carpet area|super built|\bbhk\b|price on request|₹/, why: "Details qualify buyers before they call." },
    { what: "brochure / floor-plan download", re: /brochure|floor ?plan|download/, why: "A brochure download is a classic real-estate lead capture." },
    { what: "site visit booking", re: /site visit|schedule a visit|book a visit/, why: "Site visits are the key conversion step." },
  ],
  restaurant: [
    { what: "menu", re: /\bmenu\b/, why: "The menu is the most visited restaurant page." },
    { what: "table reservation", re: /reserv|book a table|table booking/, why: "Online bookings capture diners who won't call." },
    { what: "online ordering / delivery links", re: /order online|swiggy|zomato|delivery|takeaway/, why: "Diners expect to order directly." },
    { what: "opening hours", re: /open(ing)? hours|timings|mon(day)?\s*[-–]|\bam\b.*\bpm\b/, why: "People check hours before visiting." },
  ],
  saas: [
    { what: "demo / trial CTA", re: /book a demo|request a demo|free trial|start (for )?free|try (it )?free/, why: "Software buyers want to try before they buy." },
    { what: "pricing", re: /pricing|plans/, why: "Pricing transparency speeds up decisions." },
    { what: "features page", re: /features|product tour|how it works/, why: "Buyers need to understand capabilities." },
    { what: "documentation / help", re: /docs|documentation|help center|knowledge base|api reference/, why: "Docs reassure technical evaluators." },
  ],
  clinic: [
    { what: "online appointment booking", re: /book (an )?appointment|appointment|consultation booking/, why: "Patients expect to book online." },
    { what: "doctor profiles", re: /\bdr\.|doctors?|our (team|specialists)|consultants?/, why: "Patients choose clinics by their doctors." },
    { what: "treatments / services list", re: /treatments?|services?|procedures?|specialit/, why: "Patients search for specific treatments." },
    { what: "timings and location", re: /timings|opening hours|clinic hours|map|directions/, why: "Needed before visiting." },
  ],
  law: [
    { what: "practice areas", re: /practice areas?|expertise|services/, why: "Clients search by legal need." },
    { what: "lawyer profiles and credentials", re: /advocate|partners?|our (team|lawyers)|bar council|enrolled/, why: "Credentials drive trust in legal services." },
    { what: "consultation CTA", re: /consultation|book a (call|meeting)|contact us/, why: "The first consultation is the conversion." },
  ],
  hotel: [
    { what: "rooms", re: /rooms?|suites?|accommodation/, why: "Guests compare room types." },
    { what: "direct booking", re: /book now|check availability|reserve/, why: "Direct bookings avoid OTA commissions." },
    { what: "amenities", re: /amenities|facilities|pool|spa|restaurant/, why: "Amenities drive choice." },
    { what: "gallery", re: /gallery|photos/, why: "Guests book on visuals." },
  ],
  education: [
    { what: "courses / programmes", re: /courses?|programs?|programmes?|batches/, why: "Students search by course." },
    { what: "admissions / enquiry", re: /admissions?|enrol|apply now|enquir/, why: "Admissions enquiries are the conversion." },
    { what: "fees", re: /fees?|fee structure/, why: "Fees are a top question for parents and students." },
    { what: "results / placements", re: /results|placements?|toppers|success stories/, why: "Outcomes are the strongest proof." },
  ],
  manufacturer: [
    { what: "product catalogue", re: /products?|catalog(ue)?|range/, why: "B2B buyers browse specs first." },
    { what: "enquiry / RFQ", re: /enquir|request (a )?quote|rfq|get quote/, why: "Quote requests are the B2B conversion." },
    { what: "certifications", re: /iso|certif|approved|bis|ce mark/, why: "Certifications are required by many buyers." },
    { what: "industries served", re: /industries|applications|sectors|clients/, why: "Buyers look for relevant experience." },
  ],
  interior: [
    { what: "project portfolio", re: /projects?|portfolio|gallery|our work/, why: "Clients hire designers based on past work." },
    { what: "design process", re: /process|how we work|approach|steps/, why: "Explaining the process reduces hesitation." },
    { what: "consultation / site visit CTA", re: /consultation|site visit|book a (call|meeting)|free estimate/, why: "The consultation is the conversion." },
  ],
  agency: [
    { what: "case studies / work", re: /case stud|our work|portfolio|projects/, why: "Agencies are hired on results." },
    { what: "services", re: /services|what we do|capabilities/, why: "Buyers need to see the offer clearly." },
    { what: "process", re: /process|how we work|approach/, why: "A clear process builds confidence." },
  ],
};

export function business(ctx: Ctx): ModuleOut {
  const f: Finding[] = [];
  const s: Strength[] = [];
  const exp = EXPECT[ctx.business.type];
  if (exp) {
    const corpus = ctx.pages.map((p) => `${path(p.finalUrl)} ${p.title ?? ""} ${p.headings.h1.join(" ")} ${p.headings.h2.join(" ")} ${p.nav.items.join(" ")} ${p.ctas.map((c) => c.text).join(" ")} ${p.text}`.toLowerCase()).join(" ");
    const links = ctx.pages.flatMap((p) => p.internalLinks.map((l) => `${path(l.url)} ${l.text}`.toLowerCase())).join(" ");
    for (const e of exp) {
      if (e.re.test(corpus) || e.re.test(links)) s.push(S("business", `Has ${e.what}`, `Expected for ${ctx.business.label.toLowerCase()} websites`));
      else f.push(F(`biz.${e.what.split(" ")[0]}`, "medium", "conversion", `No ${e.what} detected`, `Expected for ${ctx.business.label.toLowerCase()} websites; not found in ${plural(ctx.pages.length, "crawled page")}.`, e.why, `Add ${e.what}.`, { affects: ["conversion", "content"], kind: "business", effort: "project" }));
    }
  }
  if (ctx.ecommerce) {
    const any = (fn: (p: (typeof ctx.pages)[number]) => boolean) => ctx.pages.some(fn);
    const productPages = ctx.pages.filter((p) => p.ecommerce.productSchema || p.ecommerce.addToCart);
    if (productPages.length && !productPages.some((p) => p.ecommerce.productSchema)) f.push(F("ecom.schema", "medium", "ecommerce", "No Product structured data", `${plural(productPages.length, "product page")} found without Product markup.`, "Google can't show price, stock and ratings in results.", "Add Product schema with price, availability and aggregateRating.", { pages: productPages.slice(0, 5).map((p) => p.finalUrl), affects: ["seo", "conversion"] }));
    if (!any((p) => p.trust.policies.some((x) => /return|refund/.test(x)))) f.push(F("ecom.returns", "high", "ecommerce", "No returns / refund policy", "No returns or refund policy link was found.", "Shoppers hesitate to buy without a clear returns policy.", "Publish a returns & refund policy and link it in the footer and on product pages.", { affects: ["trust", "conversion"], kind: "business" }));
    if (!any((p) => p.trust.policies.includes("shipping") || /shipping|delivery/i.test(p.text))) f.push(F("ecom.shipping", "medium", "ecommerce", "No shipping information", "No shipping or delivery information was found.", "Unknown delivery cost/time is a top reason for cart abandonment.", "Show delivery time and cost on product pages and a shipping policy page.", { affects: ["conversion"], kind: "business" }));
    if (!any((p) => p.search)) f.push(F("ecom.search", "medium", "ecommerce", "No product search", "No search box was found in the store.", "Shoppers who know what they want can't find it quickly.", "Add product search with suggestions.", { affects: ["ux", "conversion"], kind: "ux" }));
    if (!any((p) => p.ecommerce.filters) && productPages.length >= 5) f.push(F("ecom.filters", "low", "ecommerce", "No filters or sorting detected", "No filter/sort controls were found on listing pages.", "Browsing larger catalogues is slow without filters.", "Add filters (price, size, category) and sorting.", { affects: ["ux", "conversion"], kind: "ux" }));
    if (!productPages.some((p) => p.trust.reviews)) f.push(F("ecom.reviews", "medium", "ecommerce", "No product reviews", "No reviews or ratings were found on product pages.", "Reviews are among the strongest purchase drivers.", "Collect and display product reviews (with Product/AggregateRating markup).", { affects: ["trust", "conversion"], kind: "business" }));
    const payments = ctx.pages.flatMap((p) => p.tech).filter((t) => t.category === "Payments").map((t) => t.name);
    if (payments.length) s.push(S("ecommerce", `Payment provider detected: ${[...new Set(payments)].join(", ")}`));
    if (any((p) => p.ecommerce.wishlist)) s.push(S("ecommerce", "Wishlist available"));
  }
  return { findings: f, strengths: s };
}
