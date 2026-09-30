"use client";
import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Check, CircleDashed, ExternalLink, Gauge, Globe, Loader2, MapPin, Phone, PlugZap, Star } from "lucide-react";
import type { Confidence, Finding, Prospect, ScoreBreakdown, ScoringConfig, SourceId, WebsiteStatus } from "@/lib/types";
import { SIGNALS, PART_LABELS } from "@/lib/leadfinder/catalog";
import { opportunityLabel } from "@/lib/leadfinder/engine";
import { STAGE_LABELS, type Progress, type Stage } from "@/lib/leadfinder/client";
import { cn, inr } from "@/lib/utils";
import { Badge, Card, Progress as Bar } from "@/components/ui";

export const SOURCE_LABEL: Record<SourceId, string> = {
  google_places: "Google Business listing",
  website: "Business website",
  pagespeed: "Google PageSpeed",
  csv: "CSV import",
  manual: "Added manually",
};

const CONF: Record<Confidence, { label: string; cls: string }> = {
  verified: { label: "Verified", cls: "text-emerald-700 bg-emerald-50 ring-emerald-200/70 dark:bg-emerald-950/60 dark:text-emerald-300 dark:ring-emerald-900" },
  detected: { label: "Detected", cls: "text-sky-700 bg-sky-50 ring-sky-200/70 dark:bg-sky-950/60 dark:text-sky-300 dark:ring-sky-900" },
  estimated: { label: "Estimated", cls: "text-amber-700 bg-amber-50 ring-amber-200/70 dark:bg-amber-950/60 dark:text-amber-300 dark:ring-amber-900" },
  not_found: { label: "Not found", cls: "text-muted bg-surface-2 ring-line" },
};

export function ConfidenceTag({ c, source }: { c: Confidence; source?: SourceId }) {
  return (
    <span title={source ? `Source: ${SOURCE_LABEL[source]}` : undefined}
      className={cn("inline-flex items-center rounded-md px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide ring-1 ring-inset", CONF[c].cls)}>
      {CONF[c].label}
    </span>
  );
}

// One fact with where it came from. Missing facts say so; nothing is filled in.
export function DataRow({ label, value, prov, href, icon }: { label: string; value?: React.ReactNode; prov?: { source: SourceId; confidence: Confidence }; href?: string; icon?: React.ReactNode }) {
  const has = value !== undefined && value !== null && value !== "";
  return (
    <div className="flex items-start justify-between gap-3 py-2.5">
      <div className="flex min-w-0 items-start gap-2.5">
        {icon && <span className="mt-0.5 text-subtle">{icon}</span>}
        <div className="min-w-0">
          <div className="text-[11.5px] text-subtle">{label}</div>
          <div className={cn("break-words text-[13.5px]", !has && "text-subtle")}>
            {!has ? "Not found" : href ? <a href={href} target="_blank" rel="noreferrer noopener" className="text-accent hover:underline">{value}</a> : value}
          </div>
          {has && prov && <div className="mt-0.5 text-[11px] text-subtle">{SOURCE_LABEL[prov.source]}</div>}
        </div>
      </div>
      <ConfidenceTag c={has ? prov?.confidence ?? "estimated" : "not_found"} source={prov?.source} />
    </div>
  );
}

export function ScoreRing({ score, cfg, size = 52 }: { score?: number; cfg: ScoringConfig; size?: number }) {
  const s = score ?? 0;
  const r = size / 2 - 4;
  const c = 2 * Math.PI * r;
  const tone = score === undefined ? "var(--line-strong)" : s >= cfg.high ? "#10b981" : s >= cfg.qualified ? "var(--accent)" : s >= 40 ? "#f59e0b" : "var(--subtle)";
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} title="Arkria Opportunity Score">
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={4} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={tone} strokeWidth={4} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c - (c * s) / 100} style={{ transition: "stroke-dashoffset .6s cubic-bezier(.2,.7,.2,1)" }} />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-[14px] font-semibold tabular-nums" style={{ fontSize: size * 0.28 }}>{score ?? "–"}</div>
    </div>
  );
}

const WS: Record<WebsiteStatus, { label: string; tone: "red" | "amber" | "blue" | "green" | "neutral" }> = {
  none: { label: "No website", tone: "red" },
  unreachable: { label: "Website down", tone: "red" },
  outdated: { label: "Outdated website", tone: "amber" },
  basic: { label: "Basic website", tone: "blue" },
  good: { label: "Strong website", tone: "green" },
  unchecked: { label: "Website not checked", tone: "neutral" },
};

export function WebsiteBadge({ status }: { status: WebsiteStatus }) {
  return <Badge tone={WS[status].tone} dot>{WS[status].label}</Badge>;
}

