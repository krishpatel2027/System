"use client";
import React, { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useDB } from "@/lib/store";
import { inr, uid, todayISO, addDaysISO, quoteTotals } from "@/lib/utils";
import { quoteTone } from "@/lib/stages";
import { Badge, Btn, Empty, Modal, Field, inputCls, PageHeader, Tabs, Avatar } from "@/components/ui";
import { Plus, FileText, Trash2, Calculator, Sparkles, ArrowUpRight } from "lucide-react";
import type { Quote, QuoteItem } from "@/lib/types";
import { PENDING_KEY } from "@/app/pricing/_studio";

const FILTERS = ["all", "draft", "sent", "accepted", "closed"] as const;
type Filter = (typeof FILTERS)[number];
const inFilter = (q: Quote, f: Filter) => f === "all" || (f === "closed" ? q.status === "rejected" || q.status === "expired" : q.status === f);

const defaultItems = (): QuoteItem[] => [
  { id: uid("qi"), label: "Website strategy & UI/UX design", qty: 1, price: 8000 },
  { id: uid("qi"), label: "Website development", qty: 1, price: 18000 },
];

type Draft = { editingId: string | null; clientName: string; items: QuoteItem[]; discount: number; tax: number; notes: string; fromPricing: boolean };

// Next number in the PREFIX-YEAR-NNN sequence, based on existing quotes.
function nextQuoteNo(quotes: Quote[], prefix: string) {
  const year = new Date().getFullYear();
  const head = `${prefix || "Q"}-${year}-`;
  const max = quotes.reduce((m, q) => (q.no.startsWith(head) ? Math.max(m, Number(q.no.slice(head.length)) || 0) : m), 0);
  return `${head}${String(max + 1).padStart(3, "0")}`;
}

