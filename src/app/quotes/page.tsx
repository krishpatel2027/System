"use client";
import React, { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useDB } from "@/lib/store";
import { inr, uid, todayISO, addDaysISO } from "@/lib/utils";
import { Card, Badge, Btn, Empty, Modal, Field, inputCls } from "@/components/ui";
import { Plus, Printer } from "lucide-react";
import type { Quote, QuoteItem } from "@/lib/types";
import { PENDING_KEY } from "@/app/pricing/_studio";

function QuotesInner() {
  const { db, update } = useDB();
  const params = useSearchParams();
  const [open, setOpen] = useState(params.get("action") === "new");
  const [view, setView] = useState<Quote | null>(null);
  const [clientName, setClientName] = useState(db.clients[0]?.company ?? "");
  const [items, setItems] = useState<QuoteItem[]>([
    { id: uid("qi"), label: "Website Strategy & UI/UX", qty: 1, price: 8000 },
    { id: uid("qi"), label: "Website Development", qty: 1, price: 18000 },
  ]);
  const [discount, setDiscount] = useState(0);
  const [tax, setTax] = useState(0);
  const [fromPricing, setFromPricing] = useState(false);

  // Hydrate a pending pricing-studio payload once on mount (intentional mount hydration).
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- intentional mount hydration from localStorage */
    if (params.get("from") !== "pricing") return;
    try {
      const raw = localStorage.getItem(PENDING_KEY);
      if (!raw) return;
      const p = JSON.parse(raw) as { items: QuoteItem[]; discount: number };
      if (p.items?.length) {
        setItems(p.items);
        setDiscount(p.discount ?? 0);
        setFromPricing(true);
        localStorage.removeItem(PENDING_KEY);
      }
    } catch {}
    /* eslint-enable react-hooks/set-state-in-effect */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sub = items.reduce((a, i) => a + i.qty * i.price, 0);
  const total = sub - discount + (sub * tax) / 100;

  const save = (status: Quote["status"]) => {
    if (!clientName.trim()) return alert("Client required");
    const no = `ARK-2026-${String(db.quotes.length + 15).padStart(3, "0")}`;
    update("quotes", [{ id: uid("q"), no, clientName, items, discount, taxPct: tax, status, created: todayISO(), validUntil: addDaysISO(14) }, ...db.quotes]);
    setOpen(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><h1 className="text-[22px] font-semibold tracking-tight">Quotes</h1><p className="text-[13px] text-neutral-500">Grouped deliverables — never line-item internals</p></div>
        <Btn onClick={() => setOpen(true)}><Plus size={15} /> New Quote</Btn>
      </div>
      {db.quotes.length === 0 && <Empty title="No quotes yet" sub="Build your first client-facing quote." action={<Btn onClick={() => setOpen(true)}>+ New Quote</Btn>} />}
      <div className="grid gap-3 md:grid-cols-2">
        {db.quotes.map((q) => {
          const t = q.items.reduce((a, i) => a + i.qty * i.price, 0) - q.discount;
          return (
            <Card key={q.id} className="cursor-pointer p-5" >
              <div onClick={() => setView(q)}>
                <div className="flex items-center justify-between"><span className="font-mono text-[13px]">{q.no}</span><Badge tone={q.status === "accepted" ? "green" : q.status === "sent" ? "amber" : "neutral"}>{q.status}</Badge></div>
                <div className="mt-1 text-[15px] font-semibold">{q.clientName}</div>
                <div className="text-[13px] text-neutral-500">{q.items.length} deliverables · {q.created}</div>
                <div className="mt-2 text-[18px] font-semibold">{inr(t)}</div>
              </div>
            </Card>
          );
        })}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="New Quotation" wide>
        {fromPricing && <div className="mb-3 rounded-xl bg-emerald-50 px-3 py-2 text-[13px] text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">✓ Prefilled from Pricing Calculator — grouped deliverables, internals hidden.</div>}
        <div className="grid gap-3">
          <Field label="Client"><select className={inputCls} value={clientName} onChange={(e) => setClientName(e.target.value)}>{db.clients.map(c=><option key={c.id} value={c.company}>{c.company}</option>)}<option value="New Client">+ New Client…</option></select></Field>
          {items.map((it, idx) => (
            <div key={it.id} className="grid grid-cols-[1fr_70px_110px_32px] gap-2">
              <input className={inputCls} value={it.label} onChange={(e) => setItems(items.map((x) => (x.id === it.id ? { ...x, label: e.target.value } : x)))} />
              <input type="number" className={inputCls} value={it.qty} onChange={(e) => setItems(items.map((x) => (x.id === it.id ? { ...x, qty: Number(e.target.value) } : x)))} />
              <input type="number" className={inputCls} value={it.price} onChange={(e) => setItems(items.map((x) => (x.id === it.id ? { ...x, price: Number(e.target.value) } : x)))} />
              <button className="text-red-500" onClick={() => setItems(items.filter((x) => x.id !== it.id))}>✕</button>
            </div>
          ))}
          <button className="text-left text-[13px] font-medium text-neutral-600" onClick={() => setItems([...items, { id: uid("qi"), label: "New deliverable", qty: 1, price: 5000 }])}>+ Add item</button>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Discount (₹)"><input type="number" className={inputCls} value={discount} onChange={(e) => setDiscount(Number(e.target.value))} /></Field>
            <Field label="Tax %"><input type="number" className={inputCls} value={tax} onChange={(e) => setTax(Number(e.target.value))} /></Field>
          </div>
          <div className="rounded-xl bg-neutral-50 p-3 text-[14px] dark:bg-neutral-800">Subtotal {inr(sub)} · Discount {inr(discount)} · <b>Total {inr(total)}</b></div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Btn variant="ghost" onClick={() => save("draft")}>Save Draft</Btn>
          <Btn onClick={() => save("sent")}>Mark Sent</Btn>
        </div>
      </Modal>

      <Modal open={!!view} onClose={() => setView(null)} title={view ? `Quotation ${view.no}` : ""} wide>
        {view && (
          <div>
            <div className="flex items-center justify-between">
              <div><div className="text-[18px] font-bold">Arkria × {view.clientName}</div><div className="text-[13px] text-neutral-500">{view.created} · valid till {view.validUntil}</div></div>
              <div className="flex gap-2">
                <select className={inputCls} value={view.status} onChange={(e) => { const ns = e.target.value as Quote["status"]; update("quotes", db.quotes.map((x) => (x.id === view.id ? { ...x, status: ns } : x))); setView({ ...view, status: ns }); }}>
                  {(["draft","sent","accepted","rejected","expired"] as const).map(s=><option key={s} value={s}>{s}</option>)}
                </select>
                <Btn variant="outline" onClick={() => window.print()}><Printer size={14} /> PDF</Btn>
              </div>
            </div>
            <table className="mt-4 w-full text-[13.5px]">
              <tbody>
                {view.items.map((i) => <tr key={i.id} className="border-b border-neutral-100 dark:border-neutral-800"><td className="py-2">{i.label} × {i.qty}</td><td className="py-2 text-right">{inr(i.qty * i.price)}</td></tr>)}
                <tr><td className="py-2 text-neutral-500">Discount</td><td className="py-2 text-right">− {inr(view.discount)}</td></tr>
                <tr><td className="py-2 font-semibold">TOTAL</td><td className="py-2 text-right font-semibold">{inr(view.items.reduce((a,i)=>a+i.qty*i.price,0) - view.discount)}</td></tr>
              </tbody>
            </table>
            <p className="mt-3 text-[12.5px] text-neutral-500">Payment: 50% advance · 30% milestone · 20% launch. {db.settings.upi && `UPI: ${db.settings.upi}`}</p>
          </div>
        )}
      </Modal>
    </div>
  );
}
export default function QuotesPage() { return <Suspense><QuotesInner /></Suspense>; }
