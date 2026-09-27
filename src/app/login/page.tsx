"use client";
import React, { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Btn, Field, inputCls } from "@/components/ui";
import { TOKEN_KEY, NAME_KEY } from "@/lib/store";
import { AlertTriangle, ArrowRight, Lock } from "lucide-react";

type Health = { ok: boolean; auth: "password" | "open"; backend: string; problem: string | null };

function LoginInner() {
  const next = useSearchParams().get("next") || "/";
  const [health, setHealth] = useState<Health | null>(null);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "checking" | "wrong" | "error">("idle");

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- read saved name + server status once */
    try { setName(localStorage.getItem(NAME_KEY) ?? ""); } catch {}
    /* eslint-enable react-hooks/set-state-in-effect */
    fetch("/api/health", { cache: "no-store" }).then((r) => r.json()).then(setHealth).catch(() => setStatus("error"));
  }, []);

  const enter = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setStatus("checking");
    try {
      const pw = password.trim();
      const res = await fetch("/api/store", { headers: pw ? { Authorization: `Bearer ${pw}` } : {}, cache: "no-store" });
      if (res.status === 401) return setStatus("wrong");
      if (!res.ok && res.status !== 503) return setStatus("error");
      localStorage.setItem(NAME_KEY, name.trim());
      if (pw) localStorage.setItem(TOKEN_KEY, pw);
      window.location.href = next.startsWith("/") ? next : "/";
    } catch {
      setStatus("error");
    }
  };

  const open = health?.auth === "open";

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="animate-fade-up w-full max-w-[400px]">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-ink text-[20px] font-bold text-bg shadow-lg">A</div>
          <h1 className="mt-5 text-[24px] font-semibold tracking-[-0.02em]">Sign in to Studio OS</h1>
          <p className="mt-1 text-[14px] text-muted">{open ? "Tell us who's using this device." : "Enter your team password to continue."}</p>
        </div>

        <form onSubmit={enter} className="space-y-4 rounded-2xl border border-line bg-surface p-6 shadow-[0_20px_60px_-30px_rgba(20,20,23,0.25)]">
          <Field label="Your name" hint="Shown in greetings and as the default project manager">
            <input autoFocus className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Krish" />
          </Field>
          {!open && (
            <Field label="Team password">
              <div className="relative">
                <Lock size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-subtle" />
                <input type="password" className={`${inputCls} pl-8`} value={password} onChange={(e) => { setPassword(e.target.value); setStatus("idle"); }} placeholder="••••••••" />
              </div>
            </Field>
          )}
          {status === "wrong" && <p className="text-[13px] text-red-600">That password isn&apos;t right. Ask your workspace admin for the team password.</p>}
          {status === "error" && <p className="text-[13px] text-red-600">Couldn&apos;t reach the server. Check your connection and try again.</p>}
          <Btn type="submit" className="w-full" disabled={status === "checking" || !health || (!open && !password)}>
            {status === "checking" ? "Checking…" : "Continue"} <ArrowRight size={14} />
          </Btn>
        </form>

        {health?.problem && (
          <div className="mt-4 flex gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[12.5px] text-amber-800 dark:border-amber-900 dark:bg-amber-950/60 dark:text-amber-200">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" /> {health.problem}
          </div>
        )}
        {open && !health?.problem && (
          <p className="mt-4 text-center text-[12px] text-subtle">No team password is set, so anyone with this link can open the workspace. Set <code>ARKRIA_ADMIN_PASSWORD</code> before sharing it.</p>
        )}
      </div>
    </div>
  );
}

export default function LoginPage() {
  return <Suspense><LoginInner /></Suspense>;
}
