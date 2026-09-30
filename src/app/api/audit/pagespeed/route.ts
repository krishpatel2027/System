import { body, gate, json } from "@/lib/leadfinder/server/http";
import { pagespeed } from "@/lib/audit/server/pagespeed";
import { normalizeUrl } from "@/lib/audit/server/net";

export const maxDuration = 60;

// POST /api/audit/pagespeed — { url } → Lighthouse lab + Chrome UX Report field data.
export async function POST(req: Request) {
  const blocked = gate(req);
  if (blocked) return blocked;
  const b = await body<{ url?: string }>(req);
  if (!b?.url) return json({ error: "url required" }, 400);
  let u: URL;
  try { u = normalizeUrl(b.url); } catch (e) { return json({ error: (e as Error).message }, 400); }
  return json({ pagespeed: await pagespeed(u.toString()) });
}
