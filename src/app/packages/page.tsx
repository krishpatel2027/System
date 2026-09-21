"use client";
import React, { useState } from "react";
import { useDB } from "@/lib/store";
import { inr, uid } from "@/lib/utils";
import { Card, Badge, Btn, Modal, Field, inputCls } from "@/components/ui";
import { Plus } from "lucide-react";
import Link from "next/link";
import type { Package } from "@/lib/types";

const emptyPkg = { name: "", tagline: "", low: 15000, high: 30000 as number | null, features: "", best: false };

export default function PackagesPage() {
  const { db, update } = useDB();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState(emptyPkg);

  const startNew = () => {
    setEditing(null);
    setForm(emptyPkg);
    setOpen(true);
  };

  const startEdit = (p: Package) => {
    setEditing(p.id);
    setForm({ name: p.name, tagline: p.tagline, low: p.low, high: p.high, features: p.features.join(", "), best: !!p.best });
    setOpen(true);
  };

  const save = () => {
    if (!form.name.trim()) return alert("Name required");
    const features = form.features.split(",").map((f) => f.trim()).filter(Boolean);
    if (editing) {
      update(
        "packages",
        db.packages.map((p) =>
          p.id === editing ? { ...p, name: form.name, tagline: form.tagline, low: form.low, high: form.high, features, best: form.best } : form.best ? { ...p, best: false } : p
        )
      );
    } else {
      update("packages", [
        ...(form.best ? db.packages.map((p) => ({ ...p, best: false })) : db.packages),
        { id: uid("p"), name: form.name, tagline: form.tagline, low: form.low, high: form.high, features, best: form.best },
      ]);
    }
    setOpen(false);
  };

  const remove = (id: string) => {
    if (!confirm("Delete this package?")) return;
    update("packages", db.packages.filter((p) => p.id !== id));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><h1 className="text-[22px] font-semibold tracking-tight">Packages</h1><p className="text-[13px] text-neutral-500">Client-facing ranges. Complexity &gt; page count.</p></div>
        <Btn onClick={startNew}><Plus size={15} /> New Package</Btn>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {db.packages.map((p) => (
          <Card key={p.id} className={`p-6 ${p.best ? "ring-2 ring-neutral-900 dark:ring-white" : ""}`}>
            {p.best && <Badge tone="green">MOST POPULAR</Badge>}
            <div className="mt-2 text-[16px] font-bold tracking-tight">{p.name}</div>
            <div className="text-[13px] text-neutral-500">{p.tagline}</div>
            <div className="mt-3 text-[22px] font-semibold">{inr(p.low)} – {p.high ? inr(p.high) : "Custom"}{p.high && p.high >= 150000 ? "+" : ""}</div>
            <ul className="mt-3 space-y-1.5">
              {p.features.map((f) => <li key={f} className="flex gap-2 text-[13px]"><span className="text-emerald-500">✓</span>{f}</li>)}
            </ul>
            <div className="mt-4 flex gap-2">
              <Link href="/quotes?action=new" className="flex-1 rounded-xl border border-neutral-200 py-2 text-center text-[13px] font-medium hover:bg-neutral-50 dark:border-neutral-700">Use in Quote →</Link>
              <button onClick={() => startEdit(p)} className="rounded-xl border border-neutral-200 px-3 py-2 text-[13px] font-medium hover:bg-neutral-50 dark:border-neutral-700">Edit</button>
              <button onClick={() => remove(p.id)} className="rounded-xl px-2 py-2 text-[13px] text-red-500 hover:bg-red-50">✕</button>
            </div>
          </Card>
        ))}
      </div>
      <Card className="p-5 text-[13.5px] text-neutral-600 dark:text-neutral-300">
        <span className="font-semibold text-neutral-900 dark:text-white">Pricing philosophy — </span>
        Indian SMBs stay affordable; premium custom work is priced on scope + complexity + customization + responsibility. A 4-page Three.js/GSAP/AI site can cost more than a 15-page corporate site.
      </Card>
      <Modal open={open} onClose={() => setOpen(false)} title={editing ? "Edit Package" : "New Package"}>
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Name"><input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="ARKRIA GROW" /></Field>
            <Field label="Tagline"><input className={inputCls} value={form.tagline} onChange={(e) => setForm({ ...form, tagline: e.target.value })} placeholder="Credibility + lead generation" /></Field>
            <Field label="Range low (₹)"><input type="number" className={inputCls} value={form.low} onChange={(e) => setForm({ ...form, low: Number(e.target.value) })} /></Field>
            <Field label="Range high (₹, empty = Custom)"><input type="number" className={inputCls} value={form.high ?? ""} onChange={(e) => setForm({ ...form, high: e.target.value === "" ? null : Number(e.target.value) })} placeholder="Leave empty for Custom" /></Field>
          </div>
          <Field label="Features (comma separated)"><textarea rows={3} className={inputCls} value={form.features} onChange={(e) => setForm({ ...form, features: e.target.value })} placeholder="5–8 pages, Custom UI/UX, CMS, …" /></Field>
          <label className="flex items-center gap-2 text-[13.5px]"><input type="checkbox" checked={form.best} onChange={(e) => setForm({ ...form, best: e.target.checked })} className="h-4 w-4" /> Mark as most popular</label>
        </div>
        <div className="mt-4 flex justify-end gap-2"><Btn variant="ghost" onClick={() => setOpen(false)}>Cancel</Btn><Btn onClick={save}>Save</Btn></div>
      </Modal>
    </div>
  );
}
