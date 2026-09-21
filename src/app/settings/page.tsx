"use client";
import React, { useRef } from "react";
import { useDB } from "@/lib/store";
import { Card, Btn, Field, inputCls, Metric } from "@/components/ui";
import { seedDB } from "@/lib/seed";
import type { DB } from "@/lib/types";

export default function SettingsPage() {
  const { db, update, reset, sync, backend, lastSyncedAt, refreshFromServer } = useDB();
  const s = db.settings;
  const set = (k: keyof typeof s, v: string) => update("settings", { ...s, [k]: v });
  const fileRef = useRef<HTMLInputElement>(null);

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(db, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `arkria-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const importJSON = (f: File) => {
    const r = new FileReader();
    r.onload = () => {
      try {
        const parsed = JSON.parse(String(r.result)) as Partial<DB>;
        const merged: DB = { ...seedDB, ...parsed } as DB;
        if (!Array.isArray(merged.leads) || !Array.isArray(merged.clients)) return alert("Invalid backup file.");
        (Object.keys(merged) as (keyof DB)[]).forEach((k) => update(k, merged[k] as never));
        alert("Backup restored. Reloading…");
        setTimeout(() => window.location.reload(), 400);
      } catch {
        alert("Could not read that file.");
      }
    };
    r.readAsText(f);
  };

  const counts: [string, number][] = [
    ["Leads", db.leads.length],
    ["Clients", db.clients.length],
    ["Quotes", db.quotes.length],
    ["Proposals", db.proposals.length],
    ["Projects", db.projects.length],
    ["Payments", db.payments.length],
    ["Scope changes", db.scopes.length],
    ["Subscriptions", db.subs.length],
  ];

  return (
    <div className="space-y-4">
      <div><h1 className="text-[22px] font-semibold tracking-tight">Settings</h1><p className="text-[13px] text-neutral-500">Studio config · backup · backend sync</p></div>
      <Card className="p-5">
        <div className="flex flex-wrap items-center gap-2">
          <div>
            <div className="text-[14px] font-semibold">Backend &amp; sync</div>
            <div className="text-[12.5px] text-neutral-500">
              Backend: <span className="font-medium text-neutral-800 dark:text-neutral-200">{backend ?? "…"}</span>
              {" · "}Status: <span className="font-medium text-neutral-800 dark:text-neutral-200">{sync}</span>
              {lastSyncedAt ? ` · Last synced: ${new Date(lastSyncedAt).toLocaleString()}` : " · Never synced yet"}
            </div>
          </div>
          <Btn variant="outline" onClick={() => void refreshFromServer()} className="ml-auto">
            {sync === "pulling" ? "Pulling…" : "Pull from server"}
          </Btn>
        </div>
        {sync === "error" && <p className="mt-2 text-[12.5px] text-red-600">Server sync failed. Check the backend is running (and log in via /login if a password is set), then retry.</p>}
        {sync === "local" && <p className="mt-2 text-[12.5px] text-neutral-500">Working locally — the app keeps saving to this browser and will sync when the server is reachable.</p>}
      </Card>
      <Card className="p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Studio"><input className={inputCls} value={s.studio} onChange={(e) => set("studio", e.target.value)} /></Field>
          <Field label="Owner"><input className={inputCls} value={s.owner} onChange={(e) => set("owner", e.target.value)} /></Field>
          <Field label="Email"><input className={inputCls} value={s.email} onChange={(e) => set("email", e.target.value)} /></Field>
          <Field label="Phone"><input className={inputCls} value={s.phone} onChange={(e) => set("phone", e.target.value)} /></Field>
          <Field label="UPI"><input className={inputCls} value={s.upi} onChange={(e) => set("upi", e.target.value)} /></Field>
        </div>
      </Card>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {counts.map(([label, value]) => (
          <Metric key={label} label={label} value={String(value)} />
        ))}
      </div>
      <Card className="flex flex-wrap gap-2 p-5">
        <Btn variant="outline" onClick={exportJSON}>Export backup (JSON)</Btn>
        <Btn variant="outline" onClick={() => fileRef.current?.click()}>Import backup</Btn>
        <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) importJSON(f); e.target.value = ""; }} />
        <Btn variant="outline" onClick={() => { if (confirm("Reset to demo data?")) reset(); }}>Reset demo data</Btn>
      </Card>
      <Card className="p-5 text-[13px] text-neutral-500">
        Production path: set <code>SUPABASE_URL</code> + <code>SUPABASE_SERVICE_ROLE_KEY</code> (see <code>.env.example</code> + <code>supabase/schema.sql</code>), then data syncs to Postgres via <code>/api/store</code>. Schema mirrors <code>src/lib/types.ts</code>.{" "}
        <a href="/login" className="font-medium text-neutral-900 underline dark:text-white">Open login →</a>
      </Card>
    </div>
  );
}
