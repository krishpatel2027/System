"use client";
import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Bookmark, Download, FileUp, Plus, Radar, Search, Sparkles, Square, Target } from "lucide-react";
import { useDB } from "@/lib/store";
import type { Prospect, SearchQuery } from "@/lib/types";
import { INDUSTRIES } from "@/lib/leadfinder/catalog";
import { QueryFilters } from "@/components/leadfinder-forms";
import { convertBudget, parseQuery } from "@/lib/leadfinder/nlp";
import { newProspect } from "@/lib/leadfinder/prospect";
import { evaluate } from "@/lib/leadfinder/engine";
import { downloadFile } from "@/lib/leadfinder/csv";
import { ApiError, emptyQuery, importCSV, importTemplate, lfApi, prospectsCSV, useDiscovery, useFinderStatus, useProspectActions, applyAudit, analyzeUrl } from "@/lib/leadfinder/client";
import { cn, inr, uid } from "@/lib/utils";
import { Badge, Btn, Card, CardHeader, Empty, Field, inputCls, Modal, PageHeader } from "@/components/ui";
import { FOREIGN_GROUPS, MARKETS, REGION_LABEL, queryRegion, regionOf, type Region } from "@/lib/leadfinder/markets";
import { setRegion, useRegion } from "@/lib/leadfinder/region";
import { FinderTabs, ProgressStages, ProspectCard, ProviderNotConnected } from "@/components/leadfinder";

// A search is checked against the workspace it's run from, so a Dubai search never
// lands in the India list (or the other way round) by accident.
function regionProblem(q: SearchQuery, region: Region): { text: string; switchTo?: Region } | null {
  if (!q.locations.length && !q.industries.length && !q.text?.trim() && !q.country) return null;
  const r = queryRegion(q);
  const place = q.locations.length ? `“${q.locations.join(", ")}”` : "This search";
  if (region === "in") {
    if (r === "intl" || r === "mixed") return { text: `${place} ${r === "mixed" ? "includes places outside India" : "is outside India"}. Switch to International to search it.`, switchTo: "intl" };
    return null;
  }
  if (r === "in" || r === "mixed") return { text: `${place} ${r === "mixed" ? "includes places in India" : "is in India"}. Switch to India to search it.`, switchTo: "in" };
  if (r === "unknown") return { text: q.locations.length ? `Choose a country for ${place} so the right Google results are used.` : "Choose a country, or add a place such as Austin or Dubai." };
  return null;
}

