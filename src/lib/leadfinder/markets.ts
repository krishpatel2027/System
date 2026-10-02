import { inr } from "../utils";
import { CITIES, CITY_COORDS } from "./catalog";

// Countries Lead Finder can search. Shared by the server (provider requests,
// phone matching) and the browser (country picker, local time, currency).
// Nothing here is a price or an exchange rate: rates are entered by the team in
// Settings, so a made-up figure never appears next to a lead.

export type MarketCode = "IN" | "US" | "CA" | "GB" | "AU" | "AE" | "SA" | "QA" | "KW" | "BH" | "OM";

export interface MarketCity { name: string; lat: number; lng: number; tz: string }

export interface Market {
  code: MarketCode;
  name: string;
  currency: string;
  dial: string;            // international dialling code, digits only
  gl: string;              // Google "gl" country parameter
  domain: string;          // Google domain used for results
  tz?: string;             // set when the whole country has one time zone
  whatsapp: boolean;       // WhatsApp is the usual way customers contact a business here
  emailNote?: string;      // short, general pointer about unsolicited email rules
  cities: MarketCity[];
}

const c = (name: string, lat: number, lng: number, tz: string): MarketCity => ({ name, lat, lng, tz });

const INDIA_CITIES: MarketCity[] = CITIES.filter((n) => n !== "India").map((name) => {
  const [lat, lng] = CITY_COORDS[name.toLowerCase()] ?? [20.5937, 78.9629];
  return c(name, lat, lng, "Asia/Kolkata");
});

const GULF_NOTE = "Rules for unsolicited marketing differ by country and by channel (email, calls, WhatsApp). Keep messages relevant, say who you are, and stop if asked.";

