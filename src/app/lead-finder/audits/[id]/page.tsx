"use client";
import React, { use, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, Copy, FileText, MessageCircle, Printer, Presentation, ScanSearch, Sparkles, Target } from "lucide-react";
import { useDB } from "@/lib/store";
import { businessName, proposalFromAudit, prospectFromAudit, useAuditRecord } from "@/lib/audit/client";
import { computeRecord } from "@/lib/audit/engine/report";
import { salesIntel } from "@/lib/audit/engine/opportunity";
import { buildCtx } from "@/lib/audit/engine/context";
import { lfApi, useFinderStatus, useProspectActions } from "@/lib/leadfinder/client";
import { waLink } from "@/lib/leadfinder/outreach";
import type { Prospect } from "@/lib/types";
import { cn, inr } from "@/lib/utils";
import { Btn, Card, Empty, inputCls, Modal } from "@/components/ui";
import { Report, TOC, biggestOpportunity } from "@/components/audit-report";
import { BigScore } from "@/components/audit";

export default function AuditReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { rec, error } = useAuditRecord(id);
  if (error) return <Empty icon={<ScanSearch size={18} />} title="Audit not available" sub={error} action={<Link href="/lead-finder/audit"><Btn variant="outline">Back to auditor</Btn></Link>} />;
  if (!rec) return <div className="py-20 text-center text-[13px] text-muted">Loading audit…</div>;
  return <ReportView rec={rec} />;
}

