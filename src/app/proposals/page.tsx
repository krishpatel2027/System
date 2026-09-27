"use client";
import React, { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useDB } from "@/lib/store";
import { inr, uid, todayISO, quoteTotals } from "@/lib/utils";
import { proposalTone } from "@/lib/stages";
import { Badge, Btn, Empty, Modal, Field, inputCls, PageHeader, Tabs, Avatar } from "@/components/ui";
import { Plus, Presentation, ArrowUpRight, Trash2 } from "lucide-react";
import type { Proposal } from "@/lib/types";

type Draft = Omit<Proposal, "approach" | "sitemap" | "deliverables"> & { approach: string; sitemap: string; deliverables: string };
const FILTERS = ["all", "draft", "sent", "accepted", "rejected"] as const;

const split = (s: string, sep: RegExp) => s.split(sep).map((x) => x.trim()).filter(Boolean);
const toDraft = (p: Proposal): Draft => ({ ...p, approach: p.approach.join(", "), sitemap: p.sitemap.join(", "), deliverables: p.deliverables.join("\n") });
const fromDraft = (d: Draft): Proposal => ({ ...d, approach: split(d.approach, /,/), sitemap: split(d.sitemap, /,/), deliverables: split(d.deliverables, /\n/) });

function ProposalsInner() {
  const { db, ready, update } = useDB();
  const router = useRouter();
  const params = useSearchParams();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");
  const [draft, setDraft] = useState<Draft | null>(null);
  const handled = useRef(false);
  const editing = !!draft && db.proposals.some((p) => p.id === draft.id);

  const blank = (): Draft => ({
    id: uid("pr"), clientName: "", title: "Website proposal", understanding: "", opportunity: "",
    approach: "Discover, Design, Build, Launch", solution: "", sitemap: "", designDirection: "", deliverables: "", timeline: "",
    investment: 0, paymentPlan: [{ label: "To begin", pct: 50 }, { label: "Development milestone", pct: 30 }, { label: "Launch", pct: 20 }],
    terms: "Two revision rounds per stage are included. Content is provided by the client. Hosting, domains and third-party services are billed separately.",
    status: "draft", created: todayISO(),
  });

  useEffect(() => {
    if (!ready || handled.current) return;
    handled.current = true;
    /* eslint-disable react-hooks/set-state-in-effect -- one-time deep-link handling once data is loaded */
    const existing = db.proposals.find((p) => p.id === params.get("edit"));
    if (existing) setDraft(toDraft(existing));
    else if (params.get("action") === "new") setDraft(blank());
    /* eslint-enable react-hooks/set-state-in-effect */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  const set = (p: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...p } : d));
  const close = () => { setDraft(null); if (params.toString()) router.replace("/proposals"); };
  const clientQuotes = draft ? db.quotes.filter((q) => q.clientName === draft.clientName) : [];
  const fromQuote = (id: string) => {
    const q = db.quotes.find((x) => x.id === id);
    if (q) set({ investment: Math.round(quoteTotals(q).taxable), deliverables: q.items.map((i) => i.label).join("\n") });
  };

  const save = () => {
    if (!draft) return;
    if (!draft.clientName.trim() || !draft.title.trim()) return alert("Add a client and a title.");
    const p = fromDraft({ ...draft, clientName: draft.clientName.trim(), clientId: db.clients.find((c) => c.company === draft.clientName.trim())?.id });
    update("proposals", editing ? db.proposals.map((x) => (x.id === p.id ? p : x)) : [p, ...db.proposals]);
    setDraft(null);
    router.push(`/proposals/${p.id}`);
  };

  const list = db.proposals.filter((p) => filter === "all" || p.status === filter);
  const planTotal = draft?.paymentPlan.reduce((a, x) => a + x.pct, 0) ?? 100;

  return (
    <div className="space-y-6">
      <PageHeader title="Proposals" description="A story your client can say yes to — shareable as a link or a PDF."
        actions={<Btn onClick={() => setDraft(blank())}><Plus size={15} /> New proposal</Btn>} />

      {db.proposals.length === 0 ? (
        <Empty icon={<Presentation size={18} />} title="No proposals yet" sub="Turn a discovery call into a clear proposal: what you understood, what you'll build, and what it costs." action={<Btn onClick={() => setDraft(blank())}><Plus size={15} /> New proposal</Btn>} />
      ) : (
        <>
          <Tabs value={filter} onChange={setFilter} tabs={FILTERS} />
          <div className="overflow-hidden rounded-2xl border border-line bg-surface">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-[13px]">
                <thead><tr className="border-b border-line bg-surface-2/60 text-left text-[12px] text-muted">
                  <th className="px-4 py-2.5 font-medium">Client</th><th className="px-4 py-2.5 font-medium">Title</th><th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 font-medium">Created</th><th className="px-4 py-2.5 text-right font-medium">Investment</th><th className="w-10" />
                </tr></thead>
                <tbody className="divide-y divide-line">
                  {list.map((p) => (
                    <tr key={p.id} onClick={() => router.push(`/proposals/${p.id}`)} className="group cursor-pointer hover:bg-surface-2/60">
                      <td className="px-4 py-3"><div className="flex items-center gap-3"><Avatar name={p.clientName} className="h-8 w-8 text-[11px]" /><span className="font-medium">{p.clientName}</span></div></td>
                      <td className="px-4 py-3 text-muted">{p.title}</td>
                      <td className="px-4 py-3"><Badge tone={proposalTone(p.status)} dot>{p.status}</Badge></td>
                      <td className="px-4 py-3 text-muted">{p.created}</td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums">{inr(p.investment)}</td>
                      <td className="px-3 py-3 text-subtle"><ArrowUpRight size={15} className="opacity-0 transition group-hover:opacity-100" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {list.length === 0 && <div className="px-4 py-10 text-center text-[13px] text-muted">No {filter} proposals.</div>}
          </div>
        </>
      )}

      <Modal open={!!draft} onClose={close} title={editing ? "Edit proposal" : "New proposal"} wide
        footer={<><Btn variant="ghost" onClick={close}>Cancel</Btn><Btn onClick={save}>{editing ? "Save changes" : "Create proposal"}</Btn></>}>
        {draft && (
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Client">
                <input list="prop-clients" autoFocus className={inputCls} value={draft.clientName} onChange={(e) => set({ clientName: e.target.value })} placeholder="Client name" />
                <datalist id="prop-clients">{[...new Set([...db.clients.map((c) => c.company), ...db.leads.map((l) => l.company)])].map((n) => <option key={n} value={n} />)}</datalist>
              </Field>
              <Field label="Title"><input className={inputCls} value={draft.title} onChange={(e) => set({ title: e.target.value })} /></Field>
            </div>
            {clientQuotes.length > 0 && (
              <Field label="Start from a quote (optional)" hint="Copies the quote's deliverables and pre-GST total">
                <select className={inputCls} defaultValue="" onChange={(e) => fromQuote(e.target.value)}>
                  <option value="">—</option>{clientQuotes.map((q) => <option key={q.id} value={q.id}>{q.no} · {inr(quoteTotals(q).taxable)}</option>)}
                </select>
              </Field>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Our understanding" hint="Their situation, in your words"><textarea rows={3} className={inputCls} value={draft.understanding} onChange={(e) => set({ understanding: e.target.value })} /></Field>
              <Field label="The opportunity" hint="What changes for them if this goes well"><textarea rows={3} className={inputCls} value={draft.opportunity} onChange={(e) => set({ opportunity: e.target.value })} /></Field>
              <Field label="Proposed solution"><textarea rows={3} className={inputCls} value={draft.solution} onChange={(e) => set({ solution: e.target.value })} /></Field>
              <Field label="Design direction"><textarea rows={3} className={inputCls} value={draft.designDirection} onChange={(e) => set({ designDirection: e.target.value })} /></Field>
              <Field label="Approach" hint="Steps, separated by commas"><input className={inputCls} value={draft.approach} onChange={(e) => set({ approach: e.target.value })} /></Field>
              <Field label="Sitemap" hint="Pages, separated by commas"><input className={inputCls} value={draft.sitemap} onChange={(e) => set({ sitemap: e.target.value })} placeholder="Home, About, Services, Contact" /></Field>
              <Field label="Deliverables" hint="One per line"><textarea rows={4} className={inputCls} value={draft.deliverables} onChange={(e) => set({ deliverables: e.target.value })} /></Field>
              <Field label="Timeline"><textarea rows={4} className={inputCls} value={draft.timeline} onChange={(e) => set({ timeline: e.target.value })} placeholder="Week 1 discovery · Week 2 design · …" /></Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-[200px_1fr]">
              <Field label="Investment (₹, before GST)"><input type="number" min={0} className={inputCls} value={draft.investment || ""} onChange={(e) => set({ investment: Number(e.target.value) })} /></Field>
              <div>
                <div className="mb-1.5 flex items-center justify-between text-[12.5px] font-medium text-muted">
                  <span>Payment plan</span><span className={planTotal === 100 ? "text-subtle" : "text-amber-600"}>{planTotal}%</span>
                </div>
                <div className="space-y-2">
                  {draft.paymentPlan.map((x, i) => (
                    <div key={i} className="grid grid-cols-[1fr_80px_32px] gap-2">
                      <input className={inputCls} value={x.label} onChange={(e) => set({ paymentPlan: draft.paymentPlan.map((y, j) => (j === i ? { ...y, label: e.target.value } : y)) })} />
                      <input type="number" min={0} max={100} className={inputCls} value={x.pct} onChange={(e) => set({ paymentPlan: draft.paymentPlan.map((y, j) => (j === i ? { ...y, pct: Number(e.target.value) } : y)) })} />
                      <button aria-label="Remove" className="flex h-9 w-8 items-center justify-center rounded-lg text-subtle hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950" onClick={() => set({ paymentPlan: draft.paymentPlan.filter((_, j) => j !== i) })}><Trash2 size={13} /></button>
                    </div>
                  ))}
                </div>
                <button className="mt-2 text-[13px] font-medium text-accent hover:underline" onClick={() => set({ paymentPlan: [...draft.paymentPlan, { label: "", pct: 0 }] })}>+ Add instalment</button>
              </div>
            </div>
            <Field label="Terms & next steps"><textarea rows={3} className={inputCls} value={draft.terms} onChange={(e) => set({ terms: e.target.value })} /></Field>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default function ProposalsPage() {
  return <Suspense><ProposalsInner /></Suspense>;
}
