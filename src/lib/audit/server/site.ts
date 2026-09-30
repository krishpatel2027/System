import tls from "node:tls";
import type { SiteData } from "../types";
import { AnalyzeError, getRobots, guardHost, guardedFetch, normalizeUrl, readCapped } from "./net";

// Site-level, passive checks: robots.txt, sitemap, certificate, HTTPS redirect,
// security headers and cookies on the homepage response, and 404 handling.

async function certificate(host: string): Promise<SiteData["tls"]> {
  await guardHost(new URL(`https://${host}`));
  return new Promise((resolve) => {
    const socket = tls.connect({ host, port: 443, servername: host, rejectUnauthorized: false, timeout: 8000 }, () => {
      const c = socket.getPeerCertificate();
      const validTo = c?.valid_to ? new Date(c.valid_to) : undefined;
      const out = {
        valid: socket.authorized,
        issuer: (c?.issuer?.O as string | undefined) ?? (c?.issuer?.CN as string | undefined),
        validTo: validTo?.toISOString(),
        daysLeft: validTo ? Math.floor((validTo.getTime() - Date.now()) / 86400e3) : undefined,
        protocol: socket.getProtocol() ?? undefined,
        error: socket.authorized ? undefined : String(socket.authorizationError ?? "Certificate not trusted"),
      };
      socket.end();
      resolve(out);
    });
    socket.on("error", (e) => resolve({ valid: false, error: e.message }));
    socket.on("timeout", () => { socket.destroy(); resolve({ valid: false, error: "Timed out" }); });
  });
}

async function sitemapUrls(candidates: string[]): Promise<SiteData["sitemap"]> {
  const urls = new Set<string>();
  let foundAt: string | undefined;
  let error: string | undefined;
  const queue = [...candidates];
  const seen = new Set<string>();
  while (queue.length && seen.size < 6 && urls.size < 500) {
    const loc = queue.shift()!;
    if (seen.has(loc)) continue;
    seen.add(loc);
    try {
      const { res } = await guardedFetch(new URL(loc), { accept: "application/xml,text/xml", timeout: 10_000 });
      if (!res.ok) { await res.body?.cancel().catch(() => {}); continue; }
      const xml = (await readCapped(res, 5_000_000)).text;
      if (!/<(urlset|sitemapindex)\b/i.test(xml)) continue;
      foundAt ??= loc;
      const locs = [...xml.matchAll(/<loc>\s*(?:<!\[CDATA\[)?\s*([^<\]]+?)\s*(?:\]\]>)?\s*<\/loc>/gi)].map((m) => m[1].trim());
      if (/<sitemapindex\b/i.test(xml)) queue.push(...locs.slice(0, 5));
      else locs.forEach((l) => urls.size < 500 && urls.add(l));
    } catch (e) {
      error = (e as Error).message;
    }
  }
  return { found: !!foundAt, url: foundAt, urls: [...urls], count: urls.size, error: foundAt ? undefined : error };
}

export async function probeSite(input: string): Promise<{ site: SiteData; start: string }> {
  const u = normalizeUrl(input);
  const home = await guardedFetch(u, { timeout: 20_000 }).catch((e) => {
    // Some small-business sites only answer on http.
    if (u.protocol === "https:" && !(e instanceof AnalyzeError)) return guardedFetch(new URL(u.toString().replace(/^https:/, "http:")), { timeout: 20_000 });
    throw e;
  });
  const final = home.url;
  const headers: Record<string, string> = {};
  home.res.headers.forEach((v, k) => { headers[k] = v.slice(0, 600); });
  const rawCookies = typeof home.res.headers.getSetCookie === "function" ? home.res.headers.getSetCookie() : [];
  await home.res.body?.cancel().catch(() => {});
  const cookies = rawCookies.slice(0, 20).map((c) => ({
    name: c.split("=")[0].trim(),
    secure: /;\s*secure/i.test(c),
    httpOnly: /;\s*httponly/i.test(c),
    sameSite: c.match(/;\s*samesite=(\w+)/i)?.[1],
  }));

  const [robots, tlsInfo, httpRedirect, soft404] = await Promise.all([
    getRobots(final.origin),
    final.protocol === "https:" ? certificate(final.hostname).catch((e) => ({ valid: false, error: (e as Error).message })) : Promise.resolve(null),
    (async () => {
      if (final.protocol !== "https:") return false;
      try {
        const r = await guardedFetch(new URL(`http://${final.host}/`), { timeout: 10_000, maxHops: 4 });
        await r.res.body?.cancel().catch(() => {});
        return r.url.protocol === "https:";
      } catch { return null; }
    })(),
    (async () => {
      try {
        const r = await guardedFetch(new URL(`/arkria-audit-missing-page-${Math.random().toString(36).slice(2, 8)}`, final.origin), { timeout: 10_000 });
        await r.res.body?.cancel().catch(() => {});
        return r.res.status === 200;
      } catch { return null; }
    })(),
  ]);

  const sitemap = await sitemapUrls([...robots.sitemaps, new URL("/sitemap.xml", final.origin).toString(), new URL("/sitemap_index.xml", final.origin).toString()]);

  return {
    start: final.toString(),
    site: {
      input,
      origin: final.origin,
      host: final.hostname,
      https: final.protocol === "https:",
      httpRedirectsToHttps: httpRedirect,
      robots: { found: robots.found, status: robots.status, disallowAll: robots.disallowAll, sitemaps: robots.sitemaps, crawlDelay: robots.crawlDelay },
      sitemap,
      tls: tlsInfo,
      headers,
      cookies,
      soft404,
      homepageStatus: home.res.status,
    },
  };
}
