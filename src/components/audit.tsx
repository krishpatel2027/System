"use client";
/* eslint-disable @next/next/no-img-element -- screenshots are inline data URLs, not optimisable assets */
import React, { useState } from "react";
import { Check, ChevronDown, CircleDashed, Eye, Loader2, Minus, X } from "lucide-react";
import type { Finding, ScoreCell, ScoreKey, Severity, Source } from "@/lib/audit/types";
import { STAGES, type StageId } from "@/lib/audit/orchestrator";
import type { StageState } from "@/lib/audit/orchestrator";
import { SCORE_LABEL } from "@/lib/audit/engine/report";
import { cn } from "@/lib/utils";
import { Modal, Progress } from "@/components/ui";

const SEV: Record<Severity, string> = {
  critical: "bg-red-600 text-white ring-red-600",
  high: "bg-red-50 text-red-700 ring-red-200 dark:bg-red-950/60 dark:text-red-300 dark:ring-red-900",
  medium: "bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:ring-amber-900",
  low: "bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-950/60 dark:text-sky-300 dark:ring-sky-900",
  info: "bg-surface-2 text-muted ring-line",
};

export function SevBadge({ s, className }: { s: Severity; className?: string }) {
  return <span className={cn("inline-flex h-5 items-center rounded-md px-1.5 text-[10.5px] font-bold uppercase tracking-wider ring-1 ring-inset", SEV[s], className)}>{s}</span>;
}

const SRC: Record<Source, { label: string; cls: string }> = {
  html: { label: "Detected · HTML", cls: "text-sky-700 dark:text-sky-300" },
  headers: { label: "Detected · response headers", cls: "text-sky-700 dark:text-sky-300" },
  crawl: { label: "Measured · crawler", cls: "text-emerald-700 dark:text-emerald-300" },
  browser: { label: "Measured · Arkria browser", cls: "text-emerald-700 dark:text-emerald-300" },
  pagespeed: { label: "Measured · Google PageSpeed", cls: "text-emerald-700 dark:text-emerald-300" },
  crux: { label: "Real users · Chrome UX Report", cls: "text-emerald-700 dark:text-emerald-300" },
  axe: { label: "Automated finding · axe-core", cls: "text-violet-700 dark:text-violet-300" },
  tls: { label: "Measured · certificate check", cls: "text-emerald-700 dark:text-emerald-300" },
  links: { label: "Measured · link check", cls: "text-emerald-700 dark:text-emerald-300" },
  ai: { label: "AI ANALYSIS", cls: "text-fuchsia-700 dark:text-fuchsia-300 font-semibold" },
};
export const SourceTag = ({ s }: { s: Source }) => <span className={cn("text-[11px]", SRC[s].cls)}>{SRC[s].label}</span>;

export const scoreTone = (v: number | null) => (v === null ? "text-subtle" : v >= 80 ? "text-emerald-600 dark:text-emerald-400" : v >= 60 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400");
const barTone = (v: number | null) => (v === null ? "bg-line" : v >= 80 ? "bg-emerald-500" : v >= 60 ? "bg-amber-500" : "bg-red-500");

export function ScoreCard({ k, cell, onClick }: { k: ScoreKey; cell: ScoreCell; onClick?: () => void }) {
  return (
    <button onClick={onClick} title={cell.basis} className="group rounded-2xl border border-line bg-surface p-4 text-left transition hover:-translate-y-px hover:border-line-strong hover:shadow-md">
      <div className="text-[12px] font-medium text-muted">{SCORE_LABEL[k]}</div>
      <div className={cn("mt-1.5 text-[28px] font-semibold tabular-nums leading-none tracking-tight", scoreTone(cell.score))}>{cell.score ?? "—"}<span className="text-[13px] font-medium text-subtle">{cell.score !== null ? "/100" : ""}</span></div>
      <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-surface-2"><div className={cn("h-full rounded-full transition-all duration-700", barTone(cell.score))} style={{ width: `${cell.score ?? 0}%` }} /></div>
      <div className="mt-2 line-clamp-2 text-[11px] leading-snug text-subtle">{cell.score === null ? "Not measured" : `${cell.findings} finding${cell.findings === 1 ? "" : "s"} · ${cell.basis}`}</div>
    </button>
  );
}

export function BigScore({ value, label, sub, tone }: { value: number | null; label: string; sub?: string; tone?: string }) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-wider text-subtle">{label}</div>
      <div className={cn("mt-1 text-[40px] font-semibold leading-none tracking-tight tabular-nums", tone ?? scoreTone(value))}>{value ?? "—"}<span className="text-[16px] text-subtle">{value !== null ? "/100" : ""}</span></div>
      {sub && <div className="mt-1 text-[12px] text-muted">{sub}</div>}
    </div>
  );
}

