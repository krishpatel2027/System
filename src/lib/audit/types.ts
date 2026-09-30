// Website Intelligence Auditor — data model.
// Raw data is collected server-side (crawler, headless browser, PageSpeed,
// link checks, optional AI). Analyzer modules turn it into findings and
// scores. Nothing here is ever estimated without being labelled as such.

export type Severity = "critical" | "high" | "medium" | "low" | "info";

export type ScoreKey =
  | "performance" | "ux" | "design" | "mobile" | "seo" | "accessibility"
  | "security" | "conversion" | "content" | "technical" | "trust" | "leadGeneration";

export type Category =
  | ScoreKey | "vitals" | "localSeo" | "images" | "fonts" | "javascript" | "css"
  | "forms" | "ecommerce" | "business";

// Where a finding's evidence came from.
export type Source = "html" | "headers" | "crawl" | "browser" | "pagespeed" | "crux" | "axe" | "tls" | "links" | "ai";

export interface Finding {
  id: string;
  severity: Severity;
  category: Category;
  title: string;
  evidence: string;
  impact: string;
  recommendation: string;
  pages: string[];
  affects: ScoreKey[];
  effort: "quick" | "project";
  kind: "technical" | "ux" | "business";
  source: Source;
  screenshot?: string; // key into AuditRaw.screenshots
  samples?: string[];
}

export interface Strength { category: Category; text: string; evidence?: string }

// ---------- raw: crawled page (HTML + response) ----------

export interface FormField { name: string; type: string; label: boolean; placeholderOnly: boolean; required: boolean; autocomplete: boolean }
export interface FormInfo {
  purpose: "contact" | "newsletter" | "search" | "login" | "checkout" | "booking" | "other";
  fields: FormField[];
  captcha: boolean;
  honeypot: boolean;
  submitText: string;
  action: string;
}

export type CtaKind = "call" | "whatsapp" | "email" | "contact" | "booking" | "quote" | "buy" | "signup" | "demo" | "download" | "other";
export interface Cta { text: string; href: string; kind: CtaKind; inHeader: boolean }

export interface PageData {
  url: string;
  finalUrl: string;
  status: number;
  ok: boolean;
  error?: string;
  blockedByRobots?: boolean;
  redirects: { url: string; status: number }[];
  ttfbMs?: number;
  htmlBytes?: number;
  contentType?: string;
  encoding?: string;
  depth: number;
  headers?: Record<string, string>;
  title?: string;
  metaDescription?: string;
  canonical?: string;
  robotsMeta?: string;
  lang?: string;
  viewport?: string;
  hreflang: string[];
  og: boolean;
  headings: { h1: string[]; h2: string[]; h3: string[]; skips: number };
  wordCount: number;
  text: string; // first ~1500 chars of main text
  textHash: string;
  placeholderText?: string;
  internalLinks: { url: string; text: string }[];
  externalLinks: { url: string; text: string }[];
  genericAnchors: number;
  images: { src: string; alt: string | null; width?: string; height?: string; loading?: string; srcset: boolean }[];
  imageCount: number;
  scripts: { src?: string; inHead: boolean; async: boolean; defer: boolean; module: boolean; inlineBytes?: number }[];
  stylesheets: { href: string; inHead: boolean }[];
  inlineStyleBytes: number;
  mediaQueries: number;
  preloads: number;
  preconnects: number;
  forms: FormInfo[];
  ctas: Cta[];
  contact: { phones: string[]; emails: string[]; whatsapp?: string; address?: string; mapEmbed: boolean; hours: boolean; gbpLink: boolean };
  schema: { types: string[]; invalid: number };
  trust: {
    testimonials: boolean; reviews: boolean; caseStudies: boolean; portfolio: boolean; clientLogos: boolean; certifications: boolean;
    awards: boolean; team: boolean; history: boolean; guarantees: boolean; badges: boolean; stockImages: number;
    policies: string[]; socials: string[];
  };
  ecommerce: { cart: boolean; addToCart: boolean; productSchema: boolean; prices: number; checkoutLink: boolean; wishlist: boolean; filters: boolean };
  a11y: { imgNoAlt: number; inputsNoLabel: number; buttonsNoName: number; linksNoText: number; skipLink: boolean; landmarks: string[]; positiveTabindex: number; zoomDisabled: boolean };
  nav: { present: boolean; items: string[] };
  footerLinks: number;
  breadcrumbs: boolean;
  search: boolean;
  newsletter: boolean;
  leadMagnet: boolean;
  chatWidget: boolean;
  copyrightYear?: number;
  legacy: string[];
  mixedContent: string[];
  tech: { name: string; category: string; evidence: string; version?: string }[];
  keywords: string; // lower-cased title + h1 + meta + nav, used for business-type detection
}

