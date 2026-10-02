import type { AiAnalysis, AuditRaw, BrowserRun, Category, Finding, PageData, PageSpeedData, ScoreKey, Severity, SiteData, Source, Strength } from "../types";

// Shared context and helpers for the analyzer modules.

export type BusinessType =
  | "real_estate" | "restaurant" | "saas" | "agency" | "clinic" | "law" | "ecommerce" | "manufacturer"
  | "hotel" | "education" | "portfolio" | "interior" | "local" | "general";

export interface Ctx {
  country?: string; // market code of the lead, when known
  raw: AuditRaw;
  site: SiteData;
  all: PageData[];
  pages: PageData[]; // successfully fetched HTML pages
  home?: PageData;
  desk?: BrowserRun;
  mob?: BrowserRun;
  runs: BrowserRun[];
  psi?: PageSpeedData;
  ai?: AiAnalysis;
  business: { type: BusinessType; label: string; confidence: "detected" | "estimated"; evidence: string[] };
  ecommerce: boolean;
  isLocal: boolean;
}

export interface ModuleOut { findings: Finding[]; strengths: Strength[] }

export const path = (u: string) => { try { const x = new URL(u); return (x.pathname || "/") + (x.search || ""); } catch { return u; } };

export const kb = (b?: number) => (b === undefined ? "?" : b >= 1_000_000 ? `${(b / 1_000_000).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1000))} KB`);
export const ms = (n?: number) => (n === undefined ? "?" : n >= 1000 ? `${(n / 1000).toFixed(1)} s` : `${Math.round(n)} ms`);
export const plural = (n: number, w: string, p = `${w}s`) => `${n} ${n === 1 ? w : p}`;
export const list = (xs: string[], n = 3) => (xs.length <= n ? xs.join(", ") : `${xs.slice(0, n).join(", ")} and ${xs.length - n} more`);

interface Extra { pages?: string[]; affects?: ScoreKey[]; effort?: "quick" | "project"; kind?: Finding["kind"]; source?: Source; screenshot?: string; samples?: string[] }

export function finding(id: string, severity: Severity, category: Category, title: string, evidence: string, impact: string, recommendation: string, x: Extra = {}): Finding {
  return {
    id, severity, category, title, evidence, impact, recommendation,
    pages: x.pages ?? [],
    affects: x.affects ?? [],
    effort: x.effort ?? "quick",
    kind: x.kind ?? "technical",
    source: x.source ?? "html",
    screenshot: x.screenshot,
    samples: x.samples,
  };
}

export const strength = (category: Category, text: string, evidence?: string): Strength => ({ category, text, evidence });

// Pages matching a path/title pattern (about, contact, services…).
export function pagesLike(ctx: Ctx, re: RegExp) {
  return ctx.pages.filter((p) => re.test(path(p.finalUrl).toLowerCase()) || re.test((p.title ?? "").toLowerCase()));
}
export const linkedLike = (ctx: Ctx, re: RegExp) => ctx.pages.some((p) => p.internalLinks.some((l) => re.test(path(l.url).toLowerCase()) || re.test(l.text.toLowerCase())));

const TYPES: { type: BusinessType; label: string; re: RegExp; schema: RegExp }[] = [
  { type: "real_estate", label: "Real estate", re: /real estate|propert(y|ies)|apartments?|\bflats?\b|villas?|\bbhk\b|\bplots?\b|builders?|developers?|realty|township|residential|rera\b/g, schema: /RealEstate|Residence|Apartment/ },
  { type: "restaurant", label: "Restaurant / café", re: /restaurant|\bcaf(e|é)\b|\bmenu\b|cuisine|\bdine\b|dining|biryani|pizza|bistro|bakery|reservations?/g, schema: /Restaurant|FoodEstablishment|CafeOrCoffeeShop|Bakery|Menu/ },
  { type: "clinic", label: "Clinic / healthcare", re: /clinic|doctors?|\bdr\.|hospital|dental|dentist|physio|dermatolog|treatments?|patients?|healthcare|\bivf\b|ayurved|diagnostic/g, schema: /Medical|Dentist|Physician|Hospital|Clinic/ },
  { type: "law", label: "Law firm", re: /law firm|advocates?|lawyers?|legal (services|advice)|attorneys?|litigation/g, schema: /LegalService|Attorney/ },
  { type: "hotel", label: "Hotel / hospitality", re: /\bhotels?\b|resorts?|\brooms\b|\bstay\b|suites|homestay|accommodation|check-?in/g, schema: /Hotel|LodgingBusiness|Resort/ },
  { type: "education", label: "Education", re: /\bschool\b|college|academy|institute|\bcourses?\b|admissions?|coaching|classes|students|university|training/g, schema: /EducationalOrganization|School|CollegeOrUniversity|Course/ },
  { type: "saas", label: "SaaS / software", re: /\bsaas\b|software|\bplatform\b|dashboard|\bapi\b|integrations|free trial|book a demo|request a demo|per month|\/mo\b/g, schema: /SoftwareApplication|WebApplication/ },
  { type: "manufacturer", label: "Manufacturer / industrial", re: /manufactur|factory|industrial|exporters?|suppliers?|\boem\b|machinery|fabrication|iso 9001/g, schema: /Manufacturer/ },
  { type: "interior", label: "Interior design / architecture", re: /interiors?|architect|modular kitchen|renovation|home decor|furnishing/g, schema: /HomeAndConstructionBusiness|GeneralContractor/ },
  { type: "agency", label: "Agency / professional services", re: /\bagency\b|digital marketing|branding|web design|creative studio|consult(ing|ancy)|chartered accountant/g, schema: /ProfessionalService|Organization/ },
  { type: "portfolio", label: "Portfolio / personal brand", re: /portfolio|photograph(er|y)|freelancer?|my work|\bartist\b/g, schema: /Person/ },
];