function ReportView({ rec }: { rec: NonNullable<ReturnType<typeof useAuditRecord>["rec"]> }) {
  const { db, mutate, userName } = useDB();
  const router = useRouter();
  const actions = useProspectActions();
  const { ai } = useFinderStatus();
  const { result: r, comparison } = useMemo(() => computeRecord(rec, db.services), [rec, db.services]);
  const intel = useMemo(() => salesIntel(buildCtx(rec.raw, rec.industryHint), r, db.settings.studio || "Arkria"), [rec, r, db.settings.studio]);
  const [pitchOpen, setPitchOpen] = useState(false);
  const [added, setAdded] = useState<string | null>(null);
  const big = biggestOpportunity(r);
  const high = r.issues.filter((i) => i.severity === "critical" || i.severity === "high").length;
  const linked = db.prospects.find((p) => p.deepAudit?.id === rec.id || p.id === rec.prospectId);

  const addToLeads = () => {
    const { prospect, existing } = prospectFromAudit(rec, r, db);
    if (existing) mutate((d) => ({ prospects: d.prospects.map((p) => (p.id === prospect.id ? { ...p, deepAudit: prospect.deepAudit } : p)) }));
    else mutate((d) => ({ prospects: [prospect, ...d.prospects] }));
    const lead = actions.toPipeline(prospect as Prospect, userName);
    setAdded(`${prospect.id}|${lead.id}`);
  };
  const createProposal = () => {
    const p = proposalFromAudit(rec, r, db);
    mutate((d) => ({ proposals: [p, ...d.proposals] }));
    router.push(`/proposals?edit=${p.id}`);
  };

  return (
    <div className="space-y-8">
      <div className="no-print flex flex-wrap items-center justify-between gap-2">
        <Link href="/lead-finder/audit" className="inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-ink"><ArrowLeft size={14} /> Auditor</Link>
        <div className="text-[12px] text-subtle">Audited {new Date(rec.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}{rec.createdBy ? ` by ${rec.createdBy}` : ""} · {r.pagesAnalyzed.length} pages</div>
      </div>

      {/* Final experience summary */}
      <Card className="relative overflow-hidden p-6 sm:p-8">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-accent/10 blur-3xl" />
        <div className="relative">
          <div className="text-[12px] font-semibold uppercase tracking-wider text-subtle">Website intelligence report</div>
          <h1 className="mt-1 break-all text-[28px] font-semibold tracking-[-0.02em] sm:text-[32px]">{rec.domain}</h1>
          <div className="text-[13px] text-muted">{businessName(rec.raw)} · {r.business.label} ({r.business.confidence})</div>
          <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <BigScore value={r.overallScore} label="Website health" />
            <div><div className="text-[11px] font-semibold uppercase tracking-wider text-subtle">Biggest issues</div><div className="mt-1 text-[40px] font-semibold leading-none tabular-nums text-red-600 dark:text-red-400">{high}</div><div className="mt-1 text-[12px] text-muted">high-priority issues</div></div>
            <div><div className="text-[11px] font-semibold uppercase tracking-wider text-subtle">Biggest opportunity</div><div className="mt-2 text-[18px] font-semibold leading-snug">{big?.label ?? "—"}</div>{big && <div className="text-[12px] text-muted">scored {big.score}/100</div>}</div>
            <BigScore value={r.opportunity.score} label="Arkria opportunity" tone="text-accent" sub="Match between observed issues and Arkria services" />
          </div>
          <div className="mt-6 grid gap-4 border-t border-line pt-5 lg:grid-cols-[1fr_1fr_1.4fr]">
            <div><div className="text-[11px] font-semibold uppercase tracking-wider text-subtle">Recommended service</div><div className="mt-1 text-[16px] font-semibold">{r.opportunity.recommended?.name ?? "No strong match"}</div>{r.opportunity.recommended && <div className="text-[15px] font-semibold text-accent">{inr(r.opportunity.recommended.price)}</div>}</div>
            <div><div className="text-[11px] font-semibold uppercase tracking-wider text-subtle">Secondary service</div>{r.opportunity.secondary.length ? r.opportunity.secondary.map((s) => <div key={s.serviceId} className="mt-1"><span className="text-[14px] font-semibold">{s.name}</span> <span className="text-[13px] text-accent">{inr(s.price)}</span></div>) : <div className="mt-1 text-[13px] text-muted">—</div>}</div>
            <div><div className="text-[11px] font-semibold uppercase tracking-wider text-subtle">Why</div><ul className="mt-1 space-y-0.5 text-[12.5px]">{r.opportunity.reasons.slice(0, 3).map((x) => <li key={x} className="line-clamp-2">• {x}</li>)}</ul></div>
          </div>
          <div className="no-print mt-6 flex flex-wrap gap-2">
            <Btn variant="outline" onClick={() => document.getElementById("summary")?.scrollIntoView({ behavior: "smooth" })}><FileText size={14} /> View full audit</Btn>
            <Link href={`/lead-finder/audits/${rec.id}/client`} target="_blank"><Btn variant="outline"><Printer size={14} /> Generate client report</Btn></Link>
            <Btn variant="outline" onClick={() => setPitchOpen(true)}><Sparkles size={14} /> Generate personalized pitch</Btn>
            {added || linked?.leadId ? <Link href={`/lead-finder/${added?.split("|")[0] ?? linked!.id}`}><Btn variant="outline"><Check size={14} /> In leads</Btn></Link> : <Btn variant="outline" onClick={addToLeads}><Target size={14} /> Add to leads</Btn>}
            <Btn variant="accent" onClick={createProposal}><Presentation size={14} /> Create proposal</Btn>
            <Btn variant="ghost" onClick={() => window.print()}><Printer size={14} /> Print</Btn>
          </div>
        </div>
      </Card>

      <div className="grid gap-8 xl:grid-cols-[200px_1fr]">
        <nav className="no-print hidden xl:block">
          <div className="sticky top-24 max-h-[calc(100vh-7rem)] space-y-0.5 overflow-y-auto pr-2 text-[12.5px]">
            {TOC.map((t, i) => <a key={t.id} href={`#${t.id}`} className="flex gap-2 rounded-lg px-2 py-1 text-muted hover:bg-surface-2 hover:text-ink"><span className="w-5 shrink-0 font-mono text-[10.5px] text-subtle">{String(i + 1).padStart(2, "0")}</span>{t.title}</a>)}
          </div>
        </nav>
        <div className="min-w-0"><Report r={r} raw={rec.raw} comparison={comparison} intel={intel} onGotoClient={() => window.open(`/lead-finder/audits/${rec.id}/client`, "_blank")} /></div>
      </div>

      <PitchModal open={pitchOpen} onClose={() => setPitchOpen(false)} base={intel.pitch} ai={ai} rec={rec} r={r} phone={linked?.whatsapp ?? linked?.phone ?? rec.raw.pages.flatMap((p) => p.contact.phones)[0]} />
    </div>
  );
}

function PitchModal({ open, onClose, base, ai, rec, r, phone }: { open: boolean; onClose: () => void; base: string; ai: boolean; rec: NonNullable<ReturnType<typeof useAuditRecord>["rec"]>; r: ReturnType<typeof computeRecord>["result"]; phone?: string }) {
  const { db } = useDB();
  const [text, setText] = useState(base);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const personalize = async () => {
    setBusy(true); setErr(null);
    try {
      const top = r.issues.filter((i) => i.severity !== "info").slice(0, 5);
      const prospect = {
        name: businessName(rec.raw), industry: r.business.label, website: rec.url, websiteStatus: (r.overallScore ?? 100) < 45 ? "outdated" : "basic",
        evidence: Object.fromEntries(top.map((i, n) => [`e${n}`, `${i.title}: ${i.evidence}`])), audit: { findings: top.map((i) => ({ issue: i.title, evidence: i.evidence })) },
        match: r.opportunity.recommended ? { serviceName: r.opportunity.recommended.name, price: r.opportunity.recommended.price } : null,
      };
      const res = await lfApi<{ draft: { body: string } }>("ai", { task: "outreach", prospect, channel: "whatsapp", sender: { owner: db.settings.owner, studio: db.settings.studio, website: db.settings.website } });
      setText(res.draft.body);
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  const wa = waLink(phone, text);
  return (
    <Modal open={open} onClose={onClose} wide title="Personalized pitch"
      footer={<>
        {ai && <Btn variant="ghost" disabled={busy} onClick={() => void personalize()}><Sparkles size={13} /> {busy ? "Writing…" : "Personalize with AI"}</Btn>}
        {wa && <a href={wa} target="_blank" rel="noreferrer noopener"><Btn variant="outline"><MessageCircle size={13} /> Open in WhatsApp</Btn></a>}
        <Btn onClick={() => { void navigator.clipboard?.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>{copied ? <Check size={13} /> : <Copy size={13} />} {copied ? "Copied" : "Copy"}</Btn>
      </>}>
      <p className="mb-2 text-[12.5px] text-muted">Built from the audit evidence. Review before sending — nothing is sent automatically.</p>
      <textarea rows={9} className={cn(inputCls, "leading-relaxed")} value={text} onChange={(e) => setText(e.target.value)} />
      {err && <div className="mt-2 text-[12.5px] text-red-600">{err}</div>}
    </Modal>
  );
}