// ---------- raw: site-level probe ----------

export interface SiteData {
  input: string;
  origin: string;
  host: string;
  https: boolean;
  httpRedirectsToHttps: boolean | null;
  robots: { found: boolean; status?: number; disallowAll: boolean; sitemaps: string[]; crawlDelay?: number };
  sitemap: { found: boolean; url?: string; urls: string[]; count: number; error?: string };
  tls: { valid: boolean; issuer?: string; validTo?: string; daysLeft?: number; protocol?: string; error?: string } | null;
  headers: Record<string, string>;
  cookies: { name: string; secure: boolean; httpOnly: boolean; sameSite?: string }[];
  soft404: boolean | null;
  homepageStatus?: number;
}

// ---------- raw: headless browser ----------

export interface ResourceRow { url: string; type: string; bytes: number; thirdParty: boolean; status: number; cacheable: boolean; encoding?: string; protocol?: string }

export interface BrowserMetrics {
  ttfb?: number; fcp?: number; lcp?: number; lcpElement?: string; cls?: number; tbt?: number; load?: number;
  domNodes: number; requests: number; transferBytes: number;
  byType: Record<string, { count: number; bytes: number }>;
  thirdPartyBytes: number; thirdPartyRequests: number;
  protocols: Record<string, number>;
  uncachedStatic: number; staticCount: number;
  uncompressedText: number;
}

export interface BrowserImage {
  src: string; bytes?: number; naturalW: number; naturalH: number; renderedW: number; renderedH: number;
  format: string; alt: string | null; lazy: boolean; inViewport: boolean; broken: boolean; hasDims: boolean; srcset: boolean; role: "hero" | "logo" | "icon" | "product" | "content";
}

export interface BrowserRun {
  url: string;
  viewport: "mobile" | "desktop";
  ok: boolean;
  error?: string;
  metrics?: BrowserMetrics;
  resources?: ResourceRow[];
  scripts?: { url: string; bytes: number; thirdParty: boolean; purpose?: string; unusedBytes?: number; blocking: boolean }[];
  stylesheets?: { url: string; bytes: number; unusedBytes?: number; blocking: boolean }[];
  images?: BrowserImage[];
  bgImages?: { url: string; w: number; h: number }[];
  fonts?: { family: string; weight: string; style: string; status: string }[];
  fontFiles?: { url: string; bytes: number; format: string }[];
  fontDisplay?: { family: string; display: string }[] | null;
  consoleErrors?: string[];
  renderedWords?: number;
  mobile?: {
    overflowPx: number; offenders: string[];
    smallText: number; smallTextSamples: string[];
    tapSmall: number; tapSamples: string[];
    fixedCoverage: number; ctaAboveFold: string[]; navToggle: boolean; popups: string[];
  };
  design?: {
    fontFamilies: { family: string; count: number }[];
    fontSizes: { size: number; count: number }[];
    bodySize?: number; h1Size?: number; lineHeightRatio?: number;
    textColors: { color: string; count: number }[];
    bgColors: { color: string; count: number }[];
    buttonStyles: { signature: string; count: number; sample: string }[];
    contrastFails: { text: string; ratio: number; fg: string; bg: string; large: boolean }[];
    contrastChecked: number;
    sectionPaddings: number[];
    ctaContrast?: { text: string; ratio: number };
  };
  firstViewport?: { h1?: string; text: string; ctas: string[] };
  axe?: { violations: { id: string; impact: string; help: string; nodes: number; sample: string; tags: string[] }[]; passes: number; incomplete: number };
  screenshot?: string; // key
}

export interface BreakpointRow { width: number; overflowPx: number; offenders: string[]; screenshot?: string; ok: boolean; error?: string }

// ---------- raw: PageSpeed Insights ----------

