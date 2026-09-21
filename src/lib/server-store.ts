import { promises as fs } from "fs";
import path from "path";

// Server-side persistence for /api/store.
// Mode A (default): local JSON file at ./data/arkria.json (multi-user on one server).
// Mode B (production): Supabase Postgres via REST (set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
// and run supabase/schema.sql once). No extra npm dependencies — uses native fetch.

export type BackendMode = "supabase" | "file";

export function backendMode(): BackendMode {
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) return "supabase";
  return "file";
}

export function requireToken(req: Request): boolean {
  const expected = process.env.ARKRIA_ADMIN_PASSWORD;
  if (!expected) return true; // dev: open when no password configured
  const auth = req.headers.get("authorization") ?? "";
  return auth === `Bearer ${expected}`;
}

function filePath(): string {
  return path.join(process.cwd(), "data", "arkria.json");
}

async function fileLoad(): Promise<{ data: unknown | null; updatedAt: string | null }> {
  try {
    const raw = await fs.readFile(filePath(), "utf-8");
    const parsed = JSON.parse(raw) as { data?: unknown; updatedAt?: string } | Record<string, unknown>;
    // Backward compat: old file stored the DB document directly.
    if (parsed && typeof parsed === "object" && Array.isArray((parsed as Record<string, unknown>).leads)) {
      return { data: parsed, updatedAt: null };
    }
    if (parsed && typeof parsed === "object" && "data" in parsed) {
      const w = parsed as { data?: unknown; updatedAt?: string };
      return { data: w.data ?? null, updatedAt: w.updatedAt ?? null };
    }
    return { data: null, updatedAt: null };
  } catch {
    return { data: null, updatedAt: null };
  }
}

async function fileSave(data: unknown): Promise<string> {
  const updatedAt = new Date().toISOString();
  await fs.mkdir(path.dirname(filePath()), { recursive: true });
  // Atomic write: tmp + rename so concurrent PUTs can't leave a torn file.
  const tmp = `${filePath()}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify({ data, updatedAt }), "utf-8");
  await fs.rename(tmp, filePath());
  return updatedAt;
}

function sbHeaders(): Record<string, string> {
  return {
    apikey: process.env.SUPABASE_SERVICE_ROLE_KEY as string,
    Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json",
  };
}

async function sbLoad(): Promise<{ data: unknown | null; updatedAt: string | null }> {
  const url = `${process.env.SUPABASE_URL}/rest/v1/arkria_store?id=eq.main&select=data,updated_at`;
  const res = await fetch(url, { headers: sbHeaders(), cache: "no-store" });
  if (!res.ok) throw new Error(`Supabase load failed: ${res.status}`);
  const rows = (await res.json()) as { data: unknown; updated_at?: string }[];
  return { data: rows[0]?.data ?? null, updatedAt: rows[0]?.updated_at ?? null };
}

async function sbSave(data: unknown): Promise<string> {
  // Upsert so the first save works even if the seed INSERT was never run.
  const url = `${process.env.SUPABASE_URL}/rest/v1/arkria_store?on_conflict=id`;
  const res = await fetch(url, {
    method: "POST",
    headers: { ...sbHeaders(), Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({ id: "main", data }),
  });
  if (!res.ok) throw new Error(`Supabase save failed: ${res.status}`);
  return new Date().toISOString();
}

export async function serverLoad(): Promise<{ mode: BackendMode; data: unknown | null; updatedAt: string | null }> {
  const mode = backendMode();
  const { data, updatedAt } = mode === "supabase" ? await sbLoad() : await fileLoad();
  return { mode, data, updatedAt };
}

export async function serverSave(data: unknown): Promise<{ mode: BackendMode; updatedAt: string }> {
  const mode = backendMode();
  const updatedAt = mode === "supabase" ? await sbSave(data) : await fileSave(data);
  return { mode, updatedAt };
}
