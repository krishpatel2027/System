import type { DB, Prospect, SavedSearch, SearchQuery, SearchRun } from "../../types";
import { uid } from "../../utils";
import { migrate } from "../../migrate";
import { serverLoad, serverSave } from "../../server-store";
import { DedupeIndex } from "../dedupe";
import { evaluate } from "../engine";
import { providerQueries } from "../nlp";
import { applyResolution, isDue, mergeInto, passesQuery } from "../prospect";
import { activeProvider, ProviderError, type LeadProvider } from "./providers";
import { analyzeWebsite } from "./analyzer";
import { resolveWebsite } from "./resolve";

// Server-side discovery, used by AUTO FIND (cron). The in-app FIND LEADS flow
// runs the same steps from the browser so it can show live progress.

export async function searchProvider(q: SearchQuery): Promise<{ prospects: Prospect[]; errors: string[]; source: LeadProvider["id"] }> {
  const provider = activeProvider();
  if (!provider) throw new ProviderError("Lead provider not connected.", 503);
  const queries = providerQueries(q);
  if (!queries.length) throw new ProviderError("Add an industry, location or search text.", 400);
  const per = Math.max(5, Math.ceil(Math.min(q.limit || 50, 100) / queries.length));
  const out: Prospect[] = [];
  const errors: string[] = [];
  const idx = new DedupeIndex();
  for (const pq of queries.slice(0, 12)) {
    try {
      for (const p of await provider.searchBusinesses({ ...pq, limit: Math.min(60, per) })) {
        if (idx.find(p)) continue;
        idx.add(p);
        out.push(p);
      }
    } catch (e) {
      if (e instanceof ProviderError && (e.status === 400 || e.status === 429)) throw e;
      errors.push(`${pq.text}: ${(e as Error).message}`);
    }
  }
  return { prospects: out.slice(0, Math.min(q.limit || 50, 100)), errors, source: provider.id };
}

async function pool<T>(items: T[], n: number, fn: (t: T) => Promise<void>) {
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (i < items.length) await fn(items[i++]); }));
}

export async function runSavedSearch(db: DB, s: SavedSearch, deadline: number): Promise<{ added: Prospect[]; run: SearchRun }> {
  const { prospects, source } = await searchProvider(s.query);
  const idx = new DedupeIndex(db.prospects);
  const fresh: Prospect[] = [];
  let duplicates = 0;
  for (const p of prospects) {
    const hit = idx.find(p);
    if (hit) { duplicates++; continue; }
    idx.add(p);
    fresh.push({ ...p, searchId: s.id });
  }
  // Confirm websites while time allows; the rest stay "unchecked" for later.
  let searchesLeft = 10;
  await pool(fresh, 4, async (p) => {
    if (Date.now() > deadline) return;
    const input = { name: p.name, city: p.city, address: p.address, phone: p.phone, website: p.website, placeId: p.placeId, country: p.country };
    try {
      let r;
      try { r = await resolveWebsite({ ...input, allowSearch: searchesLeft > 0 }); }
      catch (e) { if (!(e instanceof ProviderError)) throw e; searchesLeft = 0; r = await resolveWebsite({ ...input, allowSearch: false }); }
      if (r.check.searched) searchesLeft--;
      Object.assign(p, applyResolution(p, r));
    } catch {
      if (p.website) p.audit = await analyzeWebsite(p.website);
    }
  });
  const evaluated = fresh.map((p) => evaluate(p, db.services, db.finder.scoring));
  const kept = evaluated.filter((p) => passesQuery(p, { ...s.query, minScore: Math.max(s.query.minScore, 0) }));
  const run: SearchRun = {
    id: uid("run"), at: new Date().toISOString(), label: `Auto: ${s.name}`, query: s.query, source,
    found: prospects.length, added: kept.length, duplicates, qualified: kept.filter((p) => (p.score?.total ?? 0) >= db.finder.scoring.qualified).length, savedSearchId: s.id,
  };
  return { added: kept, run };
}

// Loads the workspace, runs every due saved search, and saves with conflict retry.
export async function runAutoFind(opts: { force?: string; budgetMs?: number } = {}) {
  const deadline = Date.now() + (opts.budgetMs ?? 45_000);
  const loaded = await serverLoad();
  const db = migrate(loaded.data);
  if (!db) return { ran: 0, added: 0, message: "Workspace is empty." };
  const due = db.finder.savedSearches.filter((s) => (opts.force ? s.id === opts.force : isDue(s)));
  if (!due.length) return { ran: 0, added: 0, message: "No saved searches are due." };

  const results: { id: string; added: Prospect[]; run: SearchRun }[] = [];
  const errors: string[] = [];
  for (const s of due) {
    if (Date.now() > deadline) break;
    try { results.push({ id: s.id, ...(await runSavedSearch(db, s, deadline)) }); }
    catch (e) { errors.push(`${s.name}: ${(e as Error).message}`); }
  }
  if (!results.length) return { ran: 0, added: 0, errors };

  // Apply to the freshest copy; retry if a teammate saved in between.
  for (let attempt = 0; attempt < 4; attempt++) {
    const cur = attempt === 0 ? loaded : await serverLoad();
    const doc = migrate(cur.data);
    if (!doc) break;
    const idx = new DedupeIndex(doc.prospects);
    const prospects = [...doc.prospects];
    for (const r of results)
      for (const p of r.added) {
        const hit = idx.find(p);
        if (hit) { const i = prospects.findIndex((x) => x.id === hit); if (i >= 0) prospects[i] = mergeInto(prospects[i], p); continue; }
        idx.add(p);
        prospects.unshift(p);
      }
    const now = new Date().toISOString();
    const next: DB = {
      ...doc,
      prospects,
      finder: {
        ...doc.finder,
        savedSearches: doc.finder.savedSearches.map((s) => (results.some((r) => r.id === s.id) ? { ...s, lastRunAt: now } : s)),
        history: [...results.map((r) => r.run), ...doc.finder.history].slice(0, 100),
      },
    };
    const saved = await serverSave(next, cur.version);
    if (saved.ok) return { ran: results.length, added: results.reduce((a, r) => a + r.added.length, 0), errors };
  }
  return { ran: results.length, added: 0, errors: [...errors, "Could not save results (workspace busy). Try again."] };
}
