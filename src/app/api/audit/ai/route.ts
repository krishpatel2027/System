import { body, gate, json } from "@/lib/leadfinder/server/http";
import { analyzeWithAi, auditAiEnabled, AuditAiError, type AiInput } from "@/lib/audit/server/ai";

export const maxDuration = 60;

// POST /api/audit/ai — optional AI interpretation (first impression, design, copy).
export async function POST(req: Request) {
  const blocked = gate(req);
  if (blocked) return blocked;
  if (!auditAiEnabled()) return json({ error: "AI not configured", disabled: true }, 501);
  const b = await body<AiInput>(req);
  if (!b?.url || !Array.isArray(b.pages)) return json({ error: "Invalid request" }, 400);
  const shot = (s?: string) => (typeof s === "string" && s.startsWith("data:image/jpeg;base64,") && s.length < 3_000_000 ? s : undefined);
  try {
    return json({ ai: await analyzeWithAi({ url: b.url, desktopShot: shot(b.desktopShot), mobileShot: shot(b.mobileShot), pages: b.pages.slice(0, 6), facts: (b.facts ?? []).slice(0, 40).map(String) }) });
  } catch (e) {
    return json({ error: e instanceof AuditAiError ? e.message : "AI request failed" }, e instanceof AuditAiError ? e.status : 500);
  }
}