export const MARKETS: Record<MarketCode, Market> = {
  IN: { code: "IN", name: "India", currency: "INR", dial: "91", gl: "in", domain: "google.co.in", tz: "Asia/Kolkata", whatsapp: true, cities: INDIA_CITIES },
  US: {
    code: "US", name: "United States", currency: "USD", dial: "1", gl: "us", domain: "google.com", whatsapp: false,
    emailNote: "US commercial email must follow CAN-SPAM: accurate sender details, a physical address and a working opt-out.",
    cities: [
      c("New York", 40.7128, -74.006, "America/New_York"), c("Los Angeles", 34.0522, -118.2437, "America/Los_Angeles"), c("Chicago", 41.8781, -87.6298, "America/Chicago"),
      c("Houston", 29.7604, -95.3698, "America/Chicago"), c("Dallas", 32.7767, -96.797, "America/Chicago"), c("Austin", 30.2672, -97.7431, "America/Chicago"),
      c("Miami", 25.7617, -80.1918, "America/New_York"), c("Atlanta", 33.749, -84.388, "America/New_York"), c("Boston", 42.3601, -71.0589, "America/New_York"),
      c("San Francisco", 37.7749, -122.4194, "America/Los_Angeles"), c("San Diego", 32.7157, -117.1611, "America/Los_Angeles"), c("Seattle", 47.6062, -122.3321, "America/Los_Angeles"),
      c("Phoenix", 33.4484, -112.074, "America/Phoenix"), c("Denver", 39.7392, -104.9903, "America/Denver"),
    ],
  },
  CA: {
    code: "CA", name: "Canada", currency: "CAD", dial: "1", gl: "ca", domain: "google.ca", whatsapp: false,
    emailNote: "Canada's anti-spam law (CASL) restricts unsolicited commercial email, with limited exceptions. Check before emailing; calls or LinkedIn may be simpler.",
    cities: [
      c("Toronto", 43.6532, -79.3832, "America/Toronto"), c("Mississauga", 43.589, -79.6441, "America/Toronto"), c("Vancouver", 49.2827, -123.1207, "America/Vancouver"),
      c("Montreal", 45.5017, -73.5673, "America/Toronto"), c("Calgary", 51.0447, -114.0719, "America/Edmonton"), c("Edmonton", 53.5461, -113.4938, "America/Edmonton"),
      c("Ottawa", 45.4215, -75.6972, "America/Toronto"),
    ],
  },
  GB: {
    code: "GB", name: "United Kingdom", currency: "GBP", dial: "44", gl: "uk", domain: "google.co.uk", tz: "Europe/London", whatsapp: false,
    emailNote: "UK email rules (PECR and UK GDPR) differ between limited companies and sole traders. Always identify yourself and offer an opt-out.",
    cities: [
      c("London", 51.5074, -0.1278, "Europe/London"), c("Manchester", 53.4808, -2.2426, "Europe/London"), c("Birmingham", 52.4862, -1.8904, "Europe/London"),
      c("Leeds", 53.8008, -1.5491, "Europe/London"), c("Liverpool", 53.4084, -2.9916, "Europe/London"), c("Bristol", 51.4545, -2.5879, "Europe/London"),
      c("Glasgow", 55.8642, -4.2518, "Europe/London"), c("Edinburgh", 55.9533, -3.1883, "Europe/London"),
    ],
  },
  AU: {
    code: "AU", name: "Australia", currency: "AUD", dial: "61", gl: "au", domain: "google.com.au", whatsapp: false,
    emailNote: "Australia's Spam Act 2003 requires consent (sometimes inferred), clear sender details and an unsubscribe option.",
    cities: [
      c("Sydney", -33.8688, 151.2093, "Australia/Sydney"), c("Melbourne", -37.8136, 144.9631, "Australia/Melbourne"), c("Brisbane", -27.4698, 153.0251, "Australia/Brisbane"),
      c("Perth", -31.9505, 115.8605, "Australia/Perth"), c("Adelaide", -34.9285, 138.6007, "Australia/Adelaide"), c("Gold Coast", -28.0167, 153.4, "Australia/Brisbane"),
      c("Canberra", -35.2809, 149.13, "Australia/Sydney"),
    ],
  },
  AE: {
    code: "AE", name: "United Arab Emirates", currency: "AED", dial: "971", gl: "ae", domain: "google.ae", tz: "Asia/Dubai", whatsapp: true, emailNote: GULF_NOTE,
    cities: [c("Dubai", 25.2048, 55.2708, "Asia/Dubai"), c("Abu Dhabi", 24.4539, 54.3773, "Asia/Dubai"), c("Sharjah", 25.3463, 55.4209, "Asia/Dubai"), c("Ajman", 25.4052, 55.5136, "Asia/Dubai")],
  },
  SA: {
    code: "SA", name: "Saudi Arabia", currency: "SAR", dial: "966", gl: "sa", domain: "google.com.sa", tz: "Asia/Riyadh", whatsapp: true, emailNote: GULF_NOTE,
    cities: [c("Riyadh", 24.7136, 46.6753, "Asia/Riyadh"), c("Jeddah", 21.4858, 39.1925, "Asia/Riyadh"), c("Dammam", 26.4207, 50.0888, "Asia/Riyadh")],
  },
  QA: { code: "QA", name: "Qatar", currency: "QAR", dial: "974", gl: "qa", domain: "google.com.qa", tz: "Asia/Qatar", whatsapp: true, emailNote: GULF_NOTE, cities: [c("Doha", 25.2854, 51.531, "Asia/Qatar")] },
  KW: { code: "KW", name: "Kuwait", currency: "KWD", dial: "965", gl: "kw", domain: "google.com.kw", tz: "Asia/Kuwait", whatsapp: true, emailNote: GULF_NOTE, cities: [c("Kuwait City", 29.3759, 47.9774, "Asia/Kuwait")] },
  BH: { code: "BH", name: "Bahrain", currency: "BHD", dial: "973", gl: "bh", domain: "google.com.bh", tz: "Asia/Bahrain", whatsapp: true, emailNote: GULF_NOTE, cities: [c("Manama", 26.2285, 50.586, "Asia/Bahrain")] },
  OM: { code: "OM", name: "Oman", currency: "OMR", dial: "968", gl: "om", domain: "google.com.om", tz: "Asia/Muscat", whatsapp: true, emailNote: GULF_NOTE, cities: [c("Muscat", 23.588, 58.3829, "Asia/Muscat")] },
};

export const MARKET_LIST = Object.values(MARKETS);
export const FOREIGN_MARKETS = MARKET_LIST.filter((m) => m.code !== "IN");
export const MARKET_GROUPS: { label: string; codes: MarketCode[] }[] = [
  { label: "Home", codes: ["IN"] },
  { label: "North America", codes: ["US", "CA"] },
  { label: "UK & Australia", codes: ["GB", "AU"] },
  { label: "Gulf", codes: ["AE", "SA", "QA", "KW", "BH", "OM"] },
];

