import type { AuditResult, Cta, Finding, PageData, Strength } from "../types";
import { type Ctx, type ModuleOut, finding as F, strength as S, list, path, pagesLike, plural } from "./context";

// UX, navigation, user journeys, conversion, lead generation and forms.

const SERVICE_RE = /\/(services?|solutions?|what-we-do|treatments?|practice-areas?|products?|courses?|programs?|projects?|propert(y|ies)|rooms|menu|offerings?)(\/|$)/;
const CONTACT_RE = /\/(contact|contact-us|get-in-touch|enquir|inquir|book|appointment|reach-us)/;

const keyOf = (u: string) => { try { const x = new URL(u); return `${x.hostname.replace(/^www\./, "")}${x.pathname.replace(/\/$/, "") || "/"}`; } catch { return u; } };

function bfs(ctx: Ctx) {
  const byKey = new Map(ctx.pages.map((p) => [keyOf(p.finalUrl), p]));
  const dist = new Map<string, { d: number; via: string[] }>();
  if (!ctx.home) return dist;
  const start = keyOf(ctx.home.finalUrl);
  dist.set(start, { d: 0, via: ["Home"] });
  const q = [start];
  while (q.length) {
    const k = q.shift()!;
    const p = byKey.get(k);
    if (!p) continue;
    const cur = dist.get(k)!;
    for (const l of p.internalLinks) {
      const lk = keyOf(l.url);
      if (dist.has(lk)) continue;
      const label = l.text && !/^(read more|click here|here|more|learn more)$/i.test(l.text) ? `${l.text} (${path(l.url)})` : path(l.url);
      dist.set(lk, { d: cur.d + 1, via: [...cur.via, label] });
      if (byKey.has(lk)) q.push(lk);
    }
  }
  return dist;
}

const contactable = (p: PageData) => p.forms.some((f) => f.purpose === "contact" || f.purpose === "booking") || p.ctas.some((c) => c.kind === "call" || c.kind === "whatsapp");

export function journeys(ctx: Ctx): AuditResult["journeys"] {
  if (!ctx.home) return [];
  const dist = bfs(ctx);
  const out: AuditResult["journeys"] = [];
  const shortest = (pred: (p: PageData) => boolean) => {
    let best: { p: PageData; d: number; via: string[] } | null = null;
    for (const p of ctx.pages) {
      if (!pred(p)) continue;
      const x = dist.get(keyOf(p.finalUrl));
      if (x && (!best || x.d < best.d)) best = { p, ...x };
    }
    return best;
  };
  // Contact
  const c = shortest((p) => contactable(p) || CONTACT_RE.test(path(p.finalUrl)));
  const friction: string[] = [];
  if (c) {
    const form = c.p.forms.find((f) => f.purpose === "contact" || f.purpose === "booking");
    if (!form && !c.p.ctas.some((x) => x.kind === "whatsapp" || x.kind === "call")) friction.push(`${path(c.p.finalUrl)} has no form, tappable phone or WhatsApp link`);
    if (form && form.fields.length > 6) friction.push(`Contact form asks for ${form.fields.length} fields`);
    if (!ctx.home.nav.items.some((t) => /contact|enquir|book|reach/i.test(t))) friction.push("No contact link in the main navigation");
    out.push({ name: "Contact the business", steps: c.d === 0 ? ["Home — contact options on the homepage"] : c.via, clicks: c.d, friction });
  } else out.push({ name: "Contact the business", steps: ["Home"], clicks: null, friction: ["No page with a contact form, tappable phone or WhatsApp link was found in the crawled pages"] });
  // Explore services
  const sv = shortest((p) => SERVICE_RE.test(path(p.finalUrl).toLowerCase()) && p !== ctx.home);
  out.push(sv ? { name: "Explore services / offering", steps: sv.via, clicks: sv.d, friction: sv.p.ctas.length ? [] : [`${path(sv.p.finalUrl)} has no call-to-action`] } : { name: "Explore services / offering", steps: ["Home"], clicks: null, friction: ["No dedicated services/products page found"] });
  // Build trust
  const tr = shortest((p) => /\/(about|projects?|portfolio|work|case-stud|testimonials|reviews|gallery)/.test(path(p.finalUrl).toLowerCase()) || (p !== ctx.home && (p.trust.testimonials || p.trust.caseStudies)));
  out.push(tr ? { name: "Build trust (about, work, testimonials)", steps: tr.via, clicks: tr.d, friction: [] } : { name: "Build trust (about, work, testimonials)", steps: ["Home"], clicks: null, friction: ["No about page, portfolio or testimonials found"] });
  return out;
}

