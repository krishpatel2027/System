import { gate, json } from "@/lib/leadfinder/server/http";
import { integrations } from "@/lib/leadfinder/server/providers";

// GET /api/lead-finder/status — which integrations are configured (never the keys).
export async function GET(req: Request) {
  const blocked = gate(req);
  if (blocked) return blocked;
  const list = integrations();
  return json({ integrations: list, providerConnected: list.some((i) => i.id === "google_places" && i.connected), autoFind: !!process.env.CRON_SECRET });
}
