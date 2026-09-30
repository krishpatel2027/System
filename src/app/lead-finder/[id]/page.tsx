"use client";
import React, { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, ScanSearch, Check, Clock, Copy, FileDown, Gauge, AtSign, Globe, Link2, Mail, MapPin, MessageCircle, Pencil, Phone, RefreshCw, Sparkles, Star, Target, Trash2, UserRound } from "lucide-react";
import { useDB } from "@/lib/store";
import type { Prospect, ProspectStatus } from "@/lib/types";
import { SIGNALS } from "@/lib/leadfinder/catalog";
import { opportunityLabel } from "@/lib/leadfinder/engine";
import { CHANNELS, miniAudit, outreach, waLink, type Channel } from "@/lib/leadfinder/outreach";
import { lfApi, useFinderStatus, useProspectActions } from "@/lib/leadfinder/client";
import { STAGES } from "@/lib/stages";
import { cn } from "@/lib/utils";
import { Badge, Btn, Card, CardHeader, Empty, Field, inputCls, Modal, Tabs } from "@/components/ui";
import { AuditView, ConfidenceTag, DataRow, ExtLink, OpportunityCard, ScoreBars, ScoreRing, SOURCE_LABEL, WebsiteBadge, prospectStatus } from "@/components/leadfinder";

export default function ProspectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { db, ready, userName } = useDB();
  const p = db.prospects.find((x) => x.id === id);
  if (!ready) return null;
  if (!p) return <Empty title="Business not found" sub="It may have been removed by a teammate." action={<Link href="/lead-finder/database"><Btn variant="outline">Back to database</Btn></Link>} />;
  return <Detail p={p} userName={userName} />;
}