export const CURRENCIES = [...new Set(FOREIGN_MARKETS.map((m) => m.currency))];
export const isMarket = (v: unknown): v is MarketCode => typeof v === "string" && v in MARKETS;
export const marketOf = (code?: string): Market | undefined => (isMarket(code) ? MARKETS[code] : undefined);
export const isForeign = (code?: string) => isMarket(code) && code !== "IN";

// ---------- country names and cities typed by a person ----------

const COUNTRY_ALIASES: [RegExp, MarketCode][] = [
  [/^(usa|u\.s\.a?\.?|us|united states( of america)?|america)$/, "US"],
  [/^(uk|u\.k\.|gb|united kingdom|great britain|britain|england|scotland|wales|northern ireland)$/, "GB"],
  [/^(ca|canada)$/, "CA"],
  [/^(au|australia)$/, "AU"],
  [/^(uae|u\.a\.e\.?|united arab emirates|emirates)$/, "AE"],
  [/^(saudi( arabia)?|ksa)$/, "SA"],
  [/^qatar$/, "QA"],
  [/^kuwait$/, "KW"],
  [/^bahrain$/, "BH"],
  [/^oman$/, "OM"],
  [/^india$/, "IN"],
];

export function parseCountry(text?: string): MarketCode | undefined {
  const t = (text ?? "").trim().toLowerCase().replace(/^the\s+/, "");
  if (!t) return undefined;
  return COUNTRY_ALIASES.find(([re]) => re.test(t))?.[1];
}

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

export interface ResolvedLocation { market?: Market; city?: MarketCity; place: string }

// "Austin", "Austin, USA", "Dubai, UAE" or just "UK". `country` (from the
// search form) wins when a city name exists in several countries.
export function resolveLocation(location: string, country?: string): ResolvedLocation {
  const raw = location.trim();
  const parts = raw.split(",").map((x) => x.trim()).filter(Boolean);
  let hint = isMarket(country) ? country : undefined;
  const last = parts.length > 1 ? parseCountry(parts[parts.length - 1]) : undefined;
  if (last) { hint = last; parts.pop(); }
  const place = parts.join(", ") || raw;
  const whole = parseCountry(place);
  if (whole && parts.length <= 1) return { market: MARKETS[whole], place: MARKETS[whole].name };
  const key = norm(parts[0] ?? raw);
  // A stated country is trusted even when the city isn't in the built-in list.
  for (const m of hint ? [MARKETS[hint]] : MARKET_LIST) {
    const city = m.cities.find((x) => norm(x.name) === key);
    if (city) return { market: m, city, place: parts[0] ?? raw };
  }
  return { market: hint ? MARKETS[hint] : undefined, place };
}

// Text sent to the search provider: adds the country when the place name could
// be ambiguous (Birmingham, Perth…) and it isn't already in the text.
export function providerPlace(location: string, country?: string): string {
  if (!location) return "";
  const r = resolveLocation(location, country);
  if (!r.market || r.market.code === "IN") return location;
  const parts = location.split(",").map((x) => x.trim());
  if (parts.length > 1 && parseCountry(parts[parts.length - 1])) return `${parts.slice(0, -1).join(", ")}, ${r.market.name}`;
  if (parseCountry(location)) return r.market.name;
  return `${location}, ${r.market.name}`;
}

// ---------- phone numbers ----------

const DIALS = [...new Set(MARKET_LIST.map((m) => m.dial))].sort((a, b) => b.length - a.length);

// The number without country code or trunk prefix, so "+971 50 123 4567" and
// "050 123 4567" compare equal. Returns "" if it can't be a phone number.
export function nationalNumber(phone?: string, country?: string): string {
  const raw = (phone ?? "").trim();
  let d = raw.replace(/\D/g, "");
  if (d.length < 7) return "";
  if (/^(\+|00)/.test(raw)) {
    if (d.startsWith("00")) d = d.slice(2);
    const dial = DIALS.find((x) => d.startsWith(x));
    if (dial && d.length - dial.length >= 7) d = d.slice(dial.length);
    else if (!dial) return d.slice(-10);
  } else if (isMarket(country) && (country === "US" || country === "CA") && d.length === 11 && d[0] === "1") d = d.slice(1);
  else if (!isMarket(country) && d.length === 11 && d[0] === "1") d = d.slice(1);
  d = d.replace(/^0+/, "");
  return d.length >= 7 ? d : "";
}

