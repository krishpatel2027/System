import { body, gate, json } from "@/lib/leadfinder/server/http";
import { browserStatus, runBrowser } from "@/lib/audit/server/browser";

export const maxDuration = 60;

// POST /api/audit/browser — { url, viewport, full? } → headless-browser measurements.
export async function POST(req: Request) {
  const blocked = gate(req);
  if (blocked) return blocked;
  const b = await body<{ url?: string; viewport?: "mobile" | "desktop"; full?: boolean; screenshot?: boolean }>(req);
  if (!b?.url) return json({ error: "url required" }, 400);
  const st = browserStatus();
  if (!st.available) return json({ error: st.reason, unavailable: true }, 501);
  const viewport = b.viewport === "desktop" ? "desktop" : "mobile";
  const full = b.full !== false;
  return json(await runBrowser({ url: b.url, viewport, axe: full && viewport === "desktop", coverage: full && viewport === "desktop", screenshot: b.screenshot ?? full, lite: !full }));
}
