"use client";
import React, { useMemo, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useDB } from "@/lib/store";
import { inr, uid, todayISO, addDaysISO, daysUntil, cn } from "@/lib/utils";
import { STAGES, leadValue } from "@/lib/stages";
import type { Lead, LeadStage } from "@/lib/types";
import { Badge, Btn, Modal, Field, inputCls, PageHeader, Tabs, Avatar, Empty } from "@/components/ui";
import { Plus, Search, CalendarClock, LayoutGrid, List, UserPlus, Check } from "lucide-react";

const SERVICES = ["Landing Page", "Business Website", "Corporate Website", "Premium Interactive Website", "E-commerce", "Web Application", "Mobile App", "AI Chatbot", "SEO", "Maintenance"];
const SOURCES = ["Website", "Instagram", "Referral", "WhatsApp", "Cold outreach", "Ads"];

const emptyLead = (): Lead => ({
  id: uid("lead"), company: "", industry: "", contactName: "", service: "Business Website",
  source: "Website", dateAdded: todayISO(), score: 50, stage: "new", nextFollowUp: addDaysISO(2),
});

const scoreTone = (s: number) => (s >= 70 ? "green" : s >= 50 ? "blue" : "neutral") as "green" | "blue" | "neutral";
const stageTone = (s: LeadStage) => (s === "won" ? "green" : s === "lost" ? "red" : s === "negotiation" || s === "proposal" ? "amber" : "violet") as "green" | "red" | "amber" | "violet";

function FollowUp({ date }: { date?: string }) {
  if (!date) return <span className="text-subtle">—</span>;
  const d = daysUntil(date);
  return (
    <span className={cn("inline-flex items-center gap-1", d < 0 ? "text-red-600 dark:text-red-400" : d <= 1 ? "text-amber-600 dark:text-amber-400" : "text-muted")}>
      <CalendarClock size={12} />
      {d < 0 ? `${-d}d overdue` : d === 0 ? "Today" : d === 1 ? "Tomorrow" : date}
    </span>
  );
}

