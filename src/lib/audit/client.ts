"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { DB, Prospect, Proposal } from "../types";
import { authHeaders, useDB } from "../store";
import { todayISO, uid } from "../utils";
import { evaluate } from "../leadfinder/engine";
import { newProspect } from "../leadfinder/prospect";
import { DedupeIndex } from "../leadfinder/dedupe";
import type { AuditRaw, AuditRecord, AuditResult, CompetitorRaw } from "./types";
import { runAudit, STAGES, trimForStorage, type StageId, type StageState, type Transport } from "./orchestrator";
import { computeAudit, summarize } from "./engine/report";
import type { AuditListItem } from "./server/storage";

// Browser side of the deep auditor: calls the /api/audit/* endpoints step by
// step, shows progress, computes results locally and saves the record.

async function api<T>(path: string, body?: unknown, method?: string): Promise<T> {
  const res = await fetch(`/api/${path}`, {
    method: method ?? (body === undefined ? "GET" : "POST"),
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const err = new Error(String(data.error ?? `Server error ${res.status} on ${path} — see the deployment logs`)) as Error & { status?: number; data?: Record<string, unknown> };
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data as T;
}

export const transport: Transport = {
  site: (url) => api("audit/site", { url }),
  page: async (url, rootHost, depth) => (await api<{ page: import("./types").PageData }>("audit/page", { url, rootHost, depth })).page,
  browser: async (url, viewport, full) => {
    try { return await api("audit/browser", { url, viewport, full }); } catch (e) { const x = e as Error & { data?: { unavailable?: boolean } }; if (x.data?.unavailable) return { unavailable: x.message }; throw e; }
  },
  breakpoints: async (url) => {
    try { return await api("audit/breakpoints", { url }); } catch (e) { const x = e as Error & { data?: { unavailable?: boolean } }; if (x.data?.unavailable) return { unavailable: x.message }; throw e; }
  },
  pagespeed: async (url) => (await api<{ pagespeed: import("./types").PageSpeedData }>("audit/pagespeed", { url })).pagespeed,
  links: async (links) => (await api<{ links: import("./types").LinkCheck[] }>("audit/links", { links })).links,
  ai: async (input) => {
    try { return (await api<{ ai: import("./types").AiAnalysis }>("audit/ai", input)).ai; } catch (e) { const x = e as Error & { data?: { disabled?: boolean } }; return x.data?.disabled ? { disabled: true as const } : { error: x.message }; }
  },
};

export interface Capabilities { browser: { available: boolean; reason?: string }; pagespeedKey: boolean; ai: boolean }

export function useAuditCapabilities() {
  const [caps, setCaps] = useState<Capabilities | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    api<Capabilities>("audit/status").then((c) => live && setCaps(c)).catch((e: Error) => live && setError(e.message));
    return () => { live = false; };
  }, []);
  return { caps, error };
}

export type Stages = Record<StageId, StageState>;
const initialStages = (): Stages => Object.fromEntries(STAGES.map((s) => [s.id, { status: "pending" }])) as Stages;

export interface DeepAuditInput { url: string; crawlLimit: number; competitors: string[]; prospectId?: string; industryHint?: string; country?: string }

