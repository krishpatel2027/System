"use client";
import React, { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useDB } from "@/lib/store";
import { inr, uid, todayISO, addDaysISO } from "@/lib/utils";
import { Card, Badge, Btn, Empty, Modal, Field, inputCls } from "@/components/ui";
import { Plus } from "lucide-react";
import type { Project, ProjectStatus } from "@/lib/types";

const STATUSES: ProjectStatus[] = ["planning", "design", "development", "review", "qa", "launch", "completed"];

function ProjectsInner() {
  const { db, update } = useDB();
  const params = useSearchParams();
  const [open, setOpen] = useState(params.get("action") === "new");
  const [sel, setSel] = useState<Project | null>(null);
  const [form, setForm] = useState({ name: "", clientId: db.clients[0]?.id ?? "", value: 35000 });
  const [task, setTask] = useState("");

  const save = () => {
    const c = db.clients.find((x) => x.id === form.clientId) ?? db.clients[0];
    if (!form.name.trim() || !c) return alert("Name + client required");
    const p: Project = {
      id: uid("pj"), name: form.name, clientId: c.id, clientName: c.company,
      value: form.value, start: todayISO(), deadline: addDaysISO(28), manager: "Krish",
      status: "planning", progress: 5, notes: "", tasks: [], milestones: [
        { id: uid("m"), name: "Advance", deadline: todayISO(), status: "pending", payment: Math.round(form.value * 0.5), deliverables: "Kickoff" },
        { id: uid("m"), name: "Milestone", deadline: addDaysISO(18), status: "pending", payment: Math.round(form.value * 0.3), deliverables: "Staging" },
        { id: uid("m"), name: "Launch", deadline: addDaysISO(28), status: "pending", payment: Math.round(form.value * 0.2), deliverables: "Live" },
      ],
    };
    update("projects", [p, ...db.projects]);
    // auto-create payment schedule
    update("payments", [
      { id: uid("pay"), projectId: p.id, clientName: c.company, label: "Advance 50%", amount: Math.round(form.value * 0.5), due: todayISO(), status: "pending" },
      { id: uid("pay"), projectId: p.id, clientName: c.company, label: "Milestone 30%", amount: Math.round(form.value * 0.3), due: addDaysISO(18), status: "pending" },
      { id: uid("pay"), projectId: p.id, clientName: c.company, label: "Final 20%", amount: Math.round(form.value * 0.2), due: addDaysISO(28), status: "pending" },
      ...db.payments,
    ]);
    setOpen(false);
  };

  const patch = (p: Project) => {
    update("projects", db.projects.map((x) => (x.id === p.id ? p : x)));
    setSel(p);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><h1 className="text-[22px] font-semibold tracking-tight">Projects</h1><p className="text-[13px] text-neutral-500">Planning → Design → Development → Review → QA → Launch</p></div>
        <Btn onClick={() => setOpen(true)}><Plus size={15} /> New Project</Btn>
      </div>
      {db.projects.length === 0 && <Empty title="No projects yet" sub="Won quotes become projects with payment schedules." action={<Btn onClick={() => setOpen(true)}>+ New Project</Btn>} />}
      <div className="grid gap-3 md:grid-cols-2">
        {db.projects.map((p) => (
          <Card key={p.id} className="cursor-pointer p-5" >
            <div onClick={() => setSel(p)}>
              <div className="flex items-center justify-between gap-2"><span className="text-[14.5px] font-semibold">{p.name}</span><Badge tone={p.status === "completed" ? "green" : "blue"}>{p.status}</Badge></div>
              <div className="text-[13px] text-neutral-500">{p.clientName} · {inr(p.value)} · due {p.deadline}</div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800"><div className="h-full rounded-full bg-neutral-900 dark:bg-white" style={{ width: `${p.progress}%` }} /></div>
              <div className="mt-1 text-[12px] text-neutral-500">{p.progress}% · {p.tasks.filter(t=>t.done).length}/{p.tasks.length} tasks</div>
            </div>
          </Card>
        ))}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="New Project">
        <div className="grid gap-3">
          <Field label="Project name"><input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="ABC — Growth Website" /></Field>
          <Field label="Client"><select className={inputCls} value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value })}>{db.clients.map(c=><option key={c.id} value={c.id}>{c.company}</option>)}</select></Field>
          <Field label="Value (₹)"><input type="number" className={inputCls} value={form.value} onChange={(e) => setForm({ ...form, value: Number(e.target.value) })} /></Field>
        </div>
        <div className="mt-4 flex justify-end gap-2"><Btn variant="ghost" onClick={() => setOpen(false)}>Cancel</Btn><Btn onClick={save}>Create + Payment Plan</Btn></div>
      </Modal>

      <Modal open={!!sel} onClose={() => setSel(null)} title={sel?.name ?? ""} wide>
        {sel && (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Status"><select className={inputCls} value={sel.status} onChange={(e) => patch({ ...sel, status: e.target.value as ProjectStatus })}>{STATUSES.map(s=><option key={s}>{s}</option>)}</select></Field>
              <Field label={`Progress ${sel.progress}%`}><input type="range" min={0} max={100} value={sel.progress} onChange={(e) => patch({ ...sel, progress: Number(e.target.value) })} className="w-full" /></Field>
              <Field label="Deadline"><input type="date" className={inputCls} value={sel.deadline} onChange={(e) => patch({ ...sel, deadline: e.target.value })} /></Field>
            </div>
            <div>
              <div className="mb-1 text-[13.5px] font-semibold">Tasks</div>
              <div className="space-y-1.5">
                {sel.tasks.map((t) => (
                  <div key={t.id} className="flex items-center gap-2 rounded-xl border border-neutral-100 px-3 py-1.5 text-[13.5px] dark:border-neutral-800">
                    <input type="checkbox" checked={t.done} onChange={() => patch({ ...sel, tasks: sel.tasks.map((x) => (x.id === t.id ? { ...x, done: !x.done } : x)) })} />
                    <span className={t.done ? "line-through text-neutral-400" : ""}>{t.title}</span>
                  </div>
                ))}
              </div>
              <div className="mt-2 flex gap-2">
                <input className={inputCls} placeholder="Add task…" value={task} onChange={(e) => setTask(e.target.value)} />
                <Btn variant="outline" onClick={() => { if (!task.trim()) return; patch({ ...sel, tasks: [...sel.tasks, { id: uid("t"), title: task, done: false }] }); setTask(""); }}>Add</Btn>
              </div>
            </div>
            <div>
              <div className="mb-1 text-[13.5px] font-semibold">Milestones</div>
              {sel.milestones.map((m) => (
                <div key={m.id} className="mb-1.5 flex items-center justify-between rounded-xl border border-neutral-100 px-3 py-2 text-[13px] dark:border-neutral-800">
                  <span>{m.name} · {m.deadline} · {inr(m.payment)}</span>
                  <select value={m.status} onChange={(e) => patch({ ...sel, milestones: sel.milestones.map((x) => (x.id === m.id ? { ...x, status: e.target.value as never } : x)) })} className="rounded-lg border border-neutral-200 px-2 py-1 text-[12px] dark:border-neutral-700 dark:bg-neutral-900">
                    <option value="pending">pending</option><option value="in-progress">in-progress</option><option value="done">done</option>
                  </select>
                </div>
              ))}
            </div>
            {sel.status === "completed" && <Card className="border-emerald-200 bg-emerald-50 p-3 text-[13px] dark:bg-emerald-950">🎉 Completed — offer a maintenance plan: <a href="/maintenance" className="font-semibold underline">Open Maintenance →</a></Card>}
          </div>
        )}
      </Modal>
    </div>
  );
}
export default function ProjectsPage() { return <Suspense><ProjectsInner /></Suspense>; }
