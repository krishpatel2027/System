"use client";
import React, { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useDB } from "@/lib/store";
import { inr, uid, todayISO, addDaysISO, daysUntil, cn } from "@/lib/utils";
import { Card, Badge, Btn, Empty, Modal, Field, inputCls, PageHeader, Tabs, Progress, Avatar } from "@/components/ui";
import { Plus, KanbanSquare, Check, CalendarClock, Wrench, X } from "lucide-react";
import type { Project, ProjectStatus, Milestone } from "@/lib/types";

const STATUSES: ProjectStatus[] = ["planning", "design", "development", "review", "qa", "launch", "completed"];
const LABEL: Record<ProjectStatus, string> = { planning: "Planning", design: "Design", development: "Development", review: "Review", qa: "QA", launch: "Launch", completed: "Completed" };
const FILTERS = ["active", "completed", "all"] as const;
const SPLIT = [{ name: "Advance", pct: 50, at: 0, deliverables: "Kick-off" }, { name: "Development milestone", pct: 30, at: 0.6, deliverables: "Site on staging" }, { name: "Launch", pct: 20, at: 1, deliverables: "Live site + handover" }];

function ProjectsInner() {
  const { db, update, userName } = useDB();
  const params = useSearchParams();
  const [open, setOpen] = useState(params.get("action") === "new");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("active");
  const [selId, setSelId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", clientId: "", value: 0, start: todayISO(), deadline: addDaysISO(28), schedule: true });
  const sel = db.projects.find((p) => p.id === selId) ?? null;
  const me = userName || db.settings.owner;

  const list = db.projects
    .filter((p) => filter === "all" || (filter === "completed" ? p.status === "completed" : p.status !== "completed"))
    .sort((a, b) => a.deadline.localeCompare(b.deadline));

  const openNew = () => {
    setForm({ name: "", clientId: db.clients[0]?.id ?? "", value: 0, start: todayISO(), deadline: addDaysISO(28), schedule: true });
    setOpen(true);
  };

  const save = () => {
    const c = db.clients.find((x) => x.id === form.clientId);
    if (!form.name.trim() || !c) return alert("Add a project name and choose a client.");
    const days = Math.max(1, Math.round((new Date(form.deadline).getTime() - new Date(form.start).getTime()) / 86400000));
    const dateAt = (f: number) => { const d = new Date(form.start + "T00:00:00"); d.setDate(d.getDate() + Math.round(days * f)); return d.toISOString().slice(0, 10); };
    const milestones: Milestone[] = SPLIT.map((m) => ({ id: uid("m"), name: m.name, deadline: dateAt(m.at), status: "pending", payment: Math.round((form.value * m.pct) / 100), deliverables: m.deliverables }));
    const p: Project = { id: uid("pj"), name: form.name.trim(), clientId: c.id, clientName: c.company, value: form.value, start: form.start, deadline: form.deadline, manager: me, status: "planning", progress: 0, notes: "", tasks: [], milestones };
    update("projects", [p, ...db.projects]);
    if (form.schedule && form.value > 0) {
      update("payments", [
        ...SPLIT.map((m) => ({ id: uid("pay"), projectId: p.id, clientName: c.company, label: `${m.name} ${m.pct}%`, amount: Math.round((form.value * m.pct) / 100), due: dateAt(m.at), status: "pending" as const })),
        ...db.payments,
      ]);
    }
    setOpen(false);
    setSelId(p.id);
  };

  const patch = (p: Partial<Project>) => sel && update("projects", db.projects.map((x) => (x.id === sel.id ? { ...x, ...p } : x)));

  return (
    <div className="space-y-6">
      <PageHeader title="Projects" description={`${db.projects.filter((p) => p.status !== "completed").length} in progress · ${inr(db.projects.filter((p) => p.status !== "completed").reduce((a, p) => a + p.value, 0))} in delivery`}
        actions={<Btn onClick={openNew}><Plus size={15} /> New project</Btn>} />

      {db.projects.length === 0 ? (
        <Empty icon={<KanbanSquare size={18} />} title="No projects yet" sub="When a client says yes, create the project here — its payment schedule is set up for you." action={<Btn onClick={openNew}><Plus size={15} /> New project</Btn>} />
      ) : (
        <>
          <Tabs value={filter} onChange={setFilter} tabs={FILTERS} />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {list.map((p) => {
              const d = daysUntil(p.deadline);
              const done = p.tasks.filter((t) => t.done).length;
              return (
                <div key={p.id} role="button" tabIndex={0} onClick={() => setSelId(p.id)} onKeyDown={(e) => e.key === "Enter" && setSelId(p.id)} className="cursor-pointer rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-accent/40">
                  <Card className="h-full p-5 transition hover:-translate-y-0.5 hover:border-line-strong hover:shadow-lg">
                    <div className="flex items-start gap-3">
                      <Avatar name={p.clientName} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[14.5px] font-semibold tracking-tight">{p.name}</div>
                        <div className="text-[12.5px] text-muted">{p.clientName} · {inr(p.value)}</div>
                      </div>
                      <Badge tone={p.status === "completed" ? "green" : "violet"}>{LABEL[p.status]}</Badge>
                    </div>
                    <div className="mt-4 flex items-center gap-3"><Progress value={p.progress} tone="accent" className="flex-1" /><span className="text-[12px] tabular-nums text-muted">{p.progress}%</span></div>
                    <div className="mt-3 flex items-center justify-between text-[12px]">
                      <span className={cn("inline-flex items-center gap-1", p.status === "completed" ? "text-muted" : d < 0 ? "text-red-600" : d <= 7 ? "text-amber-600" : "text-muted")}>
                        <CalendarClock size={12} />{p.status === "completed" ? "Delivered" : d < 0 ? `${-d}d past deadline` : `Due in ${d}d`}
                      </span>
                      <span className="text-subtle">{p.tasks.length ? `${done}/${p.tasks.length} tasks` : "No tasks yet"}</span>
                    </div>
                  </Card>
                </div>
              );
            })}
          </div>
          {list.length === 0 && <p className="text-center text-[13px] text-muted">No {filter} projects.</p>}
        </>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="New project"
        footer={<><Btn variant="ghost" onClick={() => setOpen(false)}>Cancel</Btn><Btn onClick={save} disabled={db.clients.length === 0}>Create project</Btn></>}>
        {db.clients.length === 0 ? (
          <p className="text-[13.5px] text-muted">Projects belong to a client. <Link href="/clients?action=new" className="font-medium text-accent hover:underline">Add your first client</Link> (or convert a won lead), then come back.</p>
        ) : (
          <div className="grid gap-4">
            <Field label="Project name"><input autoFocus className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Acme — Business website" /></Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Client"><select className={inputCls} value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value })}>{db.clients.map((c) => <option key={c.id} value={c.id}>{c.company}</option>)}</select></Field>
              <Field label="Project value (₹)"><input type="number" min={0} className={inputCls} value={form.value || ""} onChange={(e) => setForm({ ...form, value: Number(e.target.value) })} /></Field>
              <Field label="Start"><input type="date" className={inputCls} value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} /></Field>
              <Field label="Deadline"><input type="date" className={inputCls} value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} /></Field>
            </div>
            <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-line p-3 text-[13px]">
              <input type="checkbox" checked={form.schedule} onChange={(e) => setForm({ ...form, schedule: e.target.checked })} className="mt-0.5 h-4 w-4 accent-[var(--accent)]" />
              <span><span className="font-medium">Create payment schedule</span><span className="block text-muted">50% advance, 30% at the development milestone, 20% at launch — added to Payments.</span></span>
            </label>
          </div>
        )}
      </Modal>

      <Modal open={!!sel} onClose={() => setSelId(null)} wide
        title={sel && <span className="flex items-center gap-2.5">{sel.name}<Badge tone={sel.status === "completed" ? "green" : "violet"}>{LABEL[sel.status]}</Badge></span>}
        footer={sel && <>
          <Btn variant="ghost" className="mr-auto text-red-600 hover:bg-red-50 dark:hover:bg-red-950" onClick={() => { if (confirm(`Delete ${sel.name}? Its payments stay in Payments.`)) { update("projects", db.projects.filter((x) => x.id !== sel.id)); setSelId(null); } }}>Delete</Btn>
          <Btn onClick={() => setSelId(null)}>Done</Btn>
        </>}>
        {sel && <ProjectDetail p={sel} patch={patch} />}
      </Modal>
    </div>
  );
}