function LeadsInner() {
  const { db, update } = useDB();
  const params = useSearchParams();
  const [open, setOpen] = useState(params.get("action") === "new");
  const [detail, setDetail] = useState<Lead | null>(null);
  const [form, setForm] = useState<Lead>(emptyLead);
  const [view, setView] = useState<"board" | "list">("board");
  const [q, setQ] = useState("");
  const [dragOver, setDragOver] = useState<LeadStage | null>(null);

  const set = <K extends keyof Lead>(k: K, v: Lead[K]) => setForm((f) => ({ ...f, [k]: v }));

  const leads = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? db.leads.filter((l) => `${l.company} ${l.contactName} ${l.service} ${l.source} ${l.industry}`.toLowerCase().includes(s)) : db.leads;
  }, [db.leads, q]);
  const open_ = db.leads.filter((l) => !["won", "lost"].includes(l.stage));

  const save = () => {
    if (!form.company.trim() || !form.contactName.trim()) return alert("Company and contact name are required.");
    update("leads", [form, ...db.leads]);
    setOpen(false);
    setForm(emptyLead());
  };

  const move = (id: string, stage: LeadStage) => update("leads", db.leads.map((l) => (l.id === id ? { ...l, stage } : l)));

  const change = (nl: Lead) => { update("leads", db.leads.map((l) => (l.id === nl.id ? nl : l))); setDetail(nl); };

  const convert = (l: Lead) => {
    if (db.clients.some((c) => c.company === l.company)) return alert(`${l.company} is already a client.`);
    update("clients", [{ id: uid("cl"), company: l.company, industry: l.industry, contactName: l.contactName, email: l.email, phone: l.phone, whatsapp: l.whatsapp, location: l.location, website: l.website, dateAdded: todayISO(), onboarding: {} }, ...db.clients]);
    update("leads", db.leads.map((x) => (x.id === l.id ? { ...x, stage: "won" } : x)));
    setDetail(null);
  };

  const del = (id: string) => {
    if (!confirm("Delete this lead? This can't be undone.")) return;
    update("leads", db.leads.filter((l) => l.id !== id));
    setDetail(null);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Leads"
        description={`${open_.length} open · ${inr(open_.reduce((a, l) => a + leadValue(l), 0))} in pipeline`}
        actions={<Btn onClick={() => { setForm(emptyLead()); setOpen(true); }}><Plus size={15} /> Add lead</Btn>}
      />

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1 sm:max-w-xs">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-subtle" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search leads…" className={cn(inputCls, "pl-8")} />
        </div>
        <Tabs value={view} onChange={setView} className="ml-auto"
          tabs={[{ id: "board", label: <span className="flex items-center gap-1.5"><LayoutGrid size={13} /> Board</span> }, { id: "list", label: <span className="flex items-center gap-1.5"><List size={13} /> List</span> }]} />
      </div>

      {db.leads.length === 0 ? (
        <Empty icon={<UserPlus size={18} />} title="No leads yet" sub="Add your first lead to start building your pipeline." action={<Btn onClick={() => setOpen(true)}><Plus size={15} /> Add lead</Btn>} />
      ) : view === "board" ? (
        <div className="-mx-4 overflow-x-auto px-4 pb-3 sm:-mx-8 sm:px-8">
          <div className="grid auto-cols-[272px] grid-flow-col gap-3">
            {STAGES.map((s) => {
              const items = leads.filter((l) => l.stage === s.id);
              const total = items.reduce((a, l) => a + leadValue(l), 0);
              return (
                <div key={s.id}
                  className={cn("flex min-h-[420px] flex-col rounded-2xl border p-2 transition-colors", dragOver === s.id ? "border-accent bg-accent-soft/60" : "border-line bg-surface-2/50")}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(s.id); }}
                  onDragLeave={() => setDragOver((d) => (d === s.id ? null : d))}
                  onDrop={(e) => { const id = e.dataTransfer.getData("lead"); setDragOver(null); if (id) move(id, s.id); }}>
                  <div className="flex items-center justify-between px-2 pb-2 pt-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-semibold">{s.label}</span>
                      <span className="rounded-full bg-surface px-1.5 text-[11px] font-medium text-muted ring-1 ring-line">{items.length}</span>
                    </div>
                    <span className="text-[11.5px] tabular-nums text-subtle">{total ? inr(total) : ""}</span>
                  </div>
                  <div className="flex-1 space-y-2">
                    {items.map((l) => (
                      <div key={l.id} role="button" tabIndex={0} draggable onDragStart={(e) => e.dataTransfer.setData("lead", l.id)} onClick={() => setDetail(l)}
                        onKeyDown={(e) => e.key === "Enter" && setDetail(l)}
                        className="block w-full cursor-grab outline-none focus-visible:ring-2 focus-visible:ring-accent/40 rounded-xl border border-line bg-surface p-3 text-left shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition hover:-translate-y-px hover:border-line-strong hover:shadow-md active:cursor-grabbing">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="truncate text-[13.5px] font-semibold">{l.company}</div>
                            <div className="truncate text-[12px] text-muted">{l.contactName} · {l.service}</div>
                          </div>
                          {l.demo && <span className="rounded bg-surface-2 px-1 text-[9.5px] font-semibold tracking-wide text-subtle">DEMO</span>}
                        </div>
                        <div className="mt-3 flex items-center justify-between text-[12px]">
                          <span className="font-semibold tabular-nums">{inr(leadValue(l))}</span>
                          <Badge tone={scoreTone(l.score)}>Score {l.score}</Badge>
                        </div>
                        <div className="mt-2 flex items-center justify-between border-t border-line pt-2 text-[11.5px]">
                          <FollowUp date={l.nextFollowUp} />
                          <span className="text-subtle">{l.source}</span>
                        </div>
                      </div>
                    ))}
                    {items.length === 0 && <div className="rounded-xl border border-dashed border-line px-3 py-6 text-center text-[12px] text-subtle">Drop leads here</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-line bg-surface">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-[13px]">
              <thead>
                <tr className="border-b border-line bg-surface-2/60 text-left text-[12px] text-muted">
                  <th className="px-4 py-2.5 font-medium">Company</th>
                  <th className="px-4 py-2.5 font-medium">Stage</th>
                  <th className="px-4 py-2.5 text-right font-medium">Value</th>
                  <th className="px-4 py-2.5 font-medium">Score</th>
                  <th className="px-4 py-2.5 font-medium">Follow-up</th>
                  <th className="px-4 py-2.5 font-medium">Source</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {leads.map((l) => (
                  <tr key={l.id} onClick={() => setDetail(l)} className="cursor-pointer transition hover:bg-surface-2/60">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={l.company} className="h-8 w-8 text-[11px]" />
                        <div className="min-w-0"><div className="font-medium">{l.company}</div><div className="text-[12px] text-muted">{l.contactName} · {l.service}</div></div>
                      </div>
                    </td>
                    <td className="px-4 py-3"><Badge tone={stageTone(l.stage)} dot>{STAGES.find((s) => s.id === l.stage)?.label}</Badge></td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums">{inr(leadValue(l))}</td>
                    <td className="px-4 py-3"><Badge tone={scoreTone(l.score)}>{l.score}</Badge></td>
                    <td className="px-4 py-3 text-[12.5px]"><FollowUp date={l.nextFollowUp} /></td>
                    <td className="px-4 py-3 text-muted">{l.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {leads.length === 0 && <div className="px-4 py-10 text-center text-[13px] text-muted">No leads match “{q}”.</div>}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="New lead" wide
        footer={<><Btn variant="ghost" onClick={() => setOpen(false)}>Cancel</Btn><Btn onClick={save}>Save lead</Btn></>}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Company *"><input autoFocus className={inputCls} value={form.company} onChange={(e) => set("company", e.target.value)} placeholder="Acme Realty" /></Field>
          <Field label="Contact name *"><input className={inputCls} value={form.contactName} onChange={(e) => set("contactName", e.target.value)} placeholder="Full name" /></Field>
          <Field label="Industry"><input className={inputCls} value={form.industry} onChange={(e) => set("industry", e.target.value)} placeholder="Real estate, interiors…" /></Field>
          <Field label="Phone / WhatsApp"><input className={inputCls} value={form.phone ?? ""} onChange={(e) => set("phone", e.target.value)} placeholder="+91" /></Field>
          <Field label="Email"><input type="email" className={inputCls} value={form.email ?? ""} onChange={(e) => set("email", e.target.value)} /></Field>
          <Field label="Service"><select className={inputCls} value={form.service} onChange={(e) => set("service", e.target.value)}>{SERVICES.map((s) => <option key={s}>{s}</option>)}</select></Field>
          <Field label="Budget (₹)"><input type="number" className={inputCls} value={form.budget ?? ""} onChange={(e) => set("budget", Number(e.target.value))} /></Field>
          <Field label="Source"><select className={inputCls} value={form.source} onChange={(e) => set("source", e.target.value)}>{SOURCES.map((s) => <option key={s}>{s}</option>)}</select></Field>
          <Field label="Lead score" hint="0–100 · how likely they are to buy"><input type="number" min={0} max={100} className={inputCls} value={form.score} onChange={(e) => set("score", Number(e.target.value))} /></Field>
          <Field label="Next follow-up"><input type="date" className={inputCls} value={form.nextFollowUp ?? ""} onChange={(e) => set("nextFollowUp", e.target.value)} /></Field>
          <div className="sm:col-span-2"><Field label="Main problem / notes"><textarea rows={3} className={inputCls} value={form.problem ?? ""} onChange={(e) => set("problem", e.target.value)} placeholder="What are they trying to fix?" /></Field></div>
        </div>
      </Modal>

      <Modal open={!!detail} onClose={() => setDetail(null)} wide
        title={detail && <span className="flex items-center gap-2.5">{detail.company}<Badge tone={stageTone(detail.stage)} dot>{STAGES.find((s) => s.id === detail.stage)?.label}</Badge></span>}
        footer={detail && <>
          <Btn variant="ghost" className="mr-auto text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950" onClick={() => del(detail.id)}>Delete</Btn>
          {detail.stage !== "won" && <Btn variant="outline" onClick={() => convert(detail)}><Check size={14} /> Convert to client</Btn>}
          <Btn onClick={() => setDetail(null)}>Done</Btn>
        </>}>
        {detail && <LeadDetail lead={detail} onChange={change} />}
      </Modal>
    </div>
  );
}

function LeadDetail({ lead, onChange }: { lead: Lead; onChange: (l: Lead) => void }) {
  const [tab, setTab] = useState<"details" | "audit" | "stage">("details");
  const set = <K extends keyof Lead>(k: K, v: Lead[K]) => onChange({ ...lead, [k]: v });
  const stageIdx = STAGES.findIndex((s) => s.id === lead.stage);
  return (
    <div className="space-y-5">
      <Tabs tabs={["details", "audit", "stage"] as const} value={tab} onChange={setTab} />
      {tab === "details" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Contact"><input className={inputCls} value={lead.contactName} onChange={(e) => set("contactName", e.target.value)} /></Field>
          <Field label="Score"><input type="number" className={inputCls} value={lead.score} onChange={(e) => set("score", Number(e.target.value))} /></Field>
          <Field label="Phone"><input className={inputCls} value={lead.phone ?? ""} onChange={(e) => set("phone", e.target.value)} /></Field>
          <Field label="Email"><input className={inputCls} value={lead.email ?? ""} onChange={(e) => set("email", e.target.value)} /></Field>
          <Field label="Budget (₹)"><input type="number" className={inputCls} value={lead.budget ?? ""} onChange={(e) => set("budget", Number(e.target.value))} /></Field>
          <Field label="Timeline"><input className={inputCls} value={lead.timeline ?? ""} onChange={(e) => set("timeline", e.target.value)} /></Field>
          <Field label="Next follow-up"><input type="date" className={inputCls} value={lead.nextFollowUp ?? ""} onChange={(e) => set("nextFollowUp", e.target.value)} /></Field>
          <Field label="Service"><select className={inputCls} value={lead.service} onChange={(e) => set("service", e.target.value)}>{[...new Set([lead.service, ...SERVICES])].map((s) => <option key={s}>{s}</option>)}</select></Field>
          <div className="sm:col-span-2"><Field label="Problem"><textarea className={inputCls} rows={2} value={lead.problem ?? ""} onChange={(e) => set("problem", e.target.value)} /></Field></div>
          <div className="sm:col-span-2"><Field label="Desired outcome"><textarea className={inputCls} rows={2} value={lead.outcome ?? ""} onChange={(e) => set("outcome", e.target.value)} /></Field></div>
          <div className="sm:col-span-2"><Field label="Notes"><textarea className={inputCls} rows={2} value={lead.notes ?? ""} onChange={(e) => set("notes", e.target.value)} /></Field></div>
        </div>
      )}
      {tab === "audit" && (
        <div className="grid gap-4">
          {([["currentSituation", "Current situation"], ["problems", "Problems"], ["opportunities", "Opportunities"], ["recommended", "Recommended solution"]] as const).map(([k, label]) => (
            <Field key={k} label={label}><textarea rows={2} className={inputCls} value={lead[k] ?? ""} onChange={(e) => set(k, e.target.value)} /></Field>
          ))}
          <div className="grid grid-cols-2 gap-4">
            <Field label="Estimate — low (₹)"><input type="number" className={inputCls} value={lead.estLow ?? ""} onChange={(e) => set("estLow", Number(e.target.value))} /></Field>
            <Field label="Estimate — high (₹)"><input type="number" className={inputCls} value={lead.estHigh ?? ""} onChange={(e) => set("estHigh", Number(e.target.value))} /></Field>
          </div>
          {(lead.estLow || lead.estHigh) ? (
            <div className="rounded-xl border border-accent-line bg-accent-soft px-4 py-3">
              <div className="text-[12px] text-muted">Estimated investment</div>
              <div className="text-[18px] font-semibold tabular-nums">{inr(lead.estLow ?? 0)} – {inr(lead.estHigh ?? 0)}</div>
            </div>
          ) : null}
          {(lead.features?.length ?? 0) > 0 && (
            <div className="flex flex-wrap gap-1.5">{lead.features!.map((f) => <Badge key={f}>{f}</Badge>)}</div>
          )}
        </div>
      )}
      {tab === "stage" && (
        <div className="space-y-4">
          <div className="grid gap-1.5 sm:grid-cols-4">
            {STAGES.map((s, i) => (
              <button key={s.id} onClick={() => set("stage", s.id)}
                className={cn("rounded-xl border px-3 py-2 text-left text-[12.5px] font-medium transition",
                  s.id === lead.stage ? "border-accent bg-accent-soft text-ink" : i < stageIdx && lead.stage !== "lost" ? "border-line bg-surface-2 text-muted" : "border-line text-muted hover:border-line-strong")}>
                <span className="mr-1.5 text-subtle">{i + 1}</span>{s.label}
              </button>
            ))}
          </div>
          <div className="rounded-xl bg-surface-2 p-4 text-[13px] leading-relaxed text-muted">
            <div className="mb-1 font-medium text-ink">Discovery checklist</div>
            Goals and success metrics · what they like/dislike about their current site · content readiness · functionality needed (WhatsApp, booking, payments, CMS, AI) · design references · decision maker and timeline.
          </div>
        </div>
      )}
    </div>
  );
}

export default function LeadsPage() {
  return <Suspense><LeadsInner /></Suspense>;
}
