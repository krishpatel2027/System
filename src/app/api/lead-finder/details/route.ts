import { body, gate, json } from "@/lib/leadfinder/server/http";
import { googlePlaces, ProviderError } from "@/lib/leadfinder/server/providers";

// POST /api/lead-finder/details — { placeId } → fresh business details from Google.
export async function POST(req: Request) {
  const blocked = gate(req);
  if (blocked) return blocked;
  const b = await body<{ placeId?: string }>(req);
  if (!b?.placeId) return json({ error: "placeId required" }, 400);
  if (!googlePlaces.connected()) return json({ error: "Lead provider not connected.", notConnected: true }, 503);
  try {
    return json({ prospect: await googlePlaces.getBusinessDetails(b.placeId) });
  } catch (e) {
    return json({ error: (e as Error).message }, e instanceof ProviderError ? e.status : 500);
  }
}
