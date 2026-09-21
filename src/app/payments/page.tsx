"use client";
import React, { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useDB } from "@/lib/store";
import { inr, uid, todayISO } from "@/lib/utils";
import { Card, Badge, Btn, Empty, Modal, Field, inputCls } from "@/components/ui";
import { Plus } from "lucide-react";
import type { PaymentStatus } from "@/lib/types";

function PaymentsInner() {
  const { db, update } = useDB();
  const params = useSearchParams();
  const [open, setOpen] = useState(params.get("action") === "new");
  const [form, setForm] = useState({ clientName: db.clients[0]?.company ?? "", label: "Advance 50%", amount: 15000, due: todayISO() });

  const totalPaid = db.payments.filter(p=>p.status==="paid").reduce((a,p)=>a+p.amount,0);
  const totalDue = db.payments.filter(p=>p.status!=="paid").reduce((a,p)=>a+p.amount,0);

  const save = () => {
    update("payments", [{ id: uid("pay"), clientName: form.clientName, label: form.label, amount: form.amount, due: form.due, status: "pending" as PaymentStatus }, ...db.payments]);
    setOpen(false);
  };

  const setStatus = (id: string, status: PaymentStatus) => {
    update("payments", db.payments.map((p) => (p.id === id ? { ...p, status, paidDate: status === "paid" ? todayISO() : p.paidDate } : p)));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><h1 className="text-[22px] font-semibold tracking-tight">Payments</h1><p className="text-[13px] text-neutral-500">Collected {inr(totalPaid)} · Due {inr(totalDue)}</p></div>
        <Btn onClick={() => setOpen(true)}><Plus size={15} /> Record Payment</Btn>
      </div>
      <div className="grid gap-2">
        {db.payments.map((p) => (
          <Card key={p.id} className="flex flex-wrap items-center gap-3 p-4">
            <div className="min-w-[200px] flex-1"><div className="text-[14px] font-semibold">{p.clientName} — {p.label}</div><div className="text-[12.5px] text-neutral-500">Due {p.due}{p.paidDate ? ` · paid ${p.paidDate}` : ""}{p.method ? ` · ${p.method}` : ""}</div></div>
            <div className="text-[16px] font-semibold">{inr(p.amount)}</div>
            <Badge tone={p.status === "paid" ? "green" : p.status === "overdue" ? "red" : "amber"}>{p.status}</Badge>
            <select value={p.status} onChange={(e) => setStatus(p.id, e.target.value as PaymentStatus)} className="rounded-xl border border-neutral-200 px-2 py-1.5 text-[13px] dark:border-neutral-700 dark:bg-neutral-900">
              <option value="pending">pending</option><option value="paid">paid</option><option value="overdue">overdue</option><option value="partial">partial</option>
            </select>
            <button className="text-[12.5px] text-red-500" onClick={() => update("payments", db.payments.filter((x) => x.id !== p.id))}>Delete</button>
          </Card>
        ))}
        {db.payments.length === 0 && <Empty title="No payments yet" sub="Every project gets a 50/30/20 schedule." action={<Btn onClick={() => setOpen(true)}>+ Record Payment</Btn>} />}
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title="Record Payment">
        <div className="grid gap-3">
          <Field label="Client"><select className={inputCls} value={form.clientName} onChange={(e) => setForm({ ...form, clientName: e.target.value })}>{db.clients.map(c=><option key={c.id} value={c.company}>{c.company}</option>)}</select></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Label"><input className={inputCls} value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} /></Field>
            <Field label="Amount (₹)"><input type="number" className={inputCls} value={form.amount} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} /></Field>
          </div>
          <Field label="Due date"><input type="date" className={inputCls} value={form.due} onChange={(e) => setForm({ ...form, due: e.target.value })} /></Field>
        </div>
        <div className="mt-4 flex justify-end gap-2"><Btn variant="ghost" onClick={() => setOpen(false)}>Cancel</Btn><Btn onClick={save}>Save</Btn></div>
      </Modal>
    </div>
  );
}
export default function PaymentsPage() { return <Suspense><PaymentsInner /></Suspense>; }