const CAT_LABEL: Record<string, string> = { ...SCORE_LABEL, vitals: "Core Web Vitals", localSeo: "Local SEO", images: "Images", fonts: "Fonts", javascript: "JavaScript", css: "CSS", forms: "Forms", ecommerce: "E-commerce", business: "Business" };
export const catLabel = (c: string) => CAT_LABEL[c] ?? c;

const pathOf = (u: string) => { try { return new URL(u).pathname || "/"; } catch { return u; } };

export function FindingCard({ f, shots, compact }: { f: Finding; shots: Record<string, string>; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const shot = f.screenshot ? shots[f.screenshot] : undefined;
  const hasEvidence = !!shot || !!f.samples?.length;
  return (
    <div className={cn("rounded-2xl border border-line bg-surface", f.severity === "critical" && "border-red-300 dark:border-red-900")}>
      <div className="p-4">
        <div className="flex flex-wrap items-center gap-2">
          <SevBadge s={f.severity} />
          <h4 className="min-w-0 flex-1 text-[14px] font-semibold leading-snug">{f.title}</h4>
        </div>
        <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11.5px] text-subtle">
          <span>Category: <span className="text-muted">{catLabel(f.category)}</span></span>
          {f.pages.length > 0 && <span>Page: <span className="text-muted">{f.pages.slice(0, 3).map(pathOf).join(", ")}{f.pages.length > 3 ? ` +${f.pages.length - 3}` : ""}</span></span>}
          <SourceTag s={f.source} />
          {f.effort === "quick" && f.severity !== "info" && <span className="text-emerald-700 dark:text-emerald-400">Quick win</span>}
        </div>
        <dl className={cn("mt-3 grid gap-3 text-[13px] leading-relaxed", !compact && "sm:grid-cols-3")}>
          <div><dt className="text-[11px] font-semibold uppercase tracking-wide text-subtle">Evidence</dt><dd className="mt-0.5 break-words">{f.evidence}</dd></div>
          <div><dt className="text-[11px] font-semibold uppercase tracking-wide text-subtle">Impact</dt><dd className="mt-0.5 text-muted">{f.impact}</dd></div>
          <div><dt className="text-[11px] font-semibold uppercase tracking-wide text-subtle">Recommendation</dt><dd className="mt-0.5">{f.recommendation}</dd></div>
        </dl>
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {f.affects.length > 0 && <span className="text-[11px] text-subtle">Potential impact:</span>}
          {f.affects.map((a) => <span key={a} className="rounded-md bg-surface-2 px-1.5 py-0.5 text-[11px] text-muted ring-1 ring-inset ring-line">{SCORE_LABEL[a]}</span>)}
          {hasEvidence && (
            <button onClick={() => setOpen(true)} className="no-print ml-auto inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[12px] font-medium text-accent hover:bg-accent-soft">
              <Eye size={13} /> View evidence
            </button>
          )}
        </div>
      </div>
      <Modal open={open} onClose={() => setOpen(false)} wide title={f.title}>
        <div className="space-y-4">
          {shot && <img src={shot} alt={`Screenshot: ${f.title}`} className="w-full rounded-xl border border-line" />}
          {f.samples?.length ? (
            <div>
              <div className="mb-1.5 text-[12px] font-semibold text-muted">Details</div>
              <ul className="space-y-1 text-[12.5px]">{f.samples.map((s) => <li key={s} className="break-all rounded-lg bg-surface-2 px-3 py-1.5 font-mono text-[11.5px]">{s}</li>)}</ul>
            </div>
          ) : null}
          <div className="text-[12px] text-subtle">Source: <SourceTag s={f.source} /></div>
        </div>
      </Modal>
    </div>
  );
}

