import { body, gate, json } from "@/lib/leadfinder/server/http";
import { listAudits, saveAudit, validId } from "@/lib/audit/server/storage";
import { ConfigError } from "@/lib/server-store";
import type { AuditRecord } from "@/lib/audit/types";

export const maxDuration = 30;

// GET /api/audits — recent audits (summaries). POST — save a completed audit.
export async function GET(req: Request) {
  const blocked = gate(req);
  if (blocked) return blocked;
  try { return json({ audits: await listAudits() }); } catch (e) { return json({ error: (e as Error).message }, e instanceof ConfigError ? 503 : 500); }
}

export async function POST(req: Request) {
  const blocked = gate(req);
  if (blocked) return blocked;
  const r = await body<AuditRecord>(req);
  if (!r || !validId(r.id) || typeof r.url !== "string" || !r.raw || !Array.isArray(r.raw.pages)) return json({ error: "Invalid audit" }, 400);
  try { await saveAudit(r); return json({ ok: true, id: r.id }); } catch (e) { return json({ error: (e as Error).message }, e instanceof ConfigError ? 503 : 500); }
}