function QuotesInner() {
  const { db, ready, update } = useDB();
  const router = useRouter();
  const params = useSearchParams();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [draft, setDraft] = useState<Draft | null>(null);
  const handled = useRef(false);
  const s = db.settings;

  const blank = (): Draft => ({ editingId: null, clientName: "", items: defaultItems(), discount: 0, tax: s.defaultGst, notes: s.paymentTerms, fromPricing: false });
  const openDraft = (d: Draft) => { setDraft(d); setOpen(true); };

  // Deep links: ?action=new, ?from=pricing (calculator hand-off), ?edit=<id>.
  useEffect(() => {
    if (!ready || handled.current) return;
    handled.current = true;
    /* eslint-disable react-hooks/set-state-in-effect -- one-time deep-link handling once data is loaded */
    const editId = params.get("edit");
    const existing = editId ? db.quotes.find((q) => q.id === editId) : undefined;
    if (existing) {
      openDraft({ editingId: existing.id, clientName: existing.clientName, items: existing.items, discount: existing.discount, tax: existing.taxPct, notes: existing.notes ?? "", fromPricing: false });
    } else if (params.get("from") === "pricing") {
      try {
        const p = JSON.parse(localStorage.getItem(PENDING_KEY) ?? "null") as { items: QuoteItem[]; discount: number } | null;
        localStorage.removeItem(PENDING_KEY);
        if (p?.items?.length) openDraft({ ...blank(), items: p.items, discount: p.discount ?? 0, fromPricing: true });
      } catch {}
    } else if (params.get("action") === "new") {
      openDraft(blank());
    }
    /* eslint-enable react-hooks/set-state-in-effect */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  const counts = useMemo(() => Object.fromEntries(FILTERS.map((f) => [f, db.quotes.filter((q) => inFilter(q, f)).length])) as Record<Filter, number>, [db.quotes]);
  const quotes = db.quotes.filter((q) => inFilter(q, filter));
  const acceptedValue = db.quotes.filter((q) => q.status === "accepted").reduce((a, q) => a + quoteTotals(q).total, 0);
  const openValue = db.quotes.filter((q) => q.status === "sent").reduce((a, q) => a + quoteTotals(q).total, 0);

  const set = (p: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...p } : d));
  const setItem = (id: string, patch: Partial<QuoteItem>) => setDraft((d) => (d ? { ...d, items: d.items.map((x) => (x.id === id ? { ...x, ...patch } : x)) } : d));
  const close = () => { setOpen(false); if (params.toString()) router.replace("/quotes"); };

  const save = (status?: Quote["status"]) => {
    if (!draft) return;
    const name = draft.clientName.trim();
    if (!name) return alert("Choose or type a client name.");
    if (draft.items.length === 0) return alert("Add at least one line item.");
    const client = db.clients.find((c) => c.company === name);
    const fields = { clientId: client?.id, clientName: name, items: draft.items, discount: draft.discount, taxPct: draft.tax, notes: draft.notes };
    let id = draft.editingId;
    if (id) {
      update("quotes", db.quotes.map((q) => (q.id === id ? { ...q, ...fields, ...(status ? { status } : {}) } : q)));
    } else {
      id = uid("q");
      update("quotes", [{ id, no: nextQuoteNo(db.quotes, s.quotePrefix), ...fields, status: status ?? "draft", created: todayISO(), validUntil: addDaysISO(s.quoteValidityDays || 14) }, ...db.quotes]);
    }
    setOpen(false);
    router.push(`/quotes/${id}`);
  };

  const t = quoteTotals({ items: draft?.items ?? [], discount: draft?.discount ?? 0, taxPct: draft?.tax ?? 0 });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Quotes"
        description={`${inr(openValue)} awaiting response · ${inr(acceptedValue)} accepted`}
        actions={<>
          <Link href="/pricing" className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-line bg-surface px-3.5 text-[13.5px] font-medium hover:bg-surface-2"><Calculator size={14} /> Price a project</Link>
          <Btn onClick={() => openDraft(blank())}><Plus size={15} /> New quote</Btn>
        </>}
      />

      {db.quotes.length === 0 ? (
        <Empty icon={<FileText size={18} />} title="No quotes yet" sub="Build a quote from scratch, or price a project in the calculator and send it here." action={<Btn onClick={() => openDraft(blank())}><Plus size={15} /> New quote</Btn>} />
      ) : (
        <>
          <Tabs value={filter} onChange={setFilter}
            tabs={FILTERS.map((f) => ({ id: f, label: <span className="flex items-center gap-1.5">{f}<span className="text-[11px] text-subtle">{counts[f]}</span></span> }))} />
          <div className="overflow-hidden rounded-2xl border border-line bg-surface">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-[13px]">
                <thead>
                  <tr className="border-b border-line bg-surface-2/60 text-left text-[12px] text-muted">
                    <th className="px-4 py-2.5 font-medium">Client</th>
                    <th className="px-4 py-2.5 font-medium">Quote</th>
                    <th className="px-4 py-2.5 font-medium">Status</th>
                    <th className="px-4 py-2.5 font-medium">Created</th>
                    <th className="px-4 py-2.5 font-medium">Valid until</th>
                    <th className="px-4 py-2.5 text-right font-medium">Total</th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {quotes.map((q) => (
                    <tr key={q.id} onClick={() => router.push(`/quotes/${q.id}`)} className="group cursor-pointer transition hover:bg-surface-2/60">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3"><Avatar name={q.clientName} className="h-8 w-8 text-[11px]" /><span className="font-medium">{q.clientName}</span></div>
                      </td>
                      <td className="px-4 py-3 font-mono text-[12.5px] text-muted">{q.no}</td>
                      <td className="px-4 py-3"><Badge tone={quoteTone(q.status)} dot>{q.status}</Badge></td>
                      <td className="px-4 py-3 text-muted">{q.created}</td>
                      <td className="px-4 py-3 text-muted">{q.validUntil ?? "—"}</td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums">{inr(quoteTotals(q).total)}</td>
                      <td className="px-3 py-3 text-subtle"><ArrowUpRight size={15} className="opacity-0 transition group-hover:opacity-100" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {quotes.length === 0 && <div className="px-4 py-10 text-center text-[13px] text-muted">No {filter} quotes.</div>}
          </div>
        </>
      )}

      <Modal open={open && !!draft} onClose={close} title={draft?.editingId ? "Edit quotation" : "New quotation"} wide
        footer={<>
          <Btn variant="ghost" onClick={close}>Cancel</Btn>
          {draft?.editingId ? <Btn onClick={() => save()}>Save changes</Btn> : <>
            <Btn variant="outline" onClick={() => save("draft")}>Save draft</Btn>
            <Btn onClick={() => save("sent")}>Save & mark sent</Btn>
          </>}
        </>}>
        {draft && (
          <div className="space-y-5">
            {draft.fromPricing && (
              <div className="flex items-center gap-2 rounded-xl border border-accent-line bg-accent-soft px-3 py-2 text-[13px]">
                <Sparkles size={14} className="text-accent" /> Prefilled from the pricing calculator.
              </div>
            )}
            <Field label="Client" hint="Pick an existing client or type a new name">
              <input list="quote-clients" autoFocus className={inputCls} value={draft.clientName} onChange={(e) => set({ clientName: e.target.value })} placeholder="Client name" />
              <datalist id="quote-clients">{db.clients.map((c) => <option key={c.id} value={c.company} />)}</datalist>
            </Field>

            <div>
              <div className="mb-1.5 grid grid-cols-[1fr_64px_120px_32px] gap-2 text-[12px] font-medium text-muted">
                <span>Deliverable</span><span>Qty</span><span>Price (₹)</span><span />
              </div>
              <div className="space-y-2">
                {draft.items.map((it) => (
                  <div key={it.id} className="grid grid-cols-[1fr_64px_120px_32px] items-center gap-2">
                    <input className={inputCls} value={it.label} onChange={(e) => setItem(it.id, { label: e.target.value })} placeholder="What you'll deliver" />
                    <input type="number" min={1} className={inputCls} value={it.qty} onChange={(e) => setItem(it.id, { qty: Number(e.target.value) })} />
                    <input type="number" min={0} className={inputCls} value={it.price} onChange={(e) => setItem(it.id, { price: Number(e.target.value) })} />
                    <button aria-label="Remove item" className="flex h-9 w-8 items-center justify-center rounded-lg text-subtle hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950" onClick={() => set({ items: draft.items.filter((x) => x.id !== it.id) })}><Trash2 size={14} /></button>
                  </div>
                ))}
              </div>
              <button className="mt-2 inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[13px] font-medium text-accent hover:bg-accent-soft" onClick={() => set({ items: [...draft.items, { id: uid("qi"), label: "", qty: 1, price: 0 }] })}>
                <Plus size={14} /> Add line item
              </button>
            </div>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-[1fr_260px]">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Discount (₹)"><input type="number" min={0} className={inputCls} value={draft.discount} onChange={(e) => set({ discount: Number(e.target.value) })} /></Field>
                  <Field label="GST %"><input type="number" min={0} className={inputCls} value={draft.tax} onChange={(e) => set({ tax: Number(e.target.value) })} /></Field>
                </div>
                <Field label="Payment terms shown to client"><textarea rows={2} className={inputCls} value={draft.notes} onChange={(e) => set({ notes: e.target.value })} /></Field>
              </div>
              <div className="h-fit rounded-xl bg-surface-2 p-4 text-[13px]">
                <Line k="Subtotal" v={inr(t.subtotal)} />
                {t.discount > 0 && <Line k="Discount" v={`− ${inr(t.discount)}`} />}
                <Line k={`GST ${draft.tax}%`} v={inr(t.tax)} />
                <div className="mt-2 flex items-center justify-between border-t border-line-strong pt-2 text-[15px] font-semibold"><span>Total</span><span className="tabular-nums">{inr(t.total)}</span></div>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function Line({ k, v }: { k: string; v: string }) {
  return <div className="flex items-center justify-between py-1 text-muted"><span>{k}</span><span className="tabular-nums text-ink">{v}</span></div>;
}

export default function QuotesPage() {
  return <Suspense><QuotesInner /></Suspense>;
}
