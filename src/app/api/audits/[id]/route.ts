import { gate, json } from "@/lib/leadfinder/server/http";
import { deleteAudit, getAudit } from "@/lib/audit/server/storage";
import { ConfigError } from "@/lib/server-store";

// GET /api/audits/[id] — one full audit. DELETE — remove it.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const blocked = gate(req);
  if (blocked) return blocked;
  const { id } = await params;
  try {
    const a = await getAudit(id);
    return a ? json({ audit: a }) : json({ error: "Not found" }, 404);
  } catch (e) { return json({ error: (e as Error).message }, e instanceof ConfigError ? 503 : 500); }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const blocked = gate(req);
  if (blocked) return blocked;
  const { id } = await params;
  try { await deleteAudit(id); return json({ ok: true }); } catch (e) { return json({ error: (e as Error).message }, e instanceof ConfigError ? 503 : 500); }
}
