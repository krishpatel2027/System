"use client";
import React, { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Check, Gauge, Globe, MonitorSmartphone, Plus, ScanSearch, Sparkles, Trash2, X } from "lucide-react";
import { useDB } from "@/lib/store";
import { useAuditCapabilities, useAuditList, useDeepAudit } from "@/lib/audit/client";
import { SCORE_KEYS } from "@/lib/audit/engine/report";
import { cn, inr } from "@/lib/utils";
import { Badge, Btn, Card, CardHeader, Empty, inputCls, PageHeader, Tabs } from "@/components/ui";
import { FinderTabs } from "@/components/leadfinder";
import { ScoreCard, SevBadge, StageList, scoreTone } from "@/components/audit";

const LIMITS = [10, 25, 50, 100] as const;

function AuditInner() {
  const params = useSearchParams();
  const router = useRouter();
  const { db } = useDB();
  const { caps, error: capsError } = useAuditCapabilities();
  const audit = useDeepAudit();
  const list = useAuditList();
  const [url, setUrl] = useState(params.get("url") ?? "");
  const [limit, setLimit] = useState<(typeof LIMITS)[number]>(25);
  const [compare, setCompare] = useState(false);
  const [comps, setComps] = useState<string[]>([""]);
  const [done, setDone] = useState<string | null>(null);
  const prospectId = params.get("prospect") ?? undefined;
  const prospect = prospectId ? db.prospects.find((p) => p.id === prospectId) : undefined;

  const start = async () => {
    if (!url.trim() || !caps) return;
    setDone(null);
    const id = await audit.run({ url: url.trim(), crawlLimit: limit, competitors: compare ? comps.map((c) => c.trim()).filter(Boolean).slice(0, 3) : [], prospectId, industryHint: prospect?.industry || params.get("industry") || undefined }, caps);
    if (id) { setDone(id); list.reload(); setTimeout(() => router.push(`/lead-finder/audits/${id}`), 1200); }
  };

  const started = audit.running || !!audit.partial || !!audit.error;
  const p = audit.partial;

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Lead Finder" title="Website Intelligence Auditor" description="A deep, evidence-based audit of any public website — performance, mobile, design, UX, SEO, conversion, trust, security — and what Arkria could build." />
      <FinderTabs />

      <Card className="p-5 sm:p-6">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-subtle">Audit a website</div>
        <form onSubmit={(e) => { e.preventDefault(); void start(); }} className="mt-2 flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Globe size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-subtle" />
            <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com" disabled={audit.running} className={cn(inputCls, "h-12 rounded-2xl pl-10 text-[15px]")} autoFocus={!url} />
          </div>
          <Btn type="submit" variant="accent" disabled={audit.running || !url.trim() || !caps} className="h-12 px-6 text-[14px] font-semibold uppercase tracking-wide">
            <ScanSearch size={16} /> {audit.running ? "Auditing…" : "Start deep audit"}
          </Btn>
        </form>
        {prospect && <div className="mt-2 text-[12.5px] text-muted">Linked to lead: <Link href={`/lead-finder/${prospect.id}`} className="font-medium text-accent">{prospect.name}</Link></div>}

        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-3">
          <div className="flex items-center gap-2 text-[12.5px] text-muted">Pages to crawl <Tabs tabs={LIMITS.map((l) => ({ id: String(l) as `${number}`, label: String(l) }))} value={String(limit) as `${number}`} onChange={(v) => setLimit(Number(v) as (typeof LIMITS)[number])} /></div>
          <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" checked={compare} onChange={(e) => setCompare(e.target.checked)} disabled={audit.running} className="h-4 w-4 accent-[var(--accent)]" /> Compare with competitors</label>
        </div>
        {compare && (
          <div className="mt-3 space-y-2">
            {comps.map((c, i) => (
              <div key={i} className="flex gap-2">
                <input value={c} onChange={(e) => setComps(comps.map((x, j) => (j === i ? e.target.value : x)))} placeholder={`Competitor ${i + 1} URL`} className={inputCls} disabled={audit.running} />
                <Btn variant="ghost" onClick={() => setComps(comps.filter((_, j) => j !== i))} disabled={comps.length === 1}><X size={14} /></Btn>
              </div>
            ))}
            {comps.length < 3 && <Btn size="sm" variant="ghost" onClick={() => setComps([...comps, ""])}><Plus size={13} /> Add competitor</Btn>}
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4 text-[12px]">
          {capsError && <Badge tone="red">{capsError}</Badge>}
          {caps && (
            <>
              <span title={caps.browser.reason}><Badge tone={caps.browser.available ? "green" : "amber"} dot><MonitorSmartphone size={11} className="mr-0.5" />{caps.browser.available ? "Browser checks on" : "Browser checks unavailable"}</Badge></span>
              <Badge tone={caps.pagespeedKey ? "green" : "neutral"} dot><Gauge size={11} className="mr-0.5" />{caps.pagespeedKey ? "Google PageSpeed" : "Google PageSpeed (no key, low quota)"}</Badge>
              <Badge tone={caps.ai ? "violet" : "neutral"} dot><Sparkles size={11} className="mr-0.5" />{caps.ai ? "AI analysis on" : "AI analysis off"}</Badge>
              <span className="text-subtle">Public pages only · robots.txt respected · forms are never submitted</span>
            </>
          )}
        </div>
        {caps && !caps.browser.available && <p className="mt-2 text-[12px] text-amber-700 dark:text-amber-400">{caps.browser.reason} Without it, rendering-based checks are marked “Not measured”.</p>}
      </Card>

      {started && (
        <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
          <Card className="h-fit p-4">
            <div className="mb-2 flex items-center justify-between px-3">
              <div className="text-[12px] font-semibold uppercase tracking-wider text-subtle">{done ? "Audit complete" : audit.error ? "Audit stopped" : "Analyzing website"}</div>
              {audit.running && <button onClick={audit.cancel} className="text-[12px] text-muted hover:text-ink">Stop crawl</button>}
            </div>
            <StageList stages={audit.stages} />
            {audit.competitorStatus.length > 0 && (
              <div className="mt-3 border-t border-line px-3 pt-3 text-[12.5px]">
                <div className="mb-1 font-medium text-muted">Competitors</div>
                {audit.competitorStatus.map((c) => <div key={c.url} className="flex items-center justify-between gap-2 py-0.5"><span className="truncate">{c.url}</span><Badge tone={c.status === "done" ? "green" : c.status === "failed" ? "red" : c.status === "running" ? "violet" : "neutral"}>{c.status}</Badge></div>)}
              </div>
            )}
            {audit.error && <div className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-[13px] text-red-700 dark:bg-red-950/50 dark:text-red-300">{audit.error}</div>}
          </Card>

          <div className="space-y-4">
            {done && (
              <Card className="flex flex-wrap items-center justify-between gap-3 border-emerald-300 bg-emerald-50/60 p-5 dark:border-emerald-900 dark:bg-emerald-950/30">
                <div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500 text-white"><Check size={18} /></div><div><div className="text-[15px] font-semibold">Audit complete</div><div className="text-[12.5px] text-muted">Opening the full report…</div></div></div>
                <Link href={`/lead-finder/audits/${done}`}><Btn>View full audit <ArrowRight size={14} /></Btn></Link>
              </Card>
            )}
            {p ? (
              <>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Card className="p-4"><div className="text-[12px] text-muted">Website health</div><div className={cn("mt-1 text-[28px] font-semibold tabular-nums", scoreTone(p.overallScore))}>{p.overallScore ?? "—"}</div></Card>
                  <Card className="p-4"><div className="text-[12px] text-muted">Pages analyzed</div><div className="mt-1 text-[28px] font-semibold tabular-nums">{p.pagesAnalyzed.length}</div></Card>
                  <Card className="p-4"><div className="text-[12px] text-muted">Issues found</div><div className="mt-1 text-[28px] font-semibold tabular-nums">{p.issues.filter((i) => i.severity !== "info").length}</div><div className="text-[11.5px] text-subtle">{p.issues.filter((i) => i.severity === "critical" || i.severity === "high").length} high priority</div></Card>
                  <Card className="p-4"><div className="text-[12px] text-muted">Arkria opportunity</div><div className="mt-1 text-[28px] font-semibold tabular-nums text-accent">{p.opportunity.score}</div><div className="truncate text-[11.5px] text-subtle">{p.opportunity.recommended?.name ?? "—"}</div></Card>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">{SCORE_KEYS.map((k) => <ScoreCard key={k} k={k} cell={p.scores[k]} />)}</div>
                <Card>
                  <CardHeader title="Latest findings" sub="Updates as each module completes" />
                  <div className="divide-y divide-line px-5 pb-3 pt-2">
                    {p.issues.slice(0, 8).map((i) => <div key={i.id} className="flex items-start gap-2 py-2 text-[13px]"><SevBadge s={i.severity} /><span className="min-w-0 flex-1">{i.title}</span></div>)}
                  </div>
                </Card>
              </>
            ) : (
              <Card className="p-8 text-center text-[13px] text-muted">Results appear here as each part of the audit completes.</Card>
            )}
          </div>
        </div>
      )}

      <Card>
        <CardHeader title="Recent audits" sub="Shared with your team" />
        <div className="p-5">
          {list.error ? <div className="text-[13px] text-red-600">{list.error}</div> : !list.items ? <div className="text-[13px] text-muted">Loading…</div> : list.items.length === 0 ? (
            <Empty icon={<ScanSearch size={18} />} title="No audits yet" sub="Run your first deep audit above." />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-line">
              <table className="w-full min-w-[640px] text-[13px]">
                <thead><tr className="border-b border-line bg-surface-2/60 text-left text-[12px] text-muted"><th className="px-4 py-2 font-medium">Website</th><th className="px-3 py-2 font-medium">Audited</th><th className="px-3 py-2 text-right font-medium">Health</th><th className="px-3 py-2 text-right font-medium">Opportunity</th><th className="px-3 py-2 font-medium">Recommended</th><th className="w-10" /></tr></thead>
                <tbody className="divide-y divide-line">
                  {list.items.map((a) => (
                    <tr key={a.id} className="hover:bg-surface-2/60">
                      <td className="px-4 py-2.5"><Link href={`/lead-finder/audits/${a.id}`} className="font-medium hover:text-accent">{a.domain}</Link><div className="text-[11.5px] text-subtle">{a.summary.pages} pages · {a.summary.high} high-priority issues</div></td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-muted">{new Date(a.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</td>
                      <td className={cn("px-3 py-2.5 text-right font-semibold tabular-nums", scoreTone(a.summary.overall))}>{a.summary.overall ?? "—"}</td>
                      <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-accent">{a.summary.opportunity}</td>
                      <td className="px-3 py-2.5">{a.summary.service ? `${a.summary.service} · ${inr(a.summary.servicePrice ?? 0)}` : "—"}</td>
                      <td className="px-2"><button onClick={() => confirm(`Delete the audit of ${a.domain}?`) && void list.remove(a.id)} className="rounded-lg p-1.5 text-subtle hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950" aria-label="Delete audit"><Trash2 size={14} /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

export default function AuditPage() {
  return <Suspense><AuditInner /></Suspense>;
}
