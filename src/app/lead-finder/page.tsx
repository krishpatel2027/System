"use client";
import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Bookmark, Download, FileUp, Plus, Radar, Search, Sparkles, Square, Target } from "lucide-react";
import { useDB } from "@/lib/store";
import type { Prospect, SearchQuery } from "@/lib/types";
import { INDUSTRIES } from "@/lib/leadfinder/catalog";
import { QueryFilters } from "@/components/leadfinder-forms";
import { parseQuery } from "@/lib/leadfinder/nlp";
import { newProspect } from "@/lib/leadfinder/prospect";
import { evaluate } from "@/lib/leadfinder/engine";
import { downloadFile } from "@/lib/leadfinder/csv";
import { ApiError, emptyQuery, importCSV, importTemplate, lfApi, prospectsCSV, useDiscovery, useFinderStatus, useProspectActions, applyAudit, analyzeUrl } from "@/lib/leadfinder/client";
import { cn, inr, uid } from "@/lib/utils";
import { Badge, Btn, Card, CardHeader, Empty, Field, inputCls, Modal, PageHeader } from "@/components/ui";
import { FinderTabs, ProgressStages, ProspectCard, ProviderNotConnected } from "@/components/leadfinder";

export default function LeadFinderPage() {
  const { db, mutate, userName } = useDB();
  const router = useRouter();
  const { status, ai } = useFinderStatus();
  const discovery = useDiscovery();
  const actions = useProspectActions();
  const [q, setQ] = useState<SearchQuery>(emptyQuery);
  const [understood, setUnderstood] = useState<string[]>([]);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultIds, setResultIds] = useState<string[] | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [importOpen, setImportOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const cfg = db.finder.scoring;
  const set = (patch: Partial<SearchQuery>) => setQ((cur) => ({ ...cur, ...patch }));
  const connected = status?.providerConnected;

  const leadStage = useMemo(() => new Map(db.leads.filter((l) => l.prospectId).map((l) => [l.prospectId!, l.stage])), [db.leads]);
  const results = useMemo(() => (resultIds ? resultIds.map((id) => db.prospects.find((p) => p.id === id)).filter((p): p is Prospect => !!p) : []), [resultIds, db.prospects]);
  const today = useMemo(() => db.prospects.filter((p) => !p.leadId && p.status !== "not_fit" && (p.score?.total ?? 0) >= cfg.qualified).sort((a, b) => (b.score?.total ?? 0) - (a.score?.total ?? 0)).slice(0, 6), [db.prospects, cfg.qualified]);
  const high = db.prospects.filter((p) => (p.score?.total ?? 0) >= cfg.high && !p.leadId).length;
  const potential = db.prospects.filter((p) => !p.leadId && (p.score?.total ?? 0) >= cfg.qualified).reduce((a, p) => a + (p.match?.price ?? 0), 0);

  const applyText = async (text: string, useAi: boolean) => {
    const rule = parseQuery(text);
    let parsed = rule.query;
    let chips = rule.understood;
    if (useAi && ai) {
      setParsing(true);
      try {
        parsed = (await lfApi<{ query: Partial<SearchQuery> }>("ai", { task: "parse", text })).query;
        chips = ["Understood with AI"];
      } catch {} finally { setParsing(false); }
    }
    setQ((cur) => ({ ...cur, ...parsed, text, locations: parsed.locations?.length ? parsed.locations : cur.locations, industries: parsed.industries?.length ? parsed.industries : cur.industries }));
    setUnderstood(chips);
  };

  const find = async () => {
    setError(null);
    if (!q.locations.length && !q.industries.length && !q.text?.trim()) return setError("Add at least a location, an industry or a search phrase.");
    try {
      const label = q.text?.trim() || [q.industries.join(", "), q.locations.join(", ")].filter(Boolean).join(" in ");
      const r = await discovery.run(q, label || "Search");
      setResultIds(r.ids);
      setSelected([]);
      if (r.errors.length) setError(`Some searches failed: ${r.errors.slice(0, 2).join("; ")}`);
    } catch (e) {
      discovery.reset();
      setError(e instanceof ApiError && e.data.notConnected ? "Lead provider not connected." : (e as Error).message);
    }
  };

  const toggle = (id: string, v: boolean) => setSelected((s) => (v ? [...s, id] : s.filter((x) => x !== id)));
  const bulkPipeline = () => { results.filter((p) => selected.includes(p.id)).forEach((p) => actions.toPipeline(p, userName)); setSelected([]); };

  return (
    <div className="space-y-6">
      <PageHeader eyebrow={<span className="inline-flex items-center gap-1.5"><Radar size={13} /> Lead Finder</span>}
        title="Find Your Next Client."
        description="Discover businesses that need what Arkria builds — with the evidence, the right service and how to approach them."
        actions={<>
          <Btn variant="outline" onClick={() => setImportOpen(true)}><FileUp size={14} /> Import CSV</Btn>
          <Btn variant="outline" onClick={() => setAddOpen(true)}><Plus size={14} /> Add business</Btn>
        </>} />
      <FinderTabs />

      {status && !connected && <ProviderNotConnected />}

      <Card className="p-5">
        <div className="relative">
          <Sparkles size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-accent" />
          <input value={q.text ?? ""} onChange={(e) => set({ text: e.target.value })}
            onKeyDown={(e) => { if (e.key === "Enter") void applyText(q.text ?? "", true); }}
            onBlur={() => q.text?.trim() && void applyText(q.text, false)}
            placeholder="Try: interior designers in Ahmedabad and Surat without a website"
            className={cn(inputCls, "h-12 rounded-2xl pl-10 pr-28 text-[15px]")} />
          <Btn size="sm" variant="ghost" className="absolute right-2 top-1/2 -translate-y-1/2" disabled={!q.text?.trim() || parsing} onClick={() => void applyText(q.text ?? "", true)}>
            {parsing ? "Reading…" : ai ? <><Sparkles size={13} /> Understand</> : "Apply"}
          </Btn>
        </div>
        {understood.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">{understood.map((u) => <Badge key={u} tone="violet">{u}</Badge>)}</div>}

        <div className="mt-5"><QueryFilters q={q} set={set} services={db.services.filter((s) => s.active)} /></div>

        <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-line pt-4">
          <Btn variant="accent" onClick={find} disabled={discovery.running || !connected} title={!connected ? "Lead provider not connected" : undefined} className="h-10 px-5 text-[14px]">
            <Search size={15} /> {discovery.running ? "Finding…" : "Find leads"}
          </Btn>
          {discovery.running && <Btn variant="ghost" onClick={discovery.stop}><Square size={13} /> Stop website checks</Btn>}
          <Btn variant="ghost" onClick={() => setSaveOpen(true)} disabled={!q.locations.length && !q.industries.length && !q.text?.trim()}><Bookmark size={14} /> Save search</Btn>
          <Btn variant="ghost" onClick={() => { setQ(emptyQuery()); setUnderstood([]); }}>Reset</Btn>
          <div className="ml-auto text-[12px] text-subtle">Discovery only. Nothing is ever sent to businesses automatically.</div>
        </div>
        {error && <div className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-[13px] text-red-700 dark:bg-red-950/50 dark:text-red-300">{error}</div>}
      </Card>

      {discovery.progress && discovery.progress.stage !== "done" && <ProgressStages progress={discovery.progress} />}

      {resultIds && discovery.progress?.stage === "done" && (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-[16px] font-semibold tracking-tight">{results.length} new {results.length === 1 ? "business" : "businesses"} found</h2>
              <p className="text-[12.5px] text-muted">
                {db.finder.history[0] && `${db.finder.history[0].found} searched · ${db.finder.history[0].duplicates} already in your database · ${db.finder.history[0].qualified} qualified`}
                {discovery.progress.note && ` · ${discovery.progress.note}`}
              </p>
            </div>
            {results.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {selected.length > 0 && <Btn size="sm" onClick={bulkPipeline}><Target size={13} /> Add {selected.length} to pipeline</Btn>}
                <Btn size="sm" variant="outline" onClick={() => setSelected(selected.length === results.length ? [] : results.map((p) => p.id))}>{selected.length === results.length ? "Clear" : "Select all"}</Btn>
                <Btn size="sm" variant="outline" onClick={() => downloadFile(`arkria-leads-${new Date().toISOString().slice(0, 10)}.csv`, prospectsCSV(results))}><Download size={13} /> CSV</Btn>
              </div>
            )}
          </div>
          {results.length === 0 ? (
            <Empty icon={<Search size={18} />} title="No new matches" sub="Everything found was either already in your database or didn't pass your filters. Try another area or loosen the filters." />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {results.map((p, i) => <div key={p.id} className="animate-fade-up" style={{ animationDelay: `${Math.min(i, 12) * 30}ms` }}><ProspectCard p={p} cfg={cfg} selected={selected.includes(p.id)} onSelect={(v) => toggle(p.id, v)} inPipeline={leadStage.get(p.id)} /></div>)}
            </div>
          )}
        </section>
      )}

      {!resultIds && (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            {[["Businesses in database", String(db.prospects.length), "/lead-finder/database"], ["High-opportunity leads", String(high), "/lead-finder/database?min=" + cfg.high], ["Potential pipeline value", inr(potential), "/lead-finder/database?min=" + cfg.qualified]].map(([k, v, href]) => (
              <Link key={k} href={href}><Card className="p-5 transition hover:border-line-strong"><div className="text-[12.5px] text-muted">{k}</div><div className="mt-1.5 text-[24px] font-semibold tabular-nums tracking-tight">{v}</div>{k.startsWith("Potential") && <div className="text-[11.5px] text-subtle">Not guaranteed revenue</div>}</Card></Link>
            ))}
          </div>
          <Card>
            <CardHeader title="Today's opportunities" sub="Highest-scoring businesses not yet in your pipeline" action={db.prospects.length > 0 && <Link href="/lead-finder/database" className="inline-flex items-center gap-1 text-[12.5px] font-medium text-accent">View all <ArrowRight size={13} /></Link>} />
            <div className="p-5">
              {today.length ? (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{today.map((p) => <ProspectCard key={p.id} p={p} cfg={cfg} />)}</div>
              ) : (
                <Empty icon={<Radar size={18} />} title="No opportunities yet" sub={connected ? "Run a search above — qualified businesses will appear here." : "Import a CSV or add businesses manually to start scoring opportunities."} />
              )}
            </div>
          </Card>
        </>
      )}

      <ImportModal open={importOpen} onClose={() => setImportOpen(false)} onDone={(ids) => { setImportOpen(false); setResultIds(ids); discovery.reset(); router.push("/lead-finder/database?recent=1"); }} />
      <AddModal open={addOpen} onClose={() => setAddOpen(false)} onDone={(id) => { setAddOpen(false); router.push(`/lead-finder/${id}`); }} />
      <SaveSearchModal open={saveOpen} onClose={() => setSaveOpen(false)} onSave={(name, schedule) => {
        mutate((d) => ({ finder: { ...d.finder, savedSearches: [{ id: uid("ss"), name, query: q, schedule, createdAt: new Date().toISOString() }, ...d.finder.savedSearches] } }));
        setSaveOpen(false);
      }} />
    </div>
  );
}

function SaveSearchModal({ open, onClose, onSave }: { open: boolean; onClose: () => void; onSave: (name: string, schedule: "manual" | "daily" | "weekly") => void }) {
  const [name, setName] = useState("");
  const [schedule, setSchedule] = useState<"manual" | "daily" | "weekly">("manual");
  return (
    <Modal open={open} onClose={onClose} title="Save search"
      footer={<><Btn variant="ghost" onClick={onClose}>Cancel</Btn><Btn disabled={!name.trim()} onClick={() => { onSave(name.trim(), schedule); setName(""); }}>Save</Btn></>}>
      <div className="space-y-4">
        <Field label="Name"><input autoFocus className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ahmedabad interiors without websites" /></Field>
        <Field label="Auto find" hint="Daily/weekly runs need CRON_SECRET on the server (see README). You can always run it manually.">
          <select className={inputCls} value={schedule} onChange={(e) => setSchedule(e.target.value as typeof schedule)}>
            <option value="manual">Manual only</option><option value="daily">Daily</option><option value="weekly">Weekly</option>
          </select>
        </Field>
      </div>
    </Modal>
  );
}

function ImportModal({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: (ids: string[]) => void }) {
  const { db, mutate } = useDB();
  const [text, setText] = useState("");
  const preview = useMemo(() => (text.trim() ? importCSV(text, db) : null), [text, db]);
  const onFile = async (f?: File) => { if (f) setText(await f.text()); };
  const confirm = () => {
    if (!preview?.prospects.length) return;
    mutate((d) => ({ prospects: [...preview.prospects, ...d.prospects] }));
    const ids = preview.prospects.map((p) => p.id);
    setText("");
    onDone(ids);
  };
  return (
    <Modal open={open} onClose={onClose} wide title="Import businesses from CSV"
      footer={<><Btn variant="ghost" onClick={() => downloadFile("arkria-import-template.csv", importTemplate())}><Download size={13} /> Template</Btn><Btn variant="ghost" onClick={onClose}>Cancel</Btn><Btn disabled={!preview?.prospects.length} onClick={confirm}>Import {preview?.prospects.length || ""}</Btn></>}>
      <div className="space-y-4 text-[13px]">
        <p className="text-muted">Columns: <span className="text-ink">Business Name, Industry, Location, Website, Phone, Email, Instagram, LinkedIn, Notes</span>. Only Business Name is required. Imported data is labelled with its source; websites can be analyzed after import.</p>
        <input type="file" accept=".csv,text/csv" onChange={(e) => void onFile(e.target.files?.[0])} className="block w-full text-[13px] file:mr-3 file:rounded-lg file:border-0 file:bg-surface-2 file:px-3 file:py-1.5 file:text-[13px] file:font-medium" />
        <textarea rows={6} className={cn(inputCls, "font-mono text-[12px]")} value={text} onChange={(e) => setText(e.target.value)} placeholder={"Business Name,Industry,Location,Website,Phone\nShree Interiors,Interior Design,Ahmedabad,shreeinteriors.in,+91 98…"} />
        {preview && (
          preview.missing.length ? <div className="rounded-xl bg-red-50 px-3 py-2 text-red-700 dark:bg-red-950/50 dark:text-red-300">Missing required column: {preview.missing.join(", ")}.</div> :
          <div className="flex flex-wrap gap-2"><Badge tone="green">{preview.prospects.length} ready</Badge>{preview.duplicates > 0 && <Badge tone="amber">{preview.duplicates} duplicates skipped</Badge>}{preview.skipped > 0 && <Badge>{preview.skipped} rows without a name</Badge>}</div>
        )}
      </div>
    </Modal>
  );
}

function AddModal({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: (id: string) => void }) {
  const { db, mutate } = useDB();
  const [f, setF] = useState({ name: "", industry: "", city: "", website: "", phone: "", email: "", instagram: "", notes: "" });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }));
  const save = async () => {
    if (!f.name.trim()) return;
    setBusy(true);
    let p = newProspect({
      name: f.name.trim(), industry: f.industry.trim(), city: f.city.trim() || undefined, website: f.website.trim() || undefined,
      phone: f.phone.trim() || undefined, email: f.email.trim() || undefined, notes: f.notes.trim() || undefined,
      socials: f.instagram.trim() ? { instagram: /^https?:/.test(f.instagram) ? f.instagram.trim() : `https://instagram.com/${f.instagram.trim().replace(/^@/, "")}` } : {},
    }, "manual");
    if (p.website) { try { p = applyAudit(p, await analyzeUrl(p.website)); } catch {} }
    p = evaluate(p, db.services, db.finder.scoring);
    mutate((d) => ({ prospects: [p, ...d.prospects] }));
    setBusy(false);
    setF({ name: "", industry: "", city: "", website: "", phone: "", email: "", instagram: "", notes: "" });
    onDone(p.id);
  };
  return (
    <Modal open={open} onClose={onClose} wide title="Add a business"
      footer={<><Btn variant="ghost" onClick={onClose}>Cancel</Btn><Btn disabled={!f.name.trim() || busy} onClick={() => void save()}>{busy ? "Analyzing…" : "Add & analyze"}</Btn></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Business name *"><input autoFocus className={inputCls} value={f.name} onChange={(e) => set("name", e.target.value)} /></Field>
        <Field label="Industry"><input list="lf-add-ind" className={inputCls} value={f.industry} onChange={(e) => set("industry", e.target.value)} /><datalist id="lf-add-ind">{INDUSTRIES.map((i) => <option key={i} value={i} />)}</datalist></Field>
        <Field label="City"><input className={inputCls} value={f.city} onChange={(e) => set("city", e.target.value)} /></Field>
        <Field label="Website" hint="We'll check it right away."><input className={inputCls} value={f.website} onChange={(e) => set("website", e.target.value)} placeholder="example.in" /></Field>
        <Field label="Business phone"><input className={inputCls} value={f.phone} onChange={(e) => set("phone", e.target.value)} /></Field>
        <Field label="Business email"><input className={inputCls} value={f.email} onChange={(e) => set("email", e.target.value)} /></Field>
        <Field label="Instagram"><input className={inputCls} value={f.instagram} onChange={(e) => set("instagram", e.target.value)} placeholder="@handle" /></Field>
        <Field label="Notes"><input className={inputCls} value={f.notes} onChange={(e) => set("notes", e.target.value)} /></Field>
      </div>
    </Modal>
  );
}
