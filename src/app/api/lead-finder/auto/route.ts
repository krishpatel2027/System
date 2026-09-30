import { timingSafeEqual } from "crypto";
import { body, gate, json } from "@/lib/leadfinder/server/http";
import { runAutoFind } from "@/lib/leadfinder/server/discover";
import { configProblem } from "@/lib/server-store";

export const maxDuration = 60;

const cronOk = (req: Request) => {
  const secret = (process.env.CRON_SECRET ?? "").trim();
  if (!secret) return false;
  const a = Buffer.from((req.headers.get("authorization") ?? "").replace(/^Bearer /, "").trim());
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
};

// GET — called by Vercel Cron (Authorization: Bearer $CRON_SECRET). Runs due saved searches.
export async function GET(req: Request) {
  const problem = configProblem();
  if (problem) return json({ error: problem }, 503);
  if (!cronOk(req)) return json({ error: "Unauthorized" }, 401);
  try {
    return json(await runAutoFind());
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
}

// POST — { savedSearchId? } from the app: run one saved search now, or all due ones.
export async function POST(req: Request) {
  const blocked = gate(req);
  if (blocked) return blocked;
  const b = await body<{ savedSearchId?: string }>(req);
  try {
    return json(await runAutoFind({ force: b?.savedSearchId }));
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
}
