"use client";
import React, { useMemo } from "react";
import { useDB } from "@/lib/store";
import { inr, quoteTotals } from "@/lib/utils";
import { STAGES, leadValue, stageIndex } from "@/lib/stages";
import { useHydrated } from "@/lib/use-hydrated";
import { Card, CardHeader, Metric, PageHeader, Empty } from "@/components/ui";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { Target, Trophy, Wallet, FileCheck2, BarChart3 } from "lucide-react";

const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
const compact = (n: number) => (n >= 100000 ? `₹${(n / 100000).toFixed(n >= 1000000 ? 0 : 1)}L` : n >= 1000 ? `₹${Math.round(n / 1000)}k` : `₹${n}`);

function Bars({ rows, total }: { rows: { label: string; value: number; sub?: string }[]; total: number }) {
  if (rows.length === 0) return <p className="py-6 text-center text-[13px] text-muted">No data yet.</p>;
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="space-y-3">
      {rows.map((r) => (
        <div key={r.label}>
          <div className="mb-1 flex justify-between text-[13px]"><span>{r.label}</span><span className="font-medium tabular-nums">{r.sub ?? r.value} <span className="text-subtle">· {pct(r.value, total)}%</span></span></div>
          <div className="h-2 overflow-hidden rounded-full bg-surface-2"><div className="h-full rounded-full bg-accent" style={{ width: `${(r.value / max) * 100}%` }} /></div>
        </div>
      ))}
    </div>
  );
}

