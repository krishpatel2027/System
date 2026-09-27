"use client";
import Link from "next/link";
import { useMemo } from "react";
import { useDB } from "@/lib/store";
import { inr, greeting, daysUntil, plural } from "@/lib/utils";
import { OPEN_STAGES, leadValue } from "@/lib/stages";
import { useHydrated } from "@/lib/use-hydrated";
import { Card, CardHeader, Metric, Badge, PageHeader, Progress, Avatar } from "@/components/ui";
import {
  ArrowRight, TrendingUp, Wallet, Clock, Repeat, Plus, PhoneCall, CalendarClock, MessageSquare,
} from "lucide-react";

function relDays(d: number) {
  if (d === 0) return "today";
  if (d === 1) return "tomorrow";
  if (d === -1) return "yesterday";
  return d < 0 ? `${-d}d overdue` : `in ${d}d`;
}

export default function Dashboard() {
  const { db } = useDB();
  const hydrated = useHydrated();
  const todayLabel = hydrated ? new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" }) : " ";
  const hello = hydrated ? greeting() : "Welcome back";

  const openLeads = db.leads.filter((l) => !["won", "lost"].includes(l.stage));
  const pipelineValue = openLeads.reduce((a, l) => a + leadValue(l), 0);
  const collected = db.payments.filter((p) => p.status === "paid").reduce((a, p) => a + p.amount, 0);
  const outstanding = db.payments.filter((p) => p.status !== "paid");
  const outstandingTotal = outstanding.reduce((a, p) => a + p.amount, 0);
  const mrr = db.subs.filter((s) => s.status === "active").reduce((a, s) => a + s.monthly, 0);
  const activeProjects = db.projects.filter((p) => p.status !== "completed").sort((a, b) => a.deadline.localeCompare(b.deadline));
  const awaiting = db.proposals.filter((p) => p.status === "sent");

  const agenda = useMemo(() => {
    const items: { key: string; kind: "follow" | "pay" | "deadline"; title: string; sub: string; days: number; href: string; amount?: number }[] = [];
    db.leads.filter((l) => l.nextFollowUp && !["won", "lost"].includes(l.stage)).forEach((l) =>
      items.push({ key: "f" + l.id, kind: "follow", title: `Follow up · ${l.company}`, sub: `${l.contactName} · ${l.service}`, days: daysUntil(l.nextFollowUp!), href: "/leads" }));
    db.payments.filter((p) => p.status !== "paid").forEach((p) =>
      items.push({ key: "p" + p.id, kind: "pay", title: `${p.label} · ${p.clientName}`, sub: "Payment", days: daysUntil(p.due), href: "/payments", amount: p.amount }));
    db.projects.flatMap((p) => p.milestones.filter((m) => m.status !== "done").map((m) => ({ p, m }))).forEach(({ p, m }) =>
      items.push({ key: "m" + p.id + m.id, kind: "deadline", title: `${m.name} · ${p.clientName}`, sub: "Milestone", days: daysUntil(m.deadline), href: "/projects" }));
    return items.filter((i) => i.days <= 7).sort((a, b) => a.days - b.days).slice(0, 7);
  }, [db]);
  const overdueCount = agenda.filter((a) => a.days < 0).length;

  const stageData = OPEN_STAGES.map((s) => {
    const ls = db.leads.filter((l) => l.stage === s.id);
    return { ...s, count: ls.length, value: ls.reduce((a, l) => a + leadValue(l), 0) };
  });
  const maxStage = Math.max(1, ...stageData.map((s) => s.value));
  const wonCount = db.leads.filter((l) => l.stage === "won").length;
  const closedCount = db.leads.filter((l) => l.stage === "won" || l.stage === "lost").length;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={todayLabel}
        title={`${hello}, ${db.settings.owner || "there"}`}
        description={overdueCount > 0
          ? `${overdueCount} item${overdueCount > 1 ? "s are" : " is"} overdue and ${agenda.length - overdueCount} more coming up this week.`
          : agenda.length > 0 ? `You're on track — ${agenda.length} item${agenda.length > 1 ? "s" : ""} coming up this week.` : "You're all caught up. A great time to chase new leads."}
        actions={<>
          <Link href="/pricing" className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-line bg-surface px-3.5 text-[13.5px] font-medium hover:bg-surface-2">Price a project</Link>
          <Link href="/quotes?action=new" className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-accent px-3.5 text-[13.5px] font-medium text-accent-ink shadow-sm hover:opacity-90"><Plus size={15} /> New quote</Link>
        </>}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric label="Open pipeline" value={inr(pipelineValue)} sub={`${plural(openLeads.length, "active lead")}`} icon={<TrendingUp size={15} />} />
        <Metric label="Collected" value={inr(collected)} sub={plural(db.payments.filter((p) => p.status === "paid").length, "payment") + " received"} icon={<Wallet size={15} />} accent="text-emerald-600 dark:text-emerald-400" />
        <Metric label="Outstanding" value={inr(outstandingTotal)} sub={`${plural(outstanding.length, "invoice")} open`} icon={<Clock size={15} />} accent={outstandingTotal ? "text-amber-600 dark:text-amber-400" : undefined} />
        <Metric label="Recurring (MRR)" value={inr(mrr)} sub={`${plural(db.subs.filter((s) => s.status === "active").length, "care plan")} active`} icon={<Repeat size={15} />} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_380px]">
        <div className="space-y-4">
          <Card>
            <CardHeader title="Sales pipeline" sub={`${closedCount ? Math.round((wonCount / closedCount) * 100) : 0}% win rate · ${wonCount} won`}
              action={<Link href="/leads" className="flex items-center gap-1 text-[12.5px] font-medium text-muted hover:text-ink">Open board <ArrowRight size={13} /></Link>} />
            <div className="space-y-3 p-5">
              {stageData.map((s) => (
                <Link key={s.id} href="/leads" className="group grid grid-cols-[110px_1fr_auto] items-center gap-3">
                  <span className="text-[13px] text-muted group-hover:text-ink">{s.label}</span>
                  <div className="h-7 overflow-hidden rounded-lg bg-surface-2">
                    {s.value > 0 && (
                      <div className="flex h-full items-center rounded-lg bg-accent/85 px-2 text-[11.5px] font-semibold text-accent-ink transition-all group-hover:bg-accent"
                        style={{ width: `${Math.max(8, (s.value / maxStage) * 100)}%` }}>
                        {s.count}
                      </div>
                    )}
                  </div>
                  <span className="w-24 text-right text-[13px] font-medium tabular-nums">{inr(s.value)}</span>
                </Link>
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader title="Active projects" sub={`${activeProjects.length} in progress`}
              action={<Link href="/projects" className="flex items-center gap-1 text-[12.5px] font-medium text-muted hover:text-ink">All projects <ArrowRight size={13} /></Link>} />
            <div className="divide-y divide-line px-5 pb-2 pt-2">
              {activeProjects.length === 0 && <p className="py-6 text-center text-[13px] text-muted">No active projects yet.</p>}
              {activeProjects.map((p) => {
                const d = daysUntil(p.deadline);
                return (
                  <Link key={p.id} href="/projects" className="flex items-center gap-4 py-3.5">
                    <Avatar name={p.clientName} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-[13.5px] font-medium">{p.name}</span>
                        <Badge tone="violet">{p.status}</Badge>
                      </div>
                      <div className="mt-2 flex items-center gap-3">
                        <Progress value={p.progress} tone="accent" className="flex-1" />
                        <span className="w-9 text-right text-[12px] tabular-nums text-muted">{p.progress}%</span>
                      </div>
                    </div>
                    <div className="hidden text-right sm:block">
                      <div className="text-[13px] font-medium tabular-nums">{inr(p.value)}</div>
                      <div className={`text-[12px] ${d < 0 ? "text-red-600" : d <= 7 ? "text-amber-600" : "text-muted"}`}>Due {relDays(d)}</div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader title="This week" sub="Follow-ups, payments & milestones" />
            <div className="p-2 pt-3">
              {agenda.length === 0 && <p className="px-3 py-6 text-center text-[13px] text-muted">Nothing due in the next 7 days.</p>}
              {agenda.map((a) => {
                const Icon = a.kind === "follow" ? PhoneCall : a.kind === "pay" ? Wallet : CalendarClock;
                return (
                  <Link key={a.key} href={a.href} className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-surface-2">
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${a.days < 0 ? "bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-300" : "bg-surface-2 text-muted"}`}><Icon size={14} /></div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-medium">{a.title}</div>
                      <div className={`text-[12px] ${a.days < 0 ? "text-red-600 dark:text-red-400" : "text-muted"}`}>{a.sub} · {relDays(a.days)}</div>
                    </div>
                    {a.amount != null && <span className="text-[12.5px] font-medium tabular-nums">{inr(a.amount)}</span>}
                  </Link>
                );
              })}
            </div>
          </Card>

          <Card>
            <CardHeader title="Awaiting client response" sub={`${awaiting.length} proposal${awaiting.length === 1 ? "" : "s"} out`}
              action={<Link href="/proposals" className="text-[12.5px] font-medium text-muted hover:text-ink">View</Link>} />
            <div className="p-2 pt-3">
              {awaiting.length === 0 && <p className="px-3 py-6 text-center text-[13px] text-muted">No proposals waiting.</p>}
              {awaiting.map((p) => (
                <Link key={p.id} href="/proposals" className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-surface-2">
                  <Avatar name={p.clientName} className="h-8 w-8 text-[11px]" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-medium">{p.clientName}</div>
                    <div className="truncate text-[12px] text-muted">{p.title}</div>
                  </div>
                  <span className="text-[12.5px] font-medium tabular-nums">{inr(p.investment)}</span>
                </Link>
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader title="Recent conversations" action={<Link href="/templates" className="text-[12.5px] font-medium text-muted hover:text-ink">Log</Link>} />
            <div className="space-y-3 p-5 pt-4">
              {db.comms.length === 0 && <p className="text-[13px] text-muted">No conversations logged yet.</p>}
              {db.comms.slice(0, 3).map((c) => (
                <div key={c.id} className="flex gap-3">
                  <MessageSquare size={14} className="mt-0.5 shrink-0 text-subtle" />
                  <div className="min-w-0">
                    <div className="text-[12.5px]"><span className="font-medium">{c.clientName}</span> <span className="text-subtle">· {c.channel} · {c.date}</span></div>
                    <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted">{c.summary}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
