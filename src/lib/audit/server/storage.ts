import { promises as fs } from "fs";
import path from "path";
import { backendMode, ConfigError } from "../../server-store";
import type { AuditRecord, AuditSummary } from "../types";

// Audit reports live beside the workspace, one record per audit:
// ./data/audits/<id>.json on the file backend, the arkria_audits table on Supabase.

export interface AuditListItem { id: string; url: string; domain: string; createdAt: string; prospectId?: string; summary: AuditSummary }

const ID_RE = /^au_[a-z0-9_]{6,60}$/;
export const validId = (id: string) => ID_RE.test(id);

const dir = () => path.join(process.cwd(), "data", "audits");
const file = (id: string) => path.join(dir(), `${id}.json`);
const indexFile = () => path.join(dir(), "index.json");

async function readIndex(): Promise<AuditListItem[]> {
  try { return JSON.parse(await fs.readFile(indexFile(), "utf-8")) as AuditListItem[]; } catch { return []; }
}
let lock: Promise<unknown> = Promise.resolve();
const locked = <T>(fn: () => Promise<T>): Promise<T> => { const run = lock.then(fn, fn); lock = run.catch(() => {}); return run; };

const item = (r: AuditRecord): AuditListItem => ({ id: r.id, url: r.url, domain: r.domain, createdAt: r.createdAt, prospectId: r.prospectId, summary: r.summary });

// ---------- Supabase ----------

const sb = (q: string) => `${process.env.SUPABASE_URL}/rest/v1/arkria_audits${q}`;
const sbHeaders = (extra: Record<string, string> = {}) => ({
  apikey: process.env.SUPABASE_SERVICE_ROLE_KEY as string,
  Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
  "Content-Type": "application/json",
  ...extra,
});
async function sbFail(res: Response, what: string): Promise<never> {
  const body = await res.text();
  if (/arkria_audits/.test(body) && /does not exist|relation|schema cache/.test(body))
    throw new ConfigError("The arkria_audits table doesn't exist yet. Re-run supabase/schema.sql in the Supabase SQL editor.");
  throw new Error(`Supabase ${what} failed (${res.status}): ${body.slice(0, 200)}`);
}

// ---------- API ----------

export async function listAudits(limit = 100): Promise<AuditListItem[]> {
  if (backendMode() === "supabase") {
    const res = await fetch(sb(`?select=id,url,domain,prospect_id,summary,created_at&order=created_at.desc&limit=${limit}`), { headers: sbHeaders(), cache: "no-store" });
    if (!res.ok) await sbFail(res, "list");
    const rows = (await res.json()) as { id: string; url: string; domain: string; prospect_id?: string; summary: AuditSummary; created_at: string }[];
    return rows.map((r) => ({ id: r.id, url: r.url, domain: r.domain, prospectId: r.prospect_id ?? undefined, summary: r.summary, createdAt: r.created_at }));
  }
  return (await readIndex()).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit);
}

export async function getAudit(id: string): Promise<AuditRecord | null> {
  if (!validId(id)) return null;
  if (backendMode() === "supabase") {
    const res = await fetch(sb(`?id=eq.${encodeURIComponent(id)}&select=data`), { headers: sbHeaders(), cache: "no-store" });
    if (!res.ok) await sbFail(res, "load");
    const rows = (await res.json()) as { data: AuditRecord }[];
    return rows[0]?.data ?? null;
  }
  try { return JSON.parse(await fs.readFile(file(id), "utf-8")) as AuditRecord; } catch { return null; }
}

export async function saveAudit(r: AuditRecord): Promise<void> {
  if (!validId(r.id)) throw new Error("Invalid audit id");
  if (backendMode() === "supabase") {
    const res = await fetch(sb(""), {
      method: "POST",
      headers: sbHeaders({ Prefer: "resolution=merge-duplicates,return=minimal" }),
      body: JSON.stringify({ id: r.id, url: r.url, domain: r.domain, prospect_id: r.prospectId ?? null, summary: r.summary, data: r, created_at: r.createdAt }),
    });
    if (!res.ok) await sbFail(res, "save");
    return;
  }
  await locked(async () => {
    await fs.mkdir(dir(), { recursive: true });
    const tmp = `${file(r.id)}.${process.pid}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(r), "utf-8");
    await fs.rename(tmp, file(r.id));
    const idx = (await readIndex()).filter((x) => x.id !== r.id);
    idx.unshift(item(r));
    await fs.writeFile(indexFile(), JSON.stringify(idx.slice(0, 1000)), "utf-8");
  });
}

export async function deleteAudit(id: string): Promise<void> {
  if (!validId(id)) return;
  if (backendMode() === "supabase") {
    const res = await fetch(sb(`?id=eq.${encodeURIComponent(id)}`), { method: "DELETE", headers: sbHeaders() });
    if (!res.ok) await sbFail(res, "delete");
    return;
  }
  await locked(async () => {
    await fs.rm(file(id), { force: true });
    await fs.writeFile(indexFile(), JSON.stringify((await readIndex()).filter((x) => x.id !== id)), "utf-8").catch(() => {});
  });
}
