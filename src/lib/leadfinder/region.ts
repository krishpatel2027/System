"use client";
import { useSyncExternalStore } from "react";
import type { Region } from "./markets";

// Which Lead Finder workspace this browser is looking at. Remembered per
// browser; the lead data itself is shared by the whole team.

const KEY = "arkria.lf.region";
const listeners = new Set<() => void>();

const read = (): Region => {
  try { return localStorage.getItem(KEY) === "intl" ? "intl" : "in"; } catch { return "in"; }
};

export function setRegion(r: Region) {
  try { localStorage.setItem(KEY, r); } catch {}
  listeners.forEach((l) => l());
}

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => { listeners.delete(cb); window.removeEventListener("storage", cb); };
};

export function useRegion(): Region {
  return useSyncExternalStore(subscribe, read, () => "in" as Region);
}