function ProjectDetail({ p, patch }: { p: Project; patch: (x: Partial<Project>) => void }) {
  const [task, setTask] = useState("");
  const addTask = () => { if (!task.trim()) return; patch({ tasks: [...p.tasks, { id: uid("t"), title: task.trim(), done: false }] }); setTask(""); };
  return (
    <div className="space-y-6">
      <div>
        <div className="mb-2 text-[12.5px] font-medium text-muted">Stage</div>
        <div className="flex flex-wrap gap-1.5">
          {STATUSES.map((s) => (
            <button key={s} onClick={() => patch({ status: s, progress: s === "completed" ? 100 : p.progress })}
              className={cn("rounded-full px-3 py-1.5 text-[12.5px] font-medium transition", p.status === s ? "bg-accent text-accent-ink" : "bg-surface-2 text-muted hover:text-ink")}>{LABEL[s]}</button>
          ))}
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label={`Progress — ${p.progress}%`}><input type="range" min={0} max={100} step={5} value={p.progress} onChange={(e) => patch({ progress: Number(e.target.value) })} className="mt-2 w-full accent-[var(--accent)]" /></Field>
        <Field label="Deadline"><input type="date" className={inputCls} value={p.deadline} onChange={(e) => patch({ deadline: e.target.value })} /></Field>
        <Field label="Project manager"><input className={inputCls} value={p.manager} onChange={(e) => patch({ manager: e.target.value })} /></Field>
      </div>

      <section>
        <div className="mb-2 flex items-center justify-between"><h4 className="text-[13.5px] font-semibold">Tasks</h4><span className="text-[12px] text-muted">{p.tasks.filter((t) => t.done).length}/{p.tasks.length} done</span></div>
        <div className="space-y-1.5">
          {p.tasks.map((t) => (
            <div key={t.id} className="group flex items-center gap-2.5 rounded-xl border border-line px-3 py-2 text-[13px]">
              <button onClick={() => patch({ tasks: p.tasks.map((x) => (x.id === t.id ? { ...x, done: !x.done } : x)) })}
                className={cn("flex h-4 w-4 shrink-0 items-center justify-center rounded border", t.done ? "border-accent bg-accent text-accent-ink" : "border-line-strong")} aria-label="Toggle task">{t.done && <Check size={11} strokeWidth={3} />}</button>
              <span className={cn("flex-1", t.done && "text-subtle line-through")}>{t.title}</span>
              <button onClick={() => patch({ tasks: p.tasks.filter((x) => x.id !== t.id) })} className="text-subtle opacity-0 transition hover:text-red-600 group-hover:opacity-100" aria-label="Delete task"><X size={14} /></button>
            </div>
          ))}
        </div>
        <div className="mt-2 flex gap-2">
          <input className={inputCls} placeholder="Add a task…" value={task} onChange={(e) => setTask(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addTask()} />
          <Btn variant="outline" onClick={addTask}>Add</Btn>
        </div>
      </section>

      {p.milestones.length > 0 && (
        <section>
          <h4 className="mb-2 text-[13.5px] font-semibold">Milestones</h4>
          <div className="divide-y divide-line rounded-xl border border-line">
            {p.milestones.map((m) => (
              <div key={m.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-[13px]">
                <div className="min-w-[160px] flex-1"><div className="font-medium">{m.name}</div><div className="text-[12px] text-muted">{m.deliverables} · {m.deadline}</div></div>
                <span className="tabular-nums">{inr(m.payment)}</span>
                <select value={m.status} onChange={(e) => patch({ milestones: p.milestones.map((x) => (x.id === m.id ? { ...x, status: e.target.value as Milestone["status"] } : x)) })}
                  className="h-8 rounded-lg border border-line bg-surface px-2 text-[12.5px] outline-none focus:border-accent">
                  <option value="pending">Pending</option><option value="in-progress">In progress</option><option value="done">Done</option>
                </select>
              </div>
            ))}
          </div>
        </section>
      )}

      <Field label="Notes"><textarea rows={3} className={inputCls} value={p.notes ?? ""} onChange={(e) => patch({ notes: e.target.value })} /></Field>

      {p.status === "completed" && (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[13px] dark:border-emerald-900 dark:bg-emerald-950/50">
          <Wrench size={15} className="text-emerald-600" />
          <span className="flex-1">Delivered! Offer {p.clientName} a care plan to keep the site healthy.</span>
          <Link href="/maintenance?action=new" className="font-medium text-emerald-700 hover:underline dark:text-emerald-300">Set up care plan</Link>
        </div>
      )}
    </div>
  );
}

export default function ProjectsPage() {
  return <Suspense><ProjectsInner /></Suspense>;
}
