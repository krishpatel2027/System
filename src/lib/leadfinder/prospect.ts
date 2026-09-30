import type { Confidence, Prospect, SavedSearch, SearchQuery, SourceId } from "../types";
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
