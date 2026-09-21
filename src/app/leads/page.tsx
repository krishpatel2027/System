"use client";
import React, { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useDB } from "@/lib/store";
import { inr, uid, todayISO, addDaysISO } from "@/lib/utils";
import type { Lead, LeadStage } from "@/lib/types";
import { Badge, Btn, Modal, Field, inputCls } from "@/components/ui";
import { Plus } from "lucide-react";

export const STAGES: { id: LeadStage; label: string }[] = [
  { id: "new", label: "New Lead" },
  { id: "contacted", label: "Contacted" },
  { id: "interested", label: "Interested" },
  { id: "discovery", label: "Discovery" },
  { id: "proposal", label: "Proposal Sent" },
  { id: "negotiation", label: "Negotiation" },
  { id: "won", label: "Won" },
  { id: "lost", label: "Lost" },
];

const emptyLead: Lead = {
  id: "", company: "", industry: "", contactName: "", service: "Business Website",
  source: "Website", dateAdded: todayISO(), score: 50, stage: "new",
  nextFollowUp: addDaysISO(2),
};

function LeadsInner() {
  const { db, update } = useDB();
  const params = useSearchParams();
  const [open, setOpen] = useState(params.get("action") === "new");
  const [detail, setDetail] = useState<Lead | null>(null);
  const [form, setForm] = useState<Lead>({ ...emptyLead, id: uid("lead") });

  const set = (k: keyof Lead, v: never) => setForm((f) => ({ ...f, [k]: v }) as Lead);

  const save = () => {
    if (!form.company.trim() || !form.contactName.trim()) return alert("Company + contact required");
    const exists = db.leads.some((l) => l.id === form.id);
    update("leads", exists ? db.leads.map((l) => (l.id === form.id ? form : l)) : [form, ...db.leads]);
    setOpen(false);
    setForm({ ...emptyLead, id: uid("lead") });
  };

  const move = (id: string, stage: LeadStage) => {
    update("leads", db.leads.map((l) => (l.id === id ? { ...l, stage } : l)));
  };

  const convert = (l: Lead) => {
    if (db.clients.some((c) => c.company === l.company)) return alert("Client already exists");
    update("clients", [{ id: uid("cl"), company: l.company, industry: l.industry, contactName: l.contactName, email: l.email, phone: l.phone, whatsapp: l.whatsapp, location: l.location, website: l.website, dateAdded: todayISO(), onboarding: {} }, ...db.clients]);
    move(l.id, "won");
    alert(`${l.company} moved to Clients ✓`);
  };

  const del = (id: string) => {
    if (!confirm("Delete lead?")) return;
    update("leads", db.leads.filter((l) => l.id !== id));
    setDetail(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><h1 className="text-[22px] font-semibold tracking-tight">Leads</h1><p className="text-[13px] text-neutral-500">{db.leads.filter(l=>!["won","lost"].includes(l.stage)).length} open · drag cards between stages</p></div>
        <Btn onClick={() => { setForm({ ...emptyLead, id: uid("lead") }); setOpen(true); }}><Plus size={15} /> Add Lead</Btn>
      </div>

      <div className="grid auto-cols-[260px] grid-flow-col gap-3 overflow-x-auto pb-2">
        {STAGES.map((s) => {
          const items = db.leads.filter((l) => l.stage === s.id);
          return (
            <div key={s.id} className="rounded-2xl border border-neutral-200/70 bg-neutral-50/60 p-2 dark:border-neutral-800 dark:bg-neutral-900/40"
              onDragOver={(e) => e.preventDefault()} onDrop={(e) => { const id = e.dataTransfer.getData("lead"); if (id) move(id, s.id); }}>
              <div className="flex items-center justify-between px-2 py-1 text-[12.5px] font-semibold">{s.label}<span className="rounded-full bg-neutral-200/70 px-2 text-[11px] dark:bg-neutral-800">{items.length}</span></div>
              <div className="space-y-2">
                {items.map((l) => (
                  <div key={l.id} draggable onDragStart={(e) => e.dataTransfer.setData("lead", l.id)}
                    onClick={() => setDetail(l)} className="cursor-pointer rounded-xl border border-neutral-200 bg-white p-3 shadow-sm transition hover:shadow dark:border-neutral-700 dark:bg-neutral-900">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[13.5px] font-semibold">{l.company}</span>
                      {l.demo && <Badge>DEMO</Badge>}
                    </div>
                    <div className="text-[12.5px] text-neutral-500">{l.contactName} · {l.service}</div>
                    <div className="mt-2 flex items-center justify-between">
                      <Badge tone={l.score >= 70 ? "green" : l.score >= 50 ? "blue" : "neutral"}>{inr(l.estHigh ?? l.budget ?? 0)}</Badge>
                      <span className="text-[11.5px] text-neutral-400">↻ {l.nextFollowUp ?? "—"}</span>
                    </div>
                    <div className="mt-1 text-[11.5px] text-neutral-400">{l.source} · score {l.score}</div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* New / Edit modal */}
      <Modal open={open} onClose={() => setOpen(false)} title="New Lead" wide>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Company *"><input className={inputCls} value={form.company} onChange={(e) => set("company", e.target.value as never)} /></Field>
          <Field label="Contact name *"><input className={inputCls} value={form.contactName} onChange={(e) => set("contactName", e.target.value as never)} /></Field>
          <Field label="Industry"><input className={inputCls} value={form.industry} onChange={(e) => set("industry", e.target.value as never)} /></Field>
          <Field label="Phone / WhatsApp"><input className={inputCls} value={form.phone ?? ""} onChange={(e) => set("phone", e.target.value as never)} /></Field>
          <Field label="Email"><input className={inputCls} value={form.email ?? ""} onChange={(e) => set("email", e.target.value as never)} /></Field>
          <Field label="Service"><select className={inputCls} value={form.service} onChange={(e) => set("service", e.target.value as never)}>{["Landing Page","Business Website","Corporate Website","Premium Interactive Website","E-commerce","Web Application","Mobile App","AI Chatbot","SEO","Maintenance"].map(s=><option key={s}>{s}</option>)}</select></Field>
          <Field label="Budget (₹)"><input type="number" className={inputCls} value={form.budget ?? ""} onChange={(e) => set("budget", Number(e.target.value) as never)} /></Field>
          <Field label="Source"><select className={inputCls} value={form.source} onChange={(e) => set("source", e.target.value as never)}>{["Website","Instagram","Referral","WhatsApp","Cold outreach","Ads"].map(s=><option key={s}>{s}</option>)}</select></Field>
          <Field label="Score (0-100)"><input type="number" className={inputCls} value={form.score} onChange={(e) => set("score", Number(e.target.value) as never)} /></Field>
          <Field label="Next follow-up"><input type="date" className={inputCls} value={form.nextFollowUp ?? ""} onChange={(e) => set("nextFollowUp", e.target.value as never)} /></Field>
          <div className="sm:col-span-2"><Field label="Main problem / notes"><textarea rows={3} className={inputCls} value={form.problem ?? form.notes ?? ""} onChange={(e) => set("problem", e.target.value as never)} /></Field></div>
        </div>
        <div className="mt-4 flex justify-end gap-2"><Btn variant="ghost" onClick={() => setOpen(false)}>Cancel</Btn><Btn onClick={save}>Save Lead</Btn></div>
      </Modal>

      {/* Detail drawer-modal */}
      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail ? `${detail.company} — lead detail` : ""} wide>
        {detail && (
          <LeadDetail lead={detail} onChange={(nl) => { update("leads", db.leads.map((l) => (l.id === nl.id ? nl : l))); setDetail(nl); }} onConvert={() => convert(detail)} onDelete={() => del(detail.id)} />
        )}
      </Modal>
    </div>
  );
}

function LeadDetail({ lead, onChange, onConvert, onDelete }: { lead: Lead; onChange: (l: Lead) => void; onConvert: () => void; onDelete: () => void }) {
  const [tab, setTab] = useState<"info" | "audit" | "workflow">("info");
  const set = (k: keyof Lead, v: never) => onChange({ ...lead, [k]: v });
  return (
    <div>
      <div className="flex gap-1.5">
        {(["info", "audit", "workflow"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`rounded-lg px-3 py-1.5 text-[13px] font-medium capitalize ${tab === t ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900" : "bg-neutral-100 dark:bg-neutral-800"}`}>{t}</button>
        ))}
        <span className="ml-auto" />
        <Btn variant="outline" onClick={onConvert}>Convert to Client</Btn>
        <Btn variant="danger" onClick={onDelete}>Delete</Btn>
      </div>
      {tab === "info" && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label="Stage"><select className={inputCls} value={lead.stage} onChange={(e) => set("stage", e.target.value as never)}>{STAGES.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}</select></Field>
          <Field label="Score"><input type="number" className={inputCls} value={lead.score} onChange={(e) => set("score", Number(e.target.value) as never)} /></Field>
          <Field label="Contact"><input className={inputCls} value={lead.contactName} onChange={(e) => set("contactName", e.target.value as never)} /></Field>
          <Field label="Phone"><input className={inputCls} value={lead.phone ?? ""} onChange={(e) => set("phone", e.target.value as never)} /></Field>
          <Field label="Email"><input className={inputCls} value={lead.email ?? ""} onChange={(e) => set("email", e.target.value as never)} /></Field>
          <Field label="Next follow-up"><input type="date" className={inputCls} value={lead.nextFollowUp ?? ""} onChange={(e) => set("nextFollowUp", e.target.value as never)} /></Field>
          <Field label="Budget"><input type="number" className={inputCls} value={lead.budget ?? ""} onChange={(e) => set("budget", Number(e.target.value) as never)} /></Field>
          <Field label="Timeline"><input className={inputCls} value={lead.timeline ?? ""} onChange={(e) => set("timeline", e.target.value as never)} /></Field>
          <div className="sm:col-span-2"><Field label="Problem"><textarea className={inputCls} rows={2} value={lead.problem ?? ""} onChange={(e) => set("problem", e.target.value as never)} /></Field></div>
          <div className="sm:col-span-2"><Field label="Desired outcome"><textarea className={inputCls} rows={2} value={lead.outcome ?? ""} onChange={(e) => set("outcome", e.target.value as never)} /></Field></div>
          <div className="sm:col-span-2"><Field label="Notes"><textarea className={inputCls} rows={2} value={lead.notes ?? ""} onChange={(e) => set("notes", e.target.value as never)} /></Field></div>
        </div>
      )}
      {tab === "audit" && (
        <div className="mt-4 grid gap-3">
          {[["currentSituation","Current Situation"],["problems","Problems"],["opportunities","Opportunities"],["recommended","Recommended Solution"]].map(([k, label]) => (
            <Field key={k} label={label as string}><textarea rows={2} className={inputCls} value={(lead[k as keyof Lead] as string) ?? ""} onChange={(e) => set(k as keyof Lead, e.target.value as never)} /></Field>
          ))}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Est. low (₹)"><input type="number" className={inputCls} value={lead.estLow ?? ""} onChange={(e) => set("estLow", Number(e.target.value) as never)} /></Field>
            <Field label="Est. high (₹)"><input type="number" className={inputCls} value={lead.estHigh ?? ""} onChange={(e) => set("estHigh", Number(e.target.value) as never)} /></Field>
          </div>
          {(lead.estLow || lead.estHigh) && <div className="rounded-xl bg-neutral-100 p-3 text-[14px] font-semibold dark:bg-neutral-800">{inr(lead.estLow ?? 0)} – {inr(lead.estHigh ?? 0)}</div>}
          <div className="text-[12.5px] text-neutral-500">Suggested: {(lead.features ?? []).join(", ") || "—"}</div>
        </div>
      )}
      {tab === "workflow" && (
        <div className="mt-4">
          <div className="flex flex-wrap gap-1.5 text-[11.5px]">
            {["LEAD","DISCOVERY","SCOPE","PRICING","QUOTE","PROPOSAL","NEGOTIATION","AGREEMENT","ADVANCE","ONBOARDING","DESIGN","DEVELOPMENT","QA","FINAL PAYMENT","LAUNCH","MAINTENANCE"].map(s=><span key={s} className="rounded-full border border-neutral-200 px-2 py-0.5 dark:border-neutral-700">{s}</span>)}
          </div>
          <p className="mt-3 text-[13px] text-neutral-500">Discovery questions: goals, existing site likes/dislikes, content readiness, functionality (WhatsApp, booking, payment, CMS, AI…), design refs. Files: attach screenshots / PDFs via project files after conversion.</p>
        </div>
      )}
    </div>
  );
}

export default function LeadsPage() {
  return <Suspense><LeadsInner /></Suspense>;
}
