"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, Users, UserPlus, Layers, Package as Pkg, Calculator,
  FileText, Presentation, KanbanSquare, Repeat, Wallet, Wrench, LayoutTemplate,
  BarChart3, Settings, Search, Sun, Moon, Plus, Bell, Menu, X, CornerDownLeft,
  ArrowRight, LogOut, AlertTriangle, Radar, type LucideIcon,
} from "lucide-react";
import { addDaysISO, cn } from "@/lib/utils";
import { StoreProvider, useDB } from "@/lib/store";

type NavItem = { href: string; label: string; icon: LucideIcon };
const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  { label: "Overview", items: [
    { href: "/", label: "Command Center", icon: LayoutDashboard },
    { href: "/analytics", label: "Analytics", icon: BarChart3 },
  ] },
  { label: "Sales", items: [
    { href: "/lead-finder", label: "Lead Finder", icon: Radar },
    { href: "/leads", label: "Pipeline", icon: UserPlus },
    { href: "/clients", label: "Clients", icon: Users },
    { href: "/proposals", label: "Proposals", icon: Presentation },
    { href: "/quotes", label: "Quotes", icon: FileText },
  ] },
  { label: "Catalog", items: [
    { href: "/pricing", label: "Pricing", icon: Calculator },
    { href: "/packages", label: "Packages", icon: Pkg },
    { href: "/services", label: "Services", icon: Layers },
  ] },
  { label: "Delivery", items: [
    { href: "/projects", label: "Projects", icon: KanbanSquare },
    { href: "/scope", label: "Scope changes", icon: Repeat },
    { href: "/payments", label: "Payments", icon: Wallet },
    { href: "/maintenance", label: "Maintenance", icon: Wrench },
  ] },
  { label: "Workspace", items: [
    { href: "/templates", label: "Templates", icon: LayoutTemplate },
    { href: "/settings", label: "Settings", icon: Settings },
  ] },
];
const ALL_NAV = NAV_GROUPS.flatMap((g) => g.items.map((i) => ({ ...i, group: g.label })));

// Pages without the app chrome: login, internal documents, public share links.
const isBare = (path: string) => path === "/login" || path === "/lead-finder/report" || /^\/(quotes|proposals)\/[^/]+$/.test(path);
const isActive = (path: string, href: string) => path === href || (href !== "/" && path.startsWith(href + "/"));

// Public share pages never load the workspace store, so a client opening a
// shared quote never downloads the studio's data.
export function AppRoot({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  if (path.startsWith("/share/")) return <div className="min-h-screen bg-bg text-ink">{children}</div>;
  return <StoreProvider><Shell>{children}</Shell></StoreProvider>;
}

function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const { sync } = useDB();
  useEffect(() => {
    if (sync === "locked" && path !== "/login") router.replace(`/login?next=${encodeURIComponent(path)}`);
  }, [sync, path, router]);
  if (isBare(path)) return <div className="min-h-screen bg-bg text-ink">{children}</div>;
  return <AppChrome path={path}>{children}</AppChrome>;
}