function Detail({ p, userName }: { p: Prospect; userName: string }) {
  const { db } = useDB();
  const router = useRouter();
  const act = useProspectActions();
  const { status, ai } = useFinderStatus();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [edit, setEdit] = useState(false);
  const cfg = db.finder.scoring;
  const lead = db.leads.find((l) => l.prospectId === p.id || l.id === p.leadId);
  const op = opportunityLabel(p.score?.total, cfg);
  const pagespeedOn = !!status?.integrations.find((i) => i.id === "pagespeed")?.connected;

  const analyze = async (ps = false) => {
    setBusy(ps ? "pagespeed" : "analyze"); setErr(null);
    try { await act.analyze(p, ps); } catch (e) { setErr((e as Error).message); } finally { setBusy(null); }
  };
  const setStatus = (s: ProspectStatus) => act.save({ ...p, status: s, updatedAt: new Date().toISOString() });
  const refresh = async () => {
    if (!p.placeId) return;
    setBusy("refresh"); setErr(null);
    try {
      const { prospect: g } = await lfApi<{ prospect: Prospect | null }>("details", { placeId: p.placeId });
      if (!g) throw new Error("This business is no longer listed as operational on Google.");
      // Google-sourced fields take the fresh values; anything your team edited stays.
      const next: Prospect = { ...p, provenance: { ...p.provenance } };
      for (const k of ["phone", "website", "rating", "reviewCount", "address", "googleMapsUrl", "openingHours", "category"] as const) {
        if (p.provenance[k]?.source === "manual") continue;
        (next as unknown as Record<string, unknown>)[k] = g[k];
        if (g[k] !== undefined) next.provenance[k] = g.provenance[k] ?? { source: g.sources[0], confidence: "verified" };
        else delete next.provenance[k];
      }
      if (next.website !== p.website) { next.audit = undefined; next.websiteStatus = next.website ? "unchecked" : "none"; }
      act.reevaluate(next);
    } catch (e) { setErr((e as Error).message); } finally { setBusy(null); }
  };
  const del = () => { if (confirm(`Remove ${p.name} from the lead database?`)) { act.remove([p.id]); router.push("/lead-finder/database"); } };

  const issues = p.signals.filter((s) => SIGNALS[s].kind === "opportunity");
  const context = p.signals.filter((s) => SIGNALS[s].kind !== "opportunity");

  return (
    <div className="space-y-6">
      <div className="no-print flex items-center justify-between gap-2">
        <button onClick={() => router.back()} className="inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-ink"><ArrowLeft size={14} /> Back</button>
        <div className="flex flex-wrap gap-2">
          {p.placeId && status?.providerConnected && <Btn size="sm" variant="outline" disabled={!!busy} onClick={() => void refresh()}><RefreshCw size={13} className={busy === "refresh" ? "animate-spin" : ""} /> Refresh from Google</Btn>}
          <Link href={`/lead-finder/report?id=${p.id}`} target="_blank"><Btn size="sm" variant="outline"><FileDown size={13} /> Report / PDF</Btn></Link>
          <Btn size="sm" variant="ghost" onClick={del} className="text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950"><Trash2 size={13} /> Remove</Btn>
        </div>
      </div>

      <Card className="relative overflow-hidden p-6">
        <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-accent/10 blur-3xl" />
        <div className="relative flex flex-wrap items-start gap-5">
          <ScoreRing score={p.score?.total} cfg={cfg} size={84} />
          <div className="min-w-0 flex-1">
            <div className="text-[12px] font-medium text-subtle">Arkria Opportunity Score · {op.label}</div>
            <h1 className="mt-0.5 text-[26px] font-semibold leading-tight tracking-[-0.02em]">{p.name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted">
              <span>{p.industry || p.category || "Industry not set"}</span>
              {(p.area || p.city) && <span className="inline-flex items-center gap-1"><MapPin size={12} />{[p.area, p.city].filter(Boolean).join(", ")}</span>}
              {p.rating !== undefined && <span className="inline-flex items-center gap-1"><Star size={12} className="fill-amber-400 text-amber-400" />{p.rating.toFixed(1)} · {p.reviewCount ?? 0} reviews</span>}
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5"><WebsiteBadge status={p.websiteStatus} />{lead ? <Badge tone="green" dot>In pipeline · {STAGES.find((s) => s.id === lead.stage)?.label}</Badge> : <Badge tone={prospectStatus(p.status).tone}>{prospectStatus(p.status).label}</Badge>}</div>
          </div>
          <div className="no-print flex w-full flex-wrap gap-2 sm:w-auto sm:flex-col sm:items-stretch">
            {lead ? <Link href="/leads"><Btn className="w-full"><Target size={14} /> Open in pipeline</Btn></Link> : <Btn variant="accent" onClick={() => act.toPipeline(p, userName)}><Target size={14} /> Add to pipeline</Btn>}
            <select value={p.status} onChange={(e) => setStatus(e.target.value as ProspectStatus)} className={cn(inputCls, "sm:w-44")} aria-label="Review status">
              <option value="new">New</option><option value="reviewing">Reviewing</option><option value="qualified">Qualified</option><option value="not_fit">Not a fit</option>
            </select>
          </div>
        </div>
      </Card>

      {err && <div className="rounded-xl bg-red-50 px-3 py-2 text-[13px] text-red-700 dark:bg-red-950/50 dark:text-red-300">{err}</div>}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="Why this lead" sub="Everything below was observed, not assumed" />
            <div className="space-y-4 p-5">
              {issues.length ? (
                <ul className="space-y-2.5">
                  {issues.map((s) => (
                    <li key={s} className="flex gap-3 rounded-xl border border-line bg-surface-2/40 px-3.5 py-2.5">
                      <AlertTriangle size={15} className="mt-0.5 shrink-0 text-amber-500" />
                      <div className="min-w-0 break-words"><div className="text-[11px] font-semibold uppercase tracking-wide text-subtle">Detected issue · {SIGNALS[s].label}</div><div className="text-[13.5px]">{p.evidence[s]}</div></div>
                    </li>
                  ))}
                </ul>
              ) : <div className="text-[13.5px] text-muted">{p.websiteStatus === "unchecked" ? "The website hasn't been analyzed yet." : "No website or presence issues were detected."}</div>}
              {context.length > 0 && (
                <div className="flex flex-wrap gap-1.5">{context.map((s) => <span key={s} title={p.evidence[s]}><Badge tone={SIGNALS[s].kind === "strength" ? "green" : "blue"}>{SIGNALS[s].label}</Badge></span>)}</div>
              )}
            </div>
          </Card>

          <OpportunityCard p={p} />

          <Card>
            <CardHeader title="Website audit" sub={p.audit ? `Checked ${new Date(p.audit.analyzedAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}` : p.website ? "Not checked yet" : "No website found"}
              action={p.website && <div className="no-print flex gap-1.5">
                <Link href={`/lead-finder/audit?url=${encodeURIComponent(p.website)}&prospect=${p.id}`}><Btn size="sm"><ScanSearch size={13} /> Deep audit</Btn></Link>
                <Btn size="sm" variant="outline" disabled={!!busy} onClick={() => void analyze(false)}><RefreshCw size={13} className={busy === "analyze" ? "animate-spin" : ""} /> {p.audit ? "Re-check" : "Analyze"}</Btn>
                {pagespeedOn && <Btn size="sm" variant="outline" disabled={!!busy} onClick={() => void analyze(true)} title="Google PageSpeed, mobile (~30s)"><Gauge size={13} className={busy === "pagespeed" ? "animate-pulse" : ""} /> PageSpeed</Btn>}
              </div>} />
            <div className="p-5">
              {p.deepAudit && (
                <Link href={`/lead-finder/audits/${p.deepAudit.id}`} className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-accent-line bg-accent-soft px-4 py-3 transition hover:border-accent">
                  <div>
                    <div className="text-[12px] font-semibold uppercase tracking-wide text-accent">Deep audit · {new Date(p.deepAudit.at).toLocaleDateString("en-IN")}</div>
                    <div className="text-[13px]">Website health <b>{p.deepAudit.overall ?? "—"}</b>/100 · Arkria opportunity <b>{p.deepAudit.opportunity}</b>/100{p.deepAudit.service ? ` · ${p.deepAudit.service}` : ""}</div>
                  </div>
                  <span className="text-[12.5px] font-medium text-accent">View report →</span>
                </Link>
              )}
              <AuditView p={p} />
            </div>
          </Card>

          <OutreachCard p={p} ai={ai} onContacted={(ch) => act.markContacted(p, ch)} contacted={!!lead && lead.stage !== "new" && lead.stage !== "qualified"} />

          <Card>
            <CardHeader title="30-second mini audit" sub="A short, shareable summary for the prospect" action={<CopyBtn text={miniAudit(p)} />} />
            <pre className="m-5 mt-3 whitespace-pre-wrap rounded-xl bg-surface-2 p-4 font-sans text-[13px] leading-relaxed">{miniAudit(p)}</pre>
          </Card>
        </div>

        <div className="min-w-0 space-y-6">
          {p.score && (
            <Card>
              <CardHeader title="Score breakdown" sub={<>Based on your scoring rules · <Link href="/settings?section=scoring" className="text-accent hover:underline">Edit</Link></>} />
              <div className="p-5"><ScoreBars score={p.score} cfg={cfg} /></div>
            </Card>
          )}

          <Card>
            <CardHeader title="Contact" sub="Official business channels only" action={<Btn size="sm" variant="ghost" onClick={() => setEdit(true)} className="no-print"><Pencil size={12} /> Edit</Btn>} />
            <div className="divide-y divide-line px-5 pb-2">
              <DataRow label="Phone" icon={<Phone size={13} />} value={p.phone} prov={p.provenance.phone} href={p.phone ? `tel:${p.phone.replace(/\s/g, "")}` : undefined} />
              <DataRow label="WhatsApp" icon={<MessageCircle size={13} />} value={p.whatsapp} prov={p.provenance.whatsapp} />
              <DataRow label="Email" icon={<Mail size={13} />} value={p.email} prov={p.provenance.email} href={p.email ? `mailto:${p.email}` : undefined} />
              <DataRow label="Website" icon={<Globe size={13} />} value={p.website} prov={p.provenance.website} href={p.website ? (/^https?:/.test(p.website) ? p.website : `https://${p.website}`) : undefined} />
              <DataRow label="Instagram" icon={<AtSign size={13} />} value={p.socials.instagram && p.socials.instagram.replace(/^https?:\/\/(www\.)?/, "")} prov={p.provenance["social.instagram"]} href={p.socials.instagram} />
              <DataRow label="LinkedIn" icon={<Link2 size={13} />} value={p.socials.linkedin && p.socials.linkedin.replace(/^https?:\/\/(www\.)?/, "")} prov={p.provenance["social.linkedin"]} href={p.socials.linkedin} />
              {p.socials.facebook && <DataRow label="Facebook" value={p.socials.facebook.replace(/^https?:\/\/(www\.)?/, "")} prov={p.provenance["social.facebook"]} href={p.socials.facebook} />}
            </div>
          </Card>

          <DecisionMaker p={p} onSave={(dm) => act.save({ ...p, decisionMaker: dm, provenance: { ...p.provenance, decisionMaker: { source: "manual", confidence: dm?.url ? "verified" : "estimated" } }, updatedAt: new Date().toISOString() })} />

          <Card>
            <CardHeader title="Business intelligence" />
            <div className="divide-y divide-line px-5 pb-2">
              <DataRow label="Category" value={p.category} prov={p.provenance.category} />
              <DataRow label="Address" value={p.address} prov={p.provenance.address} />
              <DataRow label="Google rating" value={p.rating !== undefined ? `${p.rating.toFixed(1)} / 5` : undefined} prov={p.provenance.rating} />
              <DataRow label="Google reviews" value={p.reviewCount !== undefined ? String(p.reviewCount) : undefined} prov={p.provenance.reviewCount} />
              <DataRow label="Google Maps" value={p.googleMapsUrl ? "Open listing" : undefined} prov={p.provenance.googleMapsUrl} href={p.googleMapsUrl} />
              <DataRow label="Description" value={p.description} prov={p.provenance.description} />
              <DataRow label="Employees" value={undefined} />
              <DataRow label="Revenue" value={undefined} />
              {p.openingHours?.length ? (
                <div className="py-2.5"><div className="mb-1 flex items-center gap-1.5 text-[11.5px] text-subtle"><Clock size={12} /> Opening hours</div><div className="space-y-0.5 text-[12.5px] text-muted">{p.openingHours.map((h) => <div key={h}>{h}</div>)}</div></div>
              ) : null}
            </div>
            <div className="border-t border-line px-5 py-3 text-[11.5px] text-subtle">
              Sources: {p.sources.map((s) => SOURCE_LABEL[s]).join(", ")} · Found {new Date(p.discoveredAt).toLocaleDateString("en-IN")}
            </div>
          </Card>

          <Card className="p-5">
            <Field label="Notes"><textarea rows={4} className={inputCls} defaultValue={p.notes ?? ""} onBlur={(e) => e.target.value !== (p.notes ?? "") && act.save({ ...p, notes: e.target.value, updatedAt: new Date().toISOString() })} placeholder="Anything the team should know…" /></Field>
          </Card>
        </div>
      </div>

      {edit && <EditContact open p={p} onClose={() => setEdit(false)} onSave={(next) => { act.reevaluate(next); setEdit(false); }} />}
    </div>
  );
}

function CopyBtn({ text, label = "Copy" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <Btn size="sm" variant="outline" className="no-print" onClick={() => { void navigator.clipboard?.writeText(text); setDone(true); setTimeout(() => setDone(false), 1500); }}>
      {done ? <Check size={13} /> : <Copy size={13} />} {done ? "Copied" : label}
    </Btn>
  );
}

function OutreachCard({ p, ai, onContacted, contacted }: { p: Prospect; ai: boolean; onContacted: (ch: string) => void; contacted: boolean }) {
  const [ch, setCh] = useState<Channel>("whatsapp");
  return (
    <Card>
      <CardHeader title="Outreach" sub="Observation → opportunity → solution → call to action. Review before sending." />
      <div className="space-y-3 p-5">
        <div className="-mx-1 overflow-x-auto px-1"><Tabs tabs={CHANNELS} value={ch} onChange={setCh} /></div>
        <OutreachEditor key={`${ch}-${p.score?.total}-${p.match?.serviceId}-${p.decisionMaker?.name}-${p.audit?.analyzedAt}`} p={p} ch={ch} ai={ai} onContacted={onContacted} contacted={contacted} />
        <div className="text-[11.5px] text-subtle">Nothing is sent automatically. Opening WhatsApp or email only prepares the message for you to send.</div>
      </div>
    </Card>
  );
}

function OutreachEditor({ p, ch, ai, onContacted, contacted }: { p: Prospect; ch: Channel; ai: boolean; onContacted: (ch: string) => void; contacted: boolean }) {
  const { db } = useDB();
  const [draft, setDraft] = useState(() => outreach(p, ch, db.settings));
  const [aiBusy, setAiBusy] = useState(false);
  const [aiErr, setAiErr] = useState<string | null>(null);

  const personalize = async () => {
    setAiBusy(true); setAiErr(null);
    try {
      const r = await lfApi<{ draft: { subject: string; body: string } }>("ai", { task: "outreach", prospect: p, channel: ch, sender: { owner: db.settings.owner, studio: db.settings.studio, website: db.settings.website } });
      setDraft({ subject: ch === "email" ? r.draft.subject : undefined, body: r.draft.body });
    } catch (e) { setAiErr((e as Error).message); } finally { setAiBusy(false); }
  };
  const full = draft.subject ? `Subject: ${draft.subject}\n\n${draft.body}` : draft.body;
  const wa = ch === "whatsapp" ? waLink(p.whatsapp ?? p.phone, draft.body) : undefined;
  const mail = ch === "email" && p.email ? `mailto:${p.email}?subject=${encodeURIComponent(draft.subject ?? "")}&body=${encodeURIComponent(draft.body)}` : undefined;

  return (
    <>
      {draft.subject !== undefined && <input className={inputCls} value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} aria-label="Subject" />}
      <textarea rows={ch === "call" ? 14 : 8} className={cn(inputCls, "leading-relaxed")} value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} aria-label="Message" />
      {aiErr && <div className="text-[12.5px] text-red-600">{aiErr}</div>}
      <div className="no-print flex flex-wrap items-center gap-2">
        <CopyBtn text={full} />
        {wa && <a href={wa} target="_blank" rel="noreferrer noopener"><Btn size="sm" variant="outline"><MessageCircle size={13} /> Open in WhatsApp</Btn></a>}
        {mail && <a href={mail}><Btn size="sm" variant="outline"><Mail size={13} /> Open in email</Btn></a>}
        {ai && <Btn size="sm" variant="ghost" disabled={aiBusy} onClick={() => void personalize()}><Sparkles size={13} /> {aiBusy ? "Writing…" : "Personalize with AI"}</Btn>}
        <Btn size="sm" className="ml-auto" disabled={contacted} onClick={() => onContacted(CHANNELS.find((c) => c.id === ch)!.label)}>{contacted ? <><Check size={13} /> Contacted</> : "Mark as contacted"}</Btn>
      </div>
    </>
  );
}

