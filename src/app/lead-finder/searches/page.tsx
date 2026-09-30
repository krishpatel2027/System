"use client";
import React, { useState } from "react";
import { Bookmark, CalendarClock, History, Play, Trash2, Zap } from "lucide-react";
import { useDB } from "@/lib/store";
import type { SavedSearch } from "@/lib/types";
import { lfApi, useDiscovery, useFinderStatus } from "@/lib/leadfinder/client";
import { describeQuery, isDue } from "@/lib/leadfinder/prospect";
import { cn } from "@/lib/utils";
import { Badge, Btn, Card, CardHeader, Empty, inputCls, PageHeader } from "@/components/ui";
import { FinderTabs, ProgressStages, ProviderNotConnected } from "@/components/leadfinder";

const when = (iso?: string) => (iso ? new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "Never");

export default function SearchesPage() {
  const { db, mutate, refreshFromServer } = useDB();
  const { status } = useFinderStatus();
  const discovery = useDiscovery();
  const [runningId, setRunningId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [autoBusy, setAutoBusy] = useState(false);
  const saved = db.finder.savedSearches;
  const connected = status?.providerConnected;
  const due = saved.filter((s) => isDue(s));

  const patch = (id: string, p: Partial<SavedSearch>) => mutate((d) => ({ finder: { ...d.finder, savedSearches: d.finder.savedSearches.map((s) => (s.id === id ? { ...s, ...p } : s)) } }));
  const remove = (id: string) => confirm("Delete this saved search?") && mutate((d) => ({ finder: { ...d.finder, savedSearches: d.finder.savedSearches.filter((s) => s.id !== id) } }));

  const runNow = async (s: SavedSearch) => {
    setRunningId(s.id); setMsg(null);
    try {
      const r = await discovery.run(s.query, s.name, s.id);
      setMsg(`${s.name}: ${r.run.added} new ${r.run.added === 1 ? "business" : "businesses"} added, ${r.run.duplicates} already known.`);
    } catch (e) { setMsg((e as Error).message); discovery.reset(); } finally { setRunningId(null); }
  };

  const runDue = async () => {
    setAutoBusy(true); setMsg(null);
    try {
      const r = await lfApi<{ ran: number; added: number; message?: string; errors?: string[] }>("auto", {});
      setMsg(r.message ?? `Ran ${r.ran} saved ${r.ran === 1 ? "search" : "searches"} · ${r.added} new businesses${r.errors?.length ? ` · ${r.errors.join("; ")}` : ""}`);
      await refreshFromServer();
    } catch (e) { setMsg((e as Error).message); } finally { setAutoBusy(false); }
  };

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Lead Finder" title="Saved searches & auto find" description="Save the searches you run often. Scheduled ones run on their own and add only new, de-duplicated businesses." />
      <FinderTabs />
      {status && !connected && <ProviderNotConnected compact />}

      <Card className="relative overflow-hidden p-5">
        <div className="pointer-events-none absolute -right-20 -top-20 h-52 w-52 rounded-full bg-accent/10 blur-3xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="flex gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-accent"><Zap size={18} /></div>
            <div>
              <div className="text-[15px] font-semibold">Auto find</div>
              <div className="mt-0.5 max-w-xl text-[13px] text-muted">
                {status?.autoFind
                  ? "Scheduled daily at 9:00 IST. Daily and weekly searches below run automatically and results appear in your lead database."
                  : "Automatic runs need CRON_SECRET set on your host (see README → Auto find). You can still run due searches from here."}
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Badge tone={status?.autoFind ? "green" : "neutral"} dot>{status?.autoFind ? "Scheduler on" : "Scheduler off"}</Badge>
                <Badge>{saved.filter((s) => s.schedule !== "manual").length} scheduled</Badge>
                {due.length > 0 && <Badge tone="amber">{due.length} due now</Badge>}
              </div>
            </div>
          </div>
          <Btn variant="outline" disabled={!connected || autoBusy || !due.length} onClick={() => void runDue()}><Play size={13} /> {autoBusy ? "Running…" : "Run due searches"}</Btn>
        </div>
      </Card>

      {discovery.progress && discovery.progress.stage !== "done" && <ProgressStages progress={discovery.progress} />}
      {msg && <div className="rounded-xl bg-surface-2 px-4 py-2.5 text-[13px]">{msg}</div>}

      <Card>
        <CardHeader title="Saved searches" sub="Create one from Discover with “Save search”" />
        <div className="p-5">
          {saved.length === 0 ? (
            <Empty icon={<Bookmark size={18} />} title="No saved searches" sub="Set up filters in Discover and save them to rerun or schedule." />
          ) : (
            <div className="divide-y divide-line rounded-xl border border-line">
              {saved.map((s) => (
                <div key={s.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2"><span className="truncate text-[14px] font-medium">{s.name}</span>{isDue(s) && <Badge tone="amber">Due</Badge>}</div>
                    <div className="truncate text-[12.5px] text-muted">{describeQuery(s.query, db.services) || "No filters"}</div>
                    <div className="mt-0.5 flex items-center gap-1 text-[11.5px] text-subtle"><CalendarClock size={11} /> Last run: {when(s.lastRunAt)}</div>
                  </div>
                  <select value={s.schedule} onChange={(e) => patch(s.id, { schedule: e.target.value as SavedSearch["schedule"] })} className={cn(inputCls, "h-8 w-auto text-[12.5px]")} aria-label="Schedule">
                    <option value="manual">Manual</option><option value="daily">Daily</option><option value="weekly">Weekly</option>
                  </select>
                  <Btn size="sm" disabled={!connected || !!runningId || discovery.running} onClick={() => void runNow(s)}><Play size={12} /> {runningId === s.id ? "Running…" : "Run now"}</Btn>
                  <Btn size="sm" variant="ghost" onClick={() => remove(s.id)} className="text-muted"><Trash2 size={13} /></Btn>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      <Card>
        <CardHeader title="Search history" sub="Last 100 runs" />
        <div className="p-5">
          {db.finder.history.length === 0 ? (
            <Empty icon={<History size={18} />} title="No searches yet" sub="Every search you run is logged here with what it found." />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-line">
              <table className="w-full min-w-[640px] text-[13px]">
                <thead><tr className="border-b border-line bg-surface-2/60 text-left text-[12px] text-muted"><th className="px-4 py-2 font-medium">Search</th><th className="px-3 py-2 font-medium">When</th><th className="px-3 py-2 text-right font-medium">Found</th><th className="px-3 py-2 text-right font-medium">New</th><th className="px-3 py-2 text-right font-medium">Duplicates</th><th className="px-3 py-2 text-right font-medium">Qualified</th></tr></thead>
                <tbody className="divide-y divide-line">
                  {db.finder.history.map((h) => (
                    <tr key={h.id}>
                      <td className="max-w-[320px] px-4 py-2.5"><div className="truncate font-medium">{h.label}</div><div className="truncate text-[12px] text-muted">{describeQuery(h.query, db.services)}</div></td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-muted">{when(h.at)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{h.found}</td>
                      <td className="px-3 py-2.5 text-right font-medium tabular-nums">{h.added}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-muted">{h.duplicates}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{h.qualified}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
