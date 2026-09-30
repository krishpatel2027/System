import type { Prospect } from "../../types";
import { newProspect, industryFromTypes } from "../prospect";

// Provider/connector layer. Each discovery source implements LeadProvider and
// returns normalized prospects; the rest of the app never sees provider shapes.
// Keys stay on the server (process.env) and are never sent to the browser.

export interface ProviderSearch { text: string; industry: string; location: string; limit: number }
export interface ProviderInfo { id: string; name: string; connected: boolean; note: string; envVar?: string }

export interface LeadProvider {
  id: "google_places";
  name: string;
  connected(): boolean;
  searchBusinesses(q: ProviderSearch): Promise<Prospect[]>;
  getBusinessDetails(placeId: string): Promise<Prospect | null>;
}

export class ProviderError extends Error {
  constructor(message: string, public status = 502) { super(message); }
}

// ---------- Google Places API (New) ----------

const PLACES = "https://places.googleapis.com/v1";
const FIELDS = [
  "id", "displayName", "formattedAddress", "addressComponents", "nationalPhoneNumber", "internationalPhoneNumber",
  "websiteUri", "rating", "userRatingCount", "googleMapsUri", "primaryType", "primaryTypeDisplayName", "types",
  "businessStatus", "regularOpeningHours", "editorialSummary",
];

interface Place {
  id: string;
  displayName?: { text: string };
  formattedAddress?: string;
  addressComponents?: { longText: string; types: string[] }[];
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  websiteUri?: string;
  rating?: number;
  userRatingCount?: number;
  googleMapsUri?: string;
  primaryType?: string;
  primaryTypeDisplayName?: { text: string };
  types?: string[];
  businessStatus?: string;
  regularOpeningHours?: { weekdayDescriptions?: string[] };
  editorialSummary?: { text: string };
}

const placesKey = () => (process.env.GOOGLE_PLACES_API_KEY ?? "").trim();

async function placesFetch(path: string, init: RequestInit & { fieldMask: string }) {
  const res = await fetch(`${PLACES}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", "X-Goog-Api-Key": placesKey(), "X-Goog-FieldMask": init.fieldMask },
    signal: AbortSignal.timeout(15000),
    cache: "no-store",
  });
  if (!res.ok) {
    let msg = `Google Places returned ${res.status}`;
    try {
      const body = (await res.json()) as { error?: { message?: string; status?: string } };
      if (body.error?.message) msg = `Google Places: ${body.error.message}`;
    } catch {}
    throw new ProviderError(msg, res.status === 429 ? 429 : res.status === 403 || res.status === 400 ? 400 : 502);
  }
  return res.json();
}

// Google's own social links aren't in Places; only the website is. Business
// details come straight from the listing the business manages, so they're
// marked verified with Google as the source.
function normalize(p: Place, industry: string, location: string): Prospect | null {
  if (!p.id || !p.displayName?.text) return null;
  if (p.businessStatus && p.businessStatus !== "OPERATIONAL") return null;
  const comp = (t: string) => p.addressComponents?.find((c) => c.types.includes(t))?.longText;
  const city = comp("locality") ?? comp("administrative_area_level_3") ?? comp("administrative_area_level_2") ?? (location || undefined);
  const area = comp("sublocality_level_1") ?? comp("sublocality") ?? comp("neighborhood");
  const web = p.websiteUri;
  // A listing that points at Instagram/Facebook has a social page, not a website.
  const social = web && /instagram\.com|facebook\.com|linktr\.ee|wa\.me|whatsapp\.com/i.test(web) ? web : undefined;
  const pr = newProspect(
    {
      name: p.displayName.text,
      industry: industry || industryFromTypes(p.types, p.primaryTypeDisplayName?.text ?? ""),
      category: p.primaryTypeDisplayName?.text,
      city,
      area,
      address: p.formattedAddress,
      phone: p.internationalPhoneNumber ?? p.nationalPhoneNumber,
      website: social ? undefined : web,
      socials: social ? { [/instagram/i.test(social) ? "instagram" : "facebook"]: social } : {},
      googleMapsUrl: p.googleMapsUri,
      placeId: p.id,
      rating: p.rating,
      reviewCount: p.userRatingCount ?? (p.rating ? undefined : 0),
      description: p.editorialSummary?.text,
      openingHours: p.regularOpeningHours?.weekdayDescriptions,
    },
    "google_places",
  );
  if (!pr.industry) pr.provenance.industry = { source: "google_places", confidence: "estimated" };
  return pr;
}

export const googlePlaces: LeadProvider = {
  id: "google_places",
  name: "Google Places",
  connected: () => !!placesKey(),
  async searchBusinesses(q) {
    const out: Prospect[] = [];
    let pageToken: string | undefined;
    // Text Search returns up to 20 per page and at most 60 per query.
    for (let page = 0; page < 3 && out.length < q.limit; page++) {
      const body: Record<string, unknown> = { textQuery: q.text, pageSize: Math.min(20, q.limit - out.length), regionCode: "IN", languageCode: "en" };
      if (pageToken) body.pageToken = pageToken;
      const data = (await placesFetch("/places:searchText", {
        method: "POST",
        body: JSON.stringify(body),
        fieldMask: [...FIELDS.map((f) => `places.${f}`), "nextPageToken"].join(","),
      })) as { places?: Place[]; nextPageToken?: string };
      for (const p of data.places ?? []) {
        const n = normalize(p, q.industry, q.location);
        if (n) out.push(n);
      }
      pageToken = data.nextPageToken;
      if (!pageToken) break;
    }
    return out.slice(0, q.limit);
  },
  async getBusinessDetails(placeId) {
    if (!/^[\w-]{10,300}$/.test(placeId)) throw new ProviderError("Invalid place id", 400);
    const p = (await placesFetch(`/places/${encodeURIComponent(placeId)}`, { method: "GET", fieldMask: FIELDS.join(",") })) as Place;
    return normalize(p, "", "");
  },
};

export const PROVIDERS: LeadProvider[] = [googlePlaces];
export const activeProvider = () => PROVIDERS.find((p) => p.connected()) ?? null;

export function integrations(): ProviderInfo[] {
  return [
    { id: "google_places", name: "Google Places", connected: googlePlaces.connected(), envVar: "GOOGLE_PLACES_API_KEY", note: "Business discovery: name, category, address, phone, website, rating, reviews." },
    { id: "website", name: "Website analyzer", connected: true, note: "Built in. Reads public homepages and respects robots.txt." },
    { id: "pagespeed", name: "Google PageSpeed", connected: !!(process.env.GOOGLE_PAGESPEED_API_KEY ?? "").trim(), envVar: "GOOGLE_PAGESPEED_API_KEY", note: "Optional. Adds Google's mobile performance score to audits." },
    { id: "claude", name: "Claude AI", connected: !!(process.env.ANTHROPIC_API_KEY ?? "").trim(), envVar: "ANTHROPIC_API_KEY", note: "Optional. Smarter search parsing and personalised outreach drafts. Rule-based fallback otherwise." },
  ];
}
