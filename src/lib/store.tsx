"use client";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { DB } from "./types";
import { seedDB } from "./seed";
import { migrate } from "./migrate";
import { merge3, sameDoc } from "./merge";

const KEY = "arkria_os_v1";
const BASE_KEY = "arkria_os_base_v1";
export const TOKEN_KEY = "arkria_admin_token";
export const NAME_KEY = "arkria_user_name";
const POLL_MS = 15000;
const MAX_CONFLICT_RETRIES = 5;

// local: server unreachable, working offline · locked: team password needed ·
// misconfigured: the deployment is missing required settings.
export type SyncState = "local" | "pulling" | "synced" | "pushing" | "error" | "locked" | "misconfigured";

type Base = { data: DB | null; version: number };
type ServerDoc = { mode?: string; data?: unknown; version?: number; updatedAt?: string | null; problem?: string };

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}
function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}
function authHeaders(): Record<string, string> {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) return { Authorization: `Bearer ${token}` };
  } catch {}
  return {};
}

type StoreValue = {
  db: DB;
  ready: boolean;
  update: <K extends keyof DB>(key: K, val: DB[K]) => void;
  replace: (next: DB) => void;
  sync: SyncState;
  backend: string | null;
  problem: string | null;
  lastSyncedAt: string | null;
  refreshFromServer: () => Promise<void>;
  userName: string;
  setUserName: (name: string) => void;
  logout: () => void;
};