export function useDeepAudit() {
  const { db, getDB, mutate, userName } = useDB();
  const [stages, setStages] = useState<Stages>(initialStages);
  const [partial, setPartial] = useState<AuditResult | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [competitorStatus, setCompetitorStatus] = useState<{ url: string; status: "pending" | "running" | "done" | "failed"; error?: string }[]>([]);
  const cancelled = useRef(false);
  const servicesRef = useRef(db.services);
  useEffect(() => { servicesRef.current = db.services; }, [db.services]);

  const run = useCallback(async (input: DeepAuditInput, caps: Capabilities): Promise<string | null> => {
    cancelled.current = false;
    setRunning(true);
    setError(null);
    setPartial(null);
    setStages(initialStages());
    setCompetitorStatus(input.competitors.map((url) => ({ url, status: "pending" })));
    const capabilities = { browser: caps.browser.available, ai: caps.ai };
    try {
      let lastCompute = 0;
      let trailing: ReturnType<typeof setTimeout> | null = null;
      const recompute = (r: AuditRaw) => { lastCompute = Date.now(); try { setPartial(computeAudit(input.url, r, { services: servicesRef.current, industryHint: input.industryHint, country: input.country })); } catch {} };
      const raw = await runAudit(transport, {
        url: input.url,
        crawlLimit: input.crawlLimit,
        capabilities,
        cancelled: () => cancelled.current,
        onStage: (id, s) => setStages((cur) => ({ ...cur, [id]: s })),
        onRaw: (r) => {
          if (!r.site) return;
          if (trailing) clearTimeout(trailing);
          const wait = 1200 - (Date.now() - lastCompute);
          // Throttled, but the latest data is always shown shortly after.
          if (wait <= 0) recompute(r);
          else trailing = setTimeout(() => recompute(r), wait);
        },
      });

      if (trailing) clearTimeout(trailing);
      const competitors: CompetitorRaw[] = [];
      for (const [i, url] of input.competitors.entries()) {
        if (cancelled.current) break;
        setCompetitorStatus((cur) => cur.map((c, j) => (j === i ? { ...c, status: "running" } : c)));
        setStages((cur) => ({ ...cur, opportunity: { status: "running", detail: `Auditing competitor ${i + 1} of ${input.competitors.length}: ${url}` } }));
        try {
          const craw = await runAudit(transport, { url, crawlLimit: 8, light: true, capabilities: { browser: capabilities.browser, ai: false } });
          competitors.push({ url, raw: craw });
          setCompetitorStatus((cur) => cur.map((c, j) => (j === i ? { ...c, status: "done" } : c)));
        } catch (e) {
          setCompetitorStatus((cur) => cur.map((c, j) => (j === i ? { ...c, status: "failed", error: (e as Error).message } : c)));
        }
      }

      setStages((cur) => ({ ...cur, opportunity: { status: "running", detail: "Scoring and matching services" } }));
      const result = computeAudit(input.url, raw, { services: getDB().services, industryHint: input.industryHint, country: input.country });
      setPartial(result);
      const host = new URL(raw.site.origin).hostname.replace(/^www\./, "");
      const rec: AuditRecord = trimForStorage({
        id: uid("au"),
        url: raw.site.origin + "/",
        domain: host,
        createdAt: new Date().toISOString(),
        createdBy: userName || undefined,
        crawlLimit: input.crawlLimit,
        prospectId: input.prospectId,
        industryHint: input.industryHint,
        country: input.country,
        raw,
        competitors,
        summary: summarize(result),
      });
      await api("audits", rec);
      if (input.prospectId) {
        const link = { id: rec.id, at: rec.createdAt, overall: result.overallScore, opportunity: result.opportunity.score, service: result.opportunity.recommended?.name };
        mutate((d) => ({ prospects: d.prospects.map((p) => (p.id === input.prospectId ? { ...p, deepAudit: link } : p)) }));
      }
      setStages((cur) => ({ ...cur, opportunity: { status: "done", detail: result.opportunity.recommended ? `${result.opportunity.recommended.name} · opportunity ${result.opportunity.score}/100` : `Opportunity ${result.opportunity.score}/100` } }));
      return rec.id;
    } catch (e) {
      setError((e as Error).message);
      setStages((cur) => {
        const next = { ...cur };
        for (const s of STAGES) if (next[s.id].status === "running") next[s.id] = { status: "failed", detail: (e as Error).message };
        return next;
      });
      return null;
    } finally {
      setRunning(false);
    }
  }, [getDB, mutate, userName]);

  return { run, stages, partial, running, error, competitorStatus, cancel: () => { cancelled.current = true; } };
}

export function useAuditList() {
  const [items, setItems] = useState<AuditListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => { api<{ audits: AuditListItem[] }>("audits").then((r) => setItems(r.audits)).catch((e: Error) => setError(e.message)); }, []);
  useEffect(() => { load(); }, [load]);
  const remove = async (id: string) => { await api(`audits/${id}`, undefined, "DELETE"); load(); };
  return { items, error, reload: load, remove };
}

export function useAuditRecord(id: string) {
  const [rec, setRec] = useState<AuditRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    api<{ audit: AuditRecord }>(`audits/${id}`).then((r) => live && setRec(r.audit)).catch((e: Error) => live && setError(e.message));
    return () => { live = false; };
  }, [id]);
  return { rec, error };
}

// ---------- actions ----------

export function businessName(raw: AuditRaw) {
  const home = raw.pages.find((p) => p.depth === 0 && p.ok);
  const og = home?.title?.split(/\s[|–—-]\s/).map((x) => x.trim()).filter(Boolean) ?? [];
  const byLength = og.sort((a, b) => a.length - b.length)[0];
  return byLength && byLength.length > 2 && !/^(home|welcome)$/i.test(byLength) ? byLength : raw.site.host.replace(/^www\./, "");
}

const INDUSTRY_OF: Record<string, string> = {
  real_estate: "Real Estate", restaurant: "Restaurants", clinic: "Clinics", law: "Law Firms", hotel: "Hotels", education: "Education", saas: "SaaS",
  manufacturer: "Manufacturing", interior: "Interior Design", agency: "Professional Services", portfolio: "Photography", ecommerce: "E-commerce", local: "Local Businesses",
};

