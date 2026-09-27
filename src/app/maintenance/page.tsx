"use client";
import React, { useState } from "react";
import { useDB } from "@/lib/store";
import { inr, uid, addDaysISO } from "@/lib/utils";
import { MAINT_PLANS } from "@/lib/pricing-data";
import { Card, Badge, Btn, Modal, Field, inputCls } from "@/components/ui";
import { Plus } from "lucide-react";

export default function MaintenancePage() {
  const { db, update } = useDB();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ clientId: db.clients[0]?.id ?? "", plan: "STANDARD" });
  const mrr = db.subs.filter((s) => s.status === "active").reduce((a, s) => a + s.monthly, 0);

  const save = () => {
    const c = db.clients.find((x) => x.id === form.clientId);
    const plan = MAINT_PLANS.find((p) => p.name === form.plan)!;
    if (!c) return alert("Client required");
    update("subs", [{ id: uid("sub"), clientId: c.id, clientName: c.company, plan: plan.name, monthly: plan.monthly, renewal: addDaysISO(30), includedHours: plan.hours, usedHours: 0, status: "active" }, ...db.subs]);
    setOpen(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><h1 className="text-[22px] font-semibold tracking-tight">Maintenance</h1><p className="text-[13px] text-neutral-500">{inr(mrr)}/mo recurring · {db.subs.filter(s=>s.status==="active").length} active</p></div>
        <Btn onClick={() => setOpen(true)}><Plus size={15} /> New Subscription</Btn>
      </div>
      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-5">
        {MAINT_PLANS.map((p) => (
          <Card key={p.name} className="p-4"><div className="text-[13px] font-bold">{p.name}</div><div className="text-[18px] font-semibold">{inr(p.monthly)}<span className="text-[12px] font-normal text-neutral-500">/mo</span></div><div className="text-[12px] text-neutral-500">{p.hours}h incl · {p.desc}</div></Card>
        ))}
      </div>
      <div className="grid gap-2">
        {db.subs.map((s) => (
          <Card key={s.id} className="flex flex-wrap items-center gap-3 p-4">
            <div className="flex-1"><div className="text-[14px] font-semibold">{s.clientName} · {s.plan}</div><div className="text-[12.5px] text-neutral-500">Renews {s.renewal} · {s.usedHours}/{s.includedHours}h used · {s.includedHours - s.usedHours}h left</div>
              <div className="mt-1 h-1.5 w-48 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800"><div className="h-full bg-emerald-500" style={{ width: `${Math.min(100, (s.usedHours / Math.max(1, s.includedHours)) * 100)}%` }} /></div>
            </div>
            <div className="font-semibold">{inr(s.monthly)}/mo</div>
            <Badge tone={s.status === "active" ? "green" : "neutral"}>{s.status}</Badge>
            <button className="rounded-xl border border-neutral-200 px-2 py-1 text-[12.5px] dark:border-neutral-700" onClick={() => update("subs", db.subs.map((x) => (x.id === s.id ? { ...x, usedHours: x.usedHours + 1 } : x)))}>+1h used</button>
          </Card>
        ))}
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title="New Subscription">
        <div className="grid gap-3">
          <Field label="Client"><select className={inputCls} value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value })}>{db.clients.map(c=><option key={c.id} value={c.id}>{c.company}</option>)}</select></Field>
          <Field label="Plan"><select className={inputCls} value={form.plan} onChange={(e) => setForm({ ...form, plan: e.target.value })}>{MAINT_PLANS.map(p=><option key={p.name} value={p.name}>{p.name} — {inr(p.monthly)}/mo</option>)}</select></Field>
        </div>
        <div className="mt-4 flex justify-end gap-2"><Btn variant="ghost" onClick={() => setOpen(false)}>Cancel</Btn><Btn onClick={save}>Activate</Btn></div>
      </Modal>
    </div>
  );
}