export default function AnalyticsPage() {
  const { db } = useDB();
  const hydrated = useHydrated();

  const won = db.leads.filter((l) => l.stage === "won").length;
  const lost = db.leads.filter((l) => l.stage === "lost").length;
  const open = db.leads.filter((l) => !["won", "lost"].includes(l.stage));
  const collected = db.payments.filter((p) => p.status === "paid").reduce((a, p) => a + p.amount, 0);
  const decided = db.quotes.filter((q) => ["accepted", "rejected", "expired"].includes(q.status));
  const accepted = db.quotes.filter((q) => q.status === "accepted");
  const avgDeal = accepted.length ? accepted.reduce((a, q) => a + quoteTotals(q).taxable, 0) / accepted.length
    : db.projects.length ? db.projects.reduce((a, p) => a + p.value, 0) / db.projects.length : 0;

  const months = useMemo(() => {
    if (!hydrated) return [];
    const now = new Date();
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const inMonth = (iso?: string) => !!iso && iso.startsWith(key);
      return {
        month: d.toLocaleDateString("en-IN", { month: "short" }),
        Collected: db.payments.filter((p) => p.status === "paid" && inMonth(p.paidDate ?? p.due)).reduce((a, p) => a + p.amount, 0),
        Due: db.payments.filter((p) => p.status !== "paid" && inMonth(p.due)).reduce((a, p) => a + p.amount, 0),
      };
    });
  }, [db.payments, hydrated]);

  const sources = Object.entries(db.leads.reduce<Record<string, number>>((a, l) => ({ ...a, [l.source || "Unknown"]: (a[l.source || "Unknown"] ?? 0) + 1 }), {}))
    .sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value }));
  const services = Object.entries(open.reduce<Record<string, number>>((a, l) => ({ ...a, [l.service]: (a[l.service] ?? 0) + leadValue(l) }), {}))
    .sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value, sub: inr(value) }));
  const stages = STAGES.map((s) => ({ label: s.label, value: db.leads.filter((l) => l.stage === s.id).length })).filter((s) => s.value > 0);

  // Lead Finder funnel and service demand.
  const reachedStage = (st: (typeof STAGES)[number]["id"]) => db.leads.filter((l) => l.stageHistory?.some((h) => h.stage === st) || (l.stage !== "lost" && stageIndex(l.stage) >= stageIndex(st))).length;
  const qualifiedAt = db.finder.scoring.qualified;
  const funnel = [
    { label: "Businesses found", value: db.prospects.length },
    { label: `Qualified (score ≥ ${qualifiedAt})`, value: db.prospects.filter((p) => (p.score?.total ?? 0) >= qualifiedAt).length },
    { label: "Added to pipeline", value: db.leads.length },
    { label: "Contacted", value: reachedStage("contacted") },
    { label: "Replied", value: reachedStage("replied") },
    { label: "Meeting", value: reachedStage("meeting") },
    { label: "Proposal", value: reachedStage("proposal") },
    { label: "Won", value: reachedStage("won") },
  ];
  const demand = db.services.map((s) => {
    const ps = db.prospects.filter((p) => p.match?.serviceId === s.id);
    return { name: s.name.replace("Cross-platform ", ""), Leads: ps.length, Value: ps.reduce((a, p) => a + (p.match?.price ?? 0), 0) };
  }).filter((d) => d.Leads > 0).sort((a, b) => b.Leads - a.Leads);
  const byIndustry = Object.entries(db.prospects.reduce<Record<string, number>>((a, p) => ({ ...a, [p.industry || "Unknown"]: (a[p.industry || "Unknown"] ?? 0) + 1 }), {}))
    .sort((a, b) => b[1] - a[1]).slice(0, 8).map(([label, value]) => ({ label, value }));

  const empty = db.leads.length === 0 && db.payments.length === 0 && db.quotes.length === 0 && db.prospects.length === 0;

  return (
    <div className="space-y-6">
      <PageHeader title="Analytics" description="How your pipeline converts and where revenue comes from." />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric label="Potential pipeline" value={inr(open.reduce((a, l) => a + leadValue(l), 0))} sub={`${open.length} open leads · not guaranteed`} icon={<Target size={15} />} />
        <Metric label="Win rate" value={`${pct(won, won + lost)}%`} sub={won + lost ? `${won} won · ${lost} lost` : "No decided leads yet"} icon={<Trophy size={15} />} />
        <Metric label="Quote acceptance" value={`${pct(accepted.length, decided.length)}%`} sub={`Avg deal ${inr(avgDeal)}`} icon={<FileCheck2 size={15} />} />
        <Metric label="Collected to date" value={inr(collected)} sub={`${db.payments.filter((p) => p.status === "paid").length} payments`} icon={<Wallet size={15} />} accent="text-emerald-600 dark:text-emerald-400" />
      </div>

      {empty ? (
        <Empty icon={<BarChart3 size={18} />} title="Nothing to analyse yet" sub="As you add leads, quotes and payments, your conversion and revenue trends show up here." />
      ) : (
        <>
          <Card>
            <CardHeader title="Revenue — last 6 months" sub="Payments collected, and what's due, by month" />
            <div className="h-72 p-4 pt-2">
              {hydrated && (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={months} margin={{ top: 16, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke="var(--line)" />
                    <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={12} tick={{ fill: "var(--muted)" }} />
                    <YAxis tickLine={false} axisLine={false} fontSize={12} tick={{ fill: "var(--muted)" }} tickFormatter={compact} width={56} />
                    <Tooltip cursor={{ fill: "var(--surface-2)" }} formatter={(v) => inr(Number(v))}
                      contentStyle={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 12, fontSize: 12.5, color: "var(--ink)" }} />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: 12.5 }} />
                    <Bar dataKey="Collected" stackId="a" fill="var(--accent)" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="Due" stackId="a" fill="var(--accent-line)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </Card>

          {db.prospects.length > 0 && (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1.4fr]">
              <Card>
                <CardHeader title="Lead funnel" sub="From discovery to won work" />
                <div className="space-y-2 p-5">
                  {funnel.map((f, i) => (
                    <div key={f.label} className="grid grid-cols-[150px_1fr_auto] items-center gap-3 text-[12.5px]">
                      <span className="truncate text-muted">{f.label}</span>
                      <div className="h-6 overflow-hidden rounded-md bg-surface-2"><div className="h-full rounded-md bg-accent transition-all" style={{ width: `${Math.max(f.value ? 3 : 0, pct(f.value, funnel[0].value))}%`, opacity: 1 - i * 0.08 }} /></div>
                      <span className="w-16 text-right tabular-nums"><span className="font-medium">{f.value}</span>{i > 0 && <span className="text-subtle"> · {pct(f.value, funnel[i - 1].value)}%</span>}</span>
                    </div>
                  ))}
                </div>
              </Card>
              <Card>
                <CardHeader title="Service demand" sub="Discovered businesses by recommended service · potential value, not guaranteed" />
                <div className="h-72 p-4 pt-2">
                  {hydrated && (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={demand} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
                        <CartesianGrid horizontal={false} stroke="var(--line)" />
                        <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} fontSize={12} tick={{ fill: "var(--muted)" }} />
                        <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} fontSize={12} width={150} tick={{ fill: "var(--muted)" }} />
                        <Tooltip cursor={{ fill: "var(--surface-2)" }} formatter={(v, k, item) => (k === "Leads" ? [`${v} leads · ${inr((item?.payload as { Value: number }).Value)} potential`, "Demand"] : v)}
                          contentStyle={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 12, fontSize: 12.5, color: "var(--ink)" }} />
                        <Bar dataKey="Leads" fill="var(--accent)" radius={[0, 6, 6, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </Card>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {byIndustry.length > 0 && <Card><CardHeader title="Discovered by industry" /><div className="p-5"><Bars rows={byIndustry} total={db.prospects.length} /></div></Card>}
            <Card><CardHeader title="Leads by stage" /><div className="p-5"><Bars rows={stages} total={db.leads.length} /></div></Card>
            <Card><CardHeader title="Where leads come from" /><div className="p-5"><Bars rows={sources} total={db.leads.length} /></div></Card>
            <Card><CardHeader title="Open pipeline by service" /><div className="p-5"><Bars rows={services} total={services.reduce((a, s) => a + s.value, 0)} /></div></Card>
          </div>
        </>
      )}
    </div>
  );
}
