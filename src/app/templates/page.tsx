"use client";
import React, { useState } from "react";
import { useDB } from "@/lib/store";
import { uid } from "@/lib/utils";
import { Card, Badge, Btn, Modal, Field, inputCls } from "@/components/ui";
import { Plus, Copy } from "lucide-react";
import { todayISO } from "@/lib/utils";

export default function TemplatesPage() {
  const { db, update } = useDB();
  const [cat, setCat] = useState("All");
  const [open, setOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [form, setForm] = useState({ category: "WhatsApp", title: "", body: "" });
  const [logForm, setLogForm] = useState({ date: todayISO(), clientName: "", channel: "WhatsApp", summary: "" });
  const cats = ["All", ...Array.from(new Set(db.templates.map((t) => t.category)))];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><h1 className="text-[22px] font-semibold tracking-tight">Templates</h1><p className="text-[13px] text-neutral-500">Copy-paste client communication. Use {"{{name}}, {{company}}, {{amount}}"}.</p></div>
        <Btn onClick={() => setOpen(true)}><Plus size={15} /> New Template</Btn>
      </div>
      <div className="flex gap-1.5 flex-wrap">{cats.map((c) => <button key={c} onClick={() => setCat(c)} className={`rounded-full px-3 py-1.5 text-[13px] ${cat === c ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900" : "border border-neutral-200 dark:border-neutral-700"}`}>{c}</button>)}</div>
      <div className="grid gap-3 md:grid-cols-2">
        {db.templates.filter((t) => cat === "All" || t.category === cat).map((t) => (
          <Card key={t.id} className="p-5">
            <div className="flex items-center justify-between"><Badge>{t.category}</Badge>
              <div className="flex gap-1">
                <button className="rounded-lg p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800" title="Copy" onClick={() => { navigator.clipboard.writeText(t.body); alert("Copied ✓"); }}><Copy size={14} /></button>
                <button className="rounded-lg p-1.5 text-red-500 hover:bg-red-50" onClick={() => update("templates", db.templates.filter((x) => x.id !== t.id))}>✕</button>
              </div>
            </div>
            <div className="mt-1 text-[14px] font-semibold">{t.title}</div>
            <pre className="mt-1 whitespace-pre-wrap text-[13px] text-neutral-600 dark:text-neutral-300">{t.body}</pre>
          </Card>
        ))}
      </div>
      <Card className="p-5">
        <div className="flex items-center justify-between">
          <div className="text-[14px] font-semibold">Communication log</div>
          <Btn variant="outline" onClick={() => { setLogForm({ date: todayISO(), clientName: db.clients[0]?.company ?? "", channel: "WhatsApp", summary: "" }); setLogOpen(true); }}><Plus size={14} /> Log</Btn>
        </div>
        {db.comms.length === 0 && <p className="mt-2 text-[13px] text-neutral-500">No entries yet. Log every client touch.</p>}
        {db.comms.map((c) => (
          <div key={c.id} className="mt-1.5 flex items-start justify-between gap-2 rounded-xl border border-neutral-100 px-3 py-2 text-[13px] dark:border-neutral-800">
            <span><b>{c.date}</b> · {c.clientName} · {c.channel} — {c.summary}</span>
            <button className="shrink-0 text-red-500 hover:text-red-600" onClick={() => update("comms", db.comms.filter((x) => x.id !== c.id))}>✕</button>
          </div>
        ))}
      </Card>
      <Modal open={logOpen} onClose={() => setLogOpen(false)} title="Log Communication">
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date"><input type="date" className={inputCls} value={logForm.date} onChange={(e) => setLogForm({ ...logForm, date: e.target.value })} /></Field>
            <Field label="Channel"><select className={inputCls} value={logForm.channel} onChange={(e) => setLogForm({ ...logForm, channel: e.target.value })}>{["WhatsApp", "Call", "Email", "Meeting", "Instagram", "Other"].map((c) => <option key={c}>{c}</option>)}</select></Field>
          </div>
          <Field label="Client"><input className={inputCls} value={logForm.clientName} onChange={(e) => setLogForm({ ...logForm, clientName: e.target.value })} placeholder="Client / company" list="arkria-clients" /></Field>
          <datalist id="arkria-clients">{db.clients.map((c) => <option key={c.id} value={c.company} />)}</datalist>
          <Field label="Summary"><textarea rows={3} className={inputCls} value={logForm.summary} onChange={(e) => setLogForm({ ...logForm, summary: e.target.value })} placeholder="What was discussed / agreed?" /></Field>
        </div>
        <div className="mt-4 flex justify-end gap-2"><Btn variant="ghost" onClick={() => setLogOpen(false)}>Cancel</Btn><Btn onClick={() => { if (!logForm.clientName.trim() || !logForm.summary.trim()) return alert("Client + summary required"); update("comms", [{ id: uid("c"), ...logForm }, ...db.comms]); setLogOpen(false); }}>Save</Btn></div>
      </Modal>
      <Modal open={open} onClose={() => setOpen(false)} title="New Template">
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Category"><select className={inputCls} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>{["WhatsApp","Email","Follow-up","Payment","Project","Maintenance","Contract"].map(c=><option key={c}>{c}</option>)}</select></Field>
            <Field label="Title"><input className={inputCls} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
          </div>
          <Field label="Body"><textarea rows={5} className={inputCls} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} /></Field>
        </div>
        <div className="mt-4 flex justify-end gap-2"><Btn variant="ghost" onClick={() => setOpen(false)}>Cancel</Btn><Btn onClick={() => { if (!form.title.trim()) return alert("Title required"); update("templates", [{ id: uid("tm"), ...form }, ...db.templates]); setOpen(false); }}>Save</Btn></div>
      </Modal>
    </div>
  );
}
