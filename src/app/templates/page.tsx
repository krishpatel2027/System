"use client";
import React, { useMemo, useState } from "react";
import { useDB } from "@/lib/store";
import { uid, todayISO, cn } from "@/lib/utils";
import { Card, Badge, Btn, Modal, Field, inputCls, PageHeader, Tabs, Empty } from "@/components/ui";
import { Plus, Copy, Check, Pencil, Trash2, MessageCircle, Mail, Send, MessageSquare, LayoutTemplate } from "lucide-react";
import type { Template } from "@/lib/types";

const CATEGORIES = ["WhatsApp", "Email", "Follow-up", "Payment", "Project", "Maintenance", "Contract"];
const CHANNELS = ["WhatsApp", "Call", "Email", "Meeting", "Instagram", "Other"];
const MANUAL = ["amount", "date", "label"] as const;

type Recipient = { key: string; company: string; contact: string; phone?: string; email?: string };

const waNumber = (phone?: string) => {
  const d = (phone ?? "").replace(/\D/g, "");
  return d.length === 10 ? `91${d}` : d;
};

export default function TemplatesPage() {
  const { db, update, userName } = useDB();
  const [tab, setTab] = useState<"templates" | "log">("templates");
  const [cat, setCat] = useState("All");
  const [edit, setEdit] = useState<Template | null>(null);
  const [using, setUsing] = useState<Template | null>(null);
  const [logOpen, setLogOpen] = useState(false);
  const [logForm, setLogForm] = useState({ date: todayISO(), clientName: "", channel: "WhatsApp", summary: "" });

  const cats = ["All", ...new Set(db.templates.map((t) => t.category))];
  const list = db.templates.filter((t) => cat === "All" || t.category === cat);
  const isNew = !!edit && !db.templates.some((t) => t.id === edit.id);

  const saveTemplate = () => {
    if (!edit) return;
    if (!edit.title.trim() || !edit.body.trim()) return alert("Add a title and a message.");
    update("templates", isNew ? [edit, ...db.templates] : db.templates.map((t) => (t.id === edit.id ? edit : t)));
    setEdit(null);
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Templates" description="Reusable messages for every stage — personalised in one click."
        actions={tab === "templates"
          ? <Btn onClick={() => setEdit({ id: uid("tm"), category: "WhatsApp", title: "", body: "" })}><Plus size={15} /> New template</Btn>
          : <Btn onClick={() => { setLogForm({ date: todayISO(), clientName: db.clients[0]?.company ?? "", channel: "WhatsApp", summary: "" }); setLogOpen(true); }}><Plus size={15} /> Log conversation</Btn>} />

      <Tabs value={tab} onChange={setTab} tabs={[{ id: "templates", label: `Templates · ${db.templates.length}` }, { id: "log", label: `Conversation log · ${db.comms.length}` }]} />

      {tab === "templates" ? (
        <>
          <div className="flex flex-wrap gap-1.5">
            {cats.map((c) => (
              <button key={c} onClick={() => setCat(c)} className={cn("rounded-full px-3 py-1 text-[12.5px] font-medium transition", cat === c ? "bg-ink text-bg" : "bg-surface text-muted ring-1 ring-line hover:text-ink")}>{c}</button>
            ))}
          </div>
          {list.length === 0 && <Empty icon={<LayoutTemplate size={18} />} title="No templates" sub="Save the messages you send often." />}
          <div className="grid gap-4 md:grid-cols-2">
            {list.map((t) => (
              <Card key={t.id} className="flex flex-col p-5">
                <div className="flex items-center gap-2">
                  <Badge>{t.category}</Badge>
                  <span className="truncate text-[14px] font-semibold">{t.title}</span>
                  <div className="ml-auto flex gap-0.5">
                    <button title="Edit" className="rounded-lg p-1.5 text-subtle hover:bg-surface-2 hover:text-ink" onClick={() => setEdit(t)}><Pencil size={14} /></button>
                    <button title="Delete" className="rounded-lg p-1.5 text-subtle hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950" onClick={() => { if (confirm(`Delete "${t.title}"?`)) update("templates", db.templates.filter((x) => x.id !== t.id)); }}><Trash2 size={14} /></button>
                  </div>
                </div>
                <p className="mt-3 line-clamp-4 flex-1 whitespace-pre-wrap text-[13px] leading-relaxed text-muted">{highlight(t.body)}</p>
                <Btn variant="outline" className="mt-4 self-start" onClick={() => setUsing(t)}><Send size={14} /> Use template</Btn>
              </Card>
            ))}
          </div>
        </>
      ) : (
        db.comms.length === 0
          ? <Empty icon={<MessageSquare size={18} />} title="No conversations logged" sub="Log calls, WhatsApp chats and meetings so the whole team knows where each client stands." />
          : (
            <Card className="divide-y divide-line">
              {[...db.comms].sort((a, b) => b.date.localeCompare(a.date)).map((c) => (
                <div key={c.id} className="group flex gap-3 px-5 py-4">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-muted"><MessageSquare size={14} /></div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px]"><span className="font-semibold">{c.clientName}</span> <span className="text-subtle">· {c.channel} · {c.date}</span></div>
                    <p className="mt-0.5 text-[13px] leading-relaxed text-muted">{c.summary}</p>
                  </div>
                  <button title="Delete" className="self-start rounded-lg p-1.5 text-subtle opacity-0 hover:text-red-600 group-hover:opacity-100" onClick={() => update("comms", db.comms.filter((x) => x.id !== c.id))}><Trash2 size={14} /></button>
                </div>
              ))}
            </Card>
          )
      )}

      <Modal open={!!edit} onClose={() => setEdit(null)} title={isNew ? "New template" : "Edit template"}
        footer={<><Btn variant="ghost" onClick={() => setEdit(null)}>Cancel</Btn><Btn onClick={saveTemplate}>Save template</Btn></>}>
        {edit && (
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Category"><select className={inputCls} value={edit.category} onChange={(e) => setEdit({ ...edit, category: e.target.value })}>{[...new Set([edit.category, ...CATEGORIES])].map((c) => <option key={c}>{c}</option>)}</select></Field>
              <Field label="Title"><input autoFocus className={inputCls} value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} /></Field>
            </div>
            <Field label="Message" hint="Use {{name}}, {{company}}, {{me}}, {{studio}}, {{upi}}, {{amount}}, {{date}}, {{label}}. For emails, start with “Subject: …”.">
              <textarea rows={7} className={inputCls} value={edit.body} onChange={(e) => setEdit({ ...edit, body: e.target.value })} />
            </Field>
          </div>
        )}
      </Modal>

      {using && <UseTemplate template={using} me={userName || db.settings.owner} onClose={() => setUsing(null)} onLog={(entry) => update("comms", [{ id: uid("c"), ...entry }, ...db.comms])} />}

      <Modal open={logOpen} onClose={() => setLogOpen(false)} title="Log a conversation"
        footer={<><Btn variant="ghost" onClick={() => setLogOpen(false)}>Cancel</Btn><Btn onClick={() => { if (!logForm.clientName.trim() || !logForm.summary.trim()) return alert("Add a client and a summary."); update("comms", [{ id: uid("c"), ...logForm }, ...db.comms]); setLogOpen(false); }}>Save</Btn></>}>
        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Date"><input type="date" className={inputCls} value={logForm.date} onChange={(e) => setLogForm({ ...logForm, date: e.target.value })} /></Field>
            <Field label="Channel"><select className={inputCls} value={logForm.channel} onChange={(e) => setLogForm({ ...logForm, channel: e.target.value })}>{CHANNELS.map((c) => <option key={c}>{c}</option>)}</select></Field>
          </div>
          <Field label="Client"><input list="log-clients" className={inputCls} value={logForm.clientName} onChange={(e) => setLogForm({ ...logForm, clientName: e.target.value })} placeholder="Client or lead" /></Field>
          <datalist id="log-clients">{[...new Set([...db.clients.map((c) => c.company), ...db.leads.map((l) => l.company)])].map((n) => <option key={n} value={n} />)}</datalist>
          <Field label="What was discussed or agreed?"><textarea rows={3} className={inputCls} value={logForm.summary} onChange={(e) => setLogForm({ ...logForm, summary: e.target.value })} /></Field>
        </div>
      </Modal>
    </div>
  );
}

