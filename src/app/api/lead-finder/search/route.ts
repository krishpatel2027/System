import type { SearchQuery } from "@/lib/types";
import { body, gate, json } from "@/lib/leadfinder/server/http";
import { searchProvider } from "@/lib/leadfinder/server/discover";
import { ProviderError } from "@/lib/leadfinder/server/providers";
import { isMarket } from "@/lib/leadfinder/markets";

export const maxDuration = 60;

// POST /api/lead-finder/search — { query } → normalized prospects from the
// connected provider. Nothing is stored here; the app dedupes and saves.
export async function POST(req: Request) {
  const blocked = gate(req);
  if (blocked) return blocked;
  const b = await body<{ query?: SearchQuery }>(req);
  const q = b?.query;
  if (!q || !Array.isArray(q.locations) || !Array.isArray(q.industries)) return json({ error: "Invalid query" }, 400);
  try {
    const out = await searchProvider({ ...q, country: isMarket(q.country) ? q.country : undefined, limit: Math.max(1, Math.min(100, Number(q.limit) || 50)) });
    return json(out);
  } catch (e) {
    if (e instanceof ProviderError) return json({ error: e.message, notConnected: e.status === 503 }, e.status);
    return json({ error: "Search failed" }, 500);
  }
}
