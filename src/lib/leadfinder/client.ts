"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { DB, Lead, Prospect, SearchQuery, SearchRun, WebsiteAudit } from "../types";
import { authHeaders, useDB } from "../store";
import { addDaysISO, todayISO, uid } from "../utils";
import { withStage } from "../stages";
import { DedupeIndex } from "./dedupe";
import { evaluate } from "./engine";
import { applyAudit, applyResolution, mergeInto, newProspect, passesQuery } from "./prospect";
export { applyAudit, applyResolution };
import { IMPORT_COLUMNS, mapHeader, parseCSV, toCSV } from "./csv";
import type { ProviderInfo } from "./server/providers";
import type { ResolveResult } from "./server/resolve";

// Each web search for a missing or outdated website uses one search credit.
export const WEBSITE_SEARCHES_PER_RUN = 20;

export class ApiError extends Error {
  constructor(message: string, public status: number, public data: Record<string, unknown> = {}) { super(message); }
}

export async function lfApi<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api/lead-finder/${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new ApiError(String(data.error ?? `Server error ${res.status} on ${path} — see the deployment logs`), res.status, data);
  return data as T;
}

export interface FinderStatus { integrations: ProviderInfo[]; providerConnected: boolean; provider: { id: string; name: string } | null; autoFind: boolean }

let statusCache: FinderStatus | null = null;
export function useFinderStatus() {
  const [status, setStatus] = useState<FinderStatus | null>(statusCache);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    lfApi<FinderStatus>("status")
      .then((s) => { statusCache = s; if (live) setStatus(s); })
      .catch((e: Error) => live && setError(e.message));
    return () => { live = false; };
  }, []);
  return { status, error, ai: !!status?.integrations.find((i) => i.id === "claude")?.connected };
}

export const emptyQuery = (): SearchQuery => ({ text: "", locations: [], industries: [], website: "any", minScore: 0, limit: 50 });

// ---------- analysis ----------

export async function analyzeUrl(url: string, withPageSpeed = false): Promise<WebsiteAudit> {
  return (await lfApi<{ audit: WebsiteAudit }>("analyze", { url, pagespeed: withPageSpeed })).audit;
}

async function pool<T>(items: T[], n: number, fn: (t: T, i: number) => Promise<void>, cancelled: () => boolean) {
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length && !cancelled()) { const k = i++; await fn(items[k], k); }
  }));
}

// ---------- FIND LEADS ----------

export type Stage = "search" | "dedupe" | "websites" | "score" | "match" | "done";
export const STAGE_LABELS: Record<Stage, string> = {
  search: "Searching businesses",
  dedupe: "Removing duplicates",
  websites: "Checking websites",
  score: "Scoring opportunities",
  match: "Matching services",
  done: "Complete",
};
export interface Progress { stage: Stage; done: number; total: number; note?: string }
export interface DiscoveryResult { run: SearchRun; ids: string[]; errors: string[] }