export default function LeadFinderPage() {
  const region = useRegion();
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
  // Switching region clears the results of the other one and any country that belongs to it.
  const [shownRegion, setShownRegion] = useState(region);
  if (shownRegion !== region) {
    setShownRegion(region);
    setResultIds(null); setSelected([]); setError(null); discovery.reset();
    setQ((cur) => (cur.country && regionOf({ country: cur.country }) !== region ? { ...cur, country: undefined } : cur));
  }
  const mine = useMemo(() => db.prospects.filter((p) => regionOf(p) === region), [db.prospects, region]);
  const problem = regionProblem(q, region);
  const connected = status?.providerConnected;

  const leadStage = useMemo(() => new Map(db.leads.filter((l) => l.prospectId).map((l) => [l.prospectId!, l.stage])), [db.leads]);
  const results = useMemo(() => (resultIds ? resultIds.map((id) => db.prospects.find((p) => p.id === id)).filter((p): p is Prospect => !!p) : []), [resultIds, db.prospects]);
  const today = useMemo(() => mine.filter((p) => !p.leadId && p.status !== "not_fit" && (p.score?.total ?? 0) >= cfg.qualified).sort((a, b) => (b.score?.total ?? 0) - (a.score?.total ?? 0)).slice(0, 6), [mine, cfg.qualified]);
  const high = mine.filter((p) => (p.score?.total ?? 0) >= cfg.high && !p.leadId).length;
  const potential = mine.filter((p) => !p.leadId && (p.score?.total ?? 0) >= cfg.qualified).reduce((a, p) => a + (p.match?.price ?? 0), 0);

  const applyText = async (text: string, useAi: boolean) => {
    const rule = parseQuery(text);
    let parsed: Partial<SearchQuery> = rule.query;
    let chips = rule.understood;
    let currency = rule.budgetCurrency;
    if (useAi && ai) {
      setParsing(true);
      try {
        const res = (await lfApi<{ query: Partial<SearchQuery> & { budgetCurrency?: string } }>("ai", { task: "parse", text })).query;
        const { budgetCurrency, ...rest } = res;
        parsed = rest; currency = budgetCurrency;
        chips = ["Understood with AI"];
      } catch {} finally { setParsing(false); }
    }
    // A budget typed in dollars, pounds or dirhams is turned into rupees with the rate saved in Settings.
    if (currency) {
      const conv = convertBudget(parsed.budgetMax, currency, db.finder.fx);
      parsed = { ...parsed, budgetMax: conv.budgetMax };
      chips = [...chips.filter((c) => !c.startsWith("Budget")), ...(conv.chip ? [conv.chip] : [])];
    }
    setQ((cur) => ({
      ...cur, ...parsed, text,
      locations: parsed.locations?.length ? parsed.locations : cur.locations,
      industries: parsed.industries?.length ? parsed.industries : cur.industries,
      // New places replace the old country; otherwise keep what was picked.
      country: parsed.locations?.length || parsed.country ? parsed.country : cur.country,
    }));
    setUnderstood(chips);
  };

  // India searches are always India; International ones use the chosen or detected country.
  const scoped = (query: SearchQuery): SearchQuery => (region === "in" ? { ...query, country: "IN" } : query);

  const find = async () => {
    setError(null);
    if (!q.locations.length && !q.industries.length && !q.text?.trim()) return setError("Add at least a location, an industry or a search phrase.");
    if (problem) return setError(problem.text);
    try {
      const label = q.text?.trim() || [q.industries.join(", "), q.locations.join(", ")].filter(Boolean).join(" in ");
      const r = await discovery.run(scoped(q), label || "Search");
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
      <PageHeader eyebrow={<span className="inline-flex items-center gap-1.5"><Radar size={13} /> Lead Finder · {REGION_LABEL[region]}</span>}
        title="Find Your Next Client."
        description={region === "in" ? "Discover businesses in India that need what Arkria builds — with the evidence, the right service and how to approach them." : "Discover businesses in the US, Canada, UK, Australia and the Gulf. Each lead keeps its own country, local time, currency and outreach rules."}
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
            placeholder={region === "in" ? "Try: interior designers in Ahmedabad and Surat without a website" : "Try: dentists in Austin, or interior designers in Dubai, without a website"}
            className={cn(inputCls, "h-12 rounded-2xl pl-10 pr-28 text-[15px]")} />
          <Btn size="sm" variant="ghost" className="absolute right-2 top-1/2 -translate-y-1/2" disabled={!q.text?.trim() || parsing} onClick={() => void applyText(q.text ?? "", true)}>
            {parsing ? "Reading…" : ai ? <><Sparkles size={13} /> Understand</> : "Apply"}
          </Btn>
        </div>
        {understood.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">{understood.map((u) => <Badge key={u} tone="violet">{u}</Badge>)}</div>}

        <div className="mt-5"><QueryFilters q={q} set={set} region={region} services={db.services.filter((s) => s.active)} /></div>

        {problem && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-amber-50 px-3 py-2 text-[13px] text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
            <span>{problem.text}</span>
            {problem.switchTo && <Btn size="sm" variant="outline" onClick={() => setRegion(problem.switchTo!)}>Switch to {REGION_LABEL[problem.switchTo]}</Btn>}
          </div>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-line pt-4">
          <Btn variant="accent" onClick={find} disabled={discovery.running || !connected || !!problem} title={!connected ? "Lead provider not connected" : problem?.text} className="h-10 px-5 text-[14px]">
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
            {[[`${REGION_LABEL[region]} businesses in database`, String(mine.length), "/lead-finder/database"], ["High-opportunity leads", String(high), "/lead-finder/database?min=" + cfg.high], ["Potential pipeline value", inr(potential), "/lead-finder/database?min=" + cfg.qualified]].map(([k, v, href]) => (
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

      <ImportModal region={region} open={importOpen} onClose={() => setImportOpen(false)} onDone={(ids) => { setImportOpen(false); setResultIds(ids); discovery.reset(); router.push("/lead-finder/database?recent=1"); }} />
      <AddModal region={region} open={addOpen} onClose={() => setAddOpen(false)} onDone={(id) => { setAddOpen(false); router.push(`/lead-finder/${id}`); }} />
      <SaveSearchModal open={saveOpen} onClose={() => setSaveOpen(false)} onSave={(name, schedule) => {
        mutate((d) => ({ finder: { ...d.finder, savedSearches: [{ id: uid("ss"), name, query: scoped(q), schedule, createdAt: new Date().toISOString() }, ...d.finder.savedSearches] } }));
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

function ImportModal({ region, open, onClose, onDone }: { region: Region; open: boolean; onClose: () => void; onDone: (ids: string[]) => void }) {
  const { db, mutate } = useDB();
  const [text, setText] = useState("");
  // Rows with no country (and no recognised city) go to this workspace: India, or the country chosen here.
  const [country, setCountry] = useState("");
  const defaultCountry = region === "in" ? "IN" : country || undefined;
  const preview = useMemo(() => (text.trim() ? importCSV(text, db, defaultCountry) : null), [text, db, defaultCountry]);
  const elsewhere = preview ? preview.prospects.filter((p) => regionOf(p) !== region).length : 0;
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
      footer={<><Btn variant="ghost" onClick={() => downloadFile("arkria-import-template.csv", importTemplate())}><Download size={13} /> Template</Btn><Btn variant="ghost" onClick={onClose}>Cancel</Btn><Btn disabled={!preview?.prospects.length || (region === "intl" && !country)} onClick={confirm}>Import {preview?.prospects.length || ""}</Btn></>}>
      <div className="space-y-4 text-[13px]">
        <p className="text-muted">Columns: <span className="text-ink">Business Name, Industry, Location, Country, Website, Phone, Email, Instagram, LinkedIn, Notes</span>. Only Business Name is required. {region === "in" ? "Rows go to India unless the city or country says otherwise." : "Rows without a country (or a recognised city) use the country chosen below."} Imported data is labelled with its source; websites can be analyzed after import.</p>
        {region === "intl" && (
          <Field label="Country for rows without one" hint="Required, so every business lands in the right country.">
            <select className={inputCls} value={country} onChange={(e) => setCountry(e.target.value)}>
              <option value="">Choose a country…</option>
              {FOREIGN_GROUPS.map((g) => <optgroup key={g.label} label={g.label}>{g.codes.map((c) => <option key={c} value={c}>{MARKETS[c].name}</option>)}</optgroup>)}
            </select>
          </Field>
        )}
        <input type="file" accept=".csv,text/csv" onChange={(e) => void onFile(e.target.files?.[0])} className="block w-full text-[13px] file:mr-3 file:rounded-lg file:border-0 file:bg-surface-2 file:px-3 file:py-1.5 file:text-[13px] file:font-medium" />
        <textarea rows={6} className={cn(inputCls, "font-mono text-[12px]")} value={text} onChange={(e) => setText(e.target.value)} placeholder={"Business Name,Industry,Location,Website,Phone\nShree Interiors,Interior Design,Ahmedabad,shreeinteriors.in,+91 98…"} />
        {preview && (
          preview.missing.length ? <div className="rounded-xl bg-red-50 px-3 py-2 text-red-700 dark:bg-red-950/50 dark:text-red-300">Missing required column: {preview.missing.join(", ")}.</div> :
          <div className="flex flex-wrap gap-2"><Badge tone="green">{preview.prospects.length} ready</Badge>{preview.duplicates > 0 && <Badge tone="amber">{preview.duplicates} duplicates skipped</Badge>}{preview.skipped > 0 && <Badge>{preview.skipped} rows without a name</Badge>}{elsewhere > 0 && <Badge tone="violet">{elsewhere} will go to {REGION_LABEL[region === "in" ? "intl" : "in"]} (their country is there)</Badge>}</div>
        )}
      </div>
    </Modal>
  );
}

function AddModal({ region, open, onClose, onDone }: { region: Region; open: boolean; onClose: () => void; onDone: (id: string) => void }) {
  const { db, mutate } = useDB();
  const [f, setF] = useState({ name: "", industry: "", city: "", website: "", phone: "", email: "", instagram: "", notes: "" });
  const [country, setCountry] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }));
  const save = async () => {
    if (!f.name.trim() || (region === "intl" && !country)) return;
    setBusy(true);
    let p = newProspect({
      name: f.name.trim(), industry: f.industry.trim(), city: f.city.trim() || undefined, country: region === "in" ? "IN" : country, website: f.website.trim() || undefined,
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
      footer={<><Btn variant="ghost" onClick={onClose}>Cancel</Btn><Btn disabled={!f.name.trim() || busy || (region === "intl" && !country)} onClick={() => void save()}>{busy ? "Analyzing…" : "Add & analyze"}</Btn></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Business name *"><input autoFocus className={inputCls} value={f.name} onChange={(e) => set("name", e.target.value)} /></Field>
        <Field label="Industry"><input list="lf-add-ind" className={inputCls} value={f.industry} onChange={(e) => set("industry", e.target.value)} /><datalist id="lf-add-ind">{INDUSTRIES.map((i) => <option key={i} value={i} />)}</datalist></Field>
        {region === "intl" && (
          <Field label="Country *">
            <select className={inputCls} value={country} onChange={(e) => setCountry(e.target.value)}>
              <option value="">Choose a country…</option>
              {FOREIGN_GROUPS.map((g) => <optgroup key={g.label} label={g.label}>{g.codes.map((c) => <option key={c} value={c}>{MARKETS[c].name}</option>)}</optgroup>)}
            </select>
          </Field>
        )}
        <Field label="City"><input className={inputCls} value={f.city} onChange={(e) => set("city", e.target.value)} /></Field>
        <Field label="Website" hint="We'll check it right away."><input className={inputCls} value={f.website} onChange={(e) => set("website", e.target.value)} placeholder={region === "in" ? "example.in" : "example.com"} /></Field>
        <Field label="Business phone"><input className={inputCls} value={f.phone} onChange={(e) => set("phone", e.target.value)} /></Field>
        <Field label="Business email"><input className={inputCls} value={f.email} onChange={(e) => set("email", e.target.value)} /></Field>
        <Field label="Instagram"><input className={inputCls} value={f.instagram} onChange={(e) => set("instagram", e.target.value)} placeholder="@handle" /></Field>
        <Field label="Notes"><input className={inputCls} value={f.notes} onChange={(e) => set("notes", e.target.value)} /></Field>
      </div>
    </Modal>
  );
}
