"use client";
import React, { useState } from "react";
import { useDB } from "@/lib/store";
import { inr, uid, todayISO } from "@/lib/utils";
import { Card, Badge, Btn, Empty, Modal, Field, inputCls } from "@/components/ui";
import { Plus } from "lucide-react";
import type { ScopeStatus } from "@/lib/types";

const FLOW: ScopeStatus[] = ["requested", "estimated", "quoted", "approved", "indev", "completed"];

export default function ScopePage() {
  const { db, update } = useDB();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ projectId: db.projects[0]?.id ?? "", feature: "", description: "", hours: 5, cost: 5000 });

  const save = () => {
    const p = db.projects.find((x) => x.id === form.projectId);
    if (!p || !form.feature.trim()) return alert("Project + feature required");
    update("scopes", [{ id: uid("sc"), projectId: p.id, projectName: p.name, feature: form.feature, description: form.description, hours: form.hours, cost: form.cost, timelineImpact: "+2 days", status: "requested", created: todayISO() }, ...db.scopes]);
    setOpen(false);
  };

  const approve = (id: string) => {
    const s = db.scopes.find((x) => x.id === id);
    if (!s) return;
    update("scopes", db.scopes.map((x) => (x.id === id ? { ...x, status: "approved" as ScopeStatus } : x)));
    // automation: add to project tasks
    update("projects", db.projects.map((p) => (p.id === s.projectId ? { ...p, tasks: [...p.tasks, { id: uid("t"), title: `[SCOPE] ${s.feature}`, done: false }] } : p)));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><h1 className="text-[22px] font-semibold tracking-tight">Scope Changes</h1><p className="text-[13px] text-neutral-500">Never silently add scope. Requested → Estimated → Quoted → Approved → In Dev → Done</p></div>
        <Btn onClick={() => setOpen(true)}><Plus size={15} /> New Scope Request</Btn>
      </div>
      {db.scopes.length === 0 && <Empty title="No scope changes" sub="Out-of-scope asks get estimated and approved here first." action={<Btn onClick={() => setOpen(true)}>+ New Request</Btn>} />}
      <div className="grid gap-2">
        {db.scopes.map((s) => (
          <Card key={s.id} className="p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[14px] font-semibold">{s.feature}</span>
              <Badge tone={s.status === "approved" || s.status === "completed" ? "green" : s.status === "quoted" ? "amber" : "neutral"}>{s.status}</Badge>
              <span className="ml-auto text-[13px] font-semibold">{inr(s.cost)} · {s.hours}h · {s.timelineImpact}</span>
            </div>
            <div className="mt-1 text-[13px] text-neutral-500">{s.projectName} · {s.description}</div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {FLOW.map((f) => (
                <button key={f} onClick={() => update("scopes", db.scopes.map((x) => (x.id === s.id ? { ...x, status: f } : x)))} className={`rounded-full px-2.5 py-1 text-[12px] ${s.status === f ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900" : "bg-neutral-100 dark:bg-neutral-800"}`}>{f}</button>
              ))}
              <span className="flex-1" />
              {s.status !== "approved" && <Btn variant="outline" onClick={() => approve(s.id)}>Approve + Add to Tasks</Btn>}
            </div>
          </Card>
        ))}
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title="New Scope Request">
        <div className="grid gap-3">
          <Field label="Project"><select className={inputCls} value={form.projectId} onChange={(e) => setForm({ ...form, projectId: e.target.value })}>{db.projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
          <Field label="Requested feature"><input className={inputCls} value={form.feature} onChange={(e) => setForm({ ...form, feature: e.target.value })} /></Field>
          <Field label="Description"><textarea className={inputCls} rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Hours"><input type="number" className={inputCls} value={form.hours} onChange={(e) => setForm({ ...form, hours: Number(e.target.value) })} /></Field>
            <Field label="Cost (₹)"><input type="number" className={inputCls} value={form.cost} onChange={(e) => setForm({ ...form, cost: Number(e.target.value) })} /></Field>
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2"><Btn variant="ghost" onClick={() => setOpen(false)}>Cancel</Btn><Btn onClick={save}>Save</Btn></div>
      </Modal>
    </div>
  );
}
