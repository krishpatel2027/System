import type { Confidence, Prospect, SavedSearch, SearchQuery, SourceId, WebsiteAudit } from "../types";
import type { ResolveResult } from "./server/resolve";
import { uid } from "../utils";

type Fields = Partial<Omit<Prospect, "id" | "sources" | "provenance" | "signals" | "evidence" | "status" | "discoveredAt" | "updatedAt" | "websiteStatus">>;

const TRACKED: (keyof Fields)[] = ["name", "industry", "category", "city", "address", "phone", "whatsapp", "email", "website", "googleMapsUrl", "rating", "reviewCount", "description", "decisionMaker"];

// Every field records where it came from. Provider data is "verified" (the
// business published it there); things we inferred are marked "estimated".
export function newProspect(f: Fields & { name: string }, source: SourceId, confidence: Confidence = source === "manual" ? "verified" : source === "csv" ? "detected" : "verified"): Prospect {
  const now = new Date().toISOString();
  const provenance: Prospect["provenance"] = {};
  for (const k of TRACKED) if (f[k] !== undefined && f[k] !== "") provenance[k] = { source, confidence };
  for (const [k, v] of Object.entries(f.socials ?? {})) if (v) provenance[`social.${k}`] = { source, confidence };
  return {
    id: uid("pr"),
    industry: "",
    socials: {},
    ...f,
    sources: [source],
    provenance,
    websiteStatus: f.website ? "unchecked" : "none",
    signals: [],
    evidence: {},
    status: "new",
    discoveredAt: now,
    updatedAt: now,
  };
}

// Fills gaps on an existing prospect from a new source without overwriting
// what's already known.
export function mergeInto(base: Prospect, add: Prospect): Prospect {
  const out: Prospect = { ...base, socials: { ...add.socials, ...base.socials }, provenance: { ...add.provenance, ...base.provenance } };
  for (const k of TRACKED) {
    const cur = out[k as keyof Prospect];
    const nxt = add[k as keyof Prospect];
    if ((cur === undefined || cur === "") && nxt !== undefined && nxt !== "") (out as unknown as Record<string, unknown>)[k] = nxt;
  }
  for (const k of ["placeId", "openingHours", "area"] as const) if (!out[k] && add[k]) (out as unknown as Record<string, unknown>)[k] = add[k];
  out.sources = [...new Set([...base.sources, ...add.sources])];
  if (out.website && base.websiteStatus === "none") out.websiteStatus = "unchecked";
  return out;
}

export const hasContact = (p: Prospect) => !!(p.phone || p.email || p.whatsapp);

export function passesQuery(p: Prospect, q: Partial<SearchQuery>): boolean {
  const ws = p.websiteStatus;
  const weak = ws === "outdated" || ws === "basic" || ws === "unreachable";
  if (q.website === "none" && ws !== "none") return false;
  if (q.website === "weak" && !weak) return false;
  if (q.website === "none_or_weak" && !(ws === "none" || weak || ws === "unchecked")) return false;
  if (q.website === "has" && ws === "none") return false;
  if (q.minScore && (p.score?.total ?? 0) < q.minScore) return false;
  if (q.minReviews && (p.reviewCount ?? 0) < q.minReviews) return false;
  if (q.minRating && (p.rating ?? 0) < q.minRating) return false;
  if (q.requireContact && !hasContact(p)) return false;
  if (q.serviceId && p.match?.serviceId !== q.serviceId && !p.match?.alternatives.some((a) => a.serviceId === q.serviceId)) return false;
  if (q.budgetMax && p.match && p.match.price > q.budgetMax) return false;
  return true;
}

// Google Places primary types → our industry list.
const TYPE_MAP: [RegExp, string][] = [
  [/real_estate/, "Real Estate"], [/interior/, "Interior Design"], [/architect/, "Architecture"],
  [/general_contractor|construction/, "Construction"], [/restaurant|meal_/, "Restaurants"], [/cafe|coffee|bakery/, "Cafes"],
  [/hotel|lodging|resort|motel/, "Hotels"], [/dentist|dental/, "Dental Clinics"], [/hospital/, "Hospitals"],
  [/doctor|physiotherap|medical|clinic|health/, "Clinics"], [/gym/, "Gyms"], [/fitness|yoga/, "Fitness Studios"],
  [/hair|barber|salon|spa|nail/, "Salons"], [/beauty|cosmetic|skin_care/, "Beauty"], [/school|preschool/, "Schools"],
  [/university|college|education/, "Education"], [/tutor|coaching/, "Coaching"], [/lawyer|legal/, "Law Firms"],
  [/accounting/, "Chartered Accountants"], [/insurance|finance|bank/, "Finance"], [/consultant/, "Consulting"],
  [/travel|tour/, "Travel"], [/car_|auto/, "Automotive"], [/furniture/, "Furniture"], [/clothing|shoe|fashion/, "Fashion"],
  [/jewel/, "Jewellery"], [/software|technology/, "Technology"], [/event|wedding/, "Event Management"],
  [/photograph/, "Photography"], [/pet|veterinar/, "Pet Services"], [/plumber|electrician|locksmith|cleaning|moving|roofing|painter/, "Home Services"],
  [/manufactur|factory/, "Manufacturing"],
];

