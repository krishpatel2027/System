"use client";
import React, { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Database, Download, FileDown, LayoutGrid, List, RefreshCw, Search, Target, Trash2 } from "lucide-react";
import { useDB } from "@/lib/store";
import type { Prospect, WebsiteStatus } from "@/lib/types";
import { downloadFile } from "@/lib/leadfinder/csv";
import { prospectsCSV, useProspectActions } from "@/lib/leadfinder/client";
import { STAGES } from "@/lib/stages";
import { cn, inr } from "@/lib/utils";
import { Badge, Btn, Empty, inputCls, PageHeader, Progress, Tabs } from "@/components/ui";
import { FinderTabs, ProspectCard, ScoreRing, WebsiteBadge, prospectStatus } from "@/components/leadfinder";
import { MARKETS, isForeign, marketOf } from "@/lib/leadfinder/markets";

type Sort = "score" | "newest" | "reviews" | "value" | "name";

function DatabaseInner() {
  const { db, userName } = useDB();
  const params = useSearchParams();
  const act = useProspectActions();
  const cfg = db.finder.scoring;
  const [text, setText] = useState("");
  const [industry, setIndustry] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [site, setSite] = useState<"" | WebsiteStatus | "weak">("");
  const [status, setStatus] = useState<"" | Prospect["status"] | "pipeline">("");
  const [service, setService] = useState("");
  const [minScore, setMinScore] = useState(Number(params.get("min") ?? 0));
  const [contact, setContact] = useState(false);
  const [sort, setSort] = useState<Sort>(params.get("recent") ? "newest" : "score");
  const [view, setView] = useState<"table" | "grid">("table");
  const [selected, setSelected] = useState<string[]>([]);
  const [bulk, setBulk] = useState<{ done: number; total: number } | null>(null);

  const industries = useMemo(() => [...new Set(db.prospects.map((p) => p.industry).filter(Boolean))].sort(), [db.prospects]);
  const countries = useMemo(() => [...new Set(db.prospects.map((p) => p.country ?? "IN"))].sort(), [db.prospects]);
  const cities = useMemo(() => [...new Set(db.prospects.map((p) => p.city).filter((c): c is string => !!c))].sort(), [db.prospects]);
  const leadOf = useMemo(() => new Map(db.leads.filter((l) => l.prospectId).map((l) => [l.prospectId!, l])), [db.leads]);

  const list = useMemo(() => {
    const t = text.trim().toLowerCase();
    const out = db.prospects.filter((p) => {
      if (t && !`${p.name} ${p.industry} ${p.city} ${p.area} ${p.country ?? ""} ${marketOf(p.country)?.name ?? ""} ${p.website} ${p.category}`.toLowerCase().includes(t)) return false;
      if (industry && p.industry !== industry) return false;
      if (city && p.city !== city) return false;
      if (country && (p.country ?? "IN") !== country) return false;
      if (site === "weak" ? !["outdated", "basic", "unreachable"].includes(p.websiteStatus) : site && p.websiteStatus !== site) return false;
      if (status === "pipeline" ? !leadOf.has(p.id) : status && p.status !== status) return false;
      if (service && p.match?.serviceId !== service) return false;
      if (minScore && (p.score?.total ?? 0) < minScore) return false;
      if (contact && !(p.phone || p.email || p.whatsapp)) return false;
      return true;
    });
    const by: Record<Sort, (a: Prospect, b: Prospect) => number> = {
      score: (a, b) => (b.score?.total ?? -1) - (a.score?.total ?? -1),
      newest: (a, b) => b.discoveredAt.localeCompare(a.discoveredAt),
      reviews: (a, b) => (b.reviewCount ?? -1) - (a.reviewCount ?? -1),
      value: (a, b) => (b.match?.price ?? 0) - (a.match?.price ?? 0),
      name: (a, b) => a.name.localeCompare(b.name),
    };
    return out.sort(by[sort]);
  }, [db.prospects, text, industry, city, country, site, status, service, minScore, contact, sort, leadOf]);

  const chosen = list.filter((p) => selected.includes(p.id));
  const target = chosen.length ? chosen : list;
  const allSel = list.length > 0 && chosen.length === list.length;
  const toggle = (id: string, v: boolean) => setSelected((s) => (v ? [...s, id] : s.filter((x) => x !== id)));

  const analyzeUnchecked = async () => {
    const todo = target.filter((p) => p.website && !p.audit);
    setBulk({ done: 0, total: todo.length });
    let i = 0;
    for (const p of todo) {
      try { await act.analyze(p); } catch {}
      setBulk({ done: ++i, total: todo.length });
    }
    setTimeout(() => setBulk(null), 800);
  };

  const unchecked = target.filter((p) => p.website && !p.audit).length;
  const reset = () => { setText(""); setIndustry(""); setCity(""); setCountry(""); setSite(""); setStatus(""); setService(""); setMinScore(0); setContact(false); };

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Lead Finder" title="Lead database" description={`${db.prospects.length} businesses · ${db.prospects.filter((p) => (p.score?.total ?? 0) >= cfg.qualified).length} qualified · every fact labelled with its source`} />
      <FinderTabs />

      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-subtle" />
            <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Search name, area, website…" className={cn(inputCls, "pl-8")} />
          </div>
          <select className={cn(inputCls, "w-auto")} value={industry} onChange={(e) => setIndustry(e.target.value)} aria-label="Industry"><option value="">All industries</option>{industries.map((i) => <option key={i}>{i}</option>)}</select>
          {countries.length > 1 && <select className={cn(inputCls, "w-auto")} value={country} onChange={(e) => setCountry(e.target.value)} aria-label="Country"><option value="">All countries</option>{countries.map((c) => <option key={c} value={c}>{MARKETS[c as keyof typeof MARKETS]?.name ?? c}</option>)}</select>}
          <select className={cn(inputCls, "w-auto")} value={city} onChange={(e) => setCity(e.target.value)} aria-label="City"><option value="">All cities</option>{cities.map((c) => <option key={c}>{c}</option>)}</select>
          <select className={cn(inputCls, "w-auto")} value={site} onChange={(e) => setSite(e.target.value as typeof site)} aria-label="Website">
            <option value="">Any website</option><option value="none">No website</option><option value="weak">Weak / outdated</option><option value="outdated">Outdated</option><option value="basic">Basic</option><option value="good">Strong</option><option value="unchecked">Not checked</option><option value="unreachable">Not loading</option>
          </select>
          <select className={cn(inputCls, "w-auto")} value={status} onChange={(e) => setStatus(e.target.value as typeof status)} aria-label="Status">
            <option value="">Any status</option><option value="new">New</option><option value="reviewing">Reviewing</option><option value="qualified">Qualified</option><option value="not_fit">Not a fit</option><option value="pipeline">In pipeline</option>
          </select>
          <select className={cn(inputCls, "w-auto")} value={service} onChange={(e) => setService(e.target.value)} aria-label="Service"><option value="">Any service</option>{db.services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-[12.5px] text-muted">Min score <input type="range" min={0} max={90} step={5} value={minScore} onChange={(e) => setMinScore(Number(e.target.value))} className="w-28 accent-[var(--accent)]" /><span className="w-6 tabular-nums text-ink">{minScore}</span></label>
          <label className="flex items-center gap-2 text-[12.5px] text-muted"><input type="checkbox" checked={contact} onChange={(e) => setContact(e.target.checked)} className="accent-[var(--accent)]" /> Has contact</label>
          <select className={cn(inputCls, "h-8 w-auto text-[12.5px]")} value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort">
            <option value="score">Highest score</option><option value="newest">Newest</option><option value="reviews">Most reviews</option><option value="value">Highest value</option><option value="name">Name</option>
          </select>
          <button onClick={reset} className="text-[12.5px] text-muted hover:text-ink">Reset</button>
          <Tabs value={view} onChange={setView} className="ml-auto" tabs={[{ id: "table", label: <span className="flex items-center gap-1.5"><List size={13} /> Table</span> }, { id: "grid", label: <span className="flex items-center gap-1.5"><LayoutGrid size={13} /> Cards</span> }]} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-line bg-surface px-4 py-2.5">
        <span className="text-[12.5px] text-muted">{chosen.length ? `${chosen.length} selected` : `${list.length} shown`}</span>
        <div className="ml-auto flex flex-wrap gap-2">
          {chosen.length > 0 && <Btn size="sm" onClick={() => { chosen.forEach((p) => act.toPipeline(p, userName)); setSelected([]); }}><Target size={13} /> Add to pipeline</Btn>}
          {unchecked > 0 && <Btn size="sm" variant="outline" disabled={!!bulk} onClick={() => void analyzeUnchecked()}><RefreshCw size={13} className={bulk ? "animate-spin" : ""} /> Analyze {unchecked} website{unchecked > 1 ? "s" : ""}</Btn>}
          <Btn size="sm" variant="outline" disabled={!target.length} onClick={() => downloadFile(`arkria-leads-${new Date().toISOString().slice(0, 10)}.csv`, prospectsCSV(target))}><Download size={13} /> CSV / Excel</Btn>
          <Link href={`/lead-finder/report?${chosen.length ? `ids=${chosen.map((p) => p.id).join(",")}` : "all=1"}`} target="_blank"><Btn size="sm" variant="outline" disabled={!target.length}><FileDown size={13} /> PDF</Btn></Link>
          {chosen.length > 0 && <Btn size="sm" variant="ghost" className="text-red-600" onClick={() => { if (confirm(`Remove ${chosen.length} businesses from the database?`)) { act.remove(chosen.map((p) => p.id)); setSelected([]); } }}><Trash2 size={13} /></Btn>}
        </div>
        {bulk && <div className="w-full"><Progress value={(bulk.done / Math.max(1, bulk.total)) * 100} tone="accent" /><div className="mt-1 text-[11.5px] text-muted">Checking websites {bulk.done}/{bulk.total}</div></div>}
      </div>

      {db.prospects.length === 0 ? (
        <Empty icon={<Database size={18} />} title="Your lead database is empty" sub="Run a search in Discover, import a CSV, or add a business manually." action={<Link href="/lead-finder"><Btn>Go to Discover</Btn></Link>} />
      ) : list.length === 0 ? (
        <Empty icon={<Search size={18} />} title="No businesses match these filters" sub="Loosen a filter or reset them." action={<Btn variant="outline" onClick={reset}>Reset filters</Btn>} />
      ) : view === "grid" ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{list.map((p) => <ProspectCard key={p.id} p={p} cfg={cfg} selected={selected.includes(p.id)} onSelect={(v) => toggle(p.id, v)} inPipeline={leadOf.has(p.id) ? STAGES.find((s) => s.id === leadOf.get(p.id)!.stage)?.label : undefined} />)}</div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-line bg-surface">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-[13px]">
              <thead>
                <tr className="border-b border-line bg-surface-2/60 text-left text-[12px] text-muted">
                  <th className="w-10 px-4 py-2.5"><input type="checkbox" aria-label="Select all" checked={allSel} onChange={(e) => setSelected(e.target.checked ? list.map((p) => p.id) : [])} className="accent-[var(--accent)]" /></th>
                  <th className="px-2 py-2.5 font-medium">Score</th>
                  <th className="px-3 py-2.5 font-medium">Business</th>
                  <th className="px-3 py-2.5 font-medium">Website</th>
                  <th className="px-3 py-2.5 font-medium">Google</th>
                  <th className="px-3 py-2.5 font-medium">Contact</th>
                  <th className="px-3 py-2.5 font-medium">Recommended</th>
                  <th className="px-3 py-2.5 text-right font-medium">Value</th>
                  <th className="px-3 py-2.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {list.slice(0, 500).map((p) => {
                  const lead = leadOf.get(p.id);
                  return (
                    <tr key={p.id} className={cn("transition hover:bg-surface-2/60", selected.includes(p.id) && "bg-accent-soft/40")}>
                      <td className="px-4 py-2.5"><input type="checkbox" aria-label={`Select ${p.name}`} checked={selected.includes(p.id)} onChange={(e) => toggle(p.id, e.target.checked)} className="accent-[var(--accent)]" /></td>
                      <td className="px-2 py-2.5"><ScoreRing score={p.score?.total} cfg={cfg} size={36} /></td>
                      <td className="max-w-[260px] px-3 py-2.5">
                        <Link href={`/lead-finder/${p.id}`} className="block truncate font-medium hover:text-accent">{p.name}</Link>
                        <div className="truncate text-[12px] text-muted">{[p.industry, p.area ?? p.city, isForeign(p.country) ? MARKETS[p.country as keyof typeof MARKETS].name : undefined].filter(Boolean).join(" · ") || "—"}</div>
                      </td>
                      <td className="px-3 py-2.5"><WebsiteBadge status={p.websiteStatus} /></td>
                      <td className="px-3 py-2.5 text-[12.5px] tabular-nums text-muted">{p.rating !== undefined ? `${p.rating.toFixed(1)}★ · ${p.reviewCount ?? 0}` : "—"}</td>
                      <td className="px-3 py-2.5 text-[12px]">
                        <div className="flex gap-1">{p.phone && <Badge>Phone</Badge>}{p.email && <Badge>Email</Badge>}{p.whatsapp && <Badge>WA</Badge>}{!p.phone && !p.email && !p.whatsapp && <span className="text-subtle">Not found</span>}</div>
                      </td>
                      <td className="max-w-[180px] truncate px-3 py-2.5 text-[12.5px]">{p.match?.serviceName ?? <span className="text-subtle">—</span>}</td>
                      <td className="px-3 py-2.5 text-right font-medium tabular-nums">{p.match ? inr(p.match.price) : "—"}</td>
                      <td className="px-3 py-2.5">{lead ? <Badge tone="green" dot>{STAGES.find((s) => s.id === lead.stage)?.label}</Badge> : <Badge tone={prospectStatus(p.status).tone}>{prospectStatus(p.status).label}</Badge>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {list.length > 500 && <div className="border-t border-line px-4 py-2 text-[12px] text-muted">Showing the first 500 — narrow the filters or export to see all {list.length}.</div>}
        </div>
      )}
    </div>
  );
}

export default function DatabasePage() {
  return <Suspense><DatabaseInner /></Suspense>;
}
