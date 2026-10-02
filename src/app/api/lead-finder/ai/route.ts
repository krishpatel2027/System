import type { Prospect } from "@/lib/types";
import { body, gate, json } from "@/lib/leadfinder/server/http";
import { aiEnabled, AiError, aiOutreach, aiParseQuery } from "@/lib/leadfinder/server/ai";

export const maxDuration = 60;

type Req =
  | { task: "parse"; text: string }
  | { task: "outreach"; prospect: Prospect; channel: string; price?: string; sender: { owner: string; studio: string; website?: string } };

// POST /api/lead-finder/ai — optional AI assist. 501 when no key is set, and
// the app falls back to its rule-based version.
export async function POST(req: Request) {
  const blocked = gate(req);
  if (blocked) return blocked;
  if (!aiEnabled()) return json({ error: "AI not configured", disabled: true }, 501);
  const b = await body<Req>(req);
  try {
    if (b?.task === "parse" && typeof b.text === "string") return json({ query: await aiParseQuery(b.text) });
    if (b?.task === "outreach" && b.prospect?.name) return json({ draft: await aiOutreach(b.prospect, String(b.channel), b.sender ?? { owner: "", studio: "Arkria" }, typeof b.price === "string" ? b.price.slice(0, 40) : undefined) });
    return json({ error: "Unknown task" }, 400);
  } catch (e) {
    return json({ error: e instanceof AiError ? e.message : "AI request failed" }, e instanceof AiError ? e.status : 500);
  }
}
