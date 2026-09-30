import { body, gate, json } from "@/lib/leadfinder/server/http";
import { analyzeWebsite, AnalyzeError, pagespeed } from "@/lib/leadfinder/server/analyzer";

export const maxDuration = 60;

// POST /api/lead-finder/analyze — { url, pagespeed? } → WebsiteAudit.
export async function POST(req: Request) {
  const blocked = gate(req);
  if (blocked) return blocked;
  const b = await body<{ url?: string; pagespeed?: boolean }>(req);
  if (!b?.url || typeof b.url !== "string") return json({ error: "url required" }, 400);
  try {
    const audit = await analyzeWebsite(b.url);
    if (b.pagespeed && audit.ok) {
      try {
        const ps = await pagespeed(audit.finalUrl ?? audit.url);
        if (ps) audit.pagespeed = ps;
      } catch {}
    }
    return json({ audit });
  } catch (e) {
    return json({ error: e instanceof AnalyzeError ? e.message : "Analysis failed" }, e instanceof AnalyzeError ? 400 : 500);
  }
}
