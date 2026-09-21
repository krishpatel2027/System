"use client";
import React, { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useDB } from "@/lib/store";
import { inr, uid, todayISO } from "@/lib/utils";
import { ONBOARDING_ITEMS } from "@/lib/seed";
import { Card, Badge, Btn, Empty, Modal, Field, inputCls } from "@/components/ui";
import { Plus } from "lucide-react";
import type { Client } from "@/lib/types";

function ClientsInner() {
  const { db, update } = useDB();
  const params = useSearchParams();
  const [open, setOpen] = useState(params.get("action") === "new");
  const [sel, setSel] = useState<Client | null>(null);
  const [form, setForm] = useState({ company: "", contactName: "", email: "", phone: "", location: "" });

  const save = () => {
    if (!form.company.trim()) return alert("Company required");
    update("clients", [{ id: uid("cl"), company: form.company, contactName: form.contactName || "—", email: form.email, phone: form.phone, location: form.location, dateAdded: todayISO(), onboarding: {} }, ...db.clients]);
    setOpen(false); setForm({ company: "", contactName: "", email: "", phone: "", location: "" });
  };

  const toggleOb = (c: Client, item: string) => {
    const ob = { ...(c.onboarding ?? {}), [item]: !(c.onboarding ?? {})[item] };
    const nl = { ...c, onboarding: ob };
    update("clients", db.clients.map((x) => (x.id === c.id ? nl : x)));
    setSel(nl);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><h1 className="text-[22px] font-semibold tracking-tight">Clients</h1><p className="text-[13px] text-neutral-500">{db.clients.length} confirmed clients</p></div>
        <Btn onClick={() => setOpen(true)}><Plus size={15} /> New Client</Btn>
      </div>
      {db.clients.length === 0 && <Empty title="No clients yet" sub="Won leads become clients here." action={<Btn onClick={() => setOpen(true)}>+ Add Client</Btn>} />}
      <div className="grid gap-3 md:grid-cols-2">
        {db.clients.map((c) => {
          const projs = db.projects.filter((p) => p.clientId === c.id);
          const rev = db.payments.filter((p) => p.clientName === c.company && p.status === "paid").reduce((a, p) => a + p.amount, 0);
          const ob = c.onboarding ?? {};
          const done = ONBOARDING_ITEMS.filter((i) => ob[i]).length;
          return (
            <Card key={c.id} className="cursor-pointer p-5 transition hover:shadow-md" >
              <div onClick={() => setSel(c)}>
                <div className="flex items-center gap-2"><span className="text-[15px] font-semibold">{c.company}</span>{c.demo && <Badge>DEMO</Badge>}</div>
                <div className="text-[13px] text-neutral-500">{c.contactName} · {c.phone ?? c.email ?? ""}</div>
                <div className="mt-3 grid grid-cols-4 gap-2 text-center">
                  <div className="rounded-xl bg-neutral-50 py-2 dark:bg-neutral-800"><div className="text-[15px] font-semibold">{inr(rev)}</div><div className="text-[11px] text-neutral-500">Revenue</div></div>
                  <div className="rounded-xl bg-neutral-50 py-2 dark:bg-neutral-800"><div className="text-[15px] font-semibold">{projs.length}</div><div className="text-[11px] text-neutral-500">Projects</div></div>
                  <div className="rounded-xl bg-neutral-50 py-2 dark:bg-neutral-800"><div className="text-[15px] font-semibold">{projs.filter(p=>p.status!=="completed").length}</div><div className="text-[11px] text-neutral-500">Active</div></div>
                  <div className="rounded-xl bg-neutral-50 py-2 dark:bg-neutral-800"><div className="text-[15px] font-semibold">{done}/12</div><div className="text-[11px] text-neutral-500">Onboard</div></div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="New Client">
        <div className="grid gap-3">
          <Field label="Company *"><input className={inputCls} value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} /></Field>
          <Field label="Contact"><input className={inputCls} value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Email"><input className={inputCls} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
            <Field label="Phone"><input className={inputCls} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
          </div>
          <Field label="Location"><input className={inputCls} value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></Field>
        </div>
        <div className="mt-4 flex justify-end gap-2"><Btn variant="ghost" onClick={() => setOpen(false)}>Cancel</Btn><Btn onClick={save}>Save</Btn></div>
      </Modal>

      <Modal open={!!sel} onClose={() => setSel(null)} title={sel?.company ?? ""} wide>
        {sel && (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 text-[13.5px]">
              <div><span className="text-neutral-500">Contact:</span> {sel.contactName} · {sel.phone} · {sel.email}</div>
              <div><span className="text-neutral-500">Location:</span> {sel.location ?? "—"}</div>
            </div>
            <div>
              <div className="mb-2 text-[13.5px] font-semibold">Onboarding — {ONBOARDING_ITEMS.filter(i=>sel.onboarding?.[i]).length} / 12 completed</div>
              <div className="h-2 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800"><div className="h-full bg-emerald-500" style={{ width: `${(ONBOARDING_ITEMS.filter(i=>sel.onboarding?.[i]).length / 12) * 100}%` }} /></div>
              <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
                {ONBOARDING_ITEMS.map((i) => (
                  <button key={i} onClick={() => toggleOb(sel, i)} className={`rounded-xl border px-3 py-2 text-left text-[13px] ${sel.onboarding?.[i] ? "border-emerald-300 bg-emerald-50 dark:bg-emerald-950" : "border-neutral-200 dark:border-neutral-700"}`}>
                    {sel.onboarding?.[i] ? "✓ " : "○ "}{i}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="mb-1 text-[13.5px] font-semibold">Projects</div>
              {db.projects.filter(p=>p.clientId===sel.id).map(p=><div key={p.id} className="rounded-xl border border-neutral-100 px-3 py-2 text-[13px] dark:border-neutral-800">{p.name} · {inr(p.value)} · {p.status} · {p.progress}%</div>)}
              {db.projects.filter(p=>p.clientId===sel.id).length===0 && <p className="text-[13px] text-neutral-500">No projects yet.</p>}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
export default function ClientsPage() { return <Suspense><ClientsInner /></Suspense>; }
