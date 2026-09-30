import type { SearchQuery } from "../types";
import { CITIES, INDUSTRIES } from "./catalog";

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
}

export function parseQuery(text: string): ParsedQuery {
  const q: Partial<SearchQuery> = {};
  const understood: string[] = [];
  const t = ` ${text.toLowerCase().replace(/[₹]/g, " ")} `;

  const industries = new Set<string>();
  for (const [re, ind] of INDUSTRY_WORDS) if (re.test(t)) industries.add(ind);
  for (const ind of INDUSTRIES) if (t.includes(` ${ind.toLowerCase()} `)) industries.add(ind);
  if (industries.size) { q.industries = [...industries]; understood.push(`Industry: ${q.industries.join(", ")}`); }

  const cities = CITIES.filter((c) => c !== "India" && new RegExp(`\\b${c.toLowerCase()}\\b`).test(t));
  // Also accept "in <Place>" for places not in the list.
  const m = text.match(/\b(?:in|near|around|at)\s+([A-Z][\w.]+(?:\s+[A-Z][\w.]+){0,2})/);
  if (m && !cities.some((c) => c.toLowerCase() === m[1].toLowerCase()) && !INDUSTRIES.some((i) => i.toLowerCase() === m[1].toLowerCase())) cities.push(m[1]);
  // Collapse aliases so a place isn't searched twice.
  const dedup = cities.filter((c, i) => !cities.slice(0, i).some((x) => x.toLowerCase().includes(c.toLowerCase()) || c.toLowerCase().includes(x.toLowerCase())));
  if (dedup.length) { q.locations = dedup; understood.push(`Location: ${dedup.join(", ")}`); }

  const none = /\b(without|no|don'?t have|doesn'?t have|lacking|missing)( an?| any)? (website|site|web presence)\b/.test(t);
  const weak = /\b(outdated|old|poor|weak|bad|slow|basic|broken|ugly)( looking)? (website|site)s?\b|\bneed(s|ing)? (a )?(website )?redesign\b/.test(t);
  const hasSite = /\b(with|have|having) (a |an )?(website|site)\b/.test(t) && !none;
  if (none && weak) { q.website = "none_or_weak"; understood.push("Website: missing or weak"); }
  else if (none) { q.website = "none"; understood.push("Website: none"); }
  else if (weak) { q.website = "weak"; understood.push("Website: weak or outdated"); }
  else if (hasSite) { q.website = "has"; understood.push("Website: has one"); }

  for (const [re, id] of SERVICE_WORDS) if (re.test(t)) { q.serviceId = id; break; }
  if (q.serviceId) understood.push(`Service: ${q.serviceId}`);

  const budget = t.match(/\b(?:under|below|less than|upto|up to|max(?:imum)?|budget(?: of)?|within)\s*(?:rs\.?|inr)?\s*([\d.,]+)\s*(k|thousand|l|lakh|lakhs|lac|cr|crore)?\b/);
  if (budget) { q.budgetMax = amount(budget[1], budget[2]); understood.push(`Budget ≤ ₹${q.budgetMax.toLocaleString("en-IN")}`); }

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

  return { query: q, understood };
}

// One provider query per industry × location. Falls back to the raw text.
export function providerQueries(q: SearchQuery): { text: string; industry: string; location: string }[] {
  const locations = q.locations.length ? q.locations : [""];
  const industries = q.industries.length ? q.industries : [""];
  const out: { text: string; industry: string; location: string }[] = [];
  for (const loc of locations)
    for (const ind of industries) {
      const base = ind || q.text?.trim() || "";
      if (!base) continue;
      out.push({ text: loc ? `${base} in ${loc}` : base, industry: ind, location: loc });
    }
  return out;
}
