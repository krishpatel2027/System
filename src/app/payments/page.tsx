"use client";
import React, { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useDB } from "@/lib/store";
import { inr, uid, todayISO, daysUntil, cn } from "@/lib/utils";
import { Badge, Btn, Empty, Modal, Field, inputCls, PageHeader, Metric, Tabs, Avatar } from "@/components/ui";
import { Plus, Wallet, Clock, AlertTriangle, CheckCircle2, Trash2, Undo2 } from "lucide-react";
import type { Payment, PaymentStatus } from "@/lib/types";

const FILTERS = ["open", "overdue", "paid", "all"] as const;
type Filter = (typeof FILTERS)[number];
const METHODS = ["UPI", "Bank transfer", "Card", "Cash", "Cheque", "Other"];

// Anything unpaid past its due date is overdue, whatever was stored.
const effective = (p: Payment): PaymentStatus => (p.status !== "paid" && daysUntil(p.due) < 0 ? "overdue" : p.status);
const tone = (s: PaymentStatus) => (s === "paid" ? "green" : s === "overdue" ? "red" : s === "partial" ? "blue" : "amber") as "green" | "red" | "blue" | "amber";

function PaymentsInner() {
  const { db, update } = useDB();
  const params = useSearchParams();
  const [open, setOpen] = useState(params.get("action") === "new");
  const [filter, setFilter] = useState<Filter>("open");
  const [form, setForm] = useState({ clientName: "", projectId: "", label: "Advance 50%", amount: 0, due: todayISO() });
  const [paying, setPaying] = useState<Payment | null>(null);
  const [payForm, setPayForm] = useState({ method: "UPI", txn: "", paidDate: todayISO() });

  const list = useMemo(() => {
    const withStatus = db.payments.map((p) => ({ p, s: effective(p) }));
    const f = withStatus.filter(({ s }) => filter === "all" || (filter === "open" ? s !== "paid" : s === filter));
    return f.sort((a, b) => (filter === "paid" ? (b.p.paidDate ?? b.p.due).localeCompare(a.p.paidDate ?? a.p.due) : a.p.due.localeCompare(b.p.due)));
  }, [db.payments, filter]);

  const paid = db.payments.filter((p) => p.status === "paid");
  const openPays = db.payments.filter((p) => p.status !== "paid");
  const overdue = db.payments.filter((p) => effective(p) === "overdue");
  const counts = { open: openPays.length, overdue: overdue.length, paid: paid.length, all: db.payments.length };

  const openNew = () => {
    setForm({ clientName: db.clients[0]?.company ?? "", projectId: "", label: "Advance 50%", amount: 0, due: todayISO() });
    setOpen(true);
  };
  const save = () => {
    if (!form.clientName.trim() || form.amount <= 0) return alert("Add a client and an amount.");
    update("payments", [{ id: uid("pay"), clientName: form.clientName.trim(), projectId: form.projectId || undefined, label: form.label || "Payment", amount: form.amount, due: form.due, status: "pending" }, ...db.payments]);
    setOpen(false);
  };
  const markPaid = () => {
    if (!paying) return;
    update("payments", db.payments.map((p) => (p.id === paying.id ? { ...p, status: "paid", paidDate: payForm.paidDate, method: payForm.method, txn: payForm.txn || undefined } : p)));
    setPaying(null);
  };
  const clientProjects = db.projects.filter((p) => p.clientName === form.clientName);

  return (
    <div className="space-y-6">
      <PageHeader title="Payments" description="Every invoice and milestone payment, and what's still due."
        actions={<Btn onClick={openNew}><Plus size={15} /> Record payment</Btn>} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Metric label="Collected" value={inr(paid.reduce((a, p) => a + p.amount, 0))} sub={`${paid.length} received`} icon={<CheckCircle2 size={15} />} accent="text-emerald-600 dark:text-emerald-400" />
        <Metric label="Outstanding" value={inr(openPays.reduce((a, p) => a + p.amount, 0))} sub={`${openPays.length} open`} icon={<Clock size={15} />} />
        <Metric label="Overdue" value={inr(overdue.reduce((a, p) => a + p.amount, 0))} sub={overdue.length ? `${overdue.length} need a reminder` : "Nothing overdue"} icon={<AlertTriangle size={15} />} accent={overdue.length ? "text-red-600 dark:text-red-400" : undefined} />
      </div>

      {db.payments.length === 0 ? (
        <Empty icon={<Wallet size={18} />} title="No payments yet" sub="Creating a project adds its payment schedule automatically — or record a payment here." action={<Btn onClick={openNew}><Plus size={15} /> Record payment</Btn>} />
      ) : (
        <>
          <Tabs value={filter} onChange={setFilter} tabs={FILTERS.map((f) => ({ id: f, label: <span className="flex items-center gap-1.5">{f}<span className="text-[11px] text-subtle">{counts[f]}</span></span> }))} />
          <div className="overflow-hidden rounded-2xl border border-line bg-surface">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-[13px]">
                <thead><tr className="border-b border-line bg-surface-2/60 text-left text-[12px] text-muted">
                  <th className="px-4 py-2.5 font-medium">Client</th><th className="px-4 py-2.5 font-medium">For</th><th className="px-4 py-2.5 font-medium">Due</th>
                  <th className="px-4 py-2.5 font-medium">Status</th><th className="px-4 py-2.5 text-right font-medium">Amount</th><th className="w-44 px-4 py-2.5" />
                </tr></thead>
                <tbody className="divide-y divide-line">
                  {list.map(({ p, s }) => {
                    const d = daysUntil(p.due);
                    return (
                      <tr key={p.id} className="group hover:bg-surface-2/50">
                        <td className="px-4 py-3"><div className="flex items-center gap-3"><Avatar name={p.clientName} className="h-8 w-8 text-[11px]" /><span className="font-medium">{p.clientName}</span></div></td>
                        <td className="px-4 py-3 text-muted">{p.label}{p.projectId && <div className="text-[11.5px] text-subtle">{db.projects.find((x) => x.id === p.projectId)?.name}</div>}</td>
                        <td className="px-4 py-3">
                          {s === "paid" ? <span className="text-muted">Paid {p.paidDate}{p.method ? ` · ${p.method}` : ""}</span>
                            : <span className={cn(d < 0 ? "text-red-600 dark:text-red-400" : d <= 3 ? "text-amber-600 dark:text-amber-400" : "text-muted")}>{d < 0 ? `${-d}d overdue` : d === 0 ? "Today" : `In ${d}d`} <span className="text-subtle">· {p.due}</span></span>}
                        </td>
                        <td className="px-4 py-3"><Badge tone={tone(s)} dot>{s}</Badge></td>
                        <td className="px-4 py-3 text-right font-semibold tabular-nums">{inr(p.amount)}</td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-1">
                            {p.status === "paid"
                              ? <Btn size="sm" variant="ghost" onClick={() => update("payments", db.payments.map((x) => (x.id === p.id ? { ...x, status: "pending", paidDate: undefined } : x)))}><Undo2 size={13} /> Undo</Btn>
                              : <Btn size="sm" variant="outline" onClick={() => { setPaying(p); setPayForm({ method: "UPI", txn: "", paidDate: todayISO() }); }}><CheckCircle2 size={13} /> Mark paid</Btn>}
                            <Btn size="sm" variant="ghost" title="Delete" className="text-subtle hover:text-red-600" onClick={() => { if (confirm("Delete this payment?")) update("payments", db.payments.filter((x) => x.id !== p.id)); }}><Trash2 size={13} /></Btn>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {list.length === 0 && <div className="px-4 py-10 text-center text-[13px] text-muted">Nothing here.</div>}
          </div>
        </>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Record a payment"
        footer={<><Btn variant="ghost" onClick={() => setOpen(false)}>Cancel</Btn><Btn onClick={save}>Save</Btn></>}>
        <div className="grid gap-4">
          <Field label="Client">
            <input list="pay-clients" autoFocus className={inputCls} value={form.clientName} onChange={(e) => setForm({ ...form, clientName: e.target.value, projectId: "" })} placeholder="Client name" />
            <datalist id="pay-clients">{db.clients.map((c) => <option key={c.id} value={c.company} />)}</datalist>
          </Field>
          {clientProjects.length > 0 && (
            <Field label="Project (optional)">
              <select className={inputCls} value={form.projectId} onChange={(e) => setForm({ ...form, projectId: e.target.value })}>
                <option value="">—</option>{clientProjects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </Field>
          )}
          <div className="grid grid-cols-2 gap-4">
            <Field label="For"><input className={inputCls} value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="Advance 50%" /></Field>
            <Field label="Amount (₹)"><input type="number" min={0} className={inputCls} value={form.amount || ""} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} /></Field>
          </div>
          <Field label="Due date"><input type="date" className={inputCls} value={form.due} onChange={(e) => setForm({ ...form, due: e.target.value })} /></Field>
        </div>
      </Modal>

      <Modal open={!!paying} onClose={() => setPaying(null)} title={paying ? `Mark ${inr(paying.amount)} from ${paying.clientName} as paid` : ""}
        footer={<><Btn variant="ghost" onClick={() => setPaying(null)}>Cancel</Btn><Btn onClick={markPaid}><CheckCircle2 size={14} /> Mark paid</Btn></>}>
        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Paid on"><input type="date" className={inputCls} value={payForm.paidDate} onChange={(e) => setPayForm({ ...payForm, paidDate: e.target.value })} /></Field>
            <Field label="Method"><select className={inputCls} value={payForm.method} onChange={(e) => setPayForm({ ...payForm, method: e.target.value })}>{METHODS.map((m) => <option key={m}>{m}</option>)}</select></Field>
          </div>
          <Field label="Reference / transaction ID (optional)"><input className={inputCls} value={payForm.txn} onChange={(e) => setPayForm({ ...payForm, txn: e.target.value })} /></Field>
        </div>
      </Modal>
    </div>
  );
}

export default function PaymentsPage() {
  return <Suspense><PaymentsInner /></Suspense>;
}
