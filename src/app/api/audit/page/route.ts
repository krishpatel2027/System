import { body, gate, json } from "@/lib/leadfinder/server/http";
import { fetchPage } from "@/lib/audit/server/page";

export const maxDuration = 30;

// POST /api/audit/page — { url, rootHost, depth } → one crawled page.
export async function POST(req: Request) {
  const blocked = gate(req);
  if (blocked) return blocked;
  const b = await body<{ url?: string; rootHost?: string; depth?: number }>(req);
  if (!b?.url || !b.rootHost) return json({ error: "url and rootHost required" }, 400);
  let u: URL;
  try { u = new URL(b.url); } catch { return json({ error: "Invalid url" }, 400); }
  // The crawler only ever reads pages on the audited site.
  if (u.hostname.replace(/^www\./, "") !== b.rootHost.replace(/^www\./, "")) return json({ error: "Off-site URL" }, 400);
  return json({ page: await fetchPage(b.url, b.rootHost, Math.max(0, Math.min(10, Number(b.depth) || 0))) });
}
