import type { Prospect } from "../../types";
import { newProspect, industryFromTypes } from "../prospect";
import { CITY_COORDS } from "../catalog";

// Provider/connector layer. Each discovery source implements LeadProvider and
// returns normalized prospects; the rest of the app never sees provider shapes.
// Keys stay on the server (process.env) and are never sent to the browser.

export interface ProviderSearch { text: string; industry: string; location: string; limit: number }
export interface ProviderInfo { id: string; name: string; connected: boolean; note: string; envVar?: string }

export interface LeadProvider {
  id: "google_places" | "serpapi";
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

// Tolerates common paste mistakes in hosting dashboards: surrounding quotes,
// spaces/newlines, or the whole "NAME=value" line pasted as the value.
export function envKey(...names: string[]) {
  for (const n of names) {
    const v = (process.env[n] ?? "").trim().replace(/^[A-Z_]+=/, "").replace(/^["']|["']$/g, "").trim();
    if (v) return v;
  }
  return "";
}
// Safe to show the team: length and last 4 characters only.
export const keyHint = (k: string) => (k ? `…${k.slice(-4)}, ${k.length} characters` : "not set");

const placesKey = () => envKey("GOOGLE_PLACES_API_KEY");

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

// ---------- SerpApi (Google Maps results) ----------
// Same Google Maps listings, fetched through SerpApi's google_maps engine.
// Field names follow SerpApi's documented local_results schema.

interface SerpPlace {
  title?: string;
  place_id?: string;
  address?: string;
  phone?: string;
  website?: string;
  rating?: number;
  reviews?: number;
  type?: string;
  types?: string[];
  open_state?: string;
  operating_hours?: Record<string, string>;
  description?: string;
}
interface SerpResponse {
  error?: string;
  local_results?: SerpPlace[];
  place_results?: SerpPlace;
  serpapi_pagination?: { next?: string };
}

const serpKey = () => envKey("SERPAPI_API_KEY", "SERPAPI_KEY");

async function serpFetch(url: URL): Promise<SerpResponse> {
  url.searchParams.set("api_key", serpKey());
  const res = await fetch(url, { signal: AbortSignal.timeout(30000), cache: "no-store" });
  let body: SerpResponse = {};
  try { body = (await res.json()) as SerpResponse; } catch {}
  // "No results" comes back as an error string; that's an empty page, not a failure.
  if (body.error && /hasn't returned any results|no results/i.test(body.error)) return {};
  if (!res.ok || body.error) {
    const status = res.status === 401 || /invalid api key/i.test(body.error ?? "") ? 400 : res.status === 429 || /run out of searches|limit/i.test(body.error ?? "") ? 429 : 502;
    if (status === 400 && /invalid api key/i.test(body.error ?? "")) throw new ProviderError(`SerpApi rejected the key in SERPAPI_API_KEY (${keyHint(serpKey())}). SerpApi keys are 64 characters — copy it again from serpapi.com/manage-api-key, update it in your hosting settings and redeploy.`, 400);
    throw new ProviderError(`SerpApi: ${body.error ?? `request failed (${res.status})`}`, status);
  }
  return body;
}

function city(address?: string, fallback?: string) {
  // "12 CG Road, Navrangpura, Ahmedabad, Gujarat 380009" → "Ahmedabad"
  const parts = (address ?? "").split(",").map((x) => x.trim()).filter(Boolean);
  const i = parts.findIndex((x) => /\b\d{6}\b/.test(x) || /^(gujarat|maharashtra|karnataka|delhi|rajasthan|tamil nadu|telangana|west bengal|uttar pradesh|madhya pradesh|kerala|punjab|haryana|goa|india)\b/i.test(x));
  return (i > 0 ? parts[i - 1] : undefined) ?? (fallback || undefined);
}

function normalizeSerp(p: SerpPlace, industry: string, location: string): Prospect | null {
  if (!p.title || !p.place_id) return null;
  if (p.open_state && /permanently closed|temporarily closed/i.test(p.open_state)) return null;
  const web = p.website;
  const social = web && /instagram\.com|facebook\.com|linktr\.ee|wa\.me|whatsapp\.com/i.test(web) ? web : undefined;
  const pr = newProspect(
    {
      name: p.title,
      industry: industry || industryFromTypes((p.types ?? []).map((t) => t.toLowerCase().replace(/\s+/g, "_")), p.type ?? ""),
      category: p.type,
      city: city(p.address, location),
      address: p.address,
      phone: p.phone,
      website: social ? undefined : web,
      socials: social ? { [/instagram/i.test(social) ? "instagram" : "facebook"]: social } : {},
      // Google's documented Maps URL format for a place id.
      googleMapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.title)}&query_place_id=${encodeURIComponent(p.place_id)}`,
      placeId: p.place_id,
      rating: p.rating,
      reviewCount: p.reviews ?? (p.rating ? undefined : 0),
      description: p.description,
      openingHours: p.operating_hours ? Object.entries(p.operating_hours).map(([d, h]) => `${d[0].toUpperCase()}${d.slice(1)}: ${h}`) : undefined,
    },
    "serpapi",
  );
  if (!pr.industry) pr.provenance.industry = { source: "serpapi", confidence: "estimated" };
  if (pr.city && !/\d/.test(pr.city)) pr.provenance.city = { source: "serpapi", confidence: "detected" };
  return pr;
}

export const serpApi: LeadProvider = {
  id: "serpapi",
  name: "SerpApi (Google Maps)",
  connected: () => !!serpKey(),
  async searchBusinesses(q) {
    const out: Prospect[] = [];
    let url: URL | null = new URL("https://serpapi.com/search.json");
    const params: Record<string, string> = { engine: "google_maps", type: "search", q: q.text, hl: "en", gl: "in", google_domain: "google.co.in" };
    const at = CITY_COORDS[q.location.trim().toLowerCase()];
    if (at) params.ll = `@${at[0]},${at[1]},12z`;
    url.search = new URLSearchParams(params).toString();
    // 20 results per page; each page is one SerpApi search credit.
    for (let page = 0; page < 3 && url && out.length < q.limit; page++) {
      const data = await serpFetch(url);
      const list = data.local_results ?? (data.place_results ? [data.place_results] : []);
      for (const p of list) {
        const n = normalizeSerp(p, q.industry, q.location);
        if (n) out.push(n);
      }
      const next = data.serpapi_pagination?.next && list.length ? new URL(data.serpapi_pagination.next) : null;
      // Only ever send the key back to SerpApi itself.
      url = next && next.protocol === "https:" && next.hostname === "serpapi.com" ? next : null;
    }
    return out.slice(0, q.limit);
  },
  async getBusinessDetails(placeId) {
    if (!/^[\w-]{10,300}$/.test(placeId)) throw new ProviderError("Invalid place id", 400);
    const url = new URL("https://serpapi.com/search.json");
    url.search = new URLSearchParams({ engine: "google_maps", place_id: placeId, hl: "en", gl: "in" }).toString();
    const data = await serpFetch(url);
    return data.place_results ? normalizeSerp({ place_id: placeId, ...data.place_results }, "", "") : null;
  },
};

// Google's official API first when both are configured.
export const PROVIDERS: LeadProvider[] = [googlePlaces, serpApi];
export const activeProvider = () => PROVIDERS.find((p) => p.connected()) ?? null;

export function integrations(): ProviderInfo[] {
  return [
    { id: "google_places", name: "Google Places", connected: googlePlaces.connected(), envVar: "GOOGLE_PLACES_API_KEY", note: "Business discovery (official Google API): name, category, address, phone, website, rating, reviews." },
    { id: "serpapi", name: "SerpApi — Google Maps", connected: serpApi.connected(), envVar: "SERPAPI_API_KEY", note: `Alternative business discovery from Google Maps results.${serpApi.connected() ? ` Key: ${keyHint(serpKey())}${serpKey().length !== 64 ? " — SerpApi keys are normally 64 characters, check it was copied fully" : ""}.` : ""}${googlePlaces.connected() && serpApi.connected() ? " Google Places is used while both are set." : ""}` },
    { id: "website", name: "Website analyzer", connected: true, note: "Built in. Reads public homepages and respects robots.txt." },
    { id: "pagespeed", name: "Google PageSpeed", connected: !!(process.env.GOOGLE_PAGESPEED_API_KEY ?? "").trim(), envVar: "GOOGLE_PAGESPEED_API_KEY", note: "Optional. Adds Google's mobile performance score to audits." },
    { id: "claude", name: "Claude AI", connected: !!(process.env.ANTHROPIC_API_KEY ?? "").trim(), envVar: "ANTHROPIC_API_KEY", note: "Optional. Smarter search parsing and personalised outreach drafts. Rule-based fallback otherwise." },
  ];
}