export function SignalChips({ p, max = 4 }: { p: Prospect; max?: number }) {
  const list = p.signals.filter((s) => SIGNALS[s].kind === "opportunity" && !["no_website", "outdated_website", "basic_website", "website_unreachable"].includes(s));
  if (!list.length) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {list.slice(0, max).map((s) => (
        <span key={s} title={p.evidence[s]} className="rounded-md bg-surface-2 px-1.5 py-0.5 text-[11px] text-muted ring-1 ring-inset ring-line">{SIGNALS[s].label}</span>
      ))}
      {list.length > max && <span className="px-1 text-[11px] text-subtle">+{list.length - max}</span>}
    </div>
  );
}

const STATUS: Record<Prospect["status"], { label: string; tone: "neutral" | "blue" | "green" | "red" }> = {
  new: { label: "New", tone: "neutral" },
  reviewing: { label: "Reviewing", tone: "blue" },
  qualified: { label: "Qualified", tone: "green" },
  not_fit: { label: "Not a fit", tone: "red" },
};
export const prospectStatus = (s: Prospect["status"]) => STATUS[s];

export function ProspectCard({ p, cfg, selected, onSelect, inPipeline }: { p: Prospect; cfg: ScoringConfig; selected?: boolean; onSelect?: (v: boolean) => void; inPipeline?: string }) {
  const op = opportunityLabel(p.score?.total, cfg);
  return (
    <Card className={cn("group relative flex flex-col p-4 transition hover:-translate-y-px hover:border-line-strong hover:shadow-md", selected && "border-accent ring-2 ring-accent/20")}>
      {onSelect && (
        <input type="checkbox" checked={!!selected} onChange={(e) => onSelect(e.target.checked)} aria-label={`Select ${p.name}`}
          className="absolute left-3 top-3 z-10 h-4 w-4 cursor-pointer accent-[var(--accent)] opacity-0 transition group-hover:opacity-100 checked:opacity-100" />
      )}
      <Link href={`/lead-finder/${p.id}`} className="flex flex-1 flex-col outline-none">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1 pl-3">
            <div className="truncate text-[14.5px] font-semibold tracking-tight">{p.name}</div>
            <div className="mt-0.5 flex items-center gap-1 truncate text-[12px] text-muted">
              {p.industry || p.category || "Industry not set"}
              {(p.area || p.city) && <><span className="text-subtle">·</span><MapPin size={11} className="shrink-0" /><span className="truncate">{[p.area, p.city].filter(Boolean).join(", ")}</span></>}
            </div>
          </div>
          <ScoreRing score={p.score?.total} cfg={cfg} size={46} />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-1.5 pl-3">
          <WebsiteBadge status={p.websiteStatus} />
          {p.score && <Badge tone={op.tone}>{op.label} opportunity</Badge>}
        </div>
        <div className="mt-2.5 space-y-1 pl-3 text-[12px] text-muted">
          <div className="flex items-center gap-3">
            {p.rating !== undefined ? <span className="inline-flex items-center gap-1"><Star size={11} className="fill-amber-400 text-amber-400" />{p.rating.toFixed(1)} <span className="text-subtle">({p.reviewCount ?? 0})</span></span> : <span className="text-subtle">No rating</span>}
            <span className={cn("inline-flex items-center gap-1", !p.phone && "text-subtle")}><Phone size={11} />{p.phone ? "Phone" : "No phone"}</span>
            {p.website && <span className="inline-flex items-center gap-1"><Globe size={11} />Site</span>}
          </div>
        </div>
        <div className="mt-2.5 pl-3"><SignalChips p={p} max={3} /></div>
        <div className="min-h-3 flex-1" />
        <div className="flex items-end justify-between gap-2 border-t border-line pl-3 pt-3">
          {p.match ? (
            <div className="min-w-0">
              <div className="text-[11px] text-subtle">Recommended</div>
              <div className="truncate text-[12.5px] font-medium">{p.match.serviceName}</div>
            </div>
          ) : <div className="text-[12px] text-subtle">No clear service match</div>}
          <div className="text-right">
            {p.match && <div className="text-[13px] font-semibold tabular-nums">{inr(p.match.price)}</div>}
            {inPipeline ? <div className="text-[11px] text-emerald-600 dark:text-emerald-400">In pipeline · {inPipeline}</div> : <div className="text-[11px] text-subtle">{prospectStatus(p.status).label}</div>}
          </div>
        </div>
      </Link>
    </Card>
  );
}