function DecisionMaker({ p, onSave }: { p: Prospect; onSave: (dm: Prospect["decisionMaker"]) => void }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: p.decisionMaker?.name ?? "", role: p.decisionMaker?.role ?? "", url: p.decisionMaker?.url ?? "", source: p.decisionMaker?.source ?? "" });
  const dm = p.decisionMaker;
  const linkedin = `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(`${p.name} ${p.city ?? ""}`.trim())}`;
  return (
    <Card>
      <CardHeader title="Decision maker" sub="Public professional info only" action={<Btn size="sm" variant="ghost" className="no-print" onClick={() => setOpen(true)}><Pencil size={12} /> {dm ? "Edit" : "Add"}</Btn>} />
      <div className="px-5 pb-5 pt-3">
        {dm ? (
          <div className="flex items-start justify-between gap-3">
            <div className="flex gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface-2 text-muted"><UserRound size={16} /></div>
              <div><div className="text-[13.5px] font-medium">{dm.name}</div><div className="text-[12px] text-muted">{dm.role || "Role not recorded"}</div>{dm.url ? <div className="mt-0.5 text-[12px]"><ExtLink href={dm.url}>{dm.source || "Source"}</ExtLink></div> : <div className="text-[11.5px] text-subtle">{dm.source || "No source link"}</div>}</div>
            </div>
            <ConfidenceTag c={dm.url ? "verified" : "estimated"} source="manual" />
          </div>
        ) : (
          <div className="space-y-2 text-[13px] text-muted">
            <div className="flex items-center justify-between"><span>Not found</span><ConfidenceTag c="not_found" /></div>
            <div className="text-[12px]">Research publicly listed owners or founders, then add them with the source. Emails are never guessed.</div>
            <div className="no-print"><ExtLink href={linkedin}>Search LinkedIn</ExtLink></div>
          </div>
        )}
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title="Decision maker"
        footer={<>{dm && <Btn variant="ghost" className="mr-auto" onClick={() => { onSave(undefined); setOpen(false); }}>Remove</Btn>}<Btn variant="ghost" onClick={() => setOpen(false)}>Cancel</Btn><Btn disabled={!f.name.trim()} onClick={() => { onSave({ name: f.name.trim(), role: f.role.trim(), url: f.url.trim() || undefined, source: f.source.trim() || (f.url ? new URL(/^https?:/.test(f.url) ? f.url : `https://${f.url}`).hostname : "Manual entry") }); setOpen(false); }}>Save</Btn></>}>
        <div className="space-y-4">
          <Field label="Name *"><input className={inputCls} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
          <Field label="Role"><input className={inputCls} value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })} placeholder="Founder, Owner, Marketing head…" /></Field>
          <Field label="Public source link" hint="Where this is publicly listed (company About page, LinkedIn profile). Marked Verified when provided."><input className={inputCls} value={f.url} onChange={(e) => setF({ ...f, url: e.target.value })} placeholder="https://" /></Field>
          <Field label="Source name"><input className={inputCls} value={f.source} onChange={(e) => setF({ ...f, source: e.target.value })} placeholder="Company website, LinkedIn…" /></Field>
        </div>
      </Modal>
    </Card>
  );
}