export function useDiscovery() {
  const { mutate, getDB } = useDB();
  const [progress, setProgress] = useState<Progress | null>(null);
  const [running, setRunning] = useState(false);
  const cancel = useRef(false);

  const run = useCallback(async (q: SearchQuery, label: string, savedSearchId?: string): Promise<DiscoveryResult> => {
    cancel.current = false;
    setRunning(true);
    try {
      setProgress({ stage: "search", done: 0, total: 1 });
      const { prospects, errors, source } = await lfApi<{ prospects: Prospect[]; errors: string[]; source: SearchRun["source"] }>("search", { query: q });

      setProgress({ stage: "dedupe", done: 0, total: prospects.length });
      const db = getDB();
      const idx = new DedupeIndex(db.prospects);
      const fresh: Prospect[] = [];
      let duplicates = 0;
      for (const p of prospects) {
        if (idx.find(p)) { duplicates++; continue; }
        idx.add(p);
        fresh.push(p);
      }

      // Confirm each business's real website: the Google listing's link can be
      // old, broken or a directory page, and some listings have none at all.
      setProgress({ stage: "websites", done: 0, total: fresh.length });
      let checked = 0;
      let searchesLeft = WEBSITE_SEARCHES_PER_RUN;
      let searchError: string | null = null;
      await pool(fresh, 4, async (p) => {
        const ask = (allowSearch: boolean) => lfApi<ResolveResult>("resolve", { name: p.name, city: p.city, address: p.address, phone: p.phone, website: p.website, placeId: p.placeId, allowSearch });
        try {
          let r: ResolveResult;
          try {
            r = await ask(searchesLeft > 0 && !searchError);
          } catch (e) {
            // Out of search credits or a bad key: keep going without web search.
            if (!(e instanceof ApiError) || (e.status !== 400 && e.status !== 429)) throw e;
            searchError = e.message;
            r = await ask(false);
          }
          if (r.check.searched) searchesLeft--;
          Object.assign(p, applyResolution(p, r));
        } catch {
          if (p.website) { try { Object.assign(p, applyAudit(p, await analyzeUrl(p.website))); } catch {} }
        }
        checked++;
        setProgress({ stage: "websites", done: checked, total: fresh.length });
      }, () => cancel.current);
      if (searchError) errors.push(`Website search stopped early: ${searchError}`);

      setProgress({ stage: "score", done: fresh.length, total: fresh.length });
      const cur = getDB();
      const evaluated = fresh.map((p) => evaluate({ ...p, searchId: savedSearchId }, cur.services, cur.finder.scoring));
      setProgress({ stage: "match", done: fresh.length, total: fresh.length });
      const kept = evaluated.filter((p) => passesQuery(p, q));

      const runRec: SearchRun = {
        id: uid("run"), at: new Date().toISOString(), label, query: q, source,
        found: prospects.length, added: kept.length, duplicates,
        qualified: kept.filter((p) => (p.score?.total ?? 0) >= cur.finder.scoring.qualified).length, savedSearchId,
      };
      mutate((d) => {
        // Re-check against the latest list in case a teammate added some meanwhile.
        const live = new DedupeIndex(d.prospects);
        const add = kept.filter((p) => !live.find(p));
        return {
          prospects: [...add, ...d.prospects],
          finder: {
            ...d.finder,
            history: [runRec, ...d.finder.history].slice(0, 100),
            savedSearches: savedSearchId ? d.finder.savedSearches.map((s) => (s.id === savedSearchId ? { ...s, lastRunAt: runRec.at } : s)) : d.finder.savedSearches,
          },
        };
      });
      setProgress({ stage: "done", done: kept.length, total: prospects.length, note: cancel.current ? "Stopped early — unchecked websites can be analyzed later." : undefined });
      return { run: runRec, ids: kept.map((p) => p.id), errors };
    } finally {
      setRunning(false);
    }
  }, [getDB, mutate]);

  return { run, progress, running, stop: () => { cancel.current = true; }, reset: () => setProgress(null) };
}

// ---------- prospect actions ----------

export function useProspectActions() {
  const { mutate, getDB } = useDB();

  const save = useCallback((p: Prospect) => mutate((d) => ({ prospects: d.prospects.map((x) => (x.id === p.id ? p : x)) })), [mutate]);

  const reevaluate = useCallback((p: Prospect) => {
    const d = getDB();
    const next = evaluate(p, d.services, d.finder.scoring);
    save(next);
    return next;
  }, [getDB, save]);

  const analyze = useCallback(async (p: Prospect, withPageSpeed = false) => {
    if (!p.website) return p;
    const audit = await analyzeUrl(p.website, withPageSpeed);
    const latest = getDB().prospects.find((x) => x.id === p.id) ?? p;
    return reevaluate(applyAudit(latest, audit));
  }, [getDB, reevaluate]);

  const toPipeline = useCallback((p: Prospect, userName?: string): Lead => {
    const d = getDB();
    const existing = d.leads.find((l) => l.prospectId === p.id || (p.leadId && l.id === p.leadId));
    if (existing) return existing;
    const lead = prospectToLead(p, d, userName);
    mutate((cur) => ({
      leads: [lead, ...cur.leads],
      prospects: cur.prospects.map((x) => (x.id === p.id ? { ...x, leadId: lead.id, status: "qualified", updatedAt: new Date().toISOString() } : x)),
    }));
    return lead;
  }, [getDB, mutate]);

  const markContacted = useCallback((p: Prospect, channel: string) => {
    const lead = toPipeline(p);
    mutate((cur) => ({
      leads: cur.leads.map((l) => (l.id === lead.id ? { ...withStage(l, l.stage === "new" || l.stage === "qualified" ? "contacted" : l.stage), nextFollowUp: addDaysISO(3) } : l)),
      comms: [{ id: uid("c"), clientName: p.name, channel, date: todayISO(), summary: `First outreach via ${channel} (from Lead Finder)` }, ...cur.comms],
    }));
  }, [mutate, toPipeline]);

  const remove = useCallback((ids: string[]) => mutate((d) => ({ prospects: d.prospects.filter((p) => !ids.includes(p.id)) })), [mutate]);

  return { save, reevaluate, analyze, toPipeline, markContacted, remove };
}

