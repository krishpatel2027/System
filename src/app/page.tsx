"use client";
import Link from "next/link";
import { useMemo } from "react";
import { useDB } from "@/lib/store";
import { inr, greeting, daysUntil } from "@/lib/utils";
import { Card, Metric, Badge } from "@/components/ui";
import { Plus, ArrowRight, AlertCircle } from "lucide-react";

export default function Dashboard() {
  const { db } = useDB();
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);
  // eslint-disable-next-line react-hooks/purity -- dashboard "now" snapshot, stable per mount
  const nowMs = useMemo(() => Date.now(), []);
  const totalLeads = db.leads.length;
  const qualified = db.leads.filter((l) => l.score >= 60 && !["lost"].includes(l.stage)).length;
  const activeProjects = db.projects.filter((p) => p.status !== "completed").length;
  const completed = db.projects.filter((p) => p.status === "completed").length;
  const pendingPay = db.payments.filter((p) => p.status !== "paid").reduce((a, p) => a + p.amount, 0);
  const monthlyRev = db.payments.filter((p) => p.status === "paid").reduce((a, p) => a + p.amount, 0);
  const expected = db.leads.filter((l) => !["won", "lost"].includes(l.stage)).reduce((a, l) => a + (l.estHigh ?? l.budget ?? 0), 0);
  const mrr = db.subs.filter((s) => s.status === "active").reduce((a, s) => a + s.monthly, 0);

  const newThisWeek = useMemo(
    () =>
      db.leads.filter((l) => {
        const d = new Date(l.dateAdded).getTime();
        return nowMs - d < 7 * 86400000;
      }),
    [db.leads, nowMs]
  );
  const awaiting = db.proposals.filter((p) => p.status === "sent");
  const duePay = db.payments.filter((p) => p.status !== "paid").slice(0, 4);
  const nearDeadline = [...db.projects].sort((a, b) => a.deadline.localeCompare(b.deadline)).slice(0, 4);
  const overdueFollow = db.leads.filter(
    (l) => l.nextFollowUp && l.nextFollowUp <= todayStr && !["won", "lost"].includes(l.stage)
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[24px] font-semibold tracking-tight">{greeting()}, Krish</h1>
          <p className="text-[13.5px] text-neutral-500">Here&apos;s what needs your attention today.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {[
            { l: "+ New Lead", h: "/leads?action=new" },
            { l: "+ New Quote", h: "/quotes?action=new" },
            { l: "+ New Proposal", h: "/proposals?action=new" },
            { l: "+ Record Payment", h: "/payments?action=new" },
          ].map((a) => (
            <Link key={a.l} href={a.h} className="inline-flex items-center gap-1 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-[13px] font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900">
              {a.l}
            </Link>
          ))}
        </div>
      </div>

      {overdueFollow.length > 0 && (
        <Card className="flex items-start gap-3 border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/40">
          <AlertCircle size={17} className="mt-0.5 text-amber-600" />
          <div className="text-[13.5px]">
            <span className="font-semibold">{overdueFollow.length} follow-up{overdueFollow.length > 1 ? "s" : ""} overdue: </span>
            {overdueFollow.map((l) => l.company).join(", ")}. <Link href="/leads" className="font-medium underline">Open pipeline →</Link>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric label="Expected Revenue" value={inr(expected)} sub={`${qualified} qualified leads`} />
        <Metric label="Collected" value={inr(monthlyRev)} sub={`${db.payments.filter(p=>p.status==="paid").length} payments in`} />
        <Metric label="Pending Payments" value={inr(pendingPay)} sub={`${duePay.length} open`} accent="text-amber-600" />
        <Metric label="Maintenance MRR" value={inr(mrr)} sub={`${db.subs.filter(s=>s.status==="active").length} active plans`} accent="text-emerald-600" />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric label="Total Leads" value={String(totalLeads)} sub="across all sources" />
        <Metric label="Active Projects" value={String(activeProjects)} sub={`${completed} completed`} />
        <Metric label="Quotes Sent" value={String(db.quotes.length)} sub={inr(db.quotes.reduce((a,q)=>a+q.items.reduce((x,i)=>x+i.qty*i.price,0),0)) + " quoted"} />
        <Metric label="Scope Open" value={String(db.scopes.filter(s=>s.status!=="completed").length)} sub="never silently add scope" />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-[14px] font-semibold">New leads this week ({newThisWeek.length})</h3>
            <Link href="/leads" className="flex items-center gap-1 text-[13px] text-neutral-500 hover:text-neutral-900">Pipeline <ArrowRight size={14} /></Link>
          </div>
          <div className="space-y-2">
            {newThisWeek.length === 0 && <p className="text-[13px] text-neutral-500">No new leads this week. Your next client could start here.</p>}
            {newThisWeek.map((l) => (
              <div key={l.id} className="flex items-center justify-between rounded-xl border border-neutral-100 px-3 py-2 dark:border-neutral-800">
                <div><div className="text-[13.5px] font-medium">{l.company}</div><div className="text-[12px] text-neutral-500">{l.service} · {l.source}</div></div>
                <Badge tone={l.score >= 70 ? "green" : "neutral"}>{inr(l.estHigh ?? l.budget ?? 0)}</Badge>
              </div>
            ))}
          </div>
        </Card>
        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-[14px] font-semibold">Proposals awaiting response ({awaiting.length})</h3>
            <Link href="/proposals" className="flex items-center gap-1 text-[13px] text-neutral-500">All <ArrowRight size={14} /></Link>
          </div>
          <div className="space-y-2">
            {awaiting.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-xl border border-neutral-100 px-3 py-2 dark:border-neutral-800">
                <div><div className="text-[13.5px] font-medium">{p.clientName}</div><div className="text-[12px] text-neutral-500">{p.title}</div></div>
                <Badge tone="amber">{inr(p.investment)}</Badge>
              </div>
            ))}
            {awaiting.length === 0 && <p className="text-[13px] text-neutral-500">Nothing awaiting. Send the next proposal.</p>}
          </div>
        </Card>
        <Card className="p-5">
          <h3 className="mb-3 text-[14px] font-semibold">Payments due</h3>
          <div className="space-y-2">
            {duePay.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-xl border border-neutral-100 px-3 py-2 dark:border-neutral-800">
                <div><div className="text-[13.5px] font-medium">{p.clientName} — {p.label}</div><div className="text-[12px] text-neutral-500">Due {p.due} · {daysUntil(p.due) < 0 ? `${-daysUntil(p.due)}d overdue` : `in ${daysUntil(p.due)}d`}</div></div>
                <Badge tone={daysUntil(p.due) < 0 ? "red" : "amber"}>{inr(p.amount)}</Badge>
              </div>
            ))}
          </div>
        </Card>
        <Card className="p-5">
          <h3 className="mb-3 text-[14px] font-semibold">Projects nearing deadline</h3>
          <div className="space-y-2">
            {nearDeadline.map((p) => (
              <div key={p.id} className="rounded-xl border border-neutral-100 px-3 py-2 dark:border-neutral-800">
                <div className="flex items-center justify-between"><span className="text-[13.5px] font-medium">{p.name}</span><Badge>{p.status}</Badge></div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800"><div className="h-full rounded-full bg-neutral-900 dark:bg-white" style={{ width: `${p.progress}%` }} /></div>
                <div className="mt-1 text-[12px] text-neutral-500">{p.progress}% · due {p.deadline}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="p-5">
        <h3 className="mb-2 text-[14px] font-semibold">Studio workflow</h3>
        <div className="flex flex-wrap items-center gap-1.5 text-[11.5px]">
          {["LEAD","DISCOVERY","SCOPE","PRICING","QUOTE","PROPOSAL","NEGOTIATION","AGREEMENT","ADVANCE","ONBOARDING","DESIGN","DEVELOPMENT","QA","FINAL PAYMENT","LAUNCH","MAINTENANCE"].map((s, i, arr) => (
            <span key={s} className="flex items-center gap-1.5">
              <span className="rounded-full border border-neutral-200 px-2 py-0.5 font-medium dark:border-neutral-700">{s}</span>
              {i < arr.length - 1 && <span className="text-neutral-300">→</span>}
            </span>
          ))}
        </div>
        <p className="mt-3 flex items-center gap-2 text-[12.5px] text-neutral-500"><Plus size={13} /> Demo data is marked DEMO — replace with real leads as you go.</p>
      </Card>
    </div>
  );
}
