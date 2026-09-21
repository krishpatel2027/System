"use client";
import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, Users, UserPlus, Layers, Package as Pkg, Calculator,
  FileText, Presentation, KanbanSquare, Repeat, Wallet, Wrench, LayoutTemplate,
  BarChart3, Settings, Search, Command, Sun, Moon, Plus, Bell,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useDB } from "@/lib/store";

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/leads", label: "Leads", icon: UserPlus },
  { href: "/clients", label: "Clients", icon: Users },
  { href: "/services", label: "Services", icon: Layers },
  { href: "/packages", label: "Packages", icon: Pkg },
  { href: "/pricing", label: "Pricing", icon: Calculator },
  { href: "/quotes", label: "Quotes", icon: FileText },
  { href: "/proposals", label: "Proposals", icon: Presentation },
  { href: "/projects", label: "Projects", icon: KanbanSquare },
  { href: "/scope", label: "Scope Changes", icon: Repeat },
  { href: "/payments", label: "Payments", icon: Wallet },
  { href: "/maintenance", label: "Maintenance", icon: Wrench },
  { href: "/templates", label: "Templates", icon: LayoutTemplate },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const { db, sync, backend, lastSyncedAt, refreshFromServer } = useDB();
  const [dark, setDark] = useState(false);
  const [palette, setPalette] = useState(false);
  const [q, setQ] = useState("");
  const [mobile, setMobile] = useState(false);

  // Hydrate persisted theme once on mount (intentional mount hydration).
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- intentional mount hydration from localStorage */
    const d = localStorage.getItem("arkria_theme") === "dark";
    setDark(d);
    document.documentElement.classList.toggle("dark", d);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPalette(true);
      }
      if (e.key === "Escape") setPalette(false);
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, []);

  const toggleTheme = () => {
    const n = !dark;
    setDark(n);
    document.documentElement.classList.toggle("dark", n);
    localStorage.setItem("arkria_theme", n ? "dark" : "light");
  };

  const notifs = useMemo(() => {
    const out: string[] = [];
    db.leads.filter((l) => l.nextFollowUp && l.stage !== "won" && l.stage !== "lost").forEach((l) => {
      if (l.nextFollowUp! <= new Date().toISOString().slice(0, 10)) out.push(`Follow-up due: ${l.company}`);
    });
    db.payments.filter((p) => p.status !== "paid" && p.due <= new Date().toISOString().slice(0, 10)).forEach((p) => {
      out.push(`Payment due: ${p.clientName} ${p.label}`);
    });
    return out.slice(0, 6);
  }, [db]);

  const results = useMemo(() => {
    const s = q.toLowerCase().trim();
    if (!s) return null;
    return {
      leads: db.leads.filter((l) => (l.company + l.contactName).toLowerCase().includes(s)).slice(0, 4),
      clients: db.clients.filter((c) => (c.company + c.contactName).toLowerCase().includes(s)).slice(0, 4),
      projects: db.projects.filter((p) => (p.name + p.clientName).toLowerCase().includes(s)).slice(0, 4),
      quotes: db.quotes.filter((x) => (x.no + x.clientName).toLowerCase().includes(s)).slice(0, 4),
    };
  }, [q, db]);

  const actions = [
    { label: "New Lead", run: () => router.push("/leads?action=new") },
    { label: "New Client", run: () => router.push("/clients?action=new") },
    { label: "New Quote", run: () => router.push("/quotes?action=new") },
    { label: "New Proposal", run: () => router.push("/proposals?action=new") },
    { label: "New Project", run: () => router.push("/projects?action=new") },
    { label: "Record Payment", run: () => router.push("/payments?action=new") },
    { label: "Open Pricing", run: () => router.push("/pricing") },
    { label: "Open Analytics", run: () => router.push("/analytics") },
  ];

  return (
    <div className="min-h-screen bg-[#fafafa] text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      <div className="flex">
        {/* Sidebar */}
        <aside className={`fixed inset-y-0 left-0 z-40 w-[248px] shrink-0 border-r border-neutral-200/70 bg-white/90 backdrop-blur transition-transform dark:border-neutral-800 dark:bg-neutral-900/90 ${mobile ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
          <div className="flex h-16 items-center gap-2 px-5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-neutral-900 text-[15px] font-bold text-white dark:bg-white dark:text-neutral-900">A</div>
            <div>
              <div className="text-[15px] font-semibold tracking-tight">Arkria</div>
              <div className="text-[11px] text-neutral-500">Studio OS</div>
            </div>
          </div>
          <nav className="space-y-0.5 overflow-auto px-3 pb-6">
            {NAV.map((n) => {
              const active = path === n.href || (n.href !== "/" && path.startsWith(n.href));
              const Icon = n.icon;
              return (
                <Link key={n.href} href={n.href} onClick={() => setMobile(false)}
                  className={cn("flex items-center gap-2.5 rounded-xl px-3 py-2 text-[13.5px] font-medium transition-colors",
                    active ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900" : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800")}>
                  <Icon size={16} strokeWidth={2} />
                  {n.label}
                  {n.label === "Leads" && <span className="ml-auto text-[11px] opacity-70">{db.leads.filter(l=>!["won","lost"].includes(l.stage)).length}</span>}
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* Main */}
        <div className="min-w-0 flex-1 lg:pl-[248px]">
          <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-neutral-200/70 bg-[#fafafa]/85 px-4 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/85 sm:px-6">
            <button className="rounded-lg p-2 hover:bg-neutral-200/60 lg:hidden" onClick={() => setMobile(!mobile)}>☰</button>
            <button onClick={() => setPalette(true)} className="flex max-w-md flex-1 items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-left text-[13px] text-neutral-400 dark:border-neutral-800 dark:bg-neutral-900">
              <Search size={15} />
              <span className="hidden sm:inline">Search clients, leads, projects…</span>
              <span className="ml-auto hidden items-center gap-1 rounded-md bg-neutral-100 px-1.5 py-0.5 text-[11px] sm:flex dark:bg-neutral-800">Ctrl K</span>
            </button>
            <div className="ml-auto flex items-center gap-1.5">
              <button
                onClick={() => { if (sync === "error" || sync === "local") void refreshFromServer(); }}
                title={lastSyncedAt ? `Last synced: ${new Date(lastSyncedAt).toLocaleString()}${backend ? ` · backend: ${backend}` : ""}` : backend ? `Backend: ${backend}` : "Local only — server unreachable"}
                className={cn(
                  "hidden items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] font-medium md:flex",
                  sync === "synced" && "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300",
                  (sync === "pulling" || sync === "pushing") && "animate-pulse border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300",
                  sync === "error" && "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300",
                  sync === "local" && "border-neutral-200 bg-neutral-100 text-neutral-500 dark:border-neutral-800 dark:bg-neutral-800 dark:text-neutral-400"
                )}
              >
                <span className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  sync === "synced" && "bg-emerald-500",
                  (sync === "pulling" || sync === "pushing") && "bg-amber-500",
                  sync === "error" && "bg-red-500",
                  sync === "local" && "bg-neutral-400"
                )} />
                {sync === "synced" ? `Synced${backend ? ` · ${backend}` : ""}` : sync === "pulling" ? "Pulling…" : sync === "pushing" ? "Saving…" : sync === "error" ? "Sync error — retry" : "Local only"}
              </button>
              <div className="relative group">
                <button className="relative rounded-xl p-2 hover:bg-neutral-200/60 dark:hover:bg-neutral-800" title="Notifications">
                  <Bell size={17} />
                  {notifs.length > 0 && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500" />}
                </button>
                <div className="absolute right-0 top-full hidden w-72 rounded-2xl border border-neutral-200 bg-white p-2 shadow-xl group-hover:block dark:border-neutral-700 dark:bg-neutral-900">
                  <div className="px-2 py-1 text-[12px] font-semibold text-neutral-500">Notifications</div>
                  {notifs.length === 0 && <div className="px-2 py-3 text-[13px] text-neutral-500">All clear. Nothing overdue.</div>}
                  {notifs.map((n, i) => <div key={i} className="rounded-lg px-2 py-1.5 text-[13px] hover:bg-neutral-50 dark:hover:bg-neutral-800">{n}</div>)}
                </div>
              </div>
              <button onClick={toggleTheme} className="rounded-xl p-2 hover:bg-neutral-200/60 dark:hover:bg-neutral-800">{dark ? <Sun size={17} /> : <Moon size={17} />}</button>
              <Link href="/leads?action=new" className="hidden items-center gap-1 rounded-xl bg-neutral-900 px-3 py-2 text-[13px] font-medium text-white sm:flex dark:bg-white dark:text-neutral-900"><Plus size={15} /> New Lead</Link>
            </div>
          </header>
          <main className="mx-auto w-full max-w-[1200px] px-4 py-6 sm:px-6">{children}</main>
        </div>
      </div>

      {/* Command palette */}
      {palette && (
        <div className="fixed inset-0 z-50 bg-black/40 p-4 backdrop-blur-sm" onClick={() => setPalette(false)}>
          <div onClick={(e) => e.stopPropagation()} className="mx-auto mt-16 w-full max-w-xl overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-2xl dark:border-neutral-700 dark:bg-neutral-900">
            <div className="flex items-center gap-2 border-b border-neutral-100 px-4 py-3 dark:border-neutral-800">
              <Command size={15} className="text-neutral-400" />
              <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Type a command or search…" className="w-full bg-transparent text-[14px] outline-none" />
            </div>
            <div className="max-h-[55vh] overflow-auto p-2">
              <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Actions</div>
              {actions.filter(a=>!q || a.label.toLowerCase().includes(q.toLowerCase())).map((a) => (
                <button key={a.label} onClick={() => { setPalette(false); setQ(""); a.run(); }} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-[13.5px] hover:bg-neutral-100 dark:hover:bg-neutral-800">
                  <Plus size={14} className="text-neutral-400" /> {a.label}
                </button>
              ))}
              {results && (
                <>
                  {(["leads","clients","projects","quotes"] as const).map((k) => (
                    <div key={k}>
                      {results[k].length > 0 && <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">{k}</div>}
                      {(results[k] as { id: string; company?: string; contactName?: string; name?: string; clientName?: string; no?: string }[]).map((rec) => {
                        const label = rec.company ?? rec.name ?? rec.no ?? rec.id;
                        const sub = rec.contactName ?? rec.clientName ?? "";
                        const href = k === "leads" ? "/leads" : k === "clients" ? "/clients" : k === "projects" ? "/projects" : "/quotes";
                        return <button key={rec.id} onClick={() => { setPalette(false); router.push(href); }} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-[13.5px] hover:bg-neutral-100 dark:hover:bg-neutral-800"><Search size={13} className="text-neutral-400" /> {label} <span className="text-neutral-400">{sub}</span></button>;
                      })}
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