export function prospectToLead(p: Prospect, d: DB, userName?: string): Lead {
  const svc = d.services.find((s) => s.id === p.match?.serviceId);
  const issues = p.audit?.findings.slice(0, 4).map((f) => `• ${f.issue}: ${f.evidence}`).join("\n");
  return withStage({
    id: uid("lead"),
    company: p.name,
    industry: p.industry,
    website: p.website,
    instagram: p.socials.instagram,
    location: [p.area, p.city].filter(Boolean).join(", ") || p.address,
    contactName: p.decisionMaker?.name ?? "",
    role: p.decisionMaker?.role,
    phone: p.phone,
    whatsapp: p.whatsapp,
    email: p.email,
    service: svc?.name ?? p.match?.serviceName ?? "Business Website",
    serviceId: p.match?.serviceId,
    currentWebsite: p.website ? `${p.website} (${p.websiteStatus})` : "None found",
    source: "Lead Finder",
    dateAdded: todayISO(),
    score: p.score?.total ?? 0,
    stage: "new",
    nextFollowUp: addDaysISO(1),
    notes: [p.notes, userName ? `Added from Lead Finder by ${userName}` : "Added from Lead Finder"].filter(Boolean).join("\n"),
    currentSituation: Object.values(p.evidence).join(" "),
    problems: issues || undefined,
    recommended: p.match ? `${p.match.serviceName} — ${p.match.reasons.join(" ")}` : undefined,
    estLow: svc?.minBudget ?? p.match?.price,
    estHigh: p.match?.price,
    prospectId: p.id,
  } as Lead, "qualified");
}

// ---------- CSV import / export ----------

export function importCSV(text: string, d: DB): { prospects: Prospect[]; duplicates: number; skipped: number; missing: string[] } {
  const rows = parseCSV(text);
  if (rows.length < 2) return { prospects: [], duplicates: 0, skipped: 0, missing: [...IMPORT_COLUMNS] };
  const map = mapHeader(rows[0]);
  const missing = map["Business Name"] === undefined ? ["Business Name"] : [];
  if (missing.length) return { prospects: [], duplicates: 0, skipped: rows.length - 1, missing };
  const idx = new DedupeIndex(d.prospects);
  const out: Prospect[] = [];
  let duplicates = 0;
  let skipped = 0;
  const get = (r: string[], c: (typeof IMPORT_COLUMNS)[number]) => (map[c] === undefined ? "" : (r[map[c]!] ?? "").trim());
  for (const r of rows.slice(1, 2001)) {
    const name = get(r, "Business Name");
    if (!name) { skipped++; continue; }
    const ig = get(r, "Instagram");
    const li = get(r, "LinkedIn");
    const loc = get(r, "Location");
    const p = newProspect({
      name,
      industry: get(r, "Industry"),
      city: loc.split(",").map((s) => s.trim()).filter(Boolean).pop() || undefined,
      address: loc || undefined,
      website: get(r, "Website") || undefined,
      phone: get(r, "Phone") || undefined,
      email: get(r, "Email") || undefined,
      socials: {
        ...(ig ? { instagram: /^https?:/.test(ig) ? ig : `https://instagram.com/${ig.replace(/^@/, "")}` } : {}),
        ...(li ? { linkedin: /^https?:/.test(li) ? li : `https://${li.replace(/^\/+/, "")}` } : {}),
      },
      notes: get(r, "Notes") || undefined,
    }, "csv");
    const hit = idx.find(p);
    if (hit) {
      duplicates++;
      continue;
    }
    idx.add(p);
    out.push(evaluate(p, d.services, d.finder.scoring));
  }
  return { prospects: out, duplicates, skipped, missing: [] };
}

export const importTemplate = () => toCSV([...IMPORT_COLUMNS], []);

const conf = (p: Prospect, k: string) => p.provenance[k]?.confidence ?? "";

export function prospectsCSV(list: Prospect[]) {
  const header = ["Business Name", "Industry", "City", "Address", "Phone", "Phone confidence", "Email", "Email confidence", "WhatsApp", "Website", "Website status", "Instagram", "LinkedIn", "Google rating", "Google reviews", "Google Maps", "Opportunity score", "Recommended service", "Est. value (INR)", "Signals", "Status", "Sources", "Discovered"];
  const rows = list.map((p) => [
    p.name, p.industry, p.city, p.address, p.phone, conf(p, "phone"), p.email, conf(p, "email"), p.whatsapp, p.website, p.websiteStatus,
    p.socials.instagram, p.socials.linkedin, p.rating, p.reviewCount, p.googleMapsUrl, p.score?.total, p.match?.serviceName, p.match?.price,
    Object.values(p.evidence).join(" | "), p.status, p.sources.join(", "), p.discoveredAt.slice(0, 10),
  ]);
  return toCSV(header, rows);
}

export { mergeInto };
