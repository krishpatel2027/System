import { gate, json } from "@/lib/leadfinder/server/http";
import { activeProvider, integrations } from "@/lib/leadfinder/server/providers";

// GET /api/lead-finder/status — which integrations are configured (never the keys).
export async function GET(req: Request) {
  const blocked = gate(req);
  if (blocked) return blocked;
  const list = integrations();
  const provider = activeProvider();
  return json({ integrations: list, providerConnected: !!provider, provider: provider ? { id: provider.id, name: provider.name } : null, autoFind: !!process.env.CRON_SECRET });
}
