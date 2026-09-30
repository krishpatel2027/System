import { gate, json } from "@/lib/leadfinder/server/http";
import { browserStatus } from "@/lib/audit/server/browser";
import { auditAiEnabled } from "@/lib/audit/server/ai";

// GET /api/audit/status — what the deep auditor can measure on this server.
export async function GET(req: Request) {
  const blocked = gate(req);
  if (blocked) return blocked;
  let b: ReturnType<typeof browserStatus>;
  try { b = browserStatus(); } catch (e) { b = { available: false, reason: `Browser check unavailable: ${(e as Error).message}` }; }
  return json({ browser: { available: b.available, reason: b.reason }, pagespeedKey: !!(process.env.GOOGLE_PAGESPEED_API_KEY ?? "").trim(), ai: auditAiEnabled() });
}
