"use client";
import React, { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useDB } from "@/lib/store";
import { inr, uid, todayISO, cn } from "@/lib/utils";
import { ONBOARDING_ITEMS } from "@/lib/seed";
import { Card, Badge, Btn, Empty, Modal, Field, inputCls, PageHeader, Avatar, Progress } from "@/components/ui";
import { Plus, Search, Mail, Phone, MapPin, Globe, Users, Check, ArrowRight } from "lucide-react";
import type { Client } from "@/lib/types";

const blank = { company: "", contactName: "", email: "", phone: "", location: "", industry: "" };

function ClientsInner() {
  const { db, update } = useDB();
  const params = useSearchParams();
  const [open, setOpen] = useState(params.get("action") === "new");
  const [selId, setSelId] = useState<string | null>(null);
  const [form, setForm] = useState(blank);
  const [q, setQ] = useState("");

  const sel = db.clients.find((c) => c.id === selId) ?? null;
  const clients = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? db.clients.filter((c) => `${c.company} ${c.contactName} ${c.industry ?? ""} ${c.location ?? ""}`.toLowerCase().includes(s)) : db.clients;
  }, [db.clients, q]);

  const revenueOf = (c: Client) => db.payments.filter((p) => p.clientName === c.company && p.status === "paid").reduce((a, p) => a + p.amount, 0);
  const totalRevenue = db.clients.reduce((a, c) => a + revenueOf(c), 0);

  const save = () => {
    if (!form.company.trim()) return alert("Company name is required.");
    update("clients", [{ id: uid("cl"), company: form.company, industry: form.industry, contactName: form.contactName || "—", email: form.email, phone: form.phone, location: form.location, dateAdded: todayISO(), onboarding: {} }, ...db.clients]);
    setOpen(false);
    setForm(blank);
  };

  const toggleOb = (c: Client, item: string) => {
    const onboarding = { ...(c.onboarding ?? {}), [item]: !(c.onboarding ?? {})[item] };
    update("clients", db.clients.map((x) => (x.id === c.id ? { ...c, onboarding } : x)));
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clients"
        description={`${db.clients.length} client${db.clients.length === 1 ? "" : "s"} · ${inr(totalRevenue)} collected to date`}
        actions={<Btn onClick={() => setOpen(true)}><Plus size={15} /> New client</Btn>}
      />

      {db.clients.length > 0 && (
        <div className="relative max-w-xs">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-subtle" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search clients…" className={cn(inputCls, "pl-8")} />
        </div>
      )}

      {db.clients.length === 0 && (
        <Empty icon={<Users size={18} />} title="No clients yet" sub="Won leads become clients here — or add one directly." action={<Btn onClick={() => setOpen(true)}><Plus size={15} /> New client</Btn>} />
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {clients.map((c) => {
          const projs = db.projects.filter((p) => p.clientId === c.id);
          const active = projs.filter((p) => p.status !== "completed").length;
          const done = ONBOARDING_ITEMS.filter((i) => c.onboarding?.[i]).length;
          return (
            <div key={c.id} role="button" tabIndex={0} onClick={() => setSelId(c.id)} onKeyDown={(e) => e.key === "Enter" && setSelId(c.id)}
              className="cursor-pointer rounded-2xl text-left outline-none focus-visible:ring-2 focus-visible:ring-accent/40">
              <Card className="h-full p-5 transition hover:-translate-y-0.5 hover:border-line-strong hover:shadow-lg">
                <div className="flex items-start gap-3">
                  <Avatar name={c.company} className="h-11 w-11 text-[13px]" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-[15px] font-semibold tracking-tight">{c.company}</span>
                      {c.demo && <span className="rounded bg-surface-2 px-1 text-[9.5px] font-semibold tracking-wide text-subtle">DEMO</span>}
                    </div>
                    <div className="truncate text-[12.5px] text-muted">{[c.industry, c.location].filter(Boolean).join(" · ") || "—"}</div>
                  </div>
                  {active > 0 && <Badge tone="green" dot>Active</Badge>}
                </div>
                <div className="mt-4 text-[12.5px] text-muted">{c.contactName}{c.email ? ` · ${c.email}` : ""}</div>
                <div className="mt-4 grid grid-cols-3 divide-x divide-line rounded-xl border border-line">
                  <div className="px-3 py-2.5"><div className="text-[14px] font-semibold tabular-nums">{inr(revenueOf(c))}</div><div className="text-[11px] text-subtle">Collected</div></div>
                  <div className="px-3 py-2.5"><div className="text-[14px] font-semibold tabular-nums">{projs.length}</div><div className="text-[11px] text-subtle">Projects</div></div>
                  <div className="px-3 py-2.5"><div className="text-[14px] font-semibold tabular-nums">{done}/{ONBOARDING_ITEMS.length}</div><div className="text-[11px] text-subtle">Onboarded</div></div>
                </div>
                <Progress value={(done / ONBOARDING_ITEMS.length) * 100} tone="green" className="mt-3" />
              </Card>
            </div>
          );
        })}
      </div>
      {db.clients.length > 0 && clients.length === 0 && <p className="text-center text-[13px] text-muted">No clients match “{q}”.</p>}

      <Modal open={open} onClose={() => setOpen(false)} title="New client"
        footer={<><Btn variant="ghost" onClick={() => setOpen(false)}>Cancel</Btn><Btn onClick={save}>Save client</Btn></>}>
        <div className="grid gap-4">
          <Field label="Company *"><input autoFocus className={inputCls} value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Contact person"><input className={inputCls} value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} /></Field>
            <Field label="Industry"><input className={inputCls} value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })} /></Field>
            <Field label="Email"><input type="email" className={inputCls} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
            <Field label="Phone"><input className={inputCls} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
          </div>
          <Field label="Location"><input className={inputCls} value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></Field>
        </div>
      </Modal>

      <Modal open={!!sel} onClose={() => setSelId(null)} wide
        title={sel && <span className="flex items-center gap-2.5"><Avatar name={sel.company} className="h-7 w-7 rounded-lg text-[10px]" />{sel.company}</span>}
        footer={<Btn onClick={() => setSelId(null)}>Done</Btn>}>
        {sel && <ClientDetail client={sel} onToggle={(i) => toggleOb(sel, i)} />}
      </Modal>
    </div>
  );
}