const HINT: Record<string, BusinessType> = {
  "real estate": "real_estate", restaurants: "restaurant", cafes: "restaurant", clinics: "clinic", "dental clinics": "clinic", hospitals: "clinic",
  "law firms": "law", hotels: "hotel", education: "education", coaching: "education", schools: "education", saas: "saas", technology: "saas",
  manufacturing: "manufacturer", "interior design": "interior", architecture: "interior", "e-commerce": "ecommerce", fashion: "ecommerce", jewellery: "ecommerce",
  photography: "portfolio", consulting: "agency", "b2b services": "agency", "professional services": "agency", "chartered accountants": "agency",
};

export function detectBusiness(pages: PageData[], home: PageData | undefined, ecommerce: boolean, hint?: string): Ctx["business"] {
  if (hint && HINT[hint.toLowerCase()]) {
    const t = HINT[hint.toLowerCase()];
    const label = t === "ecommerce" ? "E-commerce" : TYPES.find((x) => x.type === t)?.label ?? hint;
    return { type: t, label, confidence: "detected", evidence: [`Industry on the lead record: ${hint}`] };
  }
  if (ecommerce) return { type: "ecommerce", label: "E-commerce", confidence: "detected", evidence: ["Cart, product markup or an e-commerce platform was detected"] };
  const text = [home?.keywords ?? "", ...pages.slice(0, 8).map((p) => `${p.title ?? ""} ${p.headings.h1.join(" ")}`.toLowerCase())].join(" ");
  const schema = pages.flatMap((p) => p.schema.types).join(" ");
  let best: { t: (typeof TYPES)[number]; hits: string[]; schema: boolean } | null = null;
  for (const t of TYPES) {
    const hits = [...new Set(text.match(t.re) ?? [])];
    const sch = t.schema.test(schema);
    const score = hits.length + (sch ? 3 : 0);
    if (score > 0 && (!best || score > best.hits.length + (best.schema ? 3 : 0))) best = { t, hits, schema: sch };
  }
  if (best && (best.schema || best.hits.length >= 1)) {
    const ev = [...(best.schema ? [`Structured data type: ${schema.split(" ").find((x) => best!.t.schema.test(x))}`] : []), ...(best.hits.length ? [`Keywords in titles/headings: ${best.hits.slice(0, 4).join(", ")}`] : [])];
    return { type: best.t.type, label: best.t.label, confidence: best.schema || best.hits.length >= 2 ? "detected" : "estimated", evidence: ev };
  }
  const local = pages.some((p) => p.contact.address || p.contact.phones.length);
  return local
    ? { type: "local", label: "Local business", confidence: "estimated", evidence: ["Phone number or address found, no specific industry keywords"] }
    : { type: "general", label: "General business", confidence: "estimated", evidence: ["No industry-specific signals detected"] };
}

export function buildCtx(raw: AuditRaw, hint?: string, country?: string): Ctx {
  const pages = raw.pages.filter((p) => p.ok);
  const home = pages.find((p) => p.depth === 0) ?? pages[0];
  const ok = (r: BrowserRun) => r.ok && !!r.metrics;
  const homeKey = home ? path(home.finalUrl) : "/";
  const desk = raw.browser.find((r) => r.viewport === "desktop" && ok(r) && (path(r.url) === homeKey || r.url === home?.url)) ?? raw.browser.find((r) => r.viewport === "desktop" && ok(r));
  const mob = raw.browser.find((r) => r.viewport === "mobile" && ok(r) && (path(r.url) === homeKey || r.url === home?.url)) ?? raw.browser.find((r) => r.viewport === "mobile" && ok(r));
  const ecommerce = pages.some((p) => p.ecommerce.productSchema || (p.ecommerce.cart && p.ecommerce.addToCart)) || pages.some((p) => p.tech.some((t) => ["Shopify", "WooCommerce", "Magento", "BigCommerce"].includes(t.name)));
  const business = detectBusiness(pages, home, ecommerce, hint);
  const isLocal = ["real_estate", "restaurant", "clinic", "law", "hotel", "education", "interior", "local", "manufacturer"].includes(business.type) || pages.some((p) => !!p.contact.address);
  return {
    raw, site: raw.site, all: raw.pages, pages, home, desk, mob, runs: raw.browser.filter(ok),
    psi: raw.pagespeed?.ok ? raw.pagespeed : undefined, ai: raw.ai ?? undefined, business, ecommerce, isLocal, country,
  };
}
