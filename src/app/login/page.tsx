"use client";
import React, { useEffect, useState } from "react";
import { Card, Btn, Field, inputCls } from "@/components/ui";

const TOKEN_KEY = "arkria_admin_token";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "ok" | "err" | "open">("idle");
  const [backend, setBackend] = useState("…");

  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then((h) => {
        setBackend(`${h.backend}${h.auth === "open" ? " · open (no password set)" : " · password protected"}`);
        if (h.auth === "open") setStatus("open");
      })
      .catch(() => setBackend("unreachable"));
  }, []);

  const login = async () => {
    setStatus("idle");
    const res = await fetch("/api/store", { headers: { Authorization: `Bearer ${password}` } });
    if (res.status === 401) {
      setStatus("err");
      return;
    }
    try {
      localStorage.setItem(TOKEN_KEY, password);
    } catch {}
    setPassword("");
    setStatus("ok");
  };

  const logout = () => {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {}
    setStatus("idle");
  };

  return (
    <div className="mx-auto max-w-md space-y-4">
      <div><h1 className="text-[22px] font-semibold tracking-tight">Login</h1><p className="text-[13px] text-neutral-500">Backend: {backend}</p></div>
      <Card className="space-y-3 p-5">
        {status === "open" ? (
          <p className="text-[13.5px] text-neutral-600 dark:text-neutral-300">
            No <code>ARKRIA_ADMIN_PASSWORD</code> is set — the API is open (local dev mode). Set a password in <code>.env.local</code> to enable auth.
          </p>
        ) : status === "ok" ? (
          <div className="space-y-3">
            <p className="text-[13.5px] font-medium text-emerald-600">Authenticated — this browser will sync to the server backend.</p>
            <Btn variant="outline" onClick={logout}>Log out this browser</Btn>
          </div>
        ) : (
          <>
            <Field label="Admin password"><input type="password" className={inputCls} value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && login()} placeholder="ARKRIA_ADMIN_PASSWORD" /></Field>
            {status === "err" && <p className="text-[13px] text-red-600">Wrong password.</p>}
            <Btn onClick={login} className="w-full">Log in</Btn>
          </>
        )}
      </Card>
    </div>
  );
}
