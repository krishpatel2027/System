"use client";
import React, { useState } from "react";
import { useDB } from "@/lib/store";
import { inr, uid, cn } from "@/lib/utils";
import { Card, Badge, Btn, Modal, Field, inputCls, PageHeader, Empty } from "@/components/ui";
import { Plus, Layers, Pencil, Trash2 } from "lucide-react";
import type { Service, Signal } from "@/lib/types";
import { ALL_SIGNALS, INDUSTRIES, SIGNALS } from "@/lib/leadfinder/catalog";
import { ChipsInput } from "@/components/leadfinder-forms";
import { evaluate } from "@/lib/leadfinder/engine";

const CATS = ["Websites", "E-commerce", "Web Applications", "Mobile Apps", "AI", "Ongoing"];
const COMPLEXITY: Service["complexity"][] = ["Low", "Medium", "High", "Expert"];
const blank = (): Service => ({ id: uid("s"), name: "", category: "Websites", description: "", basePrice: 0, internalCost: 0, hours: 0, complexity: "Medium", clientFacing: "", active: true, idealIndustries: [], signals: [] });

export default function ServicesPage() {
  const { db, update, mutate } = useDB();
  const [cat, setCat] = useState("All");
  const [edit, setEdit] = useState<Service | null>(null);
  const isNew = !!edit && !db.services.some((s) => s.id === edit.id);
  const cats = ["All", ...new Set([...CATS, ...db.services.map((s) => s.category)])];
  const list = db.services.filter((s) => cat === "All" || s.category === cat);

  const save = () => {
    if (!edit) return;
    if (!edit.name.trim()) return alert("Give the service a name.");
    const next = isNew ? [edit, ...db.services] : db.services.map((s) => (s.id === edit.id ? edit : s));
    // Service prices and signals drive lead matching, so refresh recommendations.
    mutate((d) => ({ services: next, prospects: d.prospects.map((p) => evaluate(p, next, d.finder.scoring)) }));
    setEdit(null);
  };
  const demand = (id: string) => db.prospects.filter((p) => p.match?.serviceId === id).length;
  const toggleSignal = (sig: Signal) => edit && setEdit({ ...edit, signals: edit.signals?.includes(sig) ? edit.signals.filter((x) => x !== sig) : [...(edit.signals ?? []), sig] });
  const margin = (s: Service) => (s.basePrice ? Math.round(((s.basePrice - s.internalCost) / s.basePrice) * 100) : 0);

  return (
    <div className="space-y-6">
      <PageHeader title="Services" description="What each service costs you to deliver versus what you charge. Internal — never shown to clients."
        actions={<Btn onClick={() => setEdit(blank())}><Plus size={15} /> Add service</Btn>} />

      <div className="flex flex-wrap gap-1.5">
        {cats.map((c) => (
          <button key={c} onClick={() => setCat(c)} className={cn("rounded-full px-3 py-1 text-[12.5px] font-medium transition", cat === c ? "bg-ink text-bg" : "bg-surface text-muted ring-1 ring-line hover:text-ink")}>{c}</button>
        ))}
      </div>

      {list.length === 0 ? (
        <Empty icon={<Layers size={18} />} title="No services here" sub="Add the services you sell to track margins." action={<Btn onClick={() => setEdit(blank())}><Plus size={15} /> Add service</Btn>} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {list.map((s) => {
            const m = margin(s);
            return (
              <Card key={s.id} className={cn("flex flex-col p-5", !s.active && "opacity-60")}>
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-[14.5px] font-semibold tracking-tight">{s.name}</div>
                    <div className="text-[12.5px] text-muted">{s.category}{!s.active && " · inactive"}</div>
                  </div>
                  <Badge tone={s.complexity === "Expert" ? "violet" : s.complexity === "High" ? "amber" : "neutral"}>{s.complexity}</Badge>
                </div>
                <p className="mt-2 flex-1 text-[13px] text-muted">{s.description}</p>
                <div className="mt-4 grid grid-cols-3 divide-x divide-line rounded-xl border border-line text-center">
                  <div className="px-2 py-2.5"><div className="text-[14px] font-semibold tabular-nums">{inr(s.basePrice)}</div><div className="text-[11px] text-subtle">Price</div></div>
                  <div className="px-2 py-2.5"><div className="text-[14px] font-semibold tabular-nums">{inr(s.internalCost)}</div><div className="text-[11px] text-subtle">Cost</div></div>
                  <div className="px-2 py-2.5"><div className={cn("text-[14px] font-semibold tabular-nums", m < 30 ? "text-red-600" : m < 40 ? "text-amber-600" : "text-emerald-600")}>{m}%</div><div className="text-[11px] text-subtle">Margin</div></div>
                </div>
                <div className="mt-3 flex items-center justify-between text-[12px] text-muted">
                  <span>~{s.hours}h to deliver{db.prospects.length > 0 && <> · <span className="text-ink">{demand(s.id)}</span> matched leads</>}</span>
                  <div className="flex gap-0.5">
                    <button title="Edit" className="rounded-lg p-1.5 text-subtle hover:bg-surface-2 hover:text-ink" onClick={() => setEdit(s)}><Pencil size={14} /></button>
                    <button title="Delete" className="rounded-lg p-1.5 text-subtle hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950" onClick={() => { if (confirm(`Delete ${s.name}?`)) update("services", db.services.filter((x) => x.id !== s.id)); }}><Trash2 size={14} /></button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Modal open={!!edit} wide onClose={() => setEdit(null)} title={isNew ? "Add service" : "Edit service"}
        footer={<><Btn variant="ghost" onClick={() => setEdit(null)}>Cancel</Btn><Btn onClick={save}>Save service</Btn></>}>
        {edit && (
          <div className="grid gap-4">
            <Field label="Name"><input autoFocus className={inputCls} value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Category"><input list="svc-cats" className={inputCls} value={edit.category} onChange={(e) => setEdit({ ...edit, category: e.target.value })} /></Field>
              <Field label="Complexity"><select className={inputCls} value={edit.complexity} onChange={(e) => setEdit({ ...edit, complexity: e.target.value as Service["complexity"] })}>{COMPLEXITY.map((c) => <option key={c}>{c}</option>)}</select></Field>
              <Field label="Client price (₹)"><input type="number" min={0} className={inputCls} value={edit.basePrice || ""} onChange={(e) => setEdit({ ...edit, basePrice: Number(e.target.value) })} /></Field>
              <Field label="Internal cost (₹)"><input type="number" min={0} className={inputCls} value={edit.internalCost || ""} onChange={(e) => setEdit({ ...edit, internalCost: Number(e.target.value) })} /></Field>
              <Field label="Estimated hours"><input type="number" min={0} className={inputCls} value={edit.hours || ""} onChange={(e) => setEdit({ ...edit, hours: Number(e.target.value) })} /></Field>
              <label className="flex items-center gap-2 self-end pb-2 text-[13px]"><input type="checkbox" checked={edit.active} onChange={(e) => setEdit({ ...edit, active: e.target.checked })} className="h-4 w-4 accent-[var(--accent)]" /> Currently offered</label>
            </div>
            <Field label="Internal description"><input className={inputCls} value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} /></Field>
            <Field label="How you describe it to clients"><textarea rows={2} className={inputCls} value={edit.clientFacing} onChange={(e) => setEdit({ ...edit, clientFacing: e.target.value })} /></Field>
            <div className="rounded-xl border border-line p-4">
              <div className="text-[13.5px] font-semibold">Lead Finder matching</div>
              <p className="mt-0.5 text-[12px] text-muted">Which evidence points to this service, and who it suits. Used to recommend a service for each discovered business.</p>
              <div className="mt-3 space-y-4">
                <div>
                  <div className="mb-1.5 text-[12.5px] font-medium text-muted">Signals that suggest this service</div>
                  <div className="flex flex-wrap gap-1.5">
                    {ALL_SIGNALS.filter((sig) => SIGNALS[sig].kind !== "strength").map((sig) => (
                      <button key={sig} type="button" onClick={() => toggleSignal(sig)}
                        className={cn("rounded-lg px-2 py-1 text-[12px] font-medium ring-1 ring-inset transition", edit.signals?.includes(sig) ? "bg-accent-soft text-ink ring-accent-line" : "text-muted ring-line hover:text-ink")}>
                        {SIGNALS[sig].label}
                      </button>
                    ))}
                    {(["established_business", "active_social"] as Signal[]).map((sig) => (
                      <button key={sig} type="button" onClick={() => toggleSignal(sig)}
                        className={cn("rounded-lg px-2 py-1 text-[12px] font-medium ring-1 ring-inset transition", edit.signals?.includes(sig) ? "bg-emerald-50 text-emerald-800 ring-emerald-200 dark:bg-emerald-950 dark:text-emerald-200 dark:ring-emerald-900" : "text-muted ring-line hover:text-ink")}>
                        {SIGNALS[sig].label}
                      </button>
                    ))}
                  </div>
                </div>
                <Field label="Ideal industries" hint="Leave empty to suit every industry."><ChipsInput id="svc-inds" values={edit.idealIndustries ?? []} onChange={(v) => setEdit({ ...edit, idealIndustries: v })} options={INDUSTRIES} placeholder="Add industries…" /></Field>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Typical budget from (₹)"><input type="number" min={0} className={inputCls} value={edit.minBudget ?? ""} onChange={(e) => setEdit({ ...edit, minBudget: e.target.value ? Number(e.target.value) : undefined })} /></Field>
                  <Field label="Typical budget to (₹)"><input type="number" min={0} className={inputCls} value={edit.maxBudget ?? ""} onChange={(e) => setEdit({ ...edit, maxBudget: e.target.value ? Number(e.target.value) : undefined })} /></Field>
                </div>
              </div>
            </div>
            <datalist id="svc-cats">{CATS.map((c) => <option key={c} value={c} />)}</datalist>
          </div>
        )}
      </Modal>
    </div>
  );
}