const Ctx = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [db, setDb] = useState<DB>(seedDB);
  const [ready, setReady] = useState(false);
  const [sync, setSync] = useState<SyncState>("pulling");
  const [backend, setBackend] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [userName, setUserNameState] = useState("");

  const dbRef = useRef<DB>(seedDB);
  const baseRef = useRef<Base>({ data: null, version: 0 });
  const busy = useRef(false);
  const blocked = useRef(false);
  const pulledOnce = useRef(false);
  const conflicts = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pushRef = useRef<() => Promise<void>>(async () => {});

  const commit = useCallback((next: DB) => {
    dbRef.current = next;
    setDb(next);
  }, []);
  const setBase = useCallback((b: Base) => {
    baseRef.current = b;
    write(BASE_KEY, b);
  }, []);
  const dirty = () => !baseRef.current.data || !sameDoc(dbRef.current, baseRef.current.data);
  const schedulePush = useCallback((ms: number) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void pushRef.current(), ms);
  }, []);

  // Statuses that stop syncing until the user acts. Returns true if handled.
  const handleBlocking = useCallback(async (res: Response) => {
    if (res.status === 401) {
      blocked.current = true;
      setSync("locked");
      return true;
    }
    if (res.status === 503) {
      const j = (await res.json().catch(() => ({}))) as ServerDoc;
      blocked.current = true;
      setProblem(j.problem ?? "The server is not configured.");
      setSync("misconfigured");
      return true;
    }
    return false;
  }, []);

  const pull = useCallback(async (visible = false) => {
    if (busy.current) return;
    busy.current = true;
    if (visible) setSync("pulling");
    try {
      const res = await fetch("/api/store", { headers: authHeaders(), cache: "no-store" });
      if (await handleBlocking(res)) return;
      if (!res.ok) throw new Error(String(res.status));
      const p = (await res.json()) as ServerDoc;
      blocked.current = false;
      setProblem(null);
      if (p.mode) setBackend(p.mode);
      if (p.updatedAt) setLastSyncedAt(p.updatedAt);
      const version = Number(p.version ?? 0);
      const remote = migrate(p.data);
      if (!remote) {
        setBase({ data: null, version });
      } else if (version !== baseRef.current.version || !baseRef.current.data) {
        const merged = merge3(baseRef.current.data, dbRef.current, remote);
        setBase({ data: remote, version });
        if (!sameDoc(merged, dbRef.current)) commit(merged);
      }
      setSync(dirty() ? "pushing" : "synced");
    } catch {
      setSync("local");
    } finally {
      busy.current = false;
      pulledOnce.current = true;
      if (!blocked.current && dirty()) schedulePush(300);
    }
  }, [commit, handleBlocking, schedulePush, setBase]);

  useEffect(() => {
    pushRef.current = async () => {
      if (busy.current) return schedulePush(400);
      if (blocked.current || !pulledOnce.current) return;
      if (!dirty()) {
        setSync("synced");
        return;
      }
      busy.current = true;
      setSync("pushing");
      const snapshot = dbRef.current;
      const base = baseRef.current;
      let retry = false;
      try {
        const res = await fetch("/api/store", {
          method: "PUT",
          headers: { "Content-Type": "application/json", ...authHeaders() },
          body: JSON.stringify({ data: snapshot, baseVersion: base.version }),
        });
        if (await handleBlocking(res)) return;
        const p = (await res.json()) as ServerDoc;
        if (res.status === 409) {
          // Someone saved first: fold their changes into ours, then retry.
          conflicts.current += 1;
          const remote = migrate(p.data);
          const version = Number(p.version ?? 0);
          if (remote) {
            const merged = merge3(base.data, dbRef.current, remote);
            setBase({ data: remote, version });
            commit(merged);
          } else {
            setBase({ data: null, version });
          }
          retry = conflicts.current <= MAX_CONFLICT_RETRIES;
          if (!retry) {
            setSync("error");
            return;
          }
        } else if (!res.ok) {
          throw new Error(String(res.status));
        } else {
          conflicts.current = 0;
          setBase({ data: snapshot, version: Number(p.version) });
          if (p.mode) setBackend(p.mode);
          setLastSyncedAt(p.updatedAt ?? new Date().toISOString());
        }
      } catch {
        setSync("error");
        return;
      } finally {
        busy.current = false;
      }
      if (dirty()) schedulePush(retry ? 50 : 300);
      else setSync("synced");
    };
  }, [commit, handleBlocking, schedulePush, setBase]);

  /* eslint-disable react-hooks/set-state-in-effect -- one-time hydration from localStorage, then server pull */
  useEffect(() => {
    const local = migrate(read(KEY));
    const storedBase = read<Base>(BASE_KEY);
    if (storedBase) baseRef.current = { data: migrate(storedBase.data), version: Number(storedBase.version ?? 0) };
    commit(local ?? seedDB);
    setUserNameState(localStorage.getItem(NAME_KEY) ?? "");
    setReady(true);
    void pull(true);
  }, [commit, pull]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (!ready) return;
    write(KEY, db);
    if (pulledOnce.current && !blocked.current) schedulePush(700);
  }, [db, ready, schedulePush]);

  // Pick up teammates' changes: poll while the tab is visible, and on return.
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible" && !blocked.current) void pull();
    };
    const id = setInterval(tick, POLL_MS);
    window.addEventListener("focus", tick);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", tick);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [pull]);

  const value = useMemo<StoreValue>(() => ({
    db,
    ready,
    update: (key, val) => setDb((d) => {
      const next = { ...d, [key]: val };
      dbRef.current = next;
      return next;
    }),
    replace: (next) => commit(migrate(next) ?? next),
    sync,
    backend,
    problem,
    lastSyncedAt,
    refreshFromServer: () => pull(true),
    userName,
    setUserName: (name) => {
      setUserNameState(name);
      try {
        localStorage.setItem(NAME_KEY, name);
      } catch {}
    },
    logout: () => {
      try {
        [TOKEN_KEY, KEY, BASE_KEY].forEach((k) => localStorage.removeItem(k));
      } catch {}
      // Full reload (not router.push) so no in-memory workspace data survives sign-out.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = "/login";
    },
  }), [db, ready, sync, backend, problem, lastSyncedAt, userName, commit, pull]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useDB() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useDB outside provider");
  return v;
}
