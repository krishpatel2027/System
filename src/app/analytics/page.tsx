"use client";
import { useDB } from "@/lib/store";
import { inr } from "@/lib/utils";
import { Card, Metric } from "@/components/ui";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

export default function AnalyticsPage() {
  const { db } = useDB();
  const totalLeads = db.leads.length;
  const won = db.leads.filter((l) => l.stage === "won").length + db.clients.length;
  const conv = totalLeads ? ((db.proposals.filter(p=>p.status==="accepted").length + 1) / Math.max(1, db.proposals.length + 1)) * 100 : 0;
  const rev = db.payments.filter((p) => p.status === "paid").reduce((a, p) => a + p.amount, 0);
  const byService = db.leads.reduce<Record<string, number>>((acc, l) => {
    acc[l.service] = (acc[l.service] ?? 0) + (l.estHigh ?? l.budget ?? 30000);
    return acc;
  }, {});
  const barData = Object.entries(byService).map(([name, value]) => ({ name: name.slice(0, 14), value }));
  const pipeData = ["new","contacted","interested","discovery","proposal","negotiation","won","lost"].map((s) => ({ name: s, value: db.leads.filter((l) => l.stage === s).length }));
  const bySource = db.leads.reduce<Record<string, number>>((acc, l) => {
    acc[l.source || "Unknown"] = (acc[l.source || "Unknown"] ?? 0) + 1;
    return acc;
  }, {});
  const pending = db.payments.filter((p) => p.status !== "paid").reduce((a, p) => a + p.amount, 0);
  const expected = db.leads.filter((l) => !["won", "lost"].includes(l.stage)).reduce((a, l) => a + (l.estHigh ?? l.budget ?? 0), 0);
  const COLORS = ["#171717", "#525252", "#a3a3a3", "#059669", "#d97706", "#2563eb", "#7c3aed"];

  return (
    <div className="space-y-4">
      <div><h1 className="text-[22px] font-semibold tracking-tight">Analytics</h1><p className="text-[13px] text-neutral-500">Sales · Revenue · Projects · Services</p></div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric label="Total Leads" value={String(totalLeads)} sub={`${db.proposals.filter(p=>p.status==="sent").length} proposals sent`} />
        <Metric label="Win Rate" value={conv.toFixed(0) + "%"} sub={`${won} won / clients`} />
        <Metric label="Collected Revenue" value={inr(rev)} sub="paid invoices" />
        <Metric label="Avg Project Value" value={inr(db.projects.length ? db.projects.reduce((a,p)=>a+p.value,0)/db.projects.length : 0)} sub={`${db.projects.length} projects`} />
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <Card className="p-5">
          <div className="text-[14px] font-semibold">Pipeline by stage</div>
          <div className="h-64"><ResponsiveContainer width="100%" height="100%"><BarChart data={pipeData}><XAxis dataKey="name" fontSize={11} /><YAxis fontSize={11} /><Tooltip /><Bar dataKey="value" fill="#171717" radius={[8,8,0,0]} /></BarChart></ResponsiveContainer></div>
        </Card>
        <Card className="p-5">
          <div className="text-[14px] font-semibold">Expected value by service</div>
          <div className="h-64"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={barData} dataKey="value" nameKey="name" outerRadius={90} label>{barData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer></div>
          <div className="mt-2 space-y-1">{Object.entries(byService).map(([k,v])=><div key={k} className="flex justify-between text-[13px]"><span>{k}</span><b>{inr(v)}</b></div>)}</div>
        </Card>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <Card className="p-5">
          <div className="text-[14px] font-semibold">Leads by source</div>
          <div className="mt-2 space-y-1.5">
            {Object.entries(bySource).sort((a, b) => b[1] - a[1]).map(([k, v]) => (
              <div key={k} className="flex items-center gap-2 text-[13px]">
                <span className="w-28 shrink-0 font-medium">{k}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
                  <div className="h-full rounded-full bg-neutral-900 dark:bg-white" style={{ width: `${(v / Math.max(1, totalLeads)) * 100}%` }} />
                </div>
                <b className="w-8 text-right">{v}</b>
              </div>
            ))}
            {Object.keys(bySource).length === 0 && <p className="text-[13px] text-neutral-500">No leads yet.</p>}
          </div>
        </Card>
        <Card className="p-5">
          <div className="text-[14px] font-semibold">Revenue pipeline</div>
          <div className="mt-2 space-y-1.5 text-[13px]">
            <div className="flex justify-between"><span className="text-neutral-500">Expected (open leads)</span><b>{inr(expected)}</b></div>
            <div className="flex justify-between"><span className="text-neutral-500">Pending payments</span><b>{inr(pending)}</b></div>
            <div className="flex justify-between"><span className="text-neutral-500">Collected</span><b>{inr(rev)}</b></div>
            <div className="flex justify-between border-t border-neutral-100 pt-1.5 font-semibold dark:border-neutral-800"><span>Total pipeline</span><span>{inr(expected + pending + rev)}</span></div>
          </div>
        </Card>
      </div>
    </div>
  );
}
