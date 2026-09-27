import { promises as fs } from "fs";
import path from "path";
import { timingSafeEqual } from "crypto";

// Server-side persistence for /api/store. The whole workspace is one JSON
// document with a version number; every save must name the version it was
// based on, so two people saving at once can't silently overwrite each other
// (the second gets a conflict, merges, and retries).
//
// Mode A (default): local JSON file at ./data/arkria.json — for a single server
//   with a persistent disk (your laptop, a VPS, Docker with a volume).
// Mode B (production): Supabase Postgres via REST — set SUPABASE_URL and
//   SUPABASE_SERVICE_ROLE_KEY and run supabase/schema.sql once.

export type BackendMode = "supabase" | "file";
export type Loaded = { data: unknown | null; version: number; updatedAt: string | null };
export type SaveResult =
  | { ok: true; version: number; updatedAt: string }
  | { ok: false; conflict: Loaded };

export class ConfigError extends Error {}

export function backendMode(): BackendMode {
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) return "supabase";
  return "file";
}

// Serverless hosts (Vercel, Netlify, AWS Lambda) have no persistent disk.
const serverless = () => !!(process.env.VERCEL || process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME);

export function configProblem(): string | null {
  if (backendMode() === "file" && serverless())
    return "This host has no persistent disk. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (see README → Deploy).";
  if (process.env.NODE_ENV === "production" && !process.env.ARKRIA_ADMIN_PASSWORD && process.env.ARKRIA_ALLOW_OPEN !== "true")
    return "ARKRIA_ADMIN_PASSWORD is not set. Set a team password before using this deployment (see README → Deploy).";
  return null;
}

export function authMode(): "password" | "open" {
  return process.env.ARKRIA_ADMIN_PASSWORD ? "password" : "open";
}

export function requireToken(req: Request): boolean {
  const expected = process.env.ARKRIA_ADMIN_PASSWORD;
  if (!expected) return true;
  const given = (req.headers.get("authorization") ?? "").replace(/^Bearer /, "");
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

// ---------- file backend ----------

const filePath = () => path.join(process.cwd(), "data", "arkria.json");
let fileLock: Promise<unknown> = Promise.resolve();
function withFileLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = fileLock.then(fn, fn);
  fileLock = run.catch(() => {});
  return run;
}

async function fileLoad(): Promise<Loaded> {
  try {
    const parsed = JSON.parse(await fs.readFile(filePath(), "utf-8")) as Record<string, unknown>;
    if (Array.isArray(parsed.leads)) return { data: parsed, version: 0, updatedAt: null }; // legacy raw document
    return { data: parsed.data ?? null, version: Number(parsed.version ?? 0), updatedAt: (parsed.updatedAt as string) ?? null };
  } catch {
    return { data: null, version: 0, updatedAt: null };
  }
}

function fileSave(data: unknown, baseVersion: number): Promise<SaveResult> {
  return withFileLock(async () => {
    const current = await fileLoad();
    if (current.version !== baseVersion) return { ok: false as const, conflict: current };
    const version = baseVersion + 1;
    const updatedAt = new Date().toISOString();
    await fs.mkdir(path.dirname(filePath()), { recursive: true });
    const tmp = `${filePath()}.${process.pid}.tmp`;
    await fs.writeFile(tmp, JSON.stringify({ data, version, updatedAt }), "utf-8");
    await fs.rename(tmp, filePath());
    return { ok: true as const, version, updatedAt };
  });
}

// ---------- Supabase backend ----------

const sbUrl = (q: string) => `${process.env.SUPABASE_URL}/rest/v1/arkria_store${q}`;
const sbHeaders = (extra: Record<string, string> = {}) => ({
  apikey: process.env.SUPABASE_SERVICE_ROLE_KEY as string,
  Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
  "Content-Type": "application/json",
  ...extra,
});

async function sbError(res: Response, what: string): Promise<never> {
  const body = await res.text();
  if (/version/.test(body) && /does not exist|column/.test(body))
    throw new ConfigError("Your Supabase table is missing the version column. Re-run supabase/schema.sql in the Supabase SQL editor.");
  if (/arkria_store/.test(body) && /does not exist|relation/.test(body))
    throw new ConfigError("The arkria_store table doesn't exist yet. Run supabase/schema.sql in the Supabase SQL editor.");
  throw new Error(`Supabase ${what} failed (${res.status}): ${body.slice(0, 200)}`);
}

async function sbLoad(): Promise<Loaded> {
  const res = await fetch(sbUrl("?id=eq.main&select=data,version,updated_at"), { headers: sbHeaders(), cache: "no-store" });
  if (!res.ok) await sbError(res, "load");
  const rows = (await res.json()) as { data: unknown; version?: number; updated_at?: string }[];
  const row = rows[0];
  if (!row) return { data: null, version: 0, updatedAt: null };
  return { data: row.data ?? null, version: Number(row.version ?? 0), updatedAt: row.updated_at ?? null };
}

async function sbSave(data: unknown, baseVersion: number): Promise<SaveResult> {
  const version = baseVersion + 1;
  const updatedAt = new Date().toISOString();
  const res = await fetch(sbUrl(`?id=eq.main&version=eq.${baseVersion}`), {
    method: "PATCH",
    headers: sbHeaders({ Prefer: "return=representation" }),
    body: JSON.stringify({ data, version, updated_at: updatedAt }),
  });
  if (!res.ok) await sbError(res, "save");
  if (((await res.json()) as unknown[]).length === 1) return { ok: true, version, updatedAt };

  const current = await sbLoad();
  if (current.data === null && current.version === 0 && baseVersion === 0) {
    const ins = await fetch(sbUrl(""), {
      method: "POST",
      headers: sbHeaders({ Prefer: "return=minimal" }),
      body: JSON.stringify({ id: "main", data, version, updated_at: updatedAt }),
    });
    if (ins.ok) return { ok: true, version, updatedAt };
    if (ins.status !== 409) await sbError(ins, "insert");
    return { ok: false, conflict: await sbLoad() };
  }
  return { ok: false, conflict: current };
}

// ---------- public API ----------

function guard() {
  const problem = backendMode() === "file" && serverless() ? configProblem() : null;
  if (problem) throw new ConfigError(problem);
}

export async function serverLoad(): Promise<Loaded & { mode: BackendMode }> {
  guard();
  const mode = backendMode();
  return { mode, ...(mode === "supabase" ? await sbLoad() : await fileLoad()) };
}

export async function serverSave(data: unknown, baseVersion: number): Promise<SaveResult & { mode: BackendMode }> {
  guard();
  const mode = backendMode();
  return { mode, ...(mode === "supabase" ? await sbSave(data, baseVersion) : await fileSave(data, baseVersion)) };
}
