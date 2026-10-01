import { body, gate, json } from "@/lib/leadfinder/server/http";
import { ProviderError } from "@/lib/leadfinder/server/providers";
import { resolveWebsite, type ResolveInput } from "@/lib/leadfinder/server/resolve";

export const maxDuration = 60;

// POST /api/lead-finder/resolve — { name, city, phone, website, placeId, allowSearch }
// → the business's confirmed website (checked against its Google listing), plus its audit.
export async function POST(req: Request) {
  const blocked = gate(req);
  if (blocked) return blocked;
  const b = await body<ResolveInput>(req);
  if (!b?.name || typeof b.name !== "string") return json({ error: "name required" }, 400);
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 500) : undefined);
  try {
    return json(await resolveWebsite({
      name: b.name.slice(0, 200), city: str(b.city), address: str(b.address), phone: str(b.phone), website: str(b.website), placeId: str(b.placeId),
      allowSearch: b.allowSearch !== false,
    }));
  } catch (e) {
    return json({ error: (e as Error).message }, e instanceof ProviderError ? e.status : 500);
  }
}
