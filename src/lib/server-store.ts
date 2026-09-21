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

async function fileLoad(): Promise<unknown | null> {
  try {
    const raw = await fs.readFile(filePath(), "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function fileSave(data: unknown): Promise<void> {
  await fs.mkdir(path.dirname(filePath()), { recursive: true });
  await fs.writeFile(filePath(), JSON.stringify(data), "utf-8");
}

function sbHeaders(): Record<string, string> {
  return {
    apikey: process.env.SUPABASE_SERVICE_ROLE_KEY as string,
    Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json",
  };
}

async function sbLoad(): Promise<unknown | null> {
  const url = `${process.env.SUPABASE_URL}/rest/v1/arkria_store?id=eq.main&select=data`;
  const res = await fetch(url, { headers: sbHeaders(), cache: "no-store" });
  if (!res.ok) throw new Error(`Supabase load failed: ${res.status}`);
  const rows = (await res.json()) as { data: unknown }[];
  return rows[0]?.data ?? null;
}

async function sbSave(data: unknown): Promise<void> {
  const url = `${process.env.SUPABASE_URL}/rest/v1/arkria_store?id=eq.main`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: { ...sbHeaders(), Prefer: "return=minimal" },
    body: JSON.stringify({ data }),
  });
  if (!res.ok) throw new Error(`Supabase save failed: ${res.status}`);
}

export async function serverLoad(): Promise<{ mode: BackendMode; data: unknown | null }> {
  const mode = backendMode();
  const data = mode === "supabase" ? await sbLoad() : await fileLoad();
  return { mode, data };
}

export async function serverSave(data: unknown): Promise<{ mode: BackendMode }> {
  const mode = backendMode();
  if (mode === "supabase") await sbSave(data);
  else await fileSave(data);
  return { mode };
}
