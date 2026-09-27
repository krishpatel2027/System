"use client";
import React, { useState } from "react";
import Link from "next/link";
import { useDB } from "@/lib/store";
import { inr, uid, todayISO, cn } from "@/lib/utils";
import { Card, Badge, Btn, Empty, Modal, Field, inputCls, PageHeader, Metric, Tabs } from "@/components/ui";
import { Plus, Repeat, Check, Trash2, Clock, IndianRupee } from "lucide-react";
import type { ScopeChange, ScopeStatus } from "@/lib/types";

const FLOW: { id: ScopeStatus; label: string }[] = [
  { id: "requested", label: "Requested" }, { id: "estimated", label: "Estimated" }, { id: "quoted", label: "Quoted" },
  { id: "approved", label: "Approved" }, { id: "indev", label: "In progress" }, { id: "completed", label: "Done" },
];
const FILTERS = ["open", "approved", "all"] as const;
const tone = (s: ScopeStatus) => (s === "completed" || s === "approved" || s === "indev" ? "green" : s === "quoted" ? "amber" : "neutral") as "green" | "amber" | "neutral";

export default function ScopePage() {
  const { db, update } = useDB();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("open");
  const [form, setForm] = useState({ projectId: "", feature: "", description: "", hours: 0, cost: 0, timelineImpact: "" });

  const approvedStates: ScopeStatus[] = ["approved", "indev", "completed"];
  const list = db.scopes.filter((s) => filter === "all" || (filter === "approved" ? approvedStates.includes(s.status) : !approvedStates.includes(s.status)));
  const approvedValue = db.scopes.filter((s) => approvedStates.includes(s.status)).reduce((a, s) => a + s.cost, 0);
  const pendingValue = db.scopes.filter((s) => !approvedStates.includes(s.status)).reduce((a, s) => a + s.cost, 0);
  const patch = (id: string, p: Partial<ScopeChange>) => update("scopes", db.scopes.map((x) => (x.id === id ? { ...x, ...p } : x)));

  const openNew = () => {
    setForm({ projectId: db.projects.find((p) => p.status !== "completed")?.id ?? db.projects[0]?.id ?? "", feature: "", description: "", hours: 0, cost: 0, timelineImpact: "" });
    setOpen(true);
  };
  const save = () => {
    const p = db.projects.find((x) => x.id === form.projectId);
    if (!p || !form.feature.trim()) return alert("Choose a project and describe the request.");
    update("scopes", [{ id: uid("sc"), projectId: p.id, projectName: p.name, feature: form.feature.trim(), description: form.description, hours: form.hours, cost: form.cost, timelineImpact: form.timelineImpact || "—", status: form.cost > 0 ? "estimated" : "requested", created: todayISO() }, ...db.scopes]);
    setOpen(false);
  };
  // Approving adds the work to the project's task list so it isn't forgotten.
  const approve = (s: ScopeChange) => {
    patch(s.id, { status: "approved" });
    update("projects", db.projects.map((p) => (p.id === s.projectId && !p.tasks.some((t) => t.title === `Change request: ${s.feature}`) ? { ...p, tasks: [...p.tasks, { id: uid("t"), title: `Change request: ${s.feature}`, done: false }] } : p)));
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Scope changes" description="Anything outside the agreed scope gets estimated and approved here before anyone builds it."
        actions={<Btn onClick={openNew}><Plus size={15} /> New request</Btn>} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Metric label="Awaiting approval" value={inr(pendingValue)} sub={`${db.scopes.filter((s) => !approvedStates.includes(s.status)).length} requests`} icon={<Clock size={15} />} />
        <Metric label="Approved extra work" value={inr(approvedValue)} sub="billable on top of the original scope" icon={<IndianRupee size={15} />} accent="text-emerald-600 dark:text-emerald-400" />
      </div>

      {db.scopes.length === 0 ? (
        <Empty icon={<Repeat size={18} />} title="No change requests" sub="When a client asks for something new mid-project, log it here, estimate it, and get approval before building." action={<Btn onClick={openNew}><Plus size={15} /> New request</Btn>} />
      ) : (
        <>
          <Tabs value={filter} onChange={setFilter} tabs={FILTERS} />
          <div className="space-y-3">
            {list.map((s) => {
              const idx = FLOW.findIndex((f) => f.id === s.status);
              return (
                <Card key={s.id} className="p-5">
                  <div className="flex flex-wrap items-start gap-3">
                    <div className="min-w-[200px] flex-1">
                      <div className="flex flex-wrap items-center gap-2"><span className="text-[14.5px] font-semibold">{s.feature}</span><Badge tone={tone(s.status)} dot>{FLOW[idx]?.label ?? s.status}</Badge></div>
                      <div className="mt-0.5 text-[12.5px] text-muted">{s.projectName} · raised {s.created}</div>
                      {s.description && <p className="mt-2 text-[13px] text-muted">{s.description}</p>}
                    </div>
                    <div className="text-right">
                      <div className="text-[16px] font-semibold tabular-nums">{inr(s.cost)}</div>
                      <div className="text-[12px] text-muted">{s.hours}h · timeline {s.timelineImpact}</div>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-1">
                    {FLOW.map((f, i) => (
                      <button key={f.id} onClick={() => (f.id === "approved" ? approve(s) : patch(s.id, { status: f.id }))}
                        className={cn("flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-medium transition",
                          i === idx ? "bg-accent text-accent-ink" : i < idx ? "bg-accent-soft text-accent" : "bg-surface-2 text-muted hover:text-ink")}>
                        {i < idx && <Check size={11} strokeWidth={3} />}{f.label}
                      </button>
                    ))}
                    <span className="flex-1" />
                    {!approvedStates.includes(s.status) && <Btn size="sm" onClick={() => approve(s)}><Check size={13} /> Approve & add task</Btn>}
                    <Btn size="sm" variant="ghost" title="Delete" className="text-subtle hover:text-red-600" onClick={() => { if (confirm("Delete this request?")) update("scopes", db.scopes.filter((x) => x.id !== s.id)); }}><Trash2 size={13} /></Btn>
                  </div>
                </Card>
              );
            })}
            {list.length === 0 && <p className="text-center text-[13px] text-muted">Nothing here.</p>}
          </div>
        </>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="New change request"
        footer={<><Btn variant="ghost" onClick={() => setOpen(false)}>Cancel</Btn><Btn onClick={save} disabled={db.projects.length === 0}>Save request</Btn></>}>
        {db.projects.length === 0 ? (
          <p className="text-[13.5px] text-muted">Change requests belong to a project. <Link href="/projects?action=new" className="font-medium text-accent hover:underline">Create a project</Link> first.</p>
        ) : (
          <div className="grid gap-4">
            <Field label="Project"><select className={inputCls} value={form.projectId} onChange={(e) => setForm({ ...form, projectId: e.target.value })}>{db.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
            <Field label="What's being asked for"><input autoFocus className={inputCls} value={form.feature} onChange={(e) => setForm({ ...form, feature: e.target.value })} placeholder="e.g. Three extra blog templates" /></Field>
            <Field label="Details"><textarea rows={2} className={inputCls} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
            <div className="grid grid-cols-3 gap-4">
              <Field label="Hours"><input type="number" min={0} className={inputCls} value={form.hours || ""} onChange={(e) => setForm({ ...form, hours: Number(e.target.value) })} /></Field>
              <Field label="Price (₹)"><input type="number" min={0} className={inputCls} value={form.cost || ""} onChange={(e) => setForm({ ...form, cost: Number(e.target.value) })} /></Field>
              <Field label="Timeline impact"><input className={inputCls} value={form.timelineImpact} onChange={(e) => setForm({ ...form, timelineImpact: e.target.value })} placeholder="+3 days" /></Field>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
