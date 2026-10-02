"use client";
/* eslint-disable @next/next/no-img-element -- screenshots are inline data URLs */
import React, { use, useMemo, useState } from "react";
import { Printer } from "lucide-react";
import { useDB } from "@/lib/store";
import { businessName, useAuditRecord } from "@/lib/audit/client";
import { computeRecord, SCORE_KEYS, SCORE_LABEL } from "@/lib/audit/engine/report";
import type { Finding } from "@/lib/audit/types";
import { moneyFor } from "@/lib/leadfinder/markets";

const priority = (f: Finding) => (f.severity === "critical" || f.severity === "high" ? "High" : f.severity === "medium" ? "Medium" : "Low");
const tone = (v: number | null) => (v === null ? "#9ca3af" : v >= 80 ? "#059669" : v >= 60 ? "#d97706" : "#dc2626");

export default function ClientReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { rec, error } = useAuditRecord(id);
  const { db, ready } = useDB();
  const [opts, setOpts] = useState({ scores: true, shots: true, service: false });
  const data = useMemo(() => (rec ? computeRecord(rec, db.services) : null), [rec, db.services]);
  if (error) return <div className="p-10 text-center text-[14px] text-neutral-500">{error}</div>;
  if (!rec || !data || !ready) return <div className="p-10 text-center text-[14px] text-neutral-500">Preparing report…</div>;
  const r = data.result;
  const s = db.settings;
  const shots = rec.raw.screenshots;
  const desk = rec.raw.browser.find((b) => b.viewport === "desktop" && b.screenshot);
  const mob = rec.raw.browser.find((b) => b.viewport === "mobile" && b.screenshot);
  const opportunities = r.issues.filter((i) => i.severity !== "info" && i.source !== "ai").slice(0, 8);
  const improvements = [...r.highImpact, ...r.quickWins].filter((f, i, a) => a.findIndex((x) => x.id === f.id) === i).slice(0, 12);
  const name = businessName(rec.raw);
  // Prices are shown in the lead's currency; with no saved rate a foreign client sees no price rather than rupees.
  const money = moneyFor(rec.country, db.finder.fx);
  const price = (n: number) => (money.needsRate ? "" : ` — from ${money.fmt(n)}`);
  const date = new Date(rec.createdAt).toLocaleDateString("en-GB", { dateStyle: "long" });

  return (
    <div className="min-h-screen bg-white text-neutral-900">
      <div className="no-print sticky top-0 z-10 flex flex-wrap items-center gap-4 border-b border-neutral-200 bg-white/90 px-6 py-3 text-[13px] backdrop-blur">
        <span className="font-medium">Client report options:</span>
        {([["scores", "Show scores"], ["shots", "Include screenshots"], ["service", "Include recommended service & price"]] as const).map(([k, l]) => (
          <label key={k} className="flex items-center gap-1.5"><input type="checkbox" checked={opts[k]} onChange={(e) => setOpts({ ...opts, [k]: e.target.checked })} /> {l}</label>
        ))}
        <button onClick={() => window.print()} className="ml-auto inline-flex items-center gap-2 rounded-xl bg-neutral-900 px-3.5 py-2 font-medium text-white"><Printer size={14} /> Print / Save PDF</button>
      </div>

      <main className="mx-auto max-w-4xl space-y-10 px-8 py-12 text-[13.5px] leading-relaxed">
        <header className="border-b border-neutral-200 pb-8">
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-500">Website audit</div>
          <h1 className="mt-2 text-[34px] font-semibold tracking-tight">{name}</h1>
          <div className="text-[15px] text-neutral-600">{rec.domain}</div>
          <div className="mt-4 text-[12.5px] text-neutral-500">Prepared by {s.studio || "Arkria"}{s.owner ? ` · ${s.owner}` : ""} · {date}</div>
        </header>

        <section>
          <h2 className="mb-3 text-[18px] font-semibold">Website overview</h2>
          <table className="w-full border-collapse text-[13px]"><tbody>
            {[["Website", rec.domain], ["Pages reviewed", String(r.pagesAnalyzed.length)], ["Platform", [r.overview.CMS, r.overview.Framework].filter((x) => x && x !== "None detected").join(", ") || "Not identified"], ["Secure connection (SSL)", r.overview.SSL], ["Mobile experience", r.mobileRating]].map(([k, v]) => (
              <tr key={k} className="border-b border-neutral-100"><td className="w-56 py-2 text-neutral-500">{k}</td><td className="py-2">{v}</td></tr>
            ))}
          </tbody></table>
        </section>

        {opts.scores && (
          <section>
            <h2 className="mb-3 text-[18px] font-semibold">Scores</h2>
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
              <div className="rounded-xl border border-neutral-200 p-3"><div className="text-[11px] text-neutral-500">Overall</div><div className="text-[24px] font-semibold" style={{ color: tone(r.overallScore) }}>{r.overallScore ?? "—"}</div></div>
              {SCORE_KEYS.filter((k) => r.scores[k].score !== null).map((k) => <div key={k} className="rounded-xl border border-neutral-200 p-3"><div className="text-[11px] text-neutral-500">{SCORE_LABEL[k]}</div><div className="text-[24px] font-semibold" style={{ color: tone(r.scores[k].score) }}>{r.scores[k].score}</div></div>)}
            </div>
            <p className="mt-2 text-[11.5px] text-neutral-500">Scores reflect the specific findings below. Areas we could not measure are omitted.</p>
          </section>
        )}

        <section>
          <h2 className="mb-3 text-[18px] font-semibold">What&apos;s working well</h2>
          <ul className="list-disc space-y-1 pl-5">{(r.strengths.slice(0, 8).map((x) => x.text)).map((x) => <li key={x}>{x}</li>)}{!r.strengths.length && <li>We&apos;ll review strengths together.</li>}</ul>
        </section>

        <section>
          <h2 className="mb-3 text-[18px] font-semibold">Key opportunities</h2>
          <div className="space-y-4">
            {opportunities.map((f, i) => (
              <div key={f.id} className="break-inside-avoid rounded-xl border border-neutral-200 p-4">
                <div className="flex items-baseline justify-between gap-3"><h3 className="text-[14.5px] font-semibold">{i + 1}. {f.title}</h3><span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: priority(f) === "High" ? "#dc2626" : priority(f) === "Medium" ? "#d97706" : "#6b7280" }}>{priority(f)} priority</span></div>
                <p className="mt-1.5"><span className="font-medium">What we observed: </span>{f.evidence}</p>
                <p className="mt-1 text-neutral-600"><span className="font-medium text-neutral-900">Why it matters: </span>{f.impact}</p>
                <p className="mt-1"><span className="font-medium">How to improve: </span>{f.recommendation}</p>
                {opts.shots && f.screenshot && shots[f.screenshot] && <img src={shots[f.screenshot]} alt="" className="mt-3 max-h-80 rounded-lg border border-neutral-200" />}
              </div>
            ))}
          </div>
        </section>

        {opts.shots && (desk || mob) && (
          <section className="break-inside-avoid">
            <h2 className="mb-3 text-[18px] font-semibold">Visual evidence</h2>
            <div className="flex gap-4">
              {desk?.screenshot && shots[desk.screenshot] && <figure className="flex-[3]"><img src={shots[desk.screenshot]} alt="Desktop" className="rounded-lg border border-neutral-200" /><figcaption className="mt-1 text-[11px] text-neutral-500">Desktop, first screen</figcaption></figure>}
              {mob?.screenshot && shots[mob.screenshot] && <figure className="flex-1"><img src={shots[mob.screenshot]} alt="Mobile" className="rounded-lg border border-neutral-200" /><figcaption className="mt-1 text-[11px] text-neutral-500">Mobile, first screen</figcaption></figure>}
            </div>
          </section>
        )}

        <section>
          <h2 className="mb-3 text-[18px] font-semibold">Recommended improvements</h2>
          <table className="w-full border-collapse text-[12.5px]">
            <thead><tr className="border-b border-neutral-300 text-left text-neutral-500"><th className="py-2 pr-3 font-medium">Improvement</th><th className="py-2 pr-3 font-medium">Priority</th><th className="py-2 font-medium">Effort</th></tr></thead>
            <tbody>{improvements.map((f) => <tr key={f.id} className="border-b border-neutral-100 align-top"><td className="py-2 pr-3">{f.recommendation}</td><td className="py-2 pr-3">{priority(f)}</td><td className="py-2">{f.effort === "quick" ? "Quick fix" : "Project"}</td></tr>)}</tbody>
          </table>
        </section>

        {opts.service && r.opportunity.recommended && (
          <section className="break-inside-avoid rounded-xl border border-neutral-200 p-5">
            <h2 className="text-[18px] font-semibold">Recommended solution</h2>
            <div className="mt-1 text-[16px] font-semibold">{r.opportunity.recommended.name}{price(r.opportunity.recommended.price)}</div>
            <p className="mt-1 text-neutral-600">{db.services.find((x) => x.id === r.opportunity.recommended!.serviceId)?.clientFacing}</p>
            <p className="mt-2 text-[12px] text-neutral-500">Addresses: {r.opportunity.improvementAreas.join(", ")}.</p>
          </section>
        )}

        <section className="break-inside-avoid">
          <h2 className="mb-3 text-[18px] font-semibold">Suggested next steps</h2>
          <ol className="list-decimal space-y-1 pl-5">
            <li>Fix the high-priority items above — several are quick changes.</li>
            <li>Agree on the larger improvements and their order of priority.</li>
            <li>Book a 20-minute walkthrough of this audit with {s.studio || "our team"}.</li>
          </ol>
          <p className="mt-4 text-neutral-600">{[s.owner, s.studio, s.phone, s.email, s.website].filter(Boolean).join(" · ")}</p>
        </section>

        <footer className="border-t border-neutral-200 pt-4 text-[11px] text-neutral-500">
          This audit reviewed publicly accessible pages only. Findings are based on automated checks of what was observable on {date}; automated accessibility checks cannot confirm full compliance. No business outcomes are guaranteed.
        </footer>
      </main>
    </div>
  );
}
