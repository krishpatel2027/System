"use client";
import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { DB } from "./types";
import { seedDB } from "./seed";

const KEY = "arkria_os_v1";
const TOKEN_KEY = "arkria_admin_token";

export type SyncState = "local" | "pulling" | "synced" | "pushing" | "error";

function isValidDoc(v: unknown): v is DB {
  if (!v || typeof v !== "object") return false;
  const d = v as Record<string, unknown>;
  return Array.isArray(d.leads) && Array.isArray(d.clients);
}

function mergeWithSeed(doc: DB): DB {
  // Shallow merge so new collections added in code survive old payloads.
  return { ...seedDB, ...doc };
}

function loadLocal(): { db: DB; hasLocal: boolean } {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DB;
      if (isValidDoc(parsed)) return { db: mergeWithSeed(parsed), hasLocal: true };
    }
  } catch {}
  return { db: seedDB, hasLocal: false };
}

function authHeaders(): Record<string, string> {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) return { Authorization: `Bearer ${token}` };
  } catch {}
  return {};
}

const Ctx = createContext<{
  db: DB;
  update: <K extends keyof DB>(key: K, val: DB[K]) => void;
  reset: () => void;
  sync: SyncState;
  backend: string | null;
  lastSyncedAt: string | null;
  refreshFromServer: () => Promise<void>;
} | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [db, setDb] = useState<DB>(seedDB);
  const [ready, setReady] = useState(false);
  const [pulled, setPulled] = useState(false);
  const [sync, setSync] = useState<SyncState>("local");
  const [backend, setBackend] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const lastPushedRef = useRef<string>("");
  const pushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 1. Instant paint from localStorage, then pull server as source of truth
  //    for fresh browsers. Gate pushes until pull completes so seed data
  //    can never clobber real server data.
  //    Intentional mount hydration from localStorage + server pull.
  /* eslint-disable react-hooks/set-state-in-effect -- intentional mount hydration + server pull */
  useEffect(() => {
    const { db: localDb, hasLocal } = loadLocal();
    setDb(localDb);
    setReady(true);

    let cancelled = false;
    (async () => {
      setSync("pulling");
      try {
        const res = await fetch("/api/store", { headers: authHeaders(), cache: "no-store" });
        if (!res.ok) throw new Error(`pull ${res.status}`);
        const payload = (await res.json()) as { mode?: string; data?: unknown; updatedAt?: string };
        if (payload.mode) setBackend(payload.mode);
        if (isValidDoc(payload.data)) {
          if (!hasLocal) {
            if (!cancelled) setDb(mergeWithSeed(payload.data));
          }
          // hasLocal: keep local edits (offline work wins over auto-pull).
          // User can pull explicitly via refreshFromServer().
          if (!cancelled) {
            setLastSyncedAt(payload.updatedAt ?? new Date().toISOString());
            setSync("synced");
          }
        } else {
          // Empty server (first run): seed the server on next push.
          if (!cancelled) setSync(hasLocal ? "synced" : "local");
        }
      } catch {
        if (!cancelled) setSync(hasLocal ? "synced" : "local");
      } finally {
        if (!cancelled) setPulled(true);
      }
    })();

    return () => {
      cancelled = true;
    };
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  // 2. Persist locally + debounced push to server (only after pull).
  useEffect(() => {
    if (!ready || !pulled) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(db));
    } catch {}
    const snapshot = JSON.stringify(db);
    if (snapshot === lastPushedRef.current) return;
    setSync("pushing");
    if (pushTimer.current) clearTimeout(pushTimer.current);
    pushTimer.current = setTimeout(() => {
      void (async () => {
        try {
          const res = await fetch("/api/store", {
            method: "PUT",
            headers: { "Content-Type": "application/json", ...authHeaders() },
            body: snapshot,
          });
          if (!res.ok) throw new Error(`push ${res.status}`);
          const out = (await res.json()) as { mode?: string; updatedAt?: string };
          if (out.mode) setBackend(out.mode);
          lastPushedRef.current = snapshot;
          setLastSyncedAt(out.updatedAt ?? new Date().toISOString());
          setSync("synced");
        } catch {
          setSync("error");
        }
      })();
    }, 800);
    return () => {
      if (pushTimer.current) clearTimeout(pushTimer.current);
    };
  }, [db, ready, pulled]);

  const value = useMemo(
    () => ({
      db,
      update: <K extends keyof DB>(key: K, val: DB[K]) => {
        setDb((d) => ({ ...d, [key]: val }));
      },
      reset: () => setDb(seedDB),
      sync,
      backend,
      lastSyncedAt,
      refreshFromServer: async () => {
        setSync("pulling");
        try {
          const res = await fetch("/api/store", { headers: authHeaders(), cache: "no-store" });
          if (!res.ok) throw new Error(`pull ${res.status}`);
          const payload = (await res.json()) as { mode?: string; data?: unknown; updatedAt?: string };
          if (payload.mode) setBackend(payload.mode);
          if (isValidDoc(payload.data)) {
            const merged = mergeWithSeed(payload.data);
            lastPushedRef.current = JSON.stringify(merged);
            setDb(merged);
            setLastSyncedAt(payload.updatedAt ?? new Date().toISOString());
          }
          setSync("synced");
        } catch {
          setSync("error");
        }
      },
    }),
    [db, sync, backend, lastSyncedAt]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useDB() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useDB outside provider");
  return v;
}