function highlight(body: string) {
  return body.split(/(\{\{\w+\}\})/g).map((part, i) =>
    /^\{\{\w+\}\}$/.test(part) ? <span key={i} className="rounded bg-accent-soft px-1 font-medium text-accent">{part}</span> : part);
}

function UseTemplate({ template, me, onClose, onLog }: { template: Template; me: string; onClose: () => void; onLog: (e: { date: string; clientName: string; channel: string; summary: string }) => void }) {
  const { db } = useDB();
  const recipients = useMemo<Recipient[]>(() => [
    ...db.clients.map((c) => ({ key: "c" + c.id, company: c.company, contact: c.contactName, phone: c.whatsapp || c.phone, email: c.email })),
    ...db.leads.filter((l) => !db.clients.some((c) => c.company === l.company)).map((l) => ({ key: "l" + l.id, company: l.company, contact: l.contactName, phone: l.whatsapp || l.phone, email: l.email })),
  ], [db.clients, db.leads]);
  const [key, setKey] = useState(recipients[0]?.key ?? "");
  const [manual, setManual] = useState<Record<string, string>>({ amount: "", date: "", label: "" });
  const [copied, setCopied] = useState(false);
  const r = recipients.find((x) => x.key === key);
  const needs = MANUAL.filter((k) => template.body.includes(`{{${k}}}`));

  const vars: Record<string, string> = {
    name: r?.contact && r.contact !== "—" ? r.contact.split(" ")[0] : "there",
    company: r?.company ?? "your company",
    me, studio: db.settings.studio, upi: db.settings.upi || "(UPI ID)",
    ...Object.fromEntries(needs.map((k) => [k, manual[k] || `{{${k}}}`])),
  };
  const text = template.body.replace(/\{\{(\w+)\}\}/g, (m, k) => vars[k] ?? m);
  const subjectMatch = text.match(/^Subject:\s*(.+)\n+/);
  const subject = subjectMatch?.[1] ?? template.title;
  const body = subjectMatch ? text.slice(subjectMatch[0].length) : text;

  const log = (channel: string) => r && onLog({ date: todayISO(), clientName: r.company, channel, summary: `Sent “${template.title}”` });
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      alert("Copy isn't available here — select the preview text and copy it manually.");
    }
  };

  return (
    <Modal open onClose={onClose} title={template.title} wide
      footer={<>
        <Btn variant="ghost" className="mr-auto" onClick={copy}>{copied ? <Check size={14} /> : <Copy size={14} />}{copied ? "Copied" : "Copy text"}</Btn>
        {r?.email && <a onClick={() => log("Email")} href={`mailto:${r.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`} className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-line bg-surface px-3.5 text-[13.5px] font-medium hover:bg-surface-2"><Mail size={14} /> Email</a>}
        {r?.phone && <a onClick={() => log("WhatsApp")} target="_blank" rel="noreferrer" href={`https://wa.me/${waNumber(r.phone)}?text=${encodeURIComponent(text)}`} className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#25D366] px-3.5 text-[13.5px] font-medium text-white hover:opacity-90"><MessageCircle size={14} /> WhatsApp</a>}
      </>}>
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Send to">
            <select className={inputCls} value={key} onChange={(e) => setKey(e.target.value)}>
              {recipients.length === 0 && <option value="">No clients or leads yet</option>}
              {recipients.map((x) => <option key={x.key} value={x.key}>{x.company}{x.contact && x.contact !== "—" ? ` — ${x.contact}` : ""}</option>)}
            </select>
          </Field>
          {needs.map((k) => (
            <Field key={k} label={k === "label" ? "Payment for" : k[0].toUpperCase() + k.slice(1)}>
              <input className={inputCls} value={manual[k]} onChange={(e) => setManual({ ...manual, [k]: e.target.value })} placeholder={k === "amount" ? "₹15,000" : k === "date" ? "12 Oct" : "Advance 50%"} />
            </Field>
          ))}
        </div>
        <div className="rounded-xl border border-line bg-surface-2/60 p-4">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-subtle">Preview</div>
          <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed">{text}</p>
        </div>
        {r && !r.phone && !r.email && <p className="text-[12.5px] text-muted">Add a phone number or email to {r.company} to send directly.</p>}
      </div>
    </Modal>
  );
}
