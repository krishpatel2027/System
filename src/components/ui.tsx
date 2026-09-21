"use client";
import React from "react";
import { cn } from "@/lib/utils";

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("rounded-2xl border border-neutral-200/80 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:border-neutral-800 dark:bg-neutral-900", className)}>
      {children}
    </div>
  );
}

export function Metric({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <Card className="p-5">
      <div className="text-[13px] font-medium text-neutral-500 dark:text-neutral-400">{label}</div>
      <div className="mt-1 text-[26px] font-semibold tracking-tight">{value}</div>
      {sub && <div className={cn("mt-1 text-[13px]", accent ?? "text-neutral-500")}>{sub}</div>}
    </Card>
  );
}

export function Badge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "green" | "amber" | "red" | "blue" | "violet" }) {
  const tones: Record<string, string> = {
    neutral: "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200",
    green: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
    amber: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
    red: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300",
    blue: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
    violet: "bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
  };
  return <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-[12px] font-medium", tones[tone])}>{children}</span>;
}

export function Btn({ children, onClick, variant = "primary", className, type }: { children: React.ReactNode; onClick?: () => void; variant?: "primary" | "ghost" | "outline" | "danger"; className?: string; type?: "button" | "submit" }) {
  const v = {
    primary: "bg-neutral-900 text-white hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200",
    ghost: "hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-200",
    outline: "border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800",
    danger: "bg-red-600 text-white hover:bg-red-500",
  }[variant];
  return (
    <button type={type ?? "button"} onClick={onClick} className={cn("inline-flex items-center justify-center gap-1.5 rounded-xl px-3.5 py-2 text-[13.5px] font-medium transition-all active:scale-[0.98]", v, className)}>
      {children}
    </button>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1.5 text-[12.5px] font-medium text-neutral-500">{label}</div>
      {children}
    </label>
  );
}

export const inputCls =
  "w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-[13.5px] outline-none focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10 dark:border-neutral-700 dark:bg-neutral-900 dark:focus:border-white";

export function Empty({ title, sub, action }: { title: string; sub: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-neutral-200 px-6 py-14 text-center dark:border-neutral-800">
      <div className="text-[15px] font-semibold">{title}</div>
      <div className="mt-1 max-w-sm text-[13.5px] text-neutral-500">{sub}</div>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; wide?: boolean }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full ${wide ? "max-w-3xl" : "max-w-lg"} max-h-[90vh] overflow-auto rounded-2xl border border-neutral-200 bg-white p-6 shadow-2xl dark:border-neutral-800 dark:bg-neutral-900`}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-[16px] font-semibold tracking-tight">{title}</h3>
          <button onClick={onClose} className="rounded-lg px-2 py-1 text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}
