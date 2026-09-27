import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(...inputs);
}

export function inr(n: number): string {
  if (!isFinite(n)) return "₹0";
  const rounded = Math.round(n);
  // Indian numbering
  const s = rounded.toString();
  const last3 = s.slice(-3);
  const rest = s.slice(0, -3);
  const formatted =
    rest.length > 0
      ? rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + last3
      : last3;
  const sign = rounded < 0 ? "-" : "";
  return `${sign}₹${formatted.replace("-", "")}`;
}

export function quoteTotals(q: { items: { qty: number; price: number }[]; discount: number; taxPct: number }) {
  const subtotal = q.items.reduce((a, i) => a + i.qty * i.price, 0);
  const taxable = Math.max(0, subtotal - (q.discount || 0));
  const tax = (taxable * (q.taxPct || 0)) / 100;
  return { subtotal, discount: q.discount || 0, taxable, tax, total: taxable + tax };
}

export function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

export function uid(prefix = "id"): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function addDaysISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export function daysUntil(dateISO: string): number {
  const a = new Date();
  a.setHours(0, 0, 0, 0);
  const b = new Date(dateISO + "T00:00:00");
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

// 128-bit random token for public share links (works on plain-http LAN too).
export function newShareToken(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
