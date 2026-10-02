import type { SearchQuery } from "../types";
import { INDUSTRIES } from "./catalog";
import { MARKET_LIST, MARKETS, moneyFor, parseCountry, providerPlace, resolveLocation, type Fx, type MarketCode } from "./markets";

// Rule-based smart search: turns "real estate developers in Ahmedabad without
// a website under 50k" into structured filters. Runs instantly, offline, and is
// the fallback whenever the AI layer is unavailable.

const INDUSTRY_WORDS: [RegExp, string][] = [
  [/\b(real[\s-]?estate|builders?|developers?|property|properties|realtors?)\b/, "Real Estate"],
  [/\binterior(s| designers?| design)?\b/, "Interior Design"],
  [/\barchitect(s|ure|ural)?\b/, "Architecture"],
  [/\bconstruction|contractors?\b/, "Construction"],
  [/\brestaurants?|eateries|dhabas?\b/, "Restaurants"],
  [/\bcaf(e|é)s?|coffee shops?|bakeries|bakery\b/, "Cafes"],
  [/\bhotels?|resorts?|homestays?\b/, "Hotels"],
  [/\bdent(al|ists?)\b/, "Dental Clinics"],
  [/\bclinics?|doctors?|physio\w*|dermatologists?\b/, "Clinics"],
  [/\bhospitals?\b/, "Hospitals"],
  [/\bgyms?\b/, "Gyms"],
  [/\b(fitness|yoga|pilates|crossfit)( studios?| centers?| centres?)?\b/, "Fitness Studios"],
  [/\bsalons?|barbers?|spas?\b/, "Salons"],
  [/\bbeauty|cosmetics?|skincare\b/, "Beauty"],
  [/\bcoaching|tutors?|tuition|classes|institutes?\b/, "Coaching"],
  [/\bschools?|preschools?|play ?schools?\b/, "Schools"],
  [/\beducation|edtech|colleges?\b/, "Education"],
  [/\bmanufactur\w*|factories|factory|industrial\b/, "Manufacturing"],
  [/\blaw(yers?| firms?)|advocates?|legal\b/, "Law Firms"],
  [/\b(ca|chartered accountants?|accountants?|tax consultants?)\b/, "Chartered Accountants"],
  [/\bfinance|financial|insurance|wealth|fintech\b/, "Finance"],
  [/\bconsult(ants?|ancy|ing)\b/, "Consulting"],
  [/\btravel|tour(s| operators?)|travel agenc\w*\b/, "Travel"],
  [/\bautomo\w*|car dealers?|showrooms?|garages?\b/, "Automotive"],
  [/\bfurniture\b/, "Furniture"],
  [/\bfashion|boutiques?|clothing|apparel|garments?\b/, "Fashion"],
  [/\bjewel(le)?(ry|lers?|ers?)\b/, "Jewellery"],
  [/\bsaas\b/, "SaaS"],
  [/\bstartups?|tech companies|technology|software|it companies\b/, "Technology"],
  [/\bd2c|online brands?|ecommerce brands?\b/, "E-commerce"],
  [/\bevent(s| planners?| management)|wedding planners?\b/, "Event Management"],
  [/\bphotograph\w*\b/, "Photography"],
  [/\bpet\w*|vets?|veterinar\w*\b/, "Pet Services"],
  [/\bplumbers?|electricians?|cleaning|pest control|home services?\b/, "Home Services"],
  [/\bb2b\b/, "B2B Services"],
];

const SERVICE_WORDS: [RegExp, string][] = [
  [/\b(e-?commerce( store| site| website)?|online (store|shop)|sell online)\b/, "s4"],
  [/\b(chat ?bots?|ai (assistant|agent|chat))\b/, "s7"],
  [/\b(mobile )?apps?\b|\bandroid|ios\b/, "s6"],
  [/\bseo|performance|speed\b/, "s8"],
  [/\blanding pages?\b/, "s2"],
  [/\b(premium|interactive|luxury|3d|animated) (website|site|experience)s?\b/, "s3"],
  [/\bdashboards?|portals?|crm|internal tools?|web apps?\b/, "s5"],
];

const amount = (n: string, unit?: string) => {
  const v = parseFloat(n.replace(/,/g, ""));
  const u = (unit ?? "").toLowerCase();
  return Math.round(u.startsWith("k") ? v * 1000 : u.startsWith("l") ? v * 100000 : u.startsWith("cr") ? v * 1e7 : v);
};