// Digits for wa.me links and tel: links, with the country code. Numbers
// without a "+" are read in the lead's country (India when unknown, as before).
export function dialDigits(phone?: string, country?: string): string {
  const raw = (phone ?? "").trim();
  const d = raw.replace(/\D/g, "");
  if (d.length < 7) return "";
  if (/^(\+|00)/.test(raw)) return d.startsWith("00") ? d.slice(2) : d;
  const m = MARKETS[isMarket(country) ? country : "IN"];
  const nat = nationalNumber(raw, m.code);
  if (!nat) return "";
  // Already carries the country code without a "+".
  if (d.startsWith(m.dial) && d.length - m.dial.length >= 8 && d.length > 10) return d;
  return `${m.dial}${nat}`;
}

// Phone numbers as written on a web page. Deliberately strict (a "+" country
// code, India's mobile format, or North-American numbers with separators) so a
// date or an id is never mistaken for a phone number. tel: links are read separately.
export const PHONE_TEXT = /(?:\+91[\s-]?|\b0)?[6-9]\d{4}[\s-]?\d{5}\b|\+\d{1,3}[\s.-]?(?:\(\d{1,4}\)[\s.-]?)?\d{1,4}(?:[\s.-]?\d{2,4}){2,4}(?!\d)|(?<![\d.+-])\(?[2-9]\d{2}\)?[\s.-]\d{3}[\s.-]\d{4}(?!\d)/g;

// ---------- money ----------

export type Fx = Record<string, number>; // rupees per 1 unit of the currency, entered in Settings

export interface MoneyFmt {
  currency: string;
  converted: boolean;   // amounts are in the lead's currency
  needsRate: boolean;   // a foreign lead, but no exchange rate saved yet
  fmt(inr: number): string;
  both(inr: number): string; // "$1,200 (≈ ₹100,000)"
}

const inrText = inr;

export function moneyFor(country: string | undefined, fx: Fx | undefined): MoneyFmt {
  const m = marketOf(country);
  const rate = m && m.code !== "IN" ? fx?.[m.currency] : undefined;
  if (!m || m.code === "IN") return { currency: "INR", converted: false, needsRate: false, fmt: inrText, both: inrText };
  if (!rate || !(rate > 0)) return { currency: "INR", converted: false, needsRate: true, fmt: inrText, both: inrText };
  const f = new Intl.NumberFormat("en-US", { style: "currency", currency: m.currency, maximumFractionDigits: m.currency === "KWD" || m.currency === "BHD" || m.currency === "OMR" ? 1 : 0 });
  const fmt = (n: number) => f.format(n / rate);
  return { currency: m.currency, converted: true, needsRate: false, fmt, both: (n) => `${fmt(n)} (≈ ${inrText(n)})` };
}

// ---------- local time ----------

export function tzFor(country?: string, city?: string): string | undefined {
  const m = marketOf(country);
  if (!m) return undefined;
  if (m.tz) return m.tz;
  const key = norm(city ?? "");
  return m.cities.find((x) => norm(x.name) === key)?.tz;
}

const offsetMin = (tz: string, at: number) => {
  const part = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "longOffset" }).formatToParts(at).find((p) => p.type === "timeZoneName")?.value ?? "GMT";
  const m = part.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
  return m ? (m[1] === "-" ? -1 : 1) * (parseInt(m[2], 10) * 60 + parseInt(m[3] ?? "0", 10)) : 0;
};

export function localTime(tz: string, at: number): { label: string; vsIndia: string } {
  const label = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short", hour: "numeric", minute: "2-digit" }).format(at);
  const diff = offsetMin("Asia/Kolkata", at) - offsetMin(tz, at);
  const h = Math.floor(Math.abs(diff) / 60), mins = Math.abs(diff) % 60;
  const amount = `${h}h${mins ? ` ${mins}m` : ""}`;
  return { label, vsIndia: diff === 0 ? "Same time as India" : `India is ${amount} ${diff > 0 ? "ahead" : "behind"}` };
}
