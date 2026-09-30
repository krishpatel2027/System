import { body, gate, json } from "@/lib/leadfinder/server/http";
import { browserStatus, runBreakpoints } from "@/lib/audit/server/browser";
import { AnalyzeError } from "@/lib/audit/server/net";

export const maxDuration = 60;

// POST /api/audit/breakpoints — { url } → overflow at 320–1440px with screenshots.
export async function POST(req: Request) {
  const blocked = gate(req);
  if (blocked) return blocked;
  const b = await body<{ url?: string }>(req);
  if (!b?.url) return json({ error: "url required" }, 400);
  const st = browserStatus();
  if (!st.available) return json({ error: st.reason, unavailable: true }, 501);
  try {
    return json(await runBreakpoints(b.url));
  } catch (e) {
    return json({ error: e instanceof AnalyzeError ? e.message : "Breakpoint test failed" }, 502);
  }
}