export type VitalRating = "good" | "needs-improvement" | "poor";
export interface PageSpeedData {
  ok: boolean;
  error?: string;
  strategy: "mobile";
  fetchedAt?: string;
  scores?: { performance: number; accessibility: number; seo: number; bestPractices: number };
  lab?: { fcp?: number; lcp?: number; cls?: number; tbt?: number; si?: number; ttfb?: number };
  field?: { scope: "page" | "origin"; lcp?: number; inp?: number; cls?: number; fcp?: number; ttfb?: number };
  opportunities?: { id: string; title: string; savingsMs?: number; savingsBytes?: number }[];
}

export interface LinkCheck { url: string; status: number; ok: boolean; error?: string; foundOn: string }

// ---------- raw: AI analysis (always labelled AI ANALYSIS) ----------

export type Answer = { answer: string; clarity: "clear" | "partial" | "unclear" };
export interface AiAnalysis {
  model: string;
  firstImpression: { whatTheyDo: Answer; audience: Answer; primaryCta: Answer; valueProposition: Answer; differentiation: Answer; convincing: Answer; observations: string[] };
  design: { aspect: string; observation: string; severity: Severity; positive: boolean }[];
  content: { whoFor: Answer; whyChoose: Answer; whatsDifferent: Answer; nextStep: Answer; issues: { observation: string; severity: Severity }[] };
  positioning: string;
}

// ---------- the stored audit ----------

export interface AuditRaw {
  site: SiteData;
  pages: PageData[];
  browser: BrowserRun[];
  breakpoints: BreakpointRow[];
  pagespeed: PageSpeedData | null;
  links: LinkCheck[];
  ai: AiAnalysis | null;
  screenshots: Record<string, string>; // key → data:image/jpeg;base64
  notes: string[]; // what couldn't be measured and why
  browserAvailable: boolean;
}

export interface CompetitorRaw { url: string; raw: AuditRaw }

export interface AuditRecord {
  id: string;
  url: string;
  domain: string;
  createdAt: string;
  createdBy?: string;
  crawlLimit: number;
  prospectId?: string;
  industryHint?: string;
  raw: AuditRaw;
  competitors: CompetitorRaw[];
  summary: AuditSummary;
}

export interface AuditSummary { overall: number | null; opportunity: number; service?: string; servicePrice?: number; issues: number; high: number; pages: number }

// ---------- computed result (derived on demand from raw) ----------

export interface ScoreCell { score: number | null; basis: string; findings: number }

export interface Technology { name: string; category: string; evidence: string; version?: string }

export interface ServiceFit { serviceId: string; name: string; price: number; cost: number; hours: number; strength: number; reasons: string[] }

export interface AuditResult {
  url: string;
  overallScore: number | null;
  scores: Record<ScoreKey, ScoreCell>;
  pagesAnalyzed: { url: string; status: number; title?: string }[];
  issues: Finding[];
  quickWins: Finding[];
  highImpact: Finding[];
  strengths: Strength[];
  technology: Technology[];
  business: { type: string; label: string; confidence: "detected" | "estimated"; evidence: string[] };
  ecommerce: boolean;
  vitals: { key: "lcp" | "inp" | "cls" | "ttfb" | "fcp"; label: string; value?: number; unit: string; rating?: VitalRating; source: string }[];
  mobileRating: "Excellent" | "Good" | "Needs work" | "Poor" | "Not measured";
  leadGen: { verdict: "Yes" | "Partly" | "No"; channels: string[]; opportunities: string[] };
  localSeo: { applicable: boolean; rating: "Strong" | "Fair" | "Weak"; present: string[]; missing: string[] };
  journeys: { name: string; steps: string[]; clicks: number | null; friction: string[] }[];
  contentAnswers: { question: string; answer: string; basis: "detected" | "ai" | "not_verified" }[];
  firstImpression: { observations: { text: string; basis: "detected" | "ai" }[] };
  crossImpact: Finding[];
  pageTable: { url: string; path: string; performance: number | null; seo: number; ux: number; conversion: number; issues: number }[];
  overview: Record<string, string>;
  executive: { quality: string; strengths: string[]; weaknesses: string[]; conversion?: string; technical?: string; mobile?: string; seo?: string; service?: string };
  opportunity: { score: number; recommended: ServiceFit | null; secondary: ServiceFit[]; reasons: string[]; improvementAreas: string[] };
  notes: string[];
}