function EditContact({ open, p, onClose, onSave }: { open: boolean; p: Prospect; onClose: () => void; onSave: (p: Prospect) => void }) {
  const fields = ["industry", "city", "phone", "whatsapp", "email", "website"] as const;
  const [f, setF] = useState<Record<(typeof fields)[number], string>>(() => Object.fromEntries(fields.map((k) => [k, p[k] ?? ""])) as Record<(typeof fields)[number], string>);
  const save = () => {
    const next: Prospect = { ...p, provenance: { ...p.provenance } };
    for (const k of fields) {
      const v = f[k].trim();
      if (v === (p[k] ?? "")) continue;
      (next as unknown as Record<string, unknown>)[k] = v || undefined;
      if (v) next.provenance[k] = { source: "manual", confidence: "verified" };
      else delete next.provenance[k];
      if (k === "website") { next.audit = undefined; next.websiteStatus = v ? "unchecked" : "none"; }
    }
    if (!next.sources.includes("manual")) next.sources = [...next.sources, "manual"];
    onSave(next);
  };
  return (
    <Modal open={open} onClose={onClose} title="Edit details" footer={<><Btn variant="ghost" onClick={onClose}>Cancel</Btn><Btn onClick={save}>Save</Btn></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        {fields.map((k) => <Field key={k} label={k[0].toUpperCase() + k.slice(1)}><input className={inputCls} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></Field>)}
      </div>
      <p className="mt-3 text-[12px] text-subtle">Edited values are marked as manually verified by your team.</p>
    </Modal>
  );
}
