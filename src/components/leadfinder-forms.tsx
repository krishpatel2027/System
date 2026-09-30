"use client";
import React, { useState } from "react";
import { X } from "lucide-react";
import type { SearchQuery } from "@/lib/types";
import { CITIES, INDUSTRIES } from "@/lib/leadfinder/catalog";
import { Field, inputCls } from "@/components/ui";

export function ChipsInput({ values, onChange, options, placeholder, id }: { values: string[]; onChange: (v: string[]) => void; options: string[]; placeholder: string; id: string }) {
  const [draft, setDraft] = useState("");
  const add = (v: string) => {
    const t = v.trim();
    if (t && !values.some((x) => x.toLowerCase() === t.toLowerCase())) onChange([...values, t]);
    setDraft("");
  };
  return (
    <div className="flex min-h-9 flex-wrap items-center gap-1 rounded-xl border border-line bg-surface px-1.5 py-1 focus-within:border-accent focus-within:ring-4 focus-within:ring-accent/10">
      {values.map((v) => (
        <span key={v} className="inline-flex items-center gap-1 rounded-lg bg-accent-soft px-2 py-0.5 text-[12.5px] font-medium text-ink ring-1 ring-inset ring-accent-line">
          {v}
          <button onClick={() => onChange(values.filter((x) => x !== v))} aria-label={`Remove ${v}`} className="text-muted hover:text-ink"><X size={12} /></button>
        </span>
      ))}
      <input list={id} value={draft} placeholder={values.length ? "" : placeholder}
        onChange={(e) => { const v = e.target.value; if (options.includes(v)) add(v); else setDraft(v); }}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === ",") && draft.trim()) { e.preventDefault(); add(draft); }
          if (e.key === "Backspace" && !draft && values.length) onChange(values.slice(0, -1));
        }}
        onBlur={() => draft.trim() && add(draft)}
        className="h-7 min-w-[120px] flex-1 bg-transparent px-1.5 text-[13.5px] outline-none placeholder:text-subtle" />
      <datalist id={id}>{options.filter((o) => !values.includes(o)).map((o) => <option key={o} value={o} />)}</datalist>
    </div>
  );
}

export function QueryFilters({ q, set, services }: { q: SearchQuery; set: (patch: Partial<SearchQuery>) => void; services: { id: string; name: string }[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div className="sm:col-span-2"><Field label="Locations" hint="Add several — each is searched separately."><ChipsInput id="lf-cities" values={q.locations} onChange={(v) => set({ locations: v })} options={CITIES} placeholder="Ahmedabad, Surat…" /></Field></div>
      <div className="sm:col-span-2"><Field label="Industries" hint="Pick from the list or type your own."><ChipsInput id="lf-inds" values={q.industries} onChange={(v) => set({ industries: v })} options={INDUSTRIES} placeholder="Real Estate, Clinics…" /></Field></div>
      <Field label="Website">
        <select className={inputCls} value={q.website} onChange={(e) => set({ website: e.target.value as SearchQuery["website"] })}>
          <option value="any">Any</option><option value="none">No website</option><option value="weak">Weak / outdated website</option><option value="none_or_weak">No or weak website</option><option value="has">Has a website</option>
        </select>
      </Field>
      <Field label="Service opportunity">
        <select className={inputCls} value={q.serviceId ?? ""} onChange={(e) => set({ serviceId: e.target.value || undefined })}>
          <option value="">Any service</option>{services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </Field>
      <Field label={`Minimum score · ${q.minScore}`}><input type="range" min={0} max={90} step={5} value={q.minScore} onChange={(e) => set({ minScore: Number(e.target.value) })} className="mt-2.5 w-full accent-[var(--accent)]" /></Field>
      <Field label="Results">
        <select className={inputCls} value={q.limit} onChange={(e) => set({ limit: Number(e.target.value) })}>{[20, 50, 100].map((n) => <option key={n} value={n}>Up to {n} businesses</option>)}</select>
      </Field>
      <Field label="Min. Google reviews"><input type="number" min={0} className={inputCls} value={q.minReviews ?? ""} onChange={(e) => set({ minReviews: e.target.value ? Number(e.target.value) : undefined })} placeholder="Any" /></Field>
      <Field label="Min. rating"><input type="number" min={0} max={5} step={0.1} className={inputCls} value={q.minRating ?? ""} onChange={(e) => set({ minRating: e.target.value ? Number(e.target.value) : undefined })} placeholder="Any" /></Field>
      <Field label="Max budget fit (₹)"><input type="number" min={0} step={1000} className={inputCls} value={q.budgetMax ?? ""} onChange={(e) => set({ budgetMax: e.target.value ? Number(e.target.value) : undefined })} placeholder="Any" /></Field>
      <label className="flex items-center gap-2 self-end pb-2 text-[13px] text-muted">
        <input type="checkbox" checked={!!q.requireContact} onChange={(e) => set({ requireContact: e.target.checked || undefined })} className="h-4 w-4 accent-[var(--accent)]" />
        Only with phone or email
      </label>
    </div>
  );
}