function AppChrome({ path, children }: { path: string; children: React.ReactNode }) {
  const router = useRouter();
  const { db, sync, backend, problem, lastSyncedAt, refreshFromServer, userName, logout } = useDB();
  const [dark, setDark] = useState(false);
  const [palette, setPalette] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [bell, setBell] = useState(false);

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
        setPalette((p) => !p);
      }
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

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const openLeads = db.leads.filter((l) => !["won", "lost"].includes(l.stage)).length;
  const overduePays = db.payments.filter((p) => p.status !== "paid" && p.due < today).length;

  const alertSince = useMemo(() => addDaysISO(-3), []);
  const hotProspects = db.prospects.filter((p) => !p.leadId && p.status !== "not_fit" && (p.score?.total ?? 0) >= db.finder.scoring.high && p.discoveredAt >= alertSince);

  const notifs = useMemo(() => {
    const out: { text: string; href: string }[] = [];
    // Lead alerts: new high-opportunity businesses from recent searches.
    hotProspects.slice(0, 3).forEach((p) => out.push({ text: `New lead: ${p.name} scored ${p.score?.total}${p.match ? ` · ${p.match.serviceName}` : ""}`, href: `/lead-finder/${p.id}` }));
    db.leads.filter((l) => l.nextFollowUp && !["won", "lost"].includes(l.stage) && l.nextFollowUp <= today)
      .forEach((l) => out.push({ text: `Follow up with ${l.company}`, href: "/leads" }));
    db.payments.filter((p) => p.status !== "paid" && p.due <= today)
      .forEach((p) => out.push({ text: `${p.clientName} · ${p.label} is due`, href: "/payments" }));
    return out.slice(0, 8);
  }, [db, today, hotProspects]);

  const current = ALL_NAV.find((n) => isActive(path, n.href));
  const badge = (href: string) => (href === "/leads" ? openLeads : href === "/payments" ? overduePays : href === "/lead-finder" ? hotProspects.length : 0);

  const syncLabel = { synced: "All changes saved", pulling: "Syncing…", pushing: "Saving…", error: "Sync error — retry", local: "Offline — saved on this device", locked: "Sign in required", misconfigured: "Server not configured" }[sync];
  const syncDot = sync === "synced" ? "bg-emerald-500" : sync === "error" || sync === "misconfigured" ? "bg-red-500" : sync === "local" || sync === "locked" ? "bg-subtle" : "bg-amber-500 animate-pulse";
  const me = userName || db.settings.owner || "You";

  return (
    <div className="min-h-screen bg-bg text-ink">
      {mobile && <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[1px] lg:hidden" onClick={() => setMobile(false)} />}

      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 flex w-[260px] flex-col border-r border-line bg-surface transition-transform duration-200 lg:translate-x-0",
        mobile ? "translate-x-0 shadow-2xl" : "-translate-x-full"
      )}>
        <div className="flex h-16 items-center justify-between px-5">
          <Link href="/" className="flex items-center gap-2.5" onClick={() => setMobile(false)}>
            <div className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-ink text-[14px] font-bold text-bg">{(db.settings.studio || "A")[0]}</div>
            <div className="leading-tight">
              <div className="text-[15px] font-semibold tracking-tight">{db.settings.studio || "Arkria"}</div>
              <div className="text-[11px] text-subtle">Studio OS</div>
            </div>
          </Link>
          <button className="rounded-lg p-1.5 text-muted hover:bg-surface-2 lg:hidden" onClick={() => setMobile(false)} aria-label="Close menu"><X size={17} /></button>
        </div>

        <div className="px-3 pb-2">
          <button onClick={() => { setMobile(false); setPalette(true); }}
            className="flex h-9 w-full items-center gap-2 rounded-xl border border-line bg-surface-2/60 px-3 text-left text-[13px] text-subtle transition hover:border-line-strong hover:text-muted">
            <Search size={14} />
            Search or jump to…
            <kbd className="ml-auto rounded-md border border-line bg-surface px-1.5 font-sans text-[10.5px] text-subtle">⌘K</kbd>
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 pb-4">
          {NAV_GROUPS.map((g) => (
            <div key={g.label} className="mt-4 first:mt-2">
              <div className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-subtle">{g.label}</div>
              <div className="space-y-0.5">
                {g.items.map((n) => {
                  const active = isActive(path, n.href);
                  const Icon = n.icon;
                  const count = badge(n.href);
                  return (
                    <Link key={n.href} href={n.href} onClick={() => setMobile(false)}
                      className={cn(
                        "group relative flex h-9 items-center gap-2.5 rounded-xl px-3 text-[13.5px] font-medium transition-colors",
                        active ? "bg-surface-2 text-ink" : "text-muted hover:bg-surface-2/70 hover:text-ink"
                      )}>
                      {active && <span className="absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-r-full bg-accent" />}
                      <Icon size={16} strokeWidth={active ? 2.2 : 1.9} className={active ? "text-accent" : "text-subtle group-hover:text-muted"} />
                      {n.label}
                      {count > 0 && (
                        <span className={cn("ml-auto rounded-full px-1.5 text-[11px] font-semibold tabular-nums",
                          n.href === "/payments" ? "bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-300" : "bg-surface-2 text-muted ring-1 ring-line")}>{count}</span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="flex items-center gap-1 border-t border-line p-3">
          <button
            onClick={() => { if (sync === "error" || sync === "local") void refreshFromServer(); else router.push("/settings"); }}
            title={lastSyncedAt ? `Last synced ${new Date(lastSyncedAt).toLocaleString()}${backend ? ` · ${backend} storage` : ""}` : "Not synced yet"}
            className="flex min-w-0 flex-1 items-center gap-2.5 rounded-xl px-2 py-2 text-left transition hover:bg-surface-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-2 text-[12px] font-semibold text-muted ring-1 ring-line">{me[0]?.toUpperCase()}</div>
            <div className="min-w-0 flex-1 leading-tight">
              <div className="truncate text-[13px] font-medium">{me}</div>
              <div className="flex items-center gap-1.5 truncate text-[11.5px] text-subtle">
                <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", syncDot)} />{syncLabel}
              </div>
            </div>
          </button>
          <button onClick={logout} title="Sign out of this device" aria-label="Sign out" className="rounded-lg p-2 text-subtle transition hover:bg-surface-2 hover:text-ink"><LogOut size={15} /></button>
        </div>
      </aside>

      <div className="min-w-0 lg:pl-[260px] print:pl-0">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-line bg-bg/80 px-4 backdrop-blur-md sm:px-8">
          <button className="-ml-1 rounded-lg p-2 text-muted hover:bg-surface-2 lg:hidden" onClick={() => setMobile(true)} aria-label="Open menu"><Menu size={18} /></button>
          <div className="flex min-w-0 items-center gap-2 text-[13px]">
            <span className="hidden text-subtle sm:inline">{current?.group ?? "Overview"}</span>
            <span className="hidden text-line-strong sm:inline">/</span>
            <span className="truncate font-medium">{current?.label ?? "Dashboard"}</span>
          </div>
          <div className="ml-auto flex items-center gap-1">
            <button onClick={() => setPalette(true)} className="rounded-xl p-2 text-muted hover:bg-surface-2 hover:text-ink lg:hidden" aria-label="Search"><Search size={17} /></button>
            <div className="relative">
              <button onClick={() => setBell((b) => !b)} className="relative rounded-xl p-2 text-muted hover:bg-surface-2 hover:text-ink" aria-label="Notifications">
                <Bell size={17} />
                {notifs.length > 0 && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-bg" />}
              </button>
              {bell && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setBell(false)} />
                  <div className="animate-pop-in absolute right-0 top-full z-40 mt-2 w-80 overflow-hidden rounded-2xl border border-line bg-surface shadow-xl">
                    <div className="flex items-center justify-between border-b border-line px-4 py-3">
                      <span className="text-[13px] font-semibold">Needs attention</span>
                      <span className="text-[12px] text-subtle">{notifs.length}</span>
                    </div>
                    <div className="max-h-80 overflow-auto p-1.5">
                      {notifs.length === 0 && <div className="px-3 py-6 text-center text-[13px] text-muted">All clear — nothing overdue.</div>}
                      {notifs.map((n, i) => (
                        <Link key={i} href={n.href} onClick={() => setBell(false)} className="flex items-center gap-2 rounded-xl px-3 py-2 text-[13px] hover:bg-surface-2">
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                          <span className="flex-1">{n.text}</span>
                          <ArrowRight size={13} className="text-subtle" />
                        </Link>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
            <button onClick={toggleTheme} className="rounded-xl p-2 text-muted hover:bg-surface-2 hover:text-ink" aria-label="Toggle theme">{dark ? <Sun size={17} /> : <Moon size={17} />}</button>
          </div>
        </header>
        {problem && (
          <div className="border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-[13px] text-amber-800 sm:px-8 dark:border-amber-900 dark:bg-amber-950/60 dark:text-amber-200">
            <span className="inline-flex items-center gap-2 font-medium"><AlertTriangle size={14} /> Changes aren&apos;t being saved to the server.</span> {problem}
          </div>
        )}
        <main key={path} className="animate-fade-up mx-auto w-full max-w-[1240px] px-4 py-8 sm:px-8">{children}</main>
      </div>

      {palette && <CommandPalette onClose={() => setPalette(false)} />}
    </div>
  );
}

type PaletteItem = { id: string; label: string; hint?: string; section: string; icon?: LucideIcon; run: () => void };

function CommandPalette({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { db } = useDB();
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const items = useMemo<PaletteItem[]>(() => {
    const go = (href: string) => () => router.push(href);
    const s = q.toLowerCase().trim();
    const match = (t: string) => !s || t.toLowerCase().includes(s);
    const out: PaletteItem[] = [];
    [
      { label: "New lead", href: "/leads?action=new" },
      { label: "New client", href: "/clients?action=new" },
      { label: "New quote", href: "/quotes?action=new" },
      { label: "New proposal", href: "/proposals?action=new" },
      { label: "New project", href: "/projects?action=new" },
      { label: "Record payment", href: "/payments?action=new" },
    ].filter((a) => match(a.label)).forEach((a) => out.push({ id: a.href, label: a.label, section: "Create", icon: Plus, run: go(a.href) }));
    ALL_NAV.filter((n) => match(n.label)).forEach((n) => out.push({ id: n.href, label: n.label, hint: n.group, section: "Go to", icon: n.icon, run: go(n.href) }));
    if (s) {
      db.leads.filter((l) => match(l.company + " " + l.contactName)).slice(0, 4)
        .forEach((l) => out.push({ id: l.id, label: l.company, hint: `Lead · ${l.contactName}`, section: "Records", icon: UserPlus, run: go("/leads") }));
      db.clients.filter((c) => match(c.company + " " + c.contactName)).slice(0, 4)
        .forEach((c) => out.push({ id: c.id, label: c.company, hint: `Client · ${c.contactName}`, section: "Records", icon: Users, run: go("/clients") }));
      db.projects.filter((p) => match(p.name + " " + p.clientName)).slice(0, 4)
        .forEach((p) => out.push({ id: p.id, label: p.name, hint: "Project", section: "Records", icon: KanbanSquare, run: go("/projects") }));
      db.quotes.filter((x) => match(x.no + " " + x.clientName)).slice(0, 4)
        .forEach((x) => out.push({ id: x.id, label: `${x.no} · ${x.clientName}`, hint: "Quote", section: "Records", icon: FileText, run: go(`/quotes/${x.id}`) }));
    }
    return out;
  }, [q, db, router]);

  const active = Math.min(idx, Math.max(0, items.length - 1));
  const choose = (it?: PaletteItem) => { if (!it) return; onClose(); it.run(); };

  useEffect(() => {
    listRef.current?.querySelector(`[data-idx="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  return (
    <div className="fixed inset-0 z-[60] bg-black/35 p-4 backdrop-blur-[2px]" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="animate-pop-in mx-auto mt-[12vh] w-full max-w-xl overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl">
        <div className="flex items-center gap-2.5 border-b border-line px-4">
          <Search size={16} className="text-subtle" />
          <input autoFocus value={q} onChange={(e) => { setQ(e.target.value); setIdx(0); }} placeholder="Search leads, clients, quotes, or jump to a page…"
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); setIdx((i) => Math.min(i + 1, items.length - 1)); }
              if (e.key === "ArrowUp") { e.preventDefault(); setIdx((i) => Math.max(i - 1, 0)); }
              if (e.key === "Enter") { e.preventDefault(); choose(items[active]); }
              if (e.key === "Escape") onClose();
            }}
            className="h-14 w-full bg-transparent text-[14.5px] outline-none placeholder:text-subtle" />
          <kbd className="rounded-md border border-line px-1.5 text-[10.5px] text-subtle">ESC</kbd>
        </div>
        <div ref={listRef} className="max-h-[52vh] overflow-auto p-2">
          {items.length === 0 && <div className="px-3 py-10 text-center text-[13.5px] text-muted">No results for “{q}”.</div>}
          {items.map((it, i) => {
            const header = items[i - 1]?.section !== it.section ? it.section : null;
            const Icon = it.icon ?? ArrowRight;
            return (
              <React.Fragment key={it.section + it.id}>
                {header && <div className="px-3 pb-1 pt-2.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-subtle">{header}</div>}
                <button data-idx={i} onMouseMove={() => setIdx(i)} onClick={() => choose(it)}
                  className={cn("flex h-10 w-full items-center gap-3 rounded-xl px-3 text-left text-[13.5px]", i === active ? "bg-surface-2 text-ink" : "text-muted")}>
                  <Icon size={15} className={i === active ? "text-accent" : "text-subtle"} />
                  <span className="flex-1 truncate">{it.label}</span>
                  {it.hint && <span className="text-[12px] text-subtle">{it.hint}</span>}
                  {i === active && <CornerDownLeft size={13} className="text-subtle" />}
                </button>
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
}