function ClientDetail({ client: c, onToggle }: { client: Client; onToggle: (item: string) => void }) {
  const { db } = useDB();
  const projs = db.projects.filter((p) => p.clientId === c.id);
  const pays = db.payments.filter((p) => p.clientName === c.company);
  const done = ONBOARDING_ITEMS.filter((i) => c.onboarding?.[i]).length;
  const contact = [
    { icon: Users, v: c.contactName },
    { icon: Mail, v: c.email },
    { icon: Phone, v: c.phone },
    { icon: MapPin, v: c.location },
    { icon: Globe, v: c.website },
  ].filter((x) => x.v);

  return (
    <div className="space-y-6">
      <div className="grid gap-2 sm:grid-cols-2">
        {contact.map(({ icon: Icon, v }) => (
          <div key={v} className="flex items-center gap-2.5 rounded-xl bg-surface-2 px-3 py-2 text-[13px]"><Icon size={14} className="text-subtle" />{v}</div>
        ))}
      </div>
      {c.notes && <p className="rounded-xl border border-line px-4 py-3 text-[13px] text-muted">{c.notes}</p>}

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h4 className="text-[13.5px] font-semibold">Onboarding</h4>
          <span className="text-[12.5px] text-muted">{done} of {ONBOARDING_ITEMS.length} received</span>
        </div>
        <Progress value={(done / ONBOARDING_ITEMS.length) * 100} tone="green" />
        <div className="mt-3 grid gap-1.5 sm:grid-cols-2">
          {ONBOARDING_ITEMS.map((i) => {
            const on = !!c.onboarding?.[i];
            return (
              <button key={i} onClick={() => onToggle(i)}
                className={cn("flex items-center gap-2.5 rounded-xl border px-3 py-2 text-left text-[13px] transition",
                  on ? "border-emerald-200 bg-emerald-50/70 dark:border-emerald-900 dark:bg-emerald-950/40" : "border-line hover:border-line-strong")}>
                <span className={cn("flex h-4 w-4 shrink-0 items-center justify-center rounded-full border", on ? "border-emerald-500 bg-emerald-500 text-white" : "border-line-strong")}>{on && <Check size={11} strokeWidth={3} />}</span>
                <span className={on ? "" : "text-muted"}>{i}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h4 className="text-[13.5px] font-semibold">Projects</h4>
          <Link href="/projects" className="flex items-center gap-1 text-[12.5px] text-muted hover:text-ink">Open projects <ArrowRight size={12} /></Link>
        </div>
        {projs.length === 0 ? <p className="text-[13px] text-muted">No projects yet.</p> : (
          <div className="space-y-2">
            {projs.map((p) => (
              <div key={p.id} className="rounded-xl border border-line px-4 py-3">
                <div className="flex items-center justify-between gap-2 text-[13px]"><span className="font-medium">{p.name}</span><span className="tabular-nums">{inr(p.value)}</span></div>
                <div className="mt-2 flex items-center gap-3"><Progress value={p.progress} tone="accent" className="flex-1" /><span className="text-[12px] capitalize text-muted">{p.status} · {p.progress}%</span></div>
              </div>
            ))}
          </div>
        )}
      </section>

      {pays.length > 0 && (
        <section>
          <h4 className="mb-2 text-[13.5px] font-semibold">Payments</h4>
          <div className="divide-y divide-line rounded-xl border border-line">
            {pays.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-2 px-4 py-2.5 text-[13px]">
                <span>{p.label} <span className="text-subtle">· due {p.due}</span></span>
                <span className="flex items-center gap-2"><span className="tabular-nums">{inr(p.amount)}</span><Badge tone={p.status === "paid" ? "green" : p.status === "overdue" ? "red" : "amber"}>{p.status}</Badge></span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

export default function ClientsPage() {
  return <Suspense><ClientsInner /></Suspense>;
}