export interface ParsedQuery {
  query: Partial<SearchQuery>;
  understood: string[];
  // Set when the budget was stated in a currency other than rupees.
  budgetCurrency?: string;
}

const ALL_CITIES = MARKET_LIST.flatMap((m) => m.cities.map((c) => c.name));
const CURRENCY_WORDS: [RegExp, string][] = [
  [/^(\$|us\$|usd|dollars?)$/, "USD"], [/^(£|gbp|pounds?)$/, "GBP"], [/^(aed|dirhams?)$/, "AED"], [/^cad$/, "CAD"], [/^aud$/, "AUD"],
  [/^sar$/, "SAR"], [/^qar$/, "QAR"], [/^kwd$/, "KWD"], [/^bhd$/, "BHD"], [/^omr$/, "OMR"], [/^(rs\.?|inr|rupees?)$/, "INR"],
];
const currencyOf = (w?: string) => (w ? CURRENCY_WORDS.find(([re]) => re.test(w.toLowerCase()))?.[1] : undefined);

// "$5k" typed in a search is turned into rupees with the rate saved in Settings.
// Without a saved rate the budget filter is skipped rather than guessed.
export function convertBudget(amount: number | undefined, currency: string | undefined, fx: Fx | undefined): { budgetMax?: number; chip?: string } {
  if (!amount || !currency || currency === "INR") return amount ? { budgetMax: amount, chip: `Budget ≤ ₹${amount.toLocaleString("en-IN")}` } : {};
  const code = (Object.values(MARKETS).find((m) => m.currency === currency)?.code ?? "US") as MarketCode;
  const rate = fx?.[currency];
  if (!rate || !(rate > 0)) return { chip: `Budget in ${currency} not applied — set the ${currency} exchange rate in Settings` };
  const inr = Math.round(amount * rate);
  return { budgetMax: inr, chip: `Budget ≤ ${moneyFor(code, fx).fmt(inr)} (≈ ₹${inr.toLocaleString("en-IN")})` };
}

