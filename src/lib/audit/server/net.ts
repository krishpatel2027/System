import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

// Safe outbound HTTP for the auditors. Every request (and every redirect hop)
// is checked so a website can't point the server at internal addresses, the
// bot identifies itself, bodies are size-capped, and robots.txt is honoured.

export const USER_AGENT = "ArkriaAuditBot/1.0 (+website quality audit; respects robots.txt)";
export const ROBOTS_AGENT = "arkriaauditbot";

export class AnalyzeError extends Error {}

export function normalizeUrl(input: string): URL {
  const raw = input.trim();
  if (!raw || raw.length > 2000) throw new AnalyzeError("Enter a website address.");
  if (/^[a-z][\w+.-]*:\/\//i.test(raw) && !/^https?:\/\//i.test(raw)) throw new AnalyzeError("Only http and https websites can be checked.");
  let u: URL;
  try { u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`); } catch { throw new AnalyzeError("That doesn't look like a website address."); }
  if (!/^https?:$/.test(u.protocol)) throw new AnalyzeError("Only http and https websites can be checked.");
  if (u.username || u.password) throw new AnalyzeError("Website addresses with credentials aren't allowed.");
  u.hash = "";
  return u;
}

export function privateIp(ip: string): boolean {
  if (isIP(ip) === 6) {
    const v = ip.toLowerCase();
    if (v === "::1" || v === "::" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80")) return true;
    const m = v.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    return m ? privateIp(m[1]) : false;
  }
  const [a, b] = ip.split(".").map(Number);
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
}

export const guardActive = () => process.env.NODE_ENV === "production" || process.env.ARKRIA_ANALYZER_ALLOW_PRIVATE === "false";

const hostVerdicts = new Map<string, { ok: boolean; at: number }>();

// In production every hop is checked so a redirect can't reach internal services.
export async function guardHost(u: URL) {
  if (!guardActive()) return;
  const host = u.hostname.replace(/^\[|\]$/g, "");
  if (/^(localhost|.*\.local|.*\.internal)$/i.test(host)) throw new AnalyzeError("Internal addresses can't be checked.");
  const cached = hostVerdicts.get(host);
  if (cached && Date.now() - cached.at < 60_000) {
    if (!cached.ok) throw new AnalyzeError("Internal addresses can't be checked.");
    return;
  }
  const addrs = isIP(host) ? [{ address: host }] : await lookup(host, { all: true }).catch(() => { throw new AnalyzeError(`Couldn't find ${host} (DNS lookup failed).`); });
  const ok = !addrs.some((a) => privateIp(a.address));
  hostVerdicts.set(host, { ok, at: Date.now() });
  if (!ok) throw new AnalyzeError("Internal addresses can't be checked.");
}

// Boolean form for the headless browser's request filter.
export async function hostAllowed(u: URL): Promise<boolean> {
  try { await guardHost(u); return true; } catch { return false; }
}

export interface Hop { url: string; status: number }
export interface Fetched { res: Response; url: URL; chain: Hop[]; ttfbMs: number }

export async function guardedFetch(u: URL, opts: { accept?: string; method?: "GET" | "HEAD"; timeout?: number; maxHops?: number } = {}): Promise<Fetched> {
  let url = u;
  const chain: Hop[] = [];
  const t0 = Date.now();
  for (let hop = 0; hop <= (opts.maxHops ?? 6); hop++) {
    await guardHost(url);
    const res = await fetch(url, {
      method: opts.method ?? "GET",
      redirect: "manual",
      headers: { "User-Agent": USER_AGENT, Accept: opts.accept ?? "text/html,application/xhtml+xml", "Accept-Language": "en-IN,en;q=0.8" },
      signal: AbortSignal.timeout(opts.timeout ?? 15_000),
      cache: "no-store",
    });
    const loc = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && loc) {
      chain.push({ url: url.toString(), status: res.status });
      await res.body?.cancel().catch(() => {});
      url = new URL(loc, url);
      if (!/^https?:$/.test(url.protocol)) throw new AnalyzeError("Redirected to an unsupported address.");
      continue;
    }
    return { res, url, chain, ttfbMs: Date.now() - t0 };
  }
  throw new AnalyzeError("Too many redirects.");
}

export async function readCapped(res: Response, max = 2_000_000): Promise<{ text: string; bytes: number; truncated: boolean }> {
  const reader = res.body?.getReader();
  if (!reader) return { text: "", bytes: 0, truncated: false };
  const chunks: Uint8Array[] = [];
  let total = 0;
  let truncated = false;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    chunks.push(value);
    if (total > max) { truncated = true; await reader.cancel(); break; }
  }
  return { text: new TextDecoder("utf-8").decode(Buffer.concat(chunks)), bytes: total, truncated };
}