export function ux(ctx: Ctx): ModuleOut {
  const f: Finding[] = [];
  const s: Strength[] = [];
  const home = ctx.home;
  const hp = home ? [home.finalUrl] : [];
  if (home && !home.nav.present) f.push(F("ux.no_nav", "low", "ux", "No navigation landmark on the homepage", "No <nav> element or role=\"navigation\" was found.", "Visitors and assistive tech rely on a clear menu.", "Wrap the main menu in a <nav> element.", { pages: hp, affects: ["ux", "accessibility"], kind: "ux" }));
  if (home && home.nav.items.length > 9) f.push(F("ux.crowded_nav", "low", "ux", `Crowded menu (${home.nav.items.length} links)`, `Navigation links: ${list(home.nav.items, 6)}.`, "Too many choices slow decisions.", "Group items into 5–7 top-level entries with dropdowns.", { pages: hp, affects: ["ux"], kind: "ux" }));
  const navs = ctx.pages.filter((p) => p.nav.present && p.nav.items.length);
  if (home && navs.length >= 4) {
    const base = new Set(home.nav.items.map((x) => x.toLowerCase()));
    const differ = navs.filter((p) => { const set = new Set(p.nav.items.map((x) => x.toLowerCase())); const inter = [...set].filter((x) => base.has(x)).length; return inter / Math.max(1, new Set([...set, ...base]).size) < 0.5; });
    if (differ.length > navs.length * 0.3) f.push(F("ux.nav_inconsistent", "medium", "ux", "Navigation changes between pages", `${plural(differ.length, "page")} show a noticeably different menu from the homepage (e.g. ${path(differ[0].finalUrl)}).`, "Inconsistent menus disorient visitors.", "Use one shared header and menu across the site.", { pages: differ.map((p) => p.finalUrl), affects: ["ux"], kind: "ux" }));
    else s.push(S("ux", "Consistent navigation across pages"));
  }
  if (!ctx.pages.some((p) => p.search) && (ctx.pages.length >= 30 || ctx.ecommerce)) f.push(F("ux.search", ctx.ecommerce ? "medium" : "low", "ux", "No site search", `No search box was found across ${plural(ctx.pages.length, "page")}.`, "Visitors can't quickly find a product or topic.", "Add site search to the header.", { affects: ["ux", "conversion"], kind: "ux" }));
  const deep = ctx.pages.filter((p) => p.depth >= 2);
  if (ctx.pages.length >= 10 && deep.length >= 3 && !deep.some((p) => p.breadcrumbs)) f.push(F("ux.breadcrumbs", "low", "ux", "No breadcrumbs on deeper pages", `${plural(deep.length, "page")} are two or more clicks deep and none show breadcrumbs.`, "Visitors lose their place in the site structure.", "Add breadcrumbs (and BreadcrumbList structured data) to inner pages.", { pages: deep.slice(0, 5).map((p) => p.finalUrl), affects: ["ux", "seo"], kind: "ux" }));
  if (home && home.footerLinks < 3) f.push(F("ux.footer", "low", "ux", "Thin footer", `The homepage footer has ${home.footerLinks} links.`, "Footers are where visitors look for contact details, policies and key pages.", "Add contact details, key pages, policies and social links to the footer.", { pages: hp, affects: ["ux", "trust"], kind: "ux" }));
  if (ctx.site.soft404) f.push(F("ux.soft404", "medium", "technical", "Missing pages return \"200 OK\"", "A request to a page that doesn't exist returned HTTP 200 instead of 404.", "Search engines may index junk URLs, and visitors don't get a helpful not-found page.", "Return a real 404 status with a helpful page (search, key links, contact).", { affects: ["seo", "ux"], source: "crawl" }));
  const brokenPages = ctx.all.filter((p) => p.status >= 400);
  if (brokenPages.length) f.push(F("ux.broken_pages", "high", "technical", `${plural(brokenPages.length, "linked page")} ${brokenPages.length === 1 ? "returns an error" : "return errors"}`, `${list(brokenPages.map((p) => `${path(p.url)} (${p.status})`))} are linked from the site but return errors.`, "Visitors hit dead ends; search engines waste crawl budget.", "Fix or redirect these URLs and update the links pointing to them.", { pages: brokenPages.map((p) => p.url), affects: ["ux", "seo", "technical"], source: "crawl" }));
  const badLinks = ctx.raw.links.filter((l) => !l.ok);
  if (badLinks.length) f.push(F("ux.broken_links", badLinks.length >= 5 ? "medium" : "low", "technical", `${plural(badLinks.length, "broken outbound link")}`, `${list(badLinks.map((l) => `${l.url.replace(/^https?:\/\//, "").slice(0, 50)} (${l.status || l.error})`))}.`, "Dead links make the site look neglected.", "Update or remove these links.", { pages: [...new Set(badLinks.map((l) => l.foundOn))], affects: ["ux", "trust"], source: "links", samples: badLinks.map((l) => `${l.url} → ${l.status || l.error} (on ${path(l.foundOn)})`) }));
  const generic = ctx.pages.reduce((a, p) => a + p.genericAnchors, 0);
  if (generic >= 5) f.push(F("ux.generic_links", "low", "ux", `${generic} vague link labels`, `${generic} links say only "click here", "read more" or "learn more".`, "Vague labels don't tell visitors (or Google) where the link goes.", "Use descriptive link text, e.g. \"See our kitchen projects\".", { affects: ["ux", "seo", "accessibility"], kind: "ux" }));
  const js = journeys(ctx);
  const contact = js[0];
  if (contact.clicks !== null && contact.clicks >= 3) f.push(F("ux.contact_depth", "medium", "conversion", `Contacting the business takes ${contact.clicks} clicks`, `Shortest path found: ${contact.steps.join(" → ")}.`, "Every extra step loses interested visitors.", "Put contact options (button, WhatsApp, phone) on every page and in the header.", { affects: ["conversion", "ux", "leadGeneration"], kind: "business" }));
  if (contact.clicks === 0) s.push(S("conversion", "Contact options are available right on the homepage"));
  return { findings: f, strengths: s };
}

export function conversion(ctx: Ctx): ModuleOut & { leadGen: AuditResult["leadGen"] } {
  const f: Finding[] = [];
  const s: Strength[] = [];
  const home = ctx.home;
  const hp = home ? [home.finalUrl] : [];
  const allCtas: (Cta & { page: string })[] = ctx.pages.flatMap((p) => p.ctas.map((c) => ({ ...c, page: p.finalUrl })));
  const has = (k: Cta["kind"]) => allCtas.some((c) => c.kind === k);
  const forms = ctx.pages.flatMap((p) => p.forms.map((x) => ({ ...x, page: p.finalUrl })));
  const contactForms = forms.filter((x) => x.purpose === "contact" || x.purpose === "booking");
  const phonesText = ctx.pages.some((p) => p.contact.phones.length);
  const emails = ctx.pages.some((p) => p.contact.emails.length);

  // CTA presence & placement
  if (home && !home.ctas.some((c) => c.inHeader) && home.ctas.length) f.push(F("conv.header_cta", "medium", "conversion", "No call-to-action in the header", "The homepage header has no contact, call, WhatsApp or booking button.", "The header is where visitors look for the next step on every page.", "Add one primary button to the header (e.g. \"Get a quote\" or \"WhatsApp us\").", { pages: hp, affects: ["conversion", "leadGeneration"], kind: "business" }));
  if (home && !home.ctas.length) f.push(F("conv.no_cta_home", "high", "conversion", "No clear call-to-action on the homepage", "No contact, call, WhatsApp, booking, quote or buy button/link was found on the homepage.", "Interested visitors aren't told what to do next.", "Add a primary call-to-action above the fold and repeat it after key sections.", { pages: hp, affects: ["conversion", "leadGeneration"], kind: "business" }));
  const svcPages = ctx.pages.filter((p) => p !== home && SERVICE_RE.test(path(p.finalUrl).toLowerCase()));
  const noCta = svcPages.filter((p) => !p.ctas.length && !p.forms.some((x) => x.purpose === "contact" || x.purpose === "booking"));
  if (noCta.length) f.push(F("conv.service_cta", "medium", "conversion", `${plural(noCta.length, "service/product page")} without a call-to-action`, `No contact, quote or booking action on ${list(noCta.map((p) => path(p.finalUrl)))}.`, "Visitors are most ready to act right after reading about a service.", "End every service page with a clear next step (form, WhatsApp, call).", { pages: noCta.map((p) => p.finalUrl), affects: ["conversion", "leadGeneration"], kind: "business" }));
  const weak = allCtas.filter((c) => /^(submit|send|click here|go|ok)$/i.test(c.text.trim()));
  if (weak.length) f.push(F("conv.cta_wording", "low", "conversion", "Generic button wording", `Buttons labelled ${list([...new Set(weak.map((c) => `"${c.text}"`))])}.`, "Specific wording (\"Get my free quote\") converts better than \"Submit\".", "Rewrite buttons to describe the benefit or outcome.", { pages: [...new Set(weak.map((c) => c.page))], affects: ["conversion"], kind: "business" }));
  const kinds = [...new Set(allCtas.map((c) => c.kind))];
  const top = Object.entries(allCtas.reduce<Record<string, number>>((a, c) => ({ ...a, [c.text.toLowerCase()]: (a[c.text.toLowerCase()] ?? 0) + 1 }), {})).sort((a, b) => b[1] - a[1])[0];
  if (top && top[1] >= 3) s.push(S("conversion", `Consistent primary action ("${top[0]}" appears ${top[1]} times)`));

  // Contact channels
  if (!has("whatsapp") && !ctx.ecommerce) f.push(F("conv.whatsapp", "medium", "leadGeneration", "No WhatsApp contact", `No WhatsApp link was found across ${plural(ctx.pages.length, "page")}.`, "Many Indian customers prefer WhatsApp over forms or calls.", "Add a click-to-WhatsApp button (header and floating on mobile).", { affects: ["leadGeneration", "conversion", "mobile"], kind: "business" }));
  else if (has("whatsapp")) s.push(S("leadGeneration", "WhatsApp contact available"));
  if (!has("call") && phonesText) f.push(F("conv.tel", "low", "leadGeneration", "Phone number isn't tappable", "A phone number appears in the text, but no tel: link was found.", "Mobile visitors can't call with one tap.", "Wrap phone numbers in tel: links.", { affects: ["leadGeneration", "mobile"], kind: "business" }));
  if (!has("call") && !phonesText) f.push(F("conv.no_phone", "medium", "leadGeneration", "No phone number on the website", `No phone number was found across ${plural(ctx.pages.length, "page")}.`, "Visitors who prefer calling can't reach you and the business looks less established.", "Show a phone number in the header or footer with a tap-to-call link.", { affects: ["leadGeneration", "trust"], kind: "business" }));
  if (!contactForms.length && !has("booking")) f.push(F("conv.no_form", has("whatsapp") || has("call") ? "medium" : "high", "leadGeneration", "No enquiry or booking form", `No contact, enquiry or booking form was found across ${plural(ctx.pages.length, "page")}.`, "Visitors who don't want to call can't leave their details, especially outside business hours.", "Add a short enquiry form (name, phone, what they need) on the contact page and key service pages.", { affects: ["leadGeneration", "conversion"], kind: "business" }));
  if (has("booking") || contactForms.some((x) => x.purpose === "booking")) s.push(S("leadGeneration", "Online booking / appointment option"));
  if (ctx.business.type === "saas" && !pagesLike(ctx, /pricing|plans/).length) f.push(F("conv.pricing", "medium", "conversion", "No pricing page", "No page about pricing or plans was found.", "Software buyers expect to see pricing before booking a call.", "Publish plans or a starting price with what's included.", { affects: ["conversion"], kind: "business" }));
  if (!ctx.pages.some((p) => p.leadMagnet || p.newsletter) && ["saas", "agency", "education", "real_estate"].includes(ctx.business.type)) f.push(F("conv.lead_magnet", "low", "leadGeneration", "No lead magnet", "No free guide, brochure, consultation offer or newsletter sign-up was found.", "Visitors who aren't ready to talk have no way to stay in touch.", "Offer something useful (brochure, price list, free consultation) in exchange for contact details.", { affects: ["leadGeneration"], kind: "business" }));

  // Forms
  for (const form of contactForms.slice(0, 4)) {
    const pg = [form.page];
    const n = form.fields.length;
    if (n > 6) f.push(F(`forms.fields:${path(form.page)}`, "medium", "forms", `Form asks for ${n} fields (${path(form.page)})`, `Fields: ${list(form.fields.map((x) => x.name), 9)}. Required: ${form.fields.filter((x) => x.required).length}.`, "Each extra field lowers the number of people who finish the form.", "Ask only for name, phone/WhatsApp and a short message; collect the rest later.", { pages: pg, affects: ["conversion", "leadGeneration"], kind: "business" }));
    const placeholderOnly = form.fields.filter((x) => x.placeholderOnly);
    if (placeholderOnly.length >= 2) f.push(F(`forms.placeholders:${path(form.page)}`, "low", "forms", "Fields labelled only by placeholder text", `${placeholderOnly.length} fields on ${path(form.page)} rely on placeholder text instead of labels.`, "The hint disappears as people type, and screen readers may skip it.", "Add visible labels above each field.", { pages: pg, affects: ["accessibility", "ux"], kind: "ux" }));
    const wrongType = form.fields.filter((x) => (/mail/i.test(x.name) && x.type !== "email") || (/phone|mobile|tel|whatsapp/i.test(x.name) && x.type !== "tel" && x.type !== "number"));
    if (wrongType.length) f.push(F(`forms.types:${path(form.page)}`, "low", "forms", "Wrong input types on form fields", `${list(wrongType.map((x) => `${x.name} (type="${x.type}")`))} on ${path(form.page)}.`, "Phones show the wrong keyboard and autofill works worse.", "Use type=\"email\" and type=\"tel\".", { pages: pg, affects: ["mobile", "conversion"], kind: "ux" }));
    if (n >= 3 && !form.fields.some((x) => x.autocomplete)) f.push(F(`forms.autocomplete:${path(form.page)}`, "low", "forms", "Form doesn't support autofill", `No autocomplete attributes on the ${n}-field form on ${path(form.page)}.`, "Visitors have to type everything by hand on phones.", "Add autocomplete=\"name\", \"email\", \"tel\" to the matching fields.", { pages: pg, affects: ["conversion", "mobile"], kind: "ux" }));
    if (/^(submit|send)$/i.test(form.submitText)) f.push(F(`forms.submit:${path(form.page)}`, "low", "forms", `Form button says "${form.submitText}"`, `The form on ${path(form.page)} is submitted with a "${form.submitText}" button.`, "A specific label sets expectations and increases completions.", "Use e.g. \"Get my free quote\" or \"Request a call back\".", { pages: pg, affects: ["conversion"], kind: "business" }));
    if (!form.captcha && !form.honeypot) f.push(F(`forms.spam:${path(form.page)}`, "info", "forms", "No visible spam protection", `No CAPTCHA or honeypot field was detected on the form on ${path(form.page)}.`, "Forms without protection often attract spam submissions.", "Add an invisible honeypot or a low-friction CAPTCHA (Cloudflare Turnstile).", { pages: pg, affects: ["security"], kind: "technical" }));
  }
  if (contactForms.length && contactForms.every((x) => x.fields.length <= 5)) s.push(S("forms", `Short enquiry form (${contactForms[0].fields.length} fields)`));

  // Lead-generation verdict
  const channels = [
    has("call") && "Tap-to-call phone",
    has("whatsapp") && "WhatsApp",
    (has("email") || emails) && "Email",
    contactForms.length > 0 && "Enquiry form",
    has("booking") && "Online booking",
    ctx.pages.some((p) => p.chatWidget) && "Live chat / chat widget",
    ctx.pages.some((p) => p.newsletter) && "Newsletter",
  ].filter((x): x is string => !!x);
  const upfront = !!(ctx.mob?.mobile?.ctaAboveFold.length || home?.ctas.some((c) => c.inHeader));
  const verdict: AuditResult["leadGen"]["verdict"] = channels.length >= 3 && upfront && (contactForms.length > 0 || has("booking")) ? "Yes" : channels.length >= 1 ? "Partly" : "No";
  const opps = f.filter((x) => x.affects.includes("leadGeneration") || x.category === "leadGeneration" || x.category === "forms").sort((a, b) => sevRank(a.severity) - sevRank(b.severity)).map((x) => x.title);
  if (kinds.length >= 3) s.push(S("leadGeneration", `Several ways to get in touch (${channels.join(", ")})`));
  return { findings: f, strengths: s, leadGen: { verdict, channels, opportunities: [...new Set(opps)].slice(0, 8) } };
}

export const sevRank = (s: Finding["severity"]) => ["critical", "high", "medium", "low", "info"].indexOf(s);
