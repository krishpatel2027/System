"use client";
import React, { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useDB } from "@/lib/store";
import { inr, uid, todayISO, daysUntil, cn } from "@/lib/utils";
import { Card, Badge, Btn, Modal, Field, inputCls, PageHeader, Metric, Progress, Empty, Avatar } from "@/components/ui";
import { Plus, Wrench, Repeat, Clock, Pause, Play, Trash2, RotateCw } from "lucide-react";
import type { MaintenanceSub } from "@/lib/types";

const addDays = (iso: string, n: number) => {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

function MaintenanceInner() {
  const { db, update } = useDB();
  const params = useSearchParams();
  const plans = db.pricing.carePlans;
  const [open, setOpen] = useState(params.get("action") === "new");
  const [form, setForm] = useState(() => ({ clientName: "", plan: plans[1]?.name ?? plans[0]?.name ?? "", start: todayISO() }));

  const active = db.subs.filter((s) => s.status === "active");
  const mrr = active.reduce((a, s) => a + s.monthly, 0);
  const hoursLeft = active.reduce((a, s) => a + Math.max(0, s.includedHours - s.usedHours), 0);
  const patch = (id: string, p: Partial<MaintenanceSub>) => update("subs", db.subs.map((x) => (x.id === id ? { ...x, ...p } : x)));

  const openNew = (planName?: string) => {
    setForm({ clientName: db.clients[0]?.company ?? "", plan: planName ?? plans[1]?.name ?? plans[0]?.name ?? "", start: todayISO() });
    setOpen(true);
  };
  const save = () => {
    const plan = plans.find((p) => p.name === form.plan);
    const name = form.clientName.trim();
    if (!name || !plan) return alert("Choose a client and a plan.");
    const client = db.clients.find((c) => c.company === name);
    update("subs", [{ id: uid("sub"), clientId: client?.id ?? "", clientName: name, plan: plan.name, monthly: plan.monthly, renewal: addDays(form.start, 30), includedHours: plan.hours, usedHours: 0, status: "active" }, ...db.subs]);
    setOpen(false);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Maintenance"
        description="Care plans keep launched sites healthy — and keep revenue recurring."
        actions={<Btn onClick={() => openNew()} disabled={plans.length === 0}><Plus size={15} /> New subscription</Btn>}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Metric label="Monthly recurring" value={inr(mrr)} sub={`${inr(mrr * 12)} a year`} icon={<Repeat size={15} />} accent="text-emerald-600 dark:text-emerald-400" />
        <Metric label="Active plans" value={String(active.length)} sub={`${db.subs.length - active.length} paused or cancelled`} icon={<Wrench size={15} />} />
        <Metric label="Support hours left" value={`${hoursLeft}h`} sub="across active plans this cycle" icon={<Clock size={15} />} />
      </div>

      {db.subs.length === 0 ? (
        <Empty icon={<Wrench size={18} />} title="No care plans yet" sub="When a project launches, offer a care plan to keep the site fast, safe and up to date." action={plans.length ? <Btn onClick={() => openNew()}><Plus size={15} /> New subscription</Btn> : undefined} />
      ) : (
        <div className="space-y-2">
          {db.subs.map((s) => {
            const renewIn = daysUntil(s.renewal);
            const pct = s.includedHours ? (s.usedHours / s.includedHours) * 100 : 0;
            return (
              <Card key={s.id} className={cn("flex flex-wrap items-center gap-4 p-4", s.status !== "active" && "opacity-70")}>
                <Avatar name={s.clientName} />
                <div className="min-w-[180px] flex-1">
                  <div className="flex items-center gap-2"><span className="text-[14px] font-semibold">{s.clientName}</span><Badge tone={s.status === "active" ? "green" : s.status === "paused" ? "amber" : "neutral"} dot>{s.status}</Badge></div>
                  <div className="text-[12.5px] text-muted">{s.plan} plan · {inr(s.monthly)}/mo · {s.status === "active" ? (renewIn < 0 ? <span className="text-red-600">renewal {-renewIn}d overdue</span> : `renews in ${renewIn}d`) : `renewal ${s.renewal}`}</div>
                </div>
                <div className="w-full sm:w-56">
                  <div className="mb-1 flex justify-between text-[12px] text-muted"><span>{s.usedHours} of {s.includedHours}h used</span>{pct > 100 && <span className="text-red-600">over by {s.usedHours - s.includedHours}h</span>}</div>
                  <Progress value={pct} tone={pct > 100 ? "accent" : "green"} />
                </div>
                <div className="flex items-center gap-1">
                  <Btn size="sm" variant="outline" onClick={() => patch(s.id, { usedHours: s.usedHours + 1 })}>+1h</Btn>
                  <Btn size="sm" variant="ghost" title="Start next cycle: reset hours, move renewal 30 days" onClick={() => patch(s.id, { usedHours: 0, renewal: addDays(s.renewal, 30) })}><RotateCw size={13} /> Renew</Btn>
                  {s.status === "active"
                    ? <Btn size="sm" variant="ghost" title="Pause" onClick={() => patch(s.id, { status: "paused" })}><Pause size={13} /></Btn>
                    : <Btn size="sm" variant="ghost" title="Resume" onClick={() => patch(s.id, { status: "active" })}><Play size={13} /></Btn>}
                  <Btn size="sm" variant="ghost" title="Delete" className="text-red-600 hover:bg-red-50 dark:hover:bg-red-950" onClick={() => { if (confirm(`Delete ${s.clientName}'s care plan?`)) update("subs", db.subs.filter((x) => x.id !== s.id)); }}><Trash2 size={13} /></Btn>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[15px] font-semibold">Plans you offer</h2>
          <Link href="/settings?section=care" className="text-[12.5px] font-medium text-muted hover:text-ink">Edit plans</Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {plans.map((p) => (
            <Card key={p.name} className="flex flex-col p-4">
              <div className="text-[13.5px] font-semibold">{p.name}</div>
              <div className="mt-1 text-[20px] font-semibold tabular-nums">{inr(p.monthly)}<span className="text-[12px] font-normal text-subtle">/mo</span></div>
              <div className="text-[12px] text-muted">{p.hours}h support included</div>
              <p className="mt-2 flex-1 text-[12.5px] leading-relaxed text-muted">{p.desc}</p>
              <Btn size="sm" variant="outline" className="mt-3" onClick={() => openNew(p.name)}>Subscribe a client</Btn>
            </Card>
          ))}
        </div>
      </section>

      <Modal open={open} onClose={() => setOpen(false)} title="New care subscription"
        footer={<><Btn variant="ghost" onClick={() => setOpen(false)}>Cancel</Btn><Btn onClick={save}>Start subscription</Btn></>}>
        <div className="grid gap-4">
          <Field label="Client">
            <input list="care-clients" autoFocus className={inputCls} value={form.clientName} onChange={(e) => setForm({ ...form, clientName: e.target.value })} placeholder="Client name" />
            <datalist id="care-clients">{db.clients.map((c) => <option key={c.id} value={c.company} />)}</datalist>
          </Field>
          <Field label="Plan">
            <select className={inputCls} value={form.plan} onChange={(e) => setForm({ ...form, plan: e.target.value })}>
              {plans.map((p) => <option key={p.name} value={p.name}>{p.name} — {inr(p.monthly)}/mo · {p.hours}h</option>)}
            </select>
          </Field>
          <Field label="Start date" hint="First renewal is 30 days later"><input type="date" className={inputCls} value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} /></Field>
        </div>
      </Modal>
    </div>
  );
}

export default function MaintenancePage() {
  return <Suspense><MaintenanceInner /></Suspense>;
}