// ---------- robots.txt ----------

interface Group { agents: string[]; rules: { allow: boolean; path: string }[]; crawlDelay?: number }

function parseRobots(txt: string) {
  const groups: Group[] = [];
  const sitemaps: string[] = [];
  let cur: Group | null = null;
  let lastWasAgent = false;
  for (const line of txt.split(/\r?\n/)) {
    const l = line.replace(/#.*/, "").trim();
    const m = l.match(/^([\w-]+)\s*:\s*(.*)$/);
    if (!m) continue;
    const key = m[1].toLowerCase();
    const val = m[2].trim();
    if (key === "sitemap") { if (val) sitemaps.push(val); continue; }
    if (key === "user-agent") {
      if (!cur || !lastWasAgent) { cur = { agents: [], rules: [] }; groups.push(cur); }
      cur.agents.push(val.toLowerCase());
      lastWasAgent = true;
    } else {
      lastWasAgent = false;
      if (!cur) continue;
      if (key === "allow" || key === "disallow") cur.rules.push({ allow: key === "allow", path: val });
      if (key === "crawl-delay" && !isNaN(Number(val))) cur.crawlDelay = Number(val);
    }
  }
  return { groups, sitemaps };
}

function groupsFor(groups: Group[], agent: string) {
  const mine = groups.filter((g) => g.agents.some((a) => a !== "*" && agent.includes(a)));
  return mine.length ? mine : groups.filter((g) => g.agents.includes("*"));
}

export function robotsAllows(txt: string, path: string, agent = ROBOTS_AGENT): boolean {
  const rules = groupsFor(parseRobots(txt).groups, agent).flatMap((g) => g.rules);
  let best: { allow: boolean; len: number } | null = null;
  for (const r of rules) {
    if (!r.path) continue; // empty Disallow = allow all
    const pattern = new RegExp("^" + r.path.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\\\$$/, "$"));
    if (pattern.test(path) && (!best || r.path.length > best.len || (r.path.length === best.len && r.allow))) best = { allow: r.allow, len: r.path.length };
  }
  return best ? best.allow : true;
}

export interface RobotsInfo { found: boolean; status?: number; txt: string; sitemaps: string[]; crawlDelay?: number; disallowAll: boolean }

const robotsCache = new Map<string, { info: RobotsInfo; at: number }>();

export async function getRobots(origin: string): Promise<RobotsInfo> {
  const hit = robotsCache.get(origin);
  if (hit && Date.now() - hit.at < 10 * 60_000) return hit.info;
  let info: RobotsInfo = { found: false, txt: "", sitemaps: [], disallowAll: false };
  try {
    const { res } = await guardedFetch(new URL("/robots.txt", origin), { accept: "text/plain", timeout: 10_000 });
    if (res.ok && !/html/i.test(res.headers.get("content-type") ?? "")) {
      const txt = (await readCapped(res, 500_000)).text;
      const parsed = parseRobots(txt);
      const delay = groupsFor(parsed.groups, ROBOTS_AGENT).map((g) => g.crawlDelay).find((d) => d !== undefined);
      info = { found: true, status: res.status, txt, sitemaps: parsed.sitemaps, crawlDelay: delay, disallowAll: !robotsAllows(txt, "/") };
    } else {
      await res.body?.cancel().catch(() => {});
      info = { ...info, status: res.status };
    }
  } catch (e) {
    if (e instanceof AnalyzeError) throw e;
    // Unreachable robots.txt = no restrictions (RFC 9309).
  }
  robotsCache.set(origin, { info, at: Date.now() });
  return info;
}

export async function robotsCheck(u: URL): Promise<boolean> {
  const r = await getRobots(u.origin);
  return !r.found || robotsAllows(r.txt, u.pathname + u.search || "/");
}
