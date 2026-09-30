import type { Prospect, ScoreBreakdown, ScoringConfig, Service, ServiceMatch, Signal, WebsiteAudit, WebsiteStatus } from "../types";
import { SIGNALS, PART_LABELS } from "./catalog";

// Signals, scoring and service matching. Pure functions shared by the browser
// and the server (auto-find), so a lead scores the same wherever it's evaluated.

const PRODUCT_INDUSTRIES = ["fashion", "jewellery", "jewelry", "furniture", "e-commerce", "ecommerce", "beauty"];
const BOOKING_INDUSTRIES = ["clinics", "dental clinics", "hospitals", "salons", "beauty", "gyms", "fitness studios", "hotels", "restaurants", "cafes", "coaching"];
const SUPPORT_INDUSTRIES = ["clinics", "dental clinics", "hospitals", "education", "coaching", "schools", "real estate", "hotels", "travel", "e-commerce"];
const TECH_INDUSTRIES = ["saas", "technology"];

const has = (list: string[], v?: string) => !!v && list.includes(v.toLowerCase());
const host = (url?: string) => {
  if (!url) return "";
  try { return new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`).hostname.replace(/^www\./, ""); } catch { return url; }
};

// ---------- website quality ----------

export function classifyAudit(a: WebsiteAudit): WebsiteStatus {
  if (!a.ok) return a.blockedByRobots ? "unchecked" : "unreachable";
  const vals = Object.values(a.scores).filter((v): v is number => typeof v === "number");
  const avg = vals.length ? vals.reduce((x, y) => x + y, 0) / vals.length : 50;
  const year = new Date().getFullYear();
  const legacy = [
    !a.found.hasViewport,
    !!a.found.copyrightYear && a.found.copyrightYear <= year - 4,
    !a.finalUrl?.startsWith("https://") && !a.url.startsWith("https://"),
    a.findings.some((f) => f.id === "legacy_markup"),
  ].filter(Boolean).length;
  if (legacy >= 2 || avg < 45) return "outdated";
  if (avg >= 75 && a.found.hasCta && (a.found.hasForm || !!a.found.whatsapp || a.found.phones.length > 0)) return "good";
  return "basic";
}

// ---------- signals ----------

export function deriveSignals(p: Prospect): { signals: Signal[]; evidence: Partial<Record<Signal, string>>; websiteStatus: WebsiteStatus } {
  const ev: Partial<Record<Signal, string>> = {};
  const add = (s: Signal, why: string) => { if (!ev[s]) ev[s] = why; };
  const a = p.audit;
  let websiteStatus: WebsiteStatus = p.website ? "unchecked" : "none";

  if (!p.website) {
    const where = p.sources.includes("google_places") ? "its Google Business listing" : p.sources.includes("csv") ? "the imported record" : "the lead record";
    add("no_website", `No website listed on ${where}.`);
  } else if (a) {
    websiteStatus = classifyAudit(a);
    const byId = (id: string) => a.findings.find((f) => f.id === id);
    if (websiteStatus === "unreachable") add("website_unreachable", `${host(p.website)} did not load when checked (${a.error ?? `HTTP ${a.httpStatus}`}).`);
    if (websiteStatus === "outdated") {
      const AGE = ["no_viewport", "legacy_markup", "stale_copyright", "no_https", "fixed_width"];
      const why = [...a.findings].sort((x, y) => (AGE.includes(y.id) ? 1 : 0) - (AGE.includes(x.id) ? 1 : 0)).slice(0, 2).map((f) => f.issue.toLowerCase());
      add("outdated_website", `${host(p.website)} shows signs of an older build${why.length ? `: ${why.join("; ")}` : ""}.`);
    }
    if (websiteStatus === "basic") add("basic_website", `${host(p.website)} is live but covers only the basics (quality checks averaged below 75/100).`);
    if (websiteStatus === "good") add("strong_website", `${host(p.website)} passed most checks (mobile, SEO, contact options).`);
    if (a.ok) {
      if (byId("no_viewport")) add("not_mobile_friendly", byId("no_viewport")!.evidence);
      const perf = a.pagespeed?.performance ?? a.scores.performance;
      if (typeof perf === "number" && perf < 50) add("slow_website", a.pagespeed ? `Google PageSpeed (mobile) scored ${a.pagespeed.performance}/100.` : `Page took ${((a.responseMs ?? 0) / 1000).toFixed(1)}s to respond and weighs ${a.htmlKb ?? "?"} KB of HTML.`);
      if ((a.scores.seo ?? 100) < 60) add("weak_seo", a.findings.filter((f) => f.category === "seo").slice(0, 2).map((f) => f.evidence).join(" ") || "Several SEO basics missing.");
      if (byId("no_https")) add("no_https", byId("no_https")!.evidence);
      if (!a.found.hasCta) add("no_cta", "No clear call-to-action (call, enquire, book, WhatsApp) found on the homepage.");
      if (!a.found.whatsapp && !p.whatsapp) add("no_whatsapp", "No WhatsApp link found on the homepage.");
      if (!a.found.hasForm) add("no_contact_form", "No enquiry or contact form found on the homepage.");
      if (a.found.sellsProducts) add("sells_products", "Product listings or prices found on the website.");
      if (a.found.sellsProducts && !a.found.hasCart) add("no_online_store", "Products are shown but no cart or checkout was detected.");
    }
  }

  if (!p.website && has(PRODUCT_INDUSTRIES, p.industry)) add("sells_products", `${p.industry} is a product-based industry.`);
  if (!p.website && has(PRODUCT_INDUSTRIES, p.industry)) add("no_online_store", "No website, so no online store found.");
  if (has(BOOKING_INDUSTRIES, p.industry)) add("booking_business", `${p.industry} businesses run on appointments or bookings.`);
  const reviews = p.reviewCount ?? 0;
  if (reviews >= 150 || (reviews >= 60 && has(SUPPORT_INDUSTRIES, p.industry))) {
    if (!a?.found.hasChatWidget) add("support_heavy", `${reviews} Google reviews suggest steady customer enquiries${a?.ok ? ", and no chat assistant was detected on the website" : ""}.`);
  }
  if (reviews >= 50) add("established_business", `${reviews} Google reviews${p.rating ? ` (rated ${p.rating.toFixed(1)})` : ""}.`);
  const socials = Object.entries(p.socials ?? {}).filter(([, v]) => v).map(([k]) => k[0].toUpperCase() + k.slice(1));
  if (socials.length) add("active_social", `${socials.join(", ")} profile${socials.length > 1 ? "s" : ""} linked.`);
  if (has(TECH_INDUSTRIES, p.industry) || /software|saas|app developer/i.test(p.category ?? "")) add("tech_business", `Listed as ${p.category || p.industry}.`);

  return { signals: Object.keys(ev) as Signal[], evidence: ev, websiteStatus };
}

// ---------- service matching ----------

const WEIGHT = { opportunity: 1, context: 0.6, strength: 0.4 } as const;

export function matchService(p: Pick<Prospect, "industry" | "signals" | "evidence">, services: Service[]): ServiceMatch | null {
  const ranked = services
    .filter((s) => s.active && (s.signals?.length ?? 0) > 0)
    .map((s) => {
      const hits = (s.signals ?? []).filter((x) => p.signals.includes(x));
      const opportunity = hits.some((h) => SIGNALS[h].kind === "opportunity" || h === "tech_business");
      const industryFit = !s.idealIndustries?.length ? 0.4 : s.idealIndustries.some((i) => i.toLowerCase() === p.industry.toLowerCase()) ? 1 : 0;
      const raw = hits.reduce((a, h) => a + WEIGHT[SIGNALS[h].kind], 0) + industryFit * 0.8;
      return { s, hits, opportunity, industryFit, raw };
    })
    .filter((r) => r.hits.length > 0 && r.opportunity)
    .sort((a, b) => b.raw - a.raw || b.industryFit - a.industryFit || a.s.basePrice - b.s.basePrice);
  const best = ranked[0];
  if (!best) return null;
  const reasons = best.hits.map((h) => p.evidence[h]).filter((x): x is string => !!x).slice(0, 3);
  if (best.industryFit === 1) reasons.push(`${best.s.name} is built for ${p.industry} businesses like this one.`);
  return {
    serviceId: best.s.id,
    serviceName: best.s.name,
    price: best.s.basePrice,
    cost: best.s.internalCost,
    hours: best.s.hours,
    strength: Math.min(1, best.raw / 2.6),
    reasons,
    alternatives: ranked.slice(1, 3).map((r) => ({ serviceId: r.s.id, serviceName: r.s.name, price: r.s.basePrice })),
  };
}

// ---------- scoring ----------

export function scoreProspect(p: Prospect, match: ServiceMatch | null, cfg: ScoringConfig): ScoreBreakdown {
  const w = cfg.weights;
  const reasons: string[] = [];
  const website = ({ none: 1, unreachable: 0.9, outdated: 0.85, basic: 0.55, unchecked: 0.4, good: 0.1 } as const)[p.websiteStatus];
  if (p.websiteStatus === "none") reasons.push("No website found");
  else if (p.websiteStatus === "outdated") reasons.push("Website looks outdated");
  else if (p.websiteStatus === "unreachable") reasons.push("Website isn't loading");
  else if (p.websiteStatus === "good") reasons.push("Website is already strong");

  const socials = Object.values(p.socials ?? {}).filter(Boolean).length;
  const presence = Math.min(1, (p.googleMapsUrl || p.placeId ? 0.4 : 0) + (socials >= 2 ? 0.4 : socials === 1 ? 0.25 : 0) + (p.rating ? 0.2 : 0));
  if (p.placeId) reasons.push("Listed on Google");
  if (socials) reasons.push(`${socials} social profile${socials > 1 ? "s" : ""}`);

  const r = p.reviewCount;
  let maturity = r === undefined ? 0.3 : r >= 200 ? 1 : r >= 100 ? 0.8 : r >= 50 ? 0.6 : r >= 20 ? 0.4 : r >= 5 ? 0.2 : 0.05;
  if ((p.rating ?? 0) >= 4.2 && (r ?? 0) >= 10) maturity = Math.min(1, maturity + 0.15);
  if (r !== undefined && r >= 20) reasons.push(`${r} public reviews`);

  const contact = Math.min(1, (p.phone ? 0.5 : 0) + (p.email ? 0.3 : 0) + (p.whatsapp ? 0.2 : 0) + (socials ? 0.1 : 0));
  if (p.phone || p.email) reasons.push("Business contact available");

  const fit = match ? match.strength : 0;
  if (match) reasons.push(`Fits ${match.serviceName}`);
  else reasons.push("No clear service match");

  const price = match?.price ?? 0;
  const value = !match ? 0 : price >= 150000 ? 1 : price >= 80000 ? 0.8 : price >= 35000 ? 0.6 : price >= 15000 ? 0.4 : 0.25;

  const parts = {
    website: Math.round(website * w.website),
    presence: Math.round(presence * w.presence),
    maturity: Math.round(maturity * w.maturity),
    contact: Math.round(contact * w.contact),
    fit: Math.round(fit * w.fit),
    value: Math.round(value * w.value),
  };
  const max = Object.values(w).reduce((a, b) => a + b, 0) || 100;
  const total = Math.round((Object.values(parts).reduce((a, b) => a + b, 0) / max) * 100);
  return { total, parts, reasons };
}

export function opportunityLabel(score: number | undefined, cfg: ScoringConfig) {
  if (score === undefined) return { label: "Not scored", tone: "neutral" as const };
  if (score >= cfg.high) return { label: "Strong", tone: "green" as const };
  if (score >= cfg.qualified) return { label: "Good", tone: "violet" as const };
  if (score >= 40) return { label: "Moderate", tone: "amber" as const };
  return { label: "Low", tone: "neutral" as const };
}

export const partLabel = (k: keyof ScoringConfig["weights"]) => PART_LABELS[k];

// Signals → match → score in one step. Use after any change to a prospect's data.
export function evaluate(p: Prospect, services: Service[], cfg: ScoringConfig): Prospect {
  const { signals, evidence, websiteStatus } = deriveSignals(p);
  const base = { ...p, signals, evidence, websiteStatus };
  const match = matchService(base, services);
  const score = scoreProspect(base, match, cfg);
  const status = p.status === "new" && !match ? "not_fit" : p.status === "not_fit" && match ? "new" : p.status;
  return { ...base, match, score, status, updatedAt: new Date().toISOString() };
}