export function parseQuery(text: string): ParsedQuery {
  const q: Partial<SearchQuery> = {};
  const understood: string[] = [];
  const t = ` ${text.toLowerCase().replace(/[₹]/g, " ")} `;

  const industries = new Set<string>();
  for (const [re, ind] of INDUSTRY_WORDS) if (re.test(t)) industries.add(ind);
  for (const ind of INDUSTRIES) if (t.includes(` ${ind.toLowerCase()} `)) industries.add(ind);
  if (industries.size) { q.industries = [...industries]; understood.push(`Industry: ${q.industries.join(", ")}`); }

  const cities = ALL_CITIES.filter((c) => new RegExp(`\\b${c.toLowerCase()}\\b`).test(t));
  // Also accept "in <Place>" for places not in the list.
  const m = text.match(/\b(?:in|near|around|at)\s+([A-Z][\w.]+(?:\s+[A-Z][\w.]+){0,2})/);
  if (m && !parseCountry(m[1]) && !cities.some((c) => c.toLowerCase() === m[1].toLowerCase()) && !INDUSTRIES.some((i) => i.toLowerCase() === m[1].toLowerCase())) cities.push(m[1]);
  // Collapse aliases so a place isn't searched twice.
  const dedup = cities.filter((c, i) => !cities.slice(0, i).some((x) => x.toLowerCase().includes(c.toLowerCase()) || c.toLowerCase().includes(x.toLowerCase())));
  if (dedup.length) { q.locations = dedup; understood.push(`Location: ${dedup.join(", ")}`); }

  // A country named in the text ("in the UK", "Austin, USA"), or implied by the city.
  const named = t.match(/(?:^|[\s,])(?:in |across |throughout )?(?:the )?(usa|u\.s\.a?\.?|united states(?: of america)?|uk|u\.k\.|united kingdom|great britain|britain|england|canada|australia|uae|u\.a\.e\.?|united arab emirates|saudi arabia|ksa|qatar|kuwait|bahrain|oman|india)(?=$|[\s,.])/)?.[1]
    ?? t.match(/\b(?:in|across|throughout) (?:the )?(us)\b/)?.[1];
  const country = parseCountry(named) ?? (dedup.length ? [...new Set(dedup.map((c) => resolveLocation(c).market?.code).filter(Boolean))].filter((c, _, a) => a.length === 1)[0] : undefined);
  if (country && country !== "IN") { q.country = country; understood.push(`Country: ${MARKETS[country].name}`); }
  else if (country === "IN" && named) { q.country = "IN"; understood.push("Country: India"); }

  const none = /\b(without|no|don'?t have|doesn'?t have|lacking|missing)( an?| any)? (website|site|web presence)\b/.test(t);
  const weak = /\b(outdated|old|poor|weak|bad|slow|basic|broken|ugly)( looking)? (website|site)s?\b|\bneed(s|ing)? (a )?(website )?redesign\b/.test(t);
  const hasSite = /\b(with|have|having) (a |an )?(website|site)\b/.test(t) && !none;
  if (none && weak) { q.website = "none_or_weak"; understood.push("Website: missing or weak"); }
  else if (none) { q.website = "none"; understood.push("Website: none"); }
  else if (weak) { q.website = "weak"; understood.push("Website: weak or outdated"); }
  else if (hasSite) { q.website = "has"; understood.push("Website: has one"); }

  for (const [re, id] of SERVICE_WORDS) if (re.test(t)) { q.serviceId = id; break; }
  if (q.serviceId) understood.push(`Service: ${q.serviceId}`);

  const cur = "(rs\\.?|inr|us\\$|\\$|usd|£|gbp|aed|cad|aud|sar|qar|kwd|bhd|omr)";
  const budget = t.match(new RegExp(`\\b(?:under|below|less than|upto|up to|max(?:imum)?|budget(?: of)?|within)\\s*${cur}?\\s*([\\d.,]+)\\s*(k|thousand|l|lakh|lakhs|lac|cr|crore)?\\s*${cur}?(?![\\w$£])`));
  let budgetCurrency: string | undefined;
  if (budget) {
    budgetCurrency = currencyOf(budget[1]) ?? currencyOf(budget[4]) ?? "INR";
    const amt = amount(budget[2], budget[3]);
    if (budgetCurrency === "INR") { q.budgetMax = amt; understood.push(`Budget ≤ ₹${amt.toLocaleString("en-IN")}`); }
    else { q.budgetMax = amt; understood.push(`Budget ≤ ${amt.toLocaleString("en-US")} ${budgetCurrency}`); }
  }

  const rating = t.match(/\b(?:rating|rated)\s*(?:above|over|of|>=?|at least)?\s*([1-5](?:\.\d)?)\b|\b([1-5](?:\.\d)?)\s*\+?\s*(?:star|rating|rated)/);
  if (rating) { q.minRating = parseFloat(rating[1] ?? rating[2]); understood.push(`Rating ≥ ${q.minRating}`); }

  const reviews = t.match(/\b(\d{1,5})\s*\+?\s*reviews\b|\b(?:at least|min(?:imum)?|over|more than)\s*(\d{1,5})\s*reviews\b/);
  if (reviews) { q.minReviews = parseInt(reviews[1] ?? reviews[2], 10); understood.push(`Reviews ≥ ${q.minReviews}`); }

  const score = t.match(/\bscore\s*(?:above|over|of|>=?|at least)?\s*(\d{1,3})\b/);
  if (score) q.minScore = Math.min(100, parseInt(score[1], 10));
  else if (/\b(high|best|top|hot)[\s-](opportunit|potential|quality|value)\w*/.test(t)) q.minScore = 70;
  if (q.minScore) understood.push(`Score ≥ ${q.minScore}`);

  const count = t.match(/\b(?:find|get|show|top|first)\s+(\d{1,3})\b/);
  if (count) q.limit = Math.min(100, parseInt(count[1], 10));

  if (/\bwith (a )?(phone|contact|number|email)\b/.test(t)) { q.requireContact = true; understood.push("Has contact details"); }

  return { query: q, understood, budgetCurrency: budgetCurrency && budgetCurrency !== "INR" ? budgetCurrency : undefined };
}

// One provider query per industry × location. Falls back to the raw text.
// The country is added to the place so "Birmingham" or "Perth" means the right one.
export function providerQueries(q: SearchQuery): { text: string; industry: string; location: string; country?: string }[] {
  const locations = q.locations.length ? q.locations : [""];
  const industries = q.industries.length ? q.industries : [""];
  const out: { text: string; industry: string; location: string; country?: string }[] = [];
  for (const loc of locations)
    for (const ind of industries) {
      const base = ind || q.text?.trim() || "";
      if (!base) continue;
      const market = resolveLocation(loc, q.country).market ?? (q.country ? MARKETS[q.country as MarketCode] : undefined);
      const place = loc ? providerPlace(loc, q.country) : market && market.code !== "IN" ? market.name : "";
      out.push({ text: place ? `${base} in ${place}` : base, industry: ind, location: loc, country: market?.code });
    }
  return out;
}
