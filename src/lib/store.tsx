"use client";
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { DB } from "./types";
import { seedDB } from "./seed";

const KEY = "arkria_os_v1";
const TOKEN_KEY = "arkria_admin_token";

// Best-effort background sync to the server backend (/api/store).
// localStorage stays the source of truth, so the app works fully offline;
// when a backend is reachable the server copy follows along for multi-user.
function syncToServer(db: DB) {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    void fetch("/api/store", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(db),
    }).catch(() => {});
  } catch {}
}

const Ctx = createContext<{
  db: DB;
  update: <K extends keyof DB>(key: K, val: DB[K]) => void;
  reset: () => void;
} | null>(null);

function load(): DB {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DB;
      // shallow merge with seed to survive schema additions
      return { ...seedDB, ...parsed };
    }
  } catch {}
  return seedDB;
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [db, setDb] = useState<DB>(seedDB);
  const [ready, setReady] = useState(false);

  // Hydrate persisted DB once on mount; persist afterwards (intentional mount hydration).
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- intentional mount hydration from localStorage */
    setDb(load());
    setReady(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  useEffect(() => {
    if (ready) {
      try {
        localStorage.setItem(KEY, JSON.stringify(db));
      } catch {}
      syncToServer(db);
    }
  }, [db, ready]);

  const value = useMemo(
    () => ({
      db,
      update: <K extends keyof DB>(key: K, val: DB[K]) => {
        setDb((d) => ({ ...d, [key]: val }));
      },
      reset: () => setDb(seedDB),
    }),
    [db]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useDB() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useDB outside provider");
  return v;
}
