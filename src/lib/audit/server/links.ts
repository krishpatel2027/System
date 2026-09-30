import type { LinkCheck } from "../types";
import { AnalyzeError, guardedFetch } from "./net";

// Passive link check: HEAD (falling back to GET) with a short timeout.
// Only link status is recorded; no content is read.

async function check(url: string, foundOn: string): Promise<LinkCheck> {
  try {
    let r = await guardedFetch(new URL(url), { method: "HEAD", accept: "*/*", timeout: 8_000 });
    if (r.res.status === 405 || r.res.status === 403 || r.res.status === 501) {
      r = await guardedFetch(new URL(url), { method: "GET", accept: "*/*", timeout: 8_000 });
      await r.res.body?.cancel().catch(() => {});
    }
    return { url, status: r.res.status, ok: r.res.status < 400 || r.res.status === 429, foundOn };
  } catch (e) {
    const err = e as Error & { cause?: { code?: string } };
    const code = err.cause?.code ?? err.name;
    const msg = e instanceof AnalyzeError ? e.message : code === "TimeoutError" ? "Timed out" : code === "ENOTFOUND" ? "Domain doesn't resolve" : "Unreachable";
    // Timeouts and blocked hosts aren't proof a link is broken.
    return { url, status: 0, ok: code === "TimeoutError" || e instanceof AnalyzeError, error: msg, foundOn };
  }
}

export async function checkLinks(items: { url: string; foundOn: string }[]): Promise<LinkCheck[]> {
  const list = items.slice(0, 40);
  const out: LinkCheck[] = [];
  let i = 0;
  await Promise.all(Array.from({ length: 5 }, async () => {
    while (i < list.length) { const it = list[i++]; out.push(await check(it.url, it.foundOn)); }
  }));
  return out;
}
