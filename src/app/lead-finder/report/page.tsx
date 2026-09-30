"use client";
import React, { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Printer } from "lucide-react";
import { useDB } from "@/lib/store";
import type { Prospect } from "@/lib/types";
import { SIGNALS, PART_LABELS } from "@/lib/leadfinder/catalog";
import { miniAudit } from "@/lib/leadfinder/outreach";
import { inr } from "@/lib/utils";
import { SOURCE_LABEL } from "@/components/leadfinder";

const fact = (p: Prospect, key: string, v?: string | number) =>
  v === undefined || v === "" ? "Not found" : `${v}${p.provenance[key] ? ` (${p.provenance[key].confidence}, ${SOURCE_LABEL[p.provenance[key].source]})` : ""}`;

function One({ p }: { p: Prospect }) {
  const { db } = useDB();
  const cfg = db.finder.scoring;
  return (
    <article className="break-after-page space-y-6">
      <header className="flex items-start justify-between gap-6 border-b border-neutral-200 pb-5">
        <div>
          <div className="text-[11px] uppercase tracking-widest text-neutral-500">{db.settings.studio} · Lead report</div>
          <h1 className="mt-1 text-[26px] font-semibold tracking-tight">{p.name}</h1>
          <div className="text-[13px] text-neutral-600">{[p.industry || p.category, p.area, p.city].filter(Boolean).join(" · ")}</div>
        </div>
        <div className="text-right">
          <div className="text-[40px] font-semibold leading-none tabular-nums">{p.score?.total ?? "–"}</div>
          <div className="text-[11px] text-neutral-500">Arkria Opportunity Score</div>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-6 text-[12.5px]">
        <div>
          <h2 className="mb-2 text-[13px] font-semibold">Business</h2>
          <dl className="space-y-1">
            {([["Phone", fact(p, "phone", p.phone)], ["Email", fact(p, "email", p.email)], ["WhatsApp", fact(p, "whatsapp", p.whatsapp)], ["Website", fact(p, "website", p.website)], ["Address", fact(p, "address", p.address)], ["Google", p.rating !== undefined ? `${p.rating.toFixed(1)}★ · ${p.reviewCount ?? 0} reviews` : "Not found"], ["Decision maker", p.decisionMaker ? `${p.decisionMaker.name}${p.decisionMaker.role ? `, ${p.decisionMaker.role}` : ""} (${p.decisionMaker.source})` : "Not found"]] as const).map(([k, v]) => (
              <div key={k} className="grid grid-cols-[110px_1fr] gap-2"><dt className="text-neutral-500">{k}</dt><dd className="break-words">{v}</dd></div>
            ))}
          </dl>
        </div>
        {p.score && (
          <div>
            <h2 className="mb-2 text-[13px] font-semibold">Score breakdown</h2>
            <dl className="space-y-1">
              {(Object.keys(PART_LABELS) as (keyof typeof PART_LABELS)[]).map((k) => (
                <div key={k} className="flex justify-between"><dt className="text-neutral-500">{PART_LABELS[k]}</dt><dd className="tabular-nums">{p.score!.parts[k]} / {cfg.weights[k]}</dd></div>
              ))}
            </dl>
          </div>
        )}
      </section>

      <section className="text-[12.5px]">
        <h2 className="mb-2 text-[13px] font-semibold">Evidence</h2>
        <ul className="list-disc space-y-1 pl-5">{p.signals.map((s) => <li key={s}><span className="font-medium">{SIGNALS[s].label}:</span> {p.evidence[s]}</li>)}</ul>
      </section>

      {p.match && (
        <section className="rounded-lg border border-neutral-200 p-4 text-[12.5px]">
          <h2 className="text-[13px] font-semibold">Recommended: {p.match.serviceName}</h2>
          <div className="mt-1 text-neutral-600">Estimated value {inr(p.match.price)} · {p.match.hours} hrs · margin {inr(p.match.price - p.match.cost)}</div>
          <ul className="mt-2 list-disc space-y-0.5 pl-5">{p.match.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
        </section>
      )}

      {p.audit?.ok && p.audit.findings.length > 0 && (
        <section className="text-[12.5px]">
          <h2 className="mb-2 text-[13px] font-semibold">Website findings</h2>
          <table className="w-full border-collapse">
            <thead><tr className="border-b border-neutral-200 text-left text-neutral-500"><th className="py-1 pr-3 font-medium">Issue</th><th className="py-1 pr-3 font-medium">Evidence</th><th className="py-1 font-medium">Improvement</th></tr></thead>
            <tbody>{p.audit.findings.map((f) => <tr key={f.id} className="border-b border-neutral-100 align-top"><td className="py-1.5 pr-3 font-medium">{f.issue}</td><td className="py-1.5 pr-3">{f.evidence}</td><td className="py-1.5">{f.improvement}</td></tr>)}</tbody>
          </table>
        </section>
      )}

      <section className="text-[12.5px]">
        <h2 className="mb-2 text-[13px] font-semibold">Mini audit</h2>
        <pre className="whitespace-pre-wrap rounded-lg bg-neutral-50 p-3 font-sans">{miniAudit(p)}</pre>
      </section>
      <footer className="text-[10.5px] text-neutral-400">Sources: {p.sources.map((s) => SOURCE_LABEL[s]).join(", ")}. The Opportunity Score is Arkria&apos;s internal prioritisation, not an objective rating. Values are estimates, not quotes.</footer>
    </article>
  );
}

function Report() {
  const { db, ready } = useDB();
  const params = useSearchParams();
  if (!ready) return null;
  const id = params.get("id");
  const ids = params.get("ids")?.split(",") ?? [];
  const single = id ? db.prospects.find((p) => p.id === id) : undefined;
  const list = id ? [] : params.get("all") ? [...db.prospects].sort((a, b) => (b.score?.total ?? 0) - (a.score?.total ?? 0)) : db.prospects.filter((p) => ids.includes(p.id));

  return (
    <div className="min-h-screen bg-white text-neutral-900">
      <div className="no-print sticky top-0 flex items-center justify-between border-b border-neutral-200 bg-white/90 px-6 py-3 backdrop-blur">
        <div className="text-[13px] text-neutral-500">Use “Save as PDF” in the print dialog.</div>
        <button onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-xl bg-neutral-900 px-3.5 py-2 text-[13px] font-medium text-white"><Printer size={14} /> Print / Save PDF</button>
      </div>
      <main className="mx-auto max-w-4xl px-8 py-10">
        {single ? <One p={single} /> : list.length ? (
          <>
            <h1 className="text-[24px] font-semibold tracking-tight">{db.settings.studio} · Lead list</h1>
            <p className="mb-5 text-[12.5px] text-neutral-500">{list.length} businesses · {new Date().toLocaleDateString("en-IN", { dateStyle: "long" })} · potential pipeline value (not guaranteed revenue): {inr(list.reduce((a, p) => a + (p.match?.price ?? 0), 0))}</p>
            <table className="w-full border-collapse text-[11.5px]">
              <thead><tr className="border-b border-neutral-300 text-left text-neutral-500"><th className="py-1.5 pr-2 font-medium">Score</th><th className="py-1.5 pr-2 font-medium">Business</th><th className="py-1.5 pr-2 font-medium">Contact</th><th className="py-1.5 pr-2 font-medium">Website</th><th className="py-1.5 pr-2 font-medium">Recommended</th><th className="py-1.5 text-right font-medium">Value</th></tr></thead>
              <tbody>
                {list.map((p) => (
                  <tr key={p.id} className="border-b border-neutral-100 align-top">
                    <td className="py-1.5 pr-2 font-semibold tabular-nums">{p.score?.total ?? "–"}</td>
                    <td className="py-1.5 pr-2"><div className="font-medium">{p.name}</div><div className="text-neutral-500">{[p.industry, p.city].filter(Boolean).join(" · ")}</div></td>
                    <td className="py-1.5 pr-2">{[p.phone, p.email].filter(Boolean).join(" · ") || "Not found"}</td>
                    <td className="py-1.5 pr-2">{p.website ? `${p.website.replace(/^https?:\/\//, "")} (${p.websiteStatus})` : "None found"}</td>
                    <td className="py-1.5 pr-2">{p.match?.serviceName ?? "—"}</td>
                    <td className="py-1.5 text-right tabular-nums">{p.match ? inr(p.match.price) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        ) : <div className="text-[14px] text-neutral-500">Nothing to report.</div>}
      </main>
    </div>
  );
}

export default function ReportPage() {
  return <Suspense><Report /></Suspense>;
}