export function FindingList({ items, shots, empty = "No issues found in this area.", limit }: { items: Finding[]; shots: Record<string, string>; empty?: string; limit?: number }) {
  const [all, setAll] = useState(false);
  if (!items.length) return <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-[13px] text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"><Check size={14} /> {empty}</div>;
  const shown = limit && !all ? items.slice(0, limit) : items;
  return (
    <div className="space-y-3">
      {shown.map((f) => <FindingCard key={f.id} f={f} shots={shots} />)}
      {limit && items.length > limit && !all && <button onClick={() => setAll(true)} className="no-print inline-flex items-center gap-1 text-[13px] font-medium text-accent"><ChevronDown size={14} /> Show {items.length - limit} more</button>}
    </div>
  );
}

export function Section({ n, id, title, sub, children, action }: { n: number; id: string; title: string; sub?: React.ReactNode; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 break-inside-avoid-page">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2 border-b border-line pb-3">
        <div>
          <div className="font-mono text-[11px] font-semibold text-accent">{String(n).padStart(2, "0")}</div>
          <h2 className="text-[20px] font-semibold tracking-tight">{title}</h2>
          {sub && <p className="mt-0.5 text-[13px] text-muted">{sub}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function StageList({ stages, compact }: { stages: Record<StageId, StageState>; compact?: boolean }) {
  return (
    <ol className={cn("space-y-1", compact && "space-y-0.5")}>
      {STAGES.map((s) => {
        const st = stages[s.id];
        return (
          <li key={s.id} className={cn("flex items-start gap-3 rounded-xl px-3 py-2 transition", st.status === "running" && "bg-accent-soft")}>
            <span className="mt-0.5">
              {st.status === "done" ? <Check size={16} className="text-emerald-500" /> : st.status === "running" ? <Loader2 size={16} className="animate-spin text-accent" /> : st.status === "failed" ? <X size={16} className="text-red-500" /> : st.status === "skipped" ? <Minus size={16} className="text-subtle" /> : <CircleDashed size={16} className="text-line-strong" />}
            </span>
            <div className="min-w-0 flex-1">
              <div className={cn("text-[13.5px] font-medium", st.status === "pending" && "text-subtle")}>{s.label}</div>
              {st.detail && <div className="truncate text-[12px] text-muted">{st.detail}</div>}
              {st.progress && st.status === "running" && <div className="mt-1.5 max-w-xs"><Progress value={(st.progress.done / Math.max(1, st.progress.total)) * 100} tone="accent" /><div className="mt-0.5 text-[11px] tabular-nums text-subtle">{st.progress.done} / {st.progress.total} pages</div></div>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function Shot({ src, alt, className }: { src?: string; alt: string; className?: string }) {
  const [open, setOpen] = useState(false);
  if (!src) return null;
  return (
    <>
      <button onClick={() => setOpen(true)} className={cn("block overflow-hidden rounded-xl border border-line bg-surface-2 transition hover:border-line-strong", className)}>
        <img src={src} alt={alt} className="h-full w-full object-cover object-top" />
      </button>
      <Modal open={open} onClose={() => setOpen(false)} wide title={alt}><img src={src} alt={alt} className="w-full rounded-xl border border-line" /></Modal>
    </>
  );
}

export function Pill({ ok, children }: { ok: boolean | null; children: React.ReactNode }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[12.5px] ring-1 ring-inset", ok === null ? "bg-surface-2 text-muted ring-line" : ok ? "bg-emerald-50 text-emerald-800 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900" : "bg-red-50 text-red-700 ring-red-200 dark:bg-red-950/40 dark:text-red-300 dark:ring-red-900")}>
      {ok === null ? <Minus size={12} /> : ok ? <Check size={12} /> : <X size={12} />}{children}
    </span>
  );
}
