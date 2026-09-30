import { body, gate, json } from "@/lib/leadfinder/server/http";
import { probeSite } from "@/lib/audit/server/site";
import { AnalyzeError } from "@/lib/audit/server/net";

export const maxDuration = 60;

// POST /api/audit/site — { url } → site-level probe and the resolved start URL.
export async function POST(req: Request) {
  const blocked = gate(req);
  if (blocked) return blocked;
  const b = await body<{ url?: string }>(req);
  if (!b?.url) return json({ error: "url required" }, 400);
  try {
    return json(await probeSite(b.url));
  } catch (e) {
    const err = e as Error & { cause?: { code?: string } };
    const code = err.cause?.code ?? err.name;
    const msg = e instanceof AnalyzeError ? e.message : code === "TimeoutError" ? "The website took too long to respond." : code === "ENOTFOUND" ? "That domain doesn't resolve." : /CERT|SSL|TLS/i.test(String(code)) ? "The website's SSL certificate is invalid." : "The website couldn't be reached.";
    return json({ error: msg }, 400);
  }
}
