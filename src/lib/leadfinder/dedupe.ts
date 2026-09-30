import type { Prospect } from "../types";

// Duplicate detection across Google place id, website domain, phone and name+city.

export const normDomain = (url?: string) => {
  if (!url) return "";
  try {
    const h = new URL(/^https?:\/\//i.test(url.trim()) ? url.trim() : `https://${url.trim()}`).host.toLowerCase().replace(/^www\./, "");
    // Link-in-bio and social hosts don't identify a business.
    return /(^|\.)(instagram|facebook|linkedin|wa|whatsapp|linktr|google|business\.site|youtube|x|twitter)\.(com|me|ee|site)$/.test(h) ? "" : h;
  } catch {
    return "";
  }
};

export const normPhone = (p?: string) => {
  const d = (p ?? "").replace(/\D/g, "");
  return d.length >= 10 ? d.slice(-10) : "";
};

export const normName = (s?: string) =>
  (s ?? "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/\b(pvt|private|ltd|limited|llp|inc|co|the)\b\.?/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

type Keyed = Pick<Prospect, "name" | "city" | "website" | "phone" | "placeId" | "address">;

export function keysOf(p: Keyed): string[] {
  const keys: string[] = [];
  if (p.placeId) keys.push(`pid:${p.placeId}`);
  const d = normDomain(p.website);
  if (d) keys.push(`dom:${d}`);
  const ph = normPhone(p.phone);
  if (ph) keys.push(`tel:${ph}`);
  const n = normName(p.name);
  const place = normName(p.city || p.address?.split(",").slice(-3, -2)[0]);
  if (n) keys.push(`nm:${n}|${place}`);
  return keys;
}

export class DedupeIndex {
  private map = new Map<string, string>();
  constructor(existing: (Keyed & { id: string })[] = []) {
    for (const p of existing) this.add(p);
  }
  find(p: Keyed): string | undefined {
    for (const k of keysOf(p)) {
      const hit = this.map.get(k);
      if (hit) return hit;
    }
  }
  add(p: Keyed & { id: string }) {
    for (const k of keysOf(p)) if (!this.map.has(k)) this.map.set(k, p.id);
  }
}
