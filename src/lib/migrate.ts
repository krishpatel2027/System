import type { DB } from "./types";
import { DEFAULT_SETTINGS, SCHEMA_VERSION, seedDB } from "./seed";
import { DEFAULT_PRICING } from "./pricing-data";
import { DEFAULT_SCORING, withServiceIntel } from "./leadfinder/catalog";

// Record ids that only ever came from the old demo seed. Real records use uid().
const DEMO_IDS: Partial<Record<keyof DB, string[]>> = {
  quotes: ["q1"],
  proposals: ["pr1"],
  payments: ["pay1", "pay2", "pay3", "pay4"],
  scopes: ["sc1"],
  subs: ["sub1"],
  comms: ["c1", "c2"],
  projects: ["pj1", "pj2"],
  leads: ["lead_abc", "lead_snl", "lead_prop", "lead_sam", "lead_tpp"],
  clients: ["cl_abc", "cl_snl"],
};
const PLACEHOLDER_SETTINGS: Record<string, string> = { phone: "+91 90000 00000", upi: "arkria@upi" };

export function isValidDoc(v: unknown): v is Record<string, unknown> {
  if (!v || typeof v !== "object") return false;
  const d = v as Record<string, unknown>;
  return Array.isArray(d.leads) && Array.isArray(d.clients);
}

// Brings any stored document (old localStorage, old server copy, a backup file)
// up to the current shape. Idempotent: running it twice changes nothing.
export function migrate(raw: unknown): DB | null {
  if (!isValidDoc(raw)) return null;
  const doc = { ...raw } as Record<string, unknown>;
  const schema = (doc.meta as { schema?: number } | undefined)?.schema ?? 1;

  if (schema < 2) {
    for (const [key, ids] of Object.entries(DEMO_IDS)) {
      const list = doc[key];
      if (Array.isArray(list)) doc[key] = list.filter((r: { id?: string; demo?: boolean }) => !r?.demo && !ids!.includes(r?.id ?? ""));
    }
    const s = { ...((doc.settings as Record<string, unknown>) ?? {}) };
    for (const [k, placeholder] of Object.entries(PLACEHOLDER_SETTINGS)) if (s[k] === placeholder) s[k] = "";
    doc.settings = s;
  }
  delete doc.packages;

  if (schema < 3) {
    // Pipeline stages now follow the Lead Finder funnel.
    const STAGE_MAP: Record<string, string> = { interested: "replied", discovery: "meeting" };
    if (Array.isArray(doc.leads)) doc.leads = doc.leads.map((l: { stage?: string }) => (l?.stage && STAGE_MAP[l.stage] ? { ...l, stage: STAGE_MAP[l.stage] } : l));
    if (Array.isArray(doc.services)) doc.services = doc.services.map((sv) => withServiceIntel(sv as DB["services"][number]));
  }

  const pricing = (doc.pricing ?? {}) as Partial<DB["pricing"]>;
  const out = {
    ...seedDB,
    ...doc,
    settings: { ...DEFAULT_SETTINGS, ...((doc.settings as object) ?? {}) },
    pricing: {
      packages: pricing.packages ?? DEFAULT_PRICING.packages,
      features: pricing.features ?? DEFAULT_PRICING.features,
      carePlans: pricing.carePlans ?? DEFAULT_PRICING.carePlans,
      policies: pricing.policies ?? DEFAULT_PRICING.policies,
      hourly: pricing.hourly ?? DEFAULT_PRICING.hourly,
    },
    prospects: Array.isArray(doc.prospects) ? doc.prospects : [],
    finder: {
      scoring: { ...DEFAULT_SCORING, ...((doc.finder as Partial<DB["finder"]>)?.scoring ?? {}), weights: { ...DEFAULT_SCORING.weights, ...((doc.finder as Partial<DB["finder"]>)?.scoring?.weights ?? {}) } },
      savedSearches: (doc.finder as Partial<DB["finder"]>)?.savedSearches ?? [],
      history: (doc.finder as Partial<DB["finder"]>)?.history ?? [],
    },
    meta: { schema: SCHEMA_VERSION },
  } as DB;
  return out;
}
