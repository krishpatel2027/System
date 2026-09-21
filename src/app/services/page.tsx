"use client";
import React, { useState } from "react";
import { useDB } from "@/lib/store";
import { inr, uid } from "@/lib/utils";
import { Card, Badge, Btn, Modal, Field, inputCls } from "@/components/ui";
import { Plus } from "lucide-react";

const CATS = ["Websites", "E-commerce", "Web Applications", "Mobile Apps", "AI", "Ongoing"];

export default function ServicesPage() {
  const { db, update } = useDB();
  const [cat, setCat] = useState("All");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", category: "Websites", description: "", basePrice: 30000, internalCost: 15000, hours: 40, complexity: "Medium" as never, clientFacing: "" });

  const list = db.services.filter((s) => cat === "All" || s.category === cat);

  const save = () => {
    if (!form.name.trim()) return alert("Name required");
    update("services", [{ id: uid("s"), ...form, active: true }, ...db.services]);
    setOpen(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><h1 className="text-[22px] font-semibold tracking-tight">Services</h1><p className="text-[13px] text-neutral-500">Internal cost vs client price — never expose internals</p></div>
        <Btn onClick={() => setOpen(true)}><Plus size={15} /> Add Service</Btn>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {["All", ...CATS].map((c) => (
          <button key={c} onClick={() => setCat(c)} className={`rounded-full px-3 py-1.5 text-[13px] font-medium ${cat === c ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900" : "bg-white border border-neutral-200 dark:bg-neutral-900 dark:border-neutral-700"}`}>{c}</button>
        ))}
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {list.map((s) => (
          <Card key={s.id} className="p-5">
            <div className="flex items-start justify-between gap-2">
              <div><div className="text-[14.5px] font-semibold">{s.name}</div><div className="text-[12.5px] text-neutral-500">{s.description}</div></div>
              <Badge tone={s.complexity === "Expert" ? "violet" : s.complexity === "High" ? "amber" : "neutral"}>{s.complexity}</Badge>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-neutral-50 py-2 dark:bg-neutral-800"><div className="text-[14px] font-semibold">{inr(s.basePrice)}</div><div className="text-[11px] text-neutral-500">Client price</div></div>
              <div className="rounded-xl bg-neutral-50 py-2 dark:bg-neutral-800"><div className="text-[14px] font-semibold">{inr(s.internalCost)}</div><div className="text-[11px] text-neutral-500">Internal</div></div>
              <div className="rounded-xl bg-neutral-50 py-2 dark:bg-neutral-800"><div className="text-[14px] font-semibold">{s.hours}h</div><div className="text-[11px] text-neutral-500">Est. hours</div></div>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-[12px] text-neutral-500">{s.category} · margin {inr(s.basePrice - s.internalCost)}</span>
              <button className="text-[12.5px] text-red-500" onClick={() => update("services", db.services.filter((x) => x.id !== s.id))}>Remove</button>
            </div>
          </Card>
        ))}
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title="Add Service">
        <div className="grid gap-3">
          <Field label="Name"><input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Category"><select className={inputCls} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>{CATS.map(c=><option key={c}>{c}</option>)}</select></Field>
            <Field label="Complexity"><select className={inputCls} value={form.complexity as string} onChange={(e) => setForm({ ...form, complexity: e.target.value as never })}>{["Low","Medium","High","Expert"].map(c=><option key={c}>{c}</option>)}</select></Field>
            <Field label="Client price (₹)"><input type="number" className={inputCls} value={form.basePrice} onChange={(e) => setForm({ ...form, basePrice: Number(e.target.value) })} /></Field>
            <Field label="Internal cost (₹)"><input type="number" className={inputCls} value={form.internalCost} onChange={(e) => setForm({ ...form, internalCost: Number(e.target.value) })} /></Field>
          </div>
          <Field label="Client-facing description"><textarea className={inputCls} rows={2} value={form.clientFacing} onChange={(e) => setForm({ ...form, clientFacing: e.target.value })} /></Field>
        </div>
        <div className="mt-4 flex justify-end gap-2"><Btn variant="ghost" onClick={() => setOpen(false)}>Cancel</Btn><Btn onClick={save}>Save</Btn></div>
      </Modal>
    </div>
  );
}