// Creates (or links) a Lead Finder prospect for the audited site.
export function prospectFromAudit(rec: AuditRecord, result: AuditResult, d: DB): { prospect: Prospect; existing: boolean } {
  const home = rec.raw.pages.find((p) => p.depth === 0 && p.ok);
  const linkTo = (p: Prospect): Prospect => ({ ...p, deepAudit: { id: rec.id, at: rec.createdAt, overall: result.overallScore, opportunity: result.opportunity.score, service: result.opportunity.recommended?.name } });
  const found = rec.prospectId ? d.prospects.find((p) => p.id === rec.prospectId) : undefined;
  const idx = new DedupeIndex(d.prospects);
  const dup = found?.id ?? idx.find({ name: "", website: rec.url });
  if (dup) return { prospect: linkTo(d.prospects.find((p) => p.id === dup)!), existing: true };
  const phones = [...new Set(rec.raw.pages.flatMap((p) => p.contact.phones))];
  const emails = [...new Set(rec.raw.pages.flatMap((p) => p.contact.emails))];
  const wa = rec.raw.pages.map((p) => p.contact.whatsapp).find(Boolean)?.match(/(?:wa\.me\/|phone=)(\d{10,15})/)?.[1];
  const addr = rec.raw.pages.map((p) => p.contact.address).find(Boolean);
  const p = newProspect({ name: businessName(rec.raw), industry: INDUSTRY_OF[result.business.type] ?? "", website: rec.url, address: addr, socials: {} }, "website", "detected");
  if (phones[0]) { p.phone = phones[0]; p.provenance.phone = { source: "website", confidence: "detected" }; }
  if (emails[0]) { p.email = emails[0]; p.provenance.email = { source: "website", confidence: "detected" }; }
  if (wa) { p.whatsapp = `+${wa}`; p.provenance.whatsapp = { source: "website", confidence: "detected" }; }
  const soc = home?.externalLinks ?? [];
  for (const [k, re] of [["instagram", /instagram\.com\//i], ["facebook", /facebook\.com\//i], ["linkedin", /linkedin\.com\/(company|in)\//i], ["youtube", /youtube\.com\//i]] as const) {
    const hit = soc.find((l) => re.test(l.url));
    if (hit) { p.socials[k] = hit.url; p.provenance[`social.${k}`] = { source: "website", confidence: "detected" }; }
  }
  p.description = home?.metaDescription;
  if (p.description) p.provenance.description = { source: "website", confidence: "detected" };
  return { prospect: linkTo(evaluate(p, d.services, d.finder.scoring)), existing: false };
}

export function proposalFromAudit(rec: AuditRecord, result: AuditResult, d: DB): Proposal {
  const svc = result.opportunity.recommended;
  const service = d.services.find((s) => s.id === svc?.serviceId);
  const name = businessName(rec.raw);
  const important = result.pagesAnalyzed.filter((p) => p.status === 200).map((p) => { try { const x = new URL(p.url).pathname; return x === "/" ? "Home" : x.split("/").filter(Boolean).map((s) => s.replace(/-/g, " ")).join(" / "); } catch { return ""; } }).filter(Boolean);
  const sitemap = [...new Set(["Home", ...important.slice(0, 8), "Contact"])].map((x) => x.replace(/\b\w/g, (c) => c.toUpperCase()));
  const top = result.issues.filter((i) => i.severity !== "info").slice(0, 5);
  const weeks = svc ? Math.max(2, Math.round(svc.hours / 30)) : 4;
  return {
    id: uid("pr"),
    clientName: name,
    title: `${name} — ${svc?.name ?? "Website"} proposal`,
    understanding: `${name} (${rec.domain}) is a ${result.business.label.toLowerCase()} business. We audited ${result.pagesAnalyzed.length} pages of the current website on ${new Date(rec.createdAt).toLocaleDateString("en-GB", { dateStyle: "medium" })}. Overall website health: ${result.overallScore ?? "not scored"}/100.`,
    opportunity: top.map((i) => `${i.title}: ${i.evidence}`).join("\n"),
    approach: ["Discover", "Design", "Build", "Launch"],
    solution: service?.clientFacing ?? svc?.name ?? "",
    sitemap,
    designDirection: result.issues.filter((i) => i.category === "design" || i.category === "mobile").slice(0, 3).map((i) => i.recommendation).join(" ") || "Clean, mobile-first design with clear calls to action.",
    deliverables: [svc?.name ?? "Website", ...result.quickWins.slice(0, 5).map((i) => i.recommendation.split(".")[0])],
    timeline: `${weeks} weeks`,
    investment: svc?.price ?? 0,
    paymentPlan: [{ label: "To begin", pct: 50 }, { label: "Development milestone", pct: 30 }, { label: "Launch", pct: 20 }],
    terms: "Two revision rounds per stage are included. Content is provided by the client. Hosting, domains and third-party services are billed separately.",
    status: "draft",
    created: todayISO(),
  };
}
