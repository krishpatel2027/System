import type { Prospect } from "../../types";
import { newProspect, industryFromTypes } from "../prospect";
import { MARKETS, isMarket, marketOf, parseCountry, resolveLocation, type Market, type MarketCode } from "../markets";

// Provider/connector layer. Each discovery source implements LeadProvider and
// returns normalized prospects; the rest of the app never sees provider shapes.
// Keys stay on the server (process.env) and are never sent to the browser.

export interface ProviderSearch { text: string; industry: string; location: string; country?: string; limit: number }
export interface ProviderInfo { id: string; name: string; connected: boolean; note: string; envVar?: string }

export interface LeadProvider {
  id: "google_places" | "serpapi" | "searchapi";
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
  addressComponents?: { longText: string; shortText?: string; types: string[] }[];
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
function normalize(p: Place, industry: string, location: string, hint?: MarketCode): Prospect | null {
  if (!p.id || !p.displayName?.text) return null;
  if (p.businessStatus && p.businessStatus !== "OPERATIONAL") return null;
  const comp = (t: string) => p.addressComponents?.find((c) => c.types.includes(t))?.longText;
  const city = comp("locality") ?? comp("administrative_area_level_3") ?? comp("administrative_area_level_2") ?? (location || undefined);
  const area = comp("sublocality_level_1") ?? comp("sublocality") ?? comp("neighborhood");
  const short = p.addressComponents?.find((c) => c.types.includes("country"))?.shortText?.toUpperCase();
  const country = isMarket(short) ? short : hint ?? countryFromAddress(p.formattedAddress);
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
      country,
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
    const market = searchMarket(q);
    let pageToken: string | undefined;
    // Text Search returns up to 20 per page and at most 60 per query.
    for (let page = 0; page < 3 && out.length < q.limit; page++) {
      const body: Record<string, unknown> = { textQuery: q.text, pageSize: Math.min(20, q.limit - out.length), regionCode: market.code, languageCode: "en" };
      if (pageToken) body.pageToken = pageToken;
      const data = (await placesFetch("/places:searchText", {
        method: "POST",
        body: JSON.stringify(body),
        fieldMask: [...FIELDS.map((f) => `places.${f}`), "nextPageToken"].join(","),
      })) as { places?: Place[]; nextPageToken?: string };
      for (const p of data.places ?? []) {
        const n = normalize(p, q.industry, q.location, market.code);
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

// Which country a search is for. India stays the default, as before, unless a
// country was chosen or the place is a known city abroad.
function searchMarket(q: { location: string; country?: string }): Market {
  return resolveLocation(q.location, q.country).market ?? marketOf(q.country) ?? MARKETS.IN;
}

// "…, Austin, TX 78701, USA" → "USA" → US. Also handles "Business Bay - Dubai - UAE".
export function countryFromAddress(address?: string): MarketCode | undefined {
  const parts = (address ?? "").split(/,|\s[-–]\s/).map((x) => x.trim()).filter(Boolean);
  return parts.length ? parseCountry(parts[parts.length - 1]) : undefined;
}

const POSTCODE = /\b(?:[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}|[A-Z]\d[A-Z]\s*\d[A-Z]\d|[A-Z]{2,3}\s+\d{4,5}(?:-\d{4})?)\b/g;

// Best-effort city from a formatted address outside India. Falls back to the
// place that was searched for.
function cityAbroad(address: string | undefined, fallback: string | undefined): string | undefined {
  const parts = (address ?? "").split(/,|\s[-–]\s/).map((x) => x.trim()).filter(Boolean);
  if (parts.length && parseCountry(parts[parts.length - 1])) parts.pop();
  for (let i = parts.length - 1; i >= 1; i--) {
    const cleaned = parts[i].replace(POSTCODE, "").replace(/\b\d+\b/g, "").replace(/\s+/g, " ").trim();
    if (cleaned && !/^(po box|p\.o\. box)/i.test(cleaned)) return cleaned;
  }
  return fallback?.split(",")[0].trim() || undefined;
}

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
  organic_results?: { link?: string; title?: string }[];
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

function cityOf(address: string | undefined, location: string, market?: MarketCode) {
  const fb = location.split(",")[0].trim();
  // The searched place, when the address mentions it, is the most reliable answer.
  if (fb && (address ?? "").toLowerCase().includes(fb.toLowerCase())) return fb;
  return market && market !== "IN" ? cityAbroad(address, location) : city(address, location);
}

function normalizeSerp(p: SerpPlace, industry: string, location: string, source: "serpapi" | "searchapi" = "serpapi", hint?: MarketCode): Prospect | null {
  if (!p.title || !p.place_id) return null;
  if (p.open_state && /permanently closed|temporarily closed/i.test(p.open_state)) return null;
  const web = p.website;
  const social = web && /instagram\.com|facebook\.com|linktr\.ee|wa\.me|whatsapp\.com/i.test(web) ? web : undefined;
  const pr = newProspect(
    {
      name: p.title,
      industry: industry || industryFromTypes((p.types ?? []).map((t) => t.toLowerCase().replace(/\s+/g, "_")), p.type ?? ""),
      category: p.type,
      city: cityOf(p.address, location, countryFromAddress(p.address) ?? hint),
      country: countryFromAddress(p.address) ?? hint,
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
    source,
  );
  if (!pr.industry) pr.provenance.industry = { source, confidence: "estimated" };
  if (pr.city && !/\d/.test(pr.city)) pr.provenance.city = { source, confidence: "detected" };
  return pr;
}

export const serpApi: LeadProvider = {
  id: "serpapi",
  name: "SerpApi (Google Maps)",
  connected: () => !!serpKey(),
  async searchBusinesses(q) {
    const out: Prospect[] = [];
    let url: URL | null = new URL("https://serpapi.com/search.json");
    const found = resolveLocation(q.location, q.country);
    const market = searchMarket(q);
    const params: Record<string, string> = { engine: "google_maps", type: "search", q: q.text, hl: "en", gl: market.gl, google_domain: market.domain };
    if (found.city) params.ll = `@${found.city.lat},${found.city.lng},12z`;
    url.search = new URLSearchParams(params).toString();
    // 20 results per page; each page is one SerpApi search credit.
    for (let page = 0; page < 3 && url && out.length < q.limit; page++) {
      const data = await serpFetch(url);
      const list = data.local_results ?? (data.place_results ? [data.place_results] : []);
      for (const p of list) {
        const n = normalizeSerp(p, q.industry, q.location, "serpapi", market.code);
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

// ---------- SearchApi.io (Google Maps results) ----------
// Another Google Maps results API. Request/response shape follows SearchApi's
// official google_maps / google_maps_place engines (local_results[]).
// The key goes in the Authorization header, never in the URL.

interface SearchApiPlace {
  title?: string;
  place_id?: string;
  address?: string;
  phone?: string;
  website?: string;
  rating?: number;
  reviews?: number;
  type?: string;
  types?: string[];
  hours?: string;
  open_hours?: Record<string, string>;
  description?: string;
  business_status?: string;
  permanently_closed?: boolean;
}
interface SearchApiResponse {
  error?: string;
  local_results?: SearchApiPlace[];
  place_result?: SearchApiPlace;
  place_results?: SearchApiPlace;
  organic_results?: { link?: string; title?: string }[];
}

const SEARCHAPI = "https://www.searchapi.io/api/v1/search";
const searchApiKey = () => envKey("SEARCHAPI_API_KEY", "SEARCHAPI_KEY");

async function searchApiFetch(params: Record<string, string>): Promise<SearchApiResponse> {
  const url = new URL(SEARCHAPI);
  url.search = new URLSearchParams(params).toString();
  const res = await fetch(url, { headers: { Authorization: `Bearer ${searchApiKey()}`, Accept: "application/json" }, signal: AbortSignal.timeout(30000), cache: "no-store" });
  let body: SearchApiResponse = {};
  try { body = (await res.json()) as SearchApiResponse; } catch {}
  const err = typeof body.error === "string" ? body.error : "";
  if (err && /no results|hasn't returned any results|didn't return any results/i.test(err)) return {};
  if (!res.ok || err) {
    if (res.status === 401 || res.status === 403 || /invalid api key|unauthori[sz]ed|api key/i.test(err))
      throw new ProviderError(`SearchApi.io rejected the key in SEARCHAPI_API_KEY (${keyHint(searchApiKey())}). Copy it again from searchapi.io (Dashboard → API key), update it in your hosting settings and redeploy.`, 400);
    if (res.status === 429 || /limit|quota|credits|searches left/i.test(err)) throw new ProviderError(`SearchApi.io: ${err || "search limit reached"}`, 429);
    throw new ProviderError(`SearchApi.io: ${err || `request failed (${res.status})`}`, 502);
  }
  return body;
}

function fromSearchApi(p: SearchApiPlace): SerpPlace {
  const closed = p.permanently_closed || /closed_(permanently|temporarily)/i.test(p.business_status ?? "");
  return {
    title: p.title, place_id: p.place_id, address: p.address, phone: p.phone, website: p.website,
    rating: typeof p.rating === "number" ? p.rating : undefined,
    reviews: typeof p.reviews === "number" ? p.reviews : undefined,
    type: p.type, types: p.types, description: p.description,
    open_state: closed ? "Permanently closed" : p.hours,
    operating_hours: p.open_hours && typeof p.open_hours === "object" && !Array.isArray(p.open_hours) ? p.open_hours : undefined,
  };
}

export const searchApi: LeadProvider = {
  id: "searchapi",
  name: "SearchApi.io (Google Maps)",
  connected: () => !!searchApiKey(),
  async searchBusinesses(q) {
    const out: Prospect[] = [];
    const found = resolveLocation(q.location, q.country);
    const market = searchMarket(q);
    const params: Record<string, string> = { engine: "google_maps", q: q.text, hl: "en", gl: market.gl };
    if (found.city) params.ll = `@${found.city.lat},${found.city.lng},12z`;
    // Up to 20 results per page; each page is one SearchApi credit.
    for (let page = 1; page <= 3 && out.length < q.limit; page++) {
      const data = await searchApiFetch({ ...params, page: String(page) });
      const list = data.local_results ?? [];
      for (const p of list) {
        const n = normalizeSerp(fromSearchApi(p), q.industry, q.location, "searchapi", market.code);
        if (n) out.push(n);
      }
      if (list.length < 20) break;
    }
    return out.slice(0, q.limit);
  },
  async getBusinessDetails(placeId) {
    if (!/^[\w-]{10,300}$/.test(placeId)) throw new ProviderError("Invalid place id", 400);
    const data = await searchApiFetch({ engine: "google_maps_place", place_id: placeId, hl: "en", gl: "in" });
    const p = data.place_result ?? data.place_results ?? data.local_results?.[0];
    return p ? normalizeSerp(fromSearchApi({ ...p, place_id: p.place_id || placeId }), "", "", "searchapi") : null;
  },
};

// Google's official API first when both are configured.
export const PROVIDERS: LeadProvider[] = [googlePlaces, serpApi, searchApi];
export const activeProvider = () => PROVIDERS.find((p) => p.connected()) ?? null;

// ---------- Google web search (website discovery) ----------
// Used to look for a business's own website when its Maps listing has none,
// links to a directory page, or links to an old/broken site. Only SearchApi
// and SerpApi offer it; Google Places has no web search.

export interface WebResult { link: string; title?: string }
export interface WebSearcher { id: "searchapi" | "serpapi"; name: string; search(q: string, country?: string): Promise<WebResult[]> }

const organic = (list?: { link?: string; title?: string }[]): WebResult[] =>
  (list ?? []).filter((r): r is WebResult => typeof r.link === "string" && /^https?:\/\//i.test(r.link)).map((r) => ({ link: r.link, title: r.title }));

const searchApiWeb: WebSearcher = {
  id: "searchapi",
  name: "SearchApi.io",
  async search(q, country) {
    return organic((await searchApiFetch({ engine: "google", q, gl: (marketOf(country) ?? MARKETS.IN).gl, hl: "en", num: "10" })).organic_results);
  },
};
const serpApiWeb: WebSearcher = {
  id: "serpapi",
  name: "SerpApi",
  async search(q, country) {
    const m = marketOf(country) ?? MARKETS.IN;
    const url = new URL("https://serpapi.com/search.json");
    url.search = new URLSearchParams({ engine: "google", q, gl: m.gl, hl: "en", google_domain: m.domain, num: "10" }).toString();
    return organic((await serpFetch(url)).organic_results);
  },
};

// Same service as the active provider when possible, so one key covers both.
export function webSearcher(): WebSearcher | null {
  const options = [
    { on: searchApi.connected(), w: searchApiWeb },
    { on: serpApi.connected(), w: serpApiWeb },
  ].filter((o) => o.on).map((o) => o.w);
  return options.find((w) => w.id === activeProvider()?.id) ?? options[0] ?? null;
}

export function integrations(): ProviderInfo[] {
  return [
    { id: "google_places", name: "Google Places", connected: googlePlaces.connected(), envVar: "GOOGLE_PLACES_API_KEY", note: "Business discovery (official Google API): name, category, address, phone, website, rating, reviews." },
    { id: "serpapi", name: "SerpApi — Google Maps", connected: serpApi.connected(), envVar: "SERPAPI_API_KEY", note: `Alternative business discovery from Google Maps results.${serpApi.connected() ? ` Key: ${keyHint(serpKey())}${serpKey().length !== 64 ? " — SerpApi keys are normally 64 characters, check it was copied fully" : ""}.` : ""}${googlePlaces.connected() && serpApi.connected() ? " Google Places is used while both are set." : ""}` },
    { id: "searchapi", name: "SearchApi.io — Google Maps", connected: searchApi.connected(), envVar: "SEARCHAPI_API_KEY", note: `Alternative business discovery from Google Maps results.${searchApi.connected() ? ` Key: ${keyHint(searchApiKey())}.` : ""}${searchApi.connected() && (googlePlaces.connected() || serpApi.connected()) ? ` ${googlePlaces.connected() ? "Google Places" : "SerpApi"} is used while both are set.` : ""}` },
    { id: "website", name: "Website analyzer", connected: true, note: `Built in. Reads public homepages and respects robots.txt.${webSearcher() ? ` When a Google listing has no website, links to a directory page, or links to an old or broken site, it also searches Google (via ${webSearcher()!.name}, one search credit each) for the business's current site and only uses one that shows the listing's phone number or clearly matches its name and city.` : " Add a SearchApi.io or SerpApi key to also look up websites that Google listings are missing or link to wrongly."}` },
    { id: "pagespeed", name: "Google PageSpeed", connected: !!(process.env.GOOGLE_PAGESPEED_API_KEY ?? "").trim(), envVar: "GOOGLE_PAGESPEED_API_KEY", note: "Optional. Adds Google's mobile performance score to audits." },
    { id: "claude", name: "Claude AI", connected: !!(process.env.ANTHROPIC_API_KEY ?? "").trim(), envVar: "ANTHROPIC_API_KEY", note: "Optional. Smarter search parsing and personalised outreach drafts. Rule-based fallback otherwise." },
  ];
}
