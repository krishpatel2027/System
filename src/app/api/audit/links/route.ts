import { body, gate, json } from "@/lib/leadfinder/server/http";
import { checkLinks } from "@/lib/audit/server/links";

export const maxDuration = 60;

// POST /api/audit/links — { links: [{url, foundOn}] } → status of each (max 40).
export async function POST(req: Request) {
  const blocked = gate(req);
  if (blocked) return blocked;
  const b = await body<{ links?: { url: string; foundOn: string }[] }>(req);
  if (!Array.isArray(b?.links)) return json({ error: "links required" }, 400);
  const valid = b.links.filter((l) => typeof l?.url === "string" && /^https?:\/\//i.test(l.url)).map((l) => ({ url: l.url.slice(0, 2000), foundOn: String(l.foundOn ?? "").slice(0, 2000) }));
  return json({ links: await checkLinks(valid) });
}