export function ScoreBars({ score, cfg }: { score: ScoreBreakdown; cfg: ScoringConfig }) {
  return (
    <div className="space-y-2.5">
      {(Object.keys(PART_LABELS) as (keyof ScoreBreakdown["parts"])[]).map((k) => {
        const max = cfg.weights[k];
        if (!max) return null;
        return (
          <div key={k}>
            <div className="mb-1 flex justify-between text-[12px]"><span className="text-muted">{PART_LABELS[k]}</span><span className="tabular-nums text-subtle">{score.parts[k]}/{max}</span></div>
            <Bar value={(score.parts[k] / max) * 100} tone="accent" />
          </div>
        );
      })}
    </div>
  );
}

export function OpportunityCard({ p, compact }: { p: Prospect; compact?: boolean }) {
  const m = p.match;
  if (!m) return (
    <Card className="p-5">
      <div className="text-[12px] font-medium text-subtle">Recommended opportunity</div>
      <div className="mt-2 text-[14px] text-muted">No service matched the evidence found. {p.websiteStatus === "unchecked" ? "Analyze the website to find opportunities." : "This business may already be well served online."}</div>
    </Card>
  );
  const margin = m.price - m.cost;
  const pct = m.price ? Math.round((margin / m.price) * 100) : 0;
  return (
    <Card className="relative overflow-hidden p-5">
      <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-accent/10 blur-2xl" />
      <div className="text-[12px] font-medium text-subtle">Recommended opportunity</div>
      <div className="mt-1 text-[18px] font-semibold tracking-tight">{m.serviceName}</div>
      <div className={cn("mt-4 grid gap-3", compact ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-4")}>
        {[["Estimated value", inr(m.price)], ["Delivery", `${m.hours} hrs`], ["Internal cost", inr(m.cost)], ["Margin", `${inr(margin)} · ${pct}%`]].map(([k, v]) => (
          <div key={k} className="rounded-xl bg-surface-2 px-3 py-2.5">
            <div className="text-[11px] text-subtle">{k}</div>
            <div className="mt-0.5 text-[14px] font-semibold tabular-nums">{v}</div>
          </div>
        ))}
      </div>
      <div className="mt-4">
        <div className="text-[12px] font-medium text-muted">Why</div>
        <ul className="mt-1.5 space-y-1.5">
          {m.reasons.map((r) => <li key={r} className="flex gap-2 text-[13px] leading-snug"><Check size={14} className="mt-0.5 shrink-0 text-emerald-500" />{r}</li>)}
        </ul>
      </div>
      {m.alternatives.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-1.5 text-[12px] text-muted">
          Also relevant: {m.alternatives.map((a) => <Badge key={a.serviceId}>{a.serviceName} · {inr(a.price)}</Badge>)}
        </div>
      )}
      <div className="mt-3 text-[11px] text-subtle">Estimates from your service catalog. Not a quote.</div>
    </Card>
  );
}

export function ProviderNotConnected({ compact }: { compact?: boolean }) {
  return (
    <div className={cn("flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50/70 p-4 text-[13px] dark:border-amber-900 dark:bg-amber-950/40", compact && "p-3")}>
      <PlugZap size={18} className="mt-0.5 shrink-0 text-amber-600" />
      <div>
        <div className="font-semibold text-amber-900 dark:text-amber-200">Lead provider not connected.</div>
        <div className="mt-0.5 text-amber-800/90 dark:text-amber-300/90">
          Add <code className="rounded bg-amber-100 px-1 dark:bg-amber-900/60">GOOGLE_PLACES_API_KEY</code> to the server environment to discover businesses. Until then you can import a CSV, add businesses manually, and use the Website Auditor.
          {!compact && <> See <Link href="/settings?section=integrations" className="font-medium underline">Settings → Integrations</Link>.</>}
        </div>
      </div>
    </div>
  );
}

const ORDER: Stage[] = ["search", "dedupe", "websites", "score", "match"];
export function ProgressStages({ progress }: { progress: Progress }) {
  const at = progress.stage === "done" ? ORDER.length : ORDER.indexOf(progress.stage);
  return (
    <div className="grid gap-2 sm:grid-cols-5">
      {ORDER.map((s, i) => {
        const state = i < at ? "done" : i === at ? "active" : "todo";
        return (
          <div key={s} className={cn("rounded-xl border px-3 py-2.5 transition", state === "active" ? "border-accent bg-accent-soft" : state === "done" ? "border-line bg-surface" : "border-line bg-surface-2/50")}>
            <div className="flex items-center gap-2 text-[12.5px] font-medium">
              {state === "done" ? <Check size={14} className="text-emerald-500" /> : state === "active" ? <Loader2 size={14} className="animate-spin text-accent" /> : <CircleDashed size={14} className="text-subtle" />}
              <span className={cn(state === "todo" && "text-subtle")}>{STAGE_LABELS[s]}</span>
            </div>
            {state === "active" && s === "websites" && progress.total > 0 && (
              <div className="mt-2"><Bar value={(progress.done / progress.total) * 100} tone="accent" /><div className="mt-1 text-[11px] tabular-nums text-muted">{progress.done} / {progress.total}</div></div>
            )}
          </div>
        );
      })}
    </div>
  );
}

const TABS = [
  { href: "/lead-finder", label: "Discover" },
  { href: "/lead-finder/database", label: "Lead database" },
  { href: "/lead-finder/audit", label: "Website auditor" },
  { href: "/lead-finder/searches", label: "Saved & auto find" },
];
export function FinderTabs() {
  const path = usePathname();
  return (
    <div className="no-print -mx-1 flex gap-1 overflow-x-auto px-1">
      {TABS.map((t) => (
        <Link key={t.href} href={t.href}
          className={cn("whitespace-nowrap rounded-xl px-3 py-1.5 text-[13px] font-medium transition", path === t.href ? "bg-ink text-bg" : "text-muted hover:bg-surface-2 hover:text-ink")}>
          {t.label}
        </Link>
      ))}
    </div>
  );
}

export function ExtLink({ href, children }: { href: string; children: React.ReactNode }) {
  return <a href={href} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 text-accent hover:underline">{children}<ExternalLink size={11} /></a>;
}

const SEV: Record<Finding["severity"], "red" | "amber" | "neutral"> = { high: "red", medium: "amber", low: "neutral" };

export function AuditView({ p }: { p: Prospect }) {
  const a = p.audit;
  if (!p.website) return <div className="text-[13.5px] text-muted">No website was found for this business{p.sources.includes("google_places") ? " on its Google listing" : ""}. That&apos;s the opportunity.</div>;
  if (!a) return <div className="text-[13.5px] text-muted">Run an analysis to check mobile-friendliness, speed, SEO basics, security and contact options.</div>;
  if (!a.ok) return <div className="rounded-xl bg-surface-2 px-4 py-3 text-[13.5px]"><span className="font-medium">{a.blockedByRobots ? "Not checked" : "Couldn't load the website"}.</span> <span className="text-muted">{a.error}</span></div>;
  const findings = [...a.findings].sort((x, y) => ["high", "medium", "low"].indexOf(x.severity) - ["high", "medium", "low"].indexOf(y.severity));
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {(Object.entries(a.scores) as [string, number][]).map(([k, v]) => (
          <div key={k} className="rounded-xl bg-surface-2 px-2.5 py-2 text-center">
            <div className={cn("text-[18px] font-semibold tabular-nums", v >= 80 ? "text-emerald-600 dark:text-emerald-400" : v >= 50 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400")}>{v}</div>
            <div className="text-[11px] capitalize text-muted">{k}</div>
          </div>
        ))}
      </div>
      {a.pagespeed && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-line px-3.5 py-2.5 text-[12.5px]">
          <Gauge size={14} className="text-accent" /><span className="font-medium">Google PageSpeed (mobile)</span>
          <Badge tone={a.pagespeed.performance >= 80 ? "green" : a.pagespeed.performance >= 50 ? "amber" : "red"}>Performance {a.pagespeed.performance}</Badge>
          <Badge>SEO {a.pagespeed.seo}</Badge><Badge>Accessibility {a.pagespeed.accessibility}</Badge>
          {a.pagespeed.lcpMs && <span className="text-muted">LCP {(a.pagespeed.lcpMs / 1000).toFixed(1)}s</span>}
        </div>
      )}
      <div className="text-[12px] text-muted">
        {a.finalUrl && <ExtLink href={a.finalUrl}>{a.finalUrl.replace(/^https?:\/\//, "").replace(/\/$/, "")}</ExtLink>} · {a.responseMs ? `${(a.responseMs / 1000).toFixed(1)}s` : ""} · {a.htmlKb} KB{a.found.generator ? ` · ${a.found.generator}` : ""}
      </div>
      {findings.length ? (
        <div className="divide-y divide-line rounded-xl border border-line">
          {findings.map((f) => (
            <div key={f.id} className="grid gap-1 px-4 py-3 sm:grid-cols-[1fr_1fr]">
              <div>
                <div className="flex items-center gap-2"><Badge tone={SEV[f.severity]}>{f.severity}</Badge><span className="text-[13.5px] font-medium">{f.issue}</span></div>
                <div className="mt-1 text-[12.5px] text-muted">{f.evidence}</div>
              </div>
              <div className="flex gap-2 text-[12.5px] sm:pl-3"><Check size={13} className="mt-0.5 shrink-0 text-emerald-500" /><span>{f.improvement}</span></div>
            </div>
          ))}
        </div>
      ) : <div className="text-[13.5px] text-muted">No issues found on the homepage.</div>}
    </div>
  );
}