export function industryFromTypes(types: string[] = [], fallback = ""): string {
  for (const t of types) for (const [re, ind] of TYPE_MAP) if (re.test(t)) return ind;
  return fallback;
}

export const isDue = (s: SavedSearch, now = Date.now()) => {
  if (s.schedule === "manual") return false;
  if (!s.lastRunAt) return true;
  const gap = s.schedule === "daily" ? 22 * 3600e3 : 6.5 * 86400e3;
  return now - new Date(s.lastRunAt).getTime() >= gap;
};

const WEB: Record<SearchQuery["website"], string> = { any: "", none: "No website", weak: "Weak website", none_or_weak: "No/weak website", has: "Has website" };

export function describeQuery(q: SearchQuery, services: { id: string; name: string }[]) {
  return [
    q.industries.join(", "),
    q.locations.length ? `in ${q.locations.join(", ")}` : "",
    WEB[q.website],
    q.serviceId ? services.find((s) => s.id === q.serviceId)?.name : "",
    q.minScore ? `score ≥ ${q.minScore}` : "",
    q.minReviews ? `${q.minReviews}+ reviews` : "",
    q.minRating ? `${q.minRating}★+` : "",
    !q.industries.length && q.text ? `“${q.text}”` : "",
  ].filter(Boolean).join(" · ");
}

// Adds what the website itself publishes (contact, socials) as "detected" data.
export function applyAudit(p: Prospect, audit: WebsiteAudit): Prospect {
  const out: Prospect = { ...p, audit, provenance: { ...p.provenance }, socials: { ...p.socials } };
  if (!audit.ok) return out;
  const det = { source: "website" as const, confidence: "detected" as const };
  if (!out.phone && audit.found.phones[0]) { out.phone = audit.found.phones[0]; out.provenance.phone = det; }
  if (!out.email && audit.found.emails[0]) { out.email = audit.found.emails[0]; out.provenance.email = det; }
  if (!out.whatsapp && audit.found.whatsapp) {
    const num = audit.found.whatsapp.match(/(?:wa\.me\/|phone=)(\d{10,15})/)?.[1];
    if (num) { out.whatsapp = `+${num}`; out.provenance.whatsapp = det; }
  }
  for (const [k, v] of Object.entries(audit.found.socials)) {
    const key = k as keyof Prospect["socials"];
    if (v && !out.socials[key]) { out.socials[key] = v; out.provenance[`social.${k}`] = det; }
  }
  if (!out.description && audit.found.description) { out.description = audit.found.description; out.provenance.description = det; }
  if (!out.sources.includes("website")) out.sources = [...out.sources, "website"];
  if (audit.pagespeed && !out.sources.includes("pagespeed")) out.sources = [...out.sources, "pagespeed"];
  return out;
}

const siteKey = (u?: string) => { try { return new URL(/^https?:\/\//i.test(u ?? "") ? u! : `https://${u}`).hostname.replace(/^www\./, ""); } catch { return ""; } };

// Applies a website check: the confirmed website (or none), missing contact
// details from the place listing, and the audit of the site that was chosen.
// A website your team entered by hand is never replaced.
export function applyResolution(p: Prospect, r: ResolveResult): Prospect {
  let out: Prospect = { ...p, provenance: { ...p.provenance }, websiteCheck: r.check };
  const addSource = (s: SourceId) => { if (!out.sources.includes(s)) out.sources = [...out.sources, s]; };
  if (r.detailsSource) {
    if (r.phone && !out.phone) { out.phone = r.phone; out.provenance.phone = { source: r.detailsSource, confidence: "verified" }; }
    if (r.address && !out.address) { out.address = r.address; out.provenance.address = { source: r.detailsSource, confidence: "verified" }; }
  }
  const manual = p.provenance.website?.source === "manual";
  if (!manual && (r.website ?? "") !== (p.website ?? "")) {
    out.website = r.website;
    if (r.website) out.provenance.website = { source: r.websiteSource ?? "website", confidence: r.websiteConfidence ?? "detected" };
    else delete out.provenance.website;
    if (r.websiteSource === "web_search") addSource("web_search");
    out.audit = undefined;
    out.websiteStatus = r.website ? "unchecked" : "none";
  }
  const site = siteKey(out.website);
  if (r.audit && site && [r.audit.url, r.audit.finalUrl].some((u) => siteKey(u) === site)) out = applyAudit(out, r.audit);
  return out;
}
