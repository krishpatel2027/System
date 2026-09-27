"use client";
import React, { useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("rounded-2xl border border-line bg-surface shadow-[0_1px_2px_rgba(20,20,23,0.04)]", className)}>
      {children}
    </div>
  );
}

export function CardHeader({ title, sub, action, className }: { title: React.ReactNode; sub?: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-start justify-between gap-3 px-5 pt-5", className)}>
      <div className="min-w-0">
        <h3 className="text-[14.5px] font-semibold tracking-tight">{title}</h3>
        {sub && <p className="mt-0.5 text-[12.5px] text-muted">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

export function PageHeader({ title, description, actions, eyebrow }: { title: React.ReactNode; description?: React.ReactNode; actions?: React.ReactNode; eyebrow?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && <div className="mb-1.5 text-[12px] font-medium text-subtle">{eyebrow}</div>}
        <h1 className="text-[26px] font-semibold leading-tight tracking-[-0.02em] sm:text-[28px]">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-[14px] text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Metric({ label, value, sub, accent, icon }: { label: string; value: string; sub?: string; accent?: string; icon?: React.ReactNode }) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <div className="text-[12.5px] font-medium text-muted">{label}</div>
        {icon && <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-surface-2 text-muted">{icon}</div>}
      </div>
      <div className="mt-2 text-[26px] font-semibold tracking-[-0.02em] tabular-nums">{value}</div>
      {sub && <div className={cn("mt-0.5 text-[12.5px]", accent ?? "text-muted")}>{sub}</div>}
    </Card>
  );
}

// "in-progress" → "In-progress": capitalise only the first letter of plain-text labels.
const sentence = (n: React.ReactNode) => (typeof n === "string" && n ? n[0].toUpperCase() + n.slice(1) : n);

type Tone = "neutral" | "green" | "amber" | "red" | "blue" | "violet";
const TONES: Record<Tone, string> = {
  neutral: "bg-surface-2 text-muted ring-line",
  green: "bg-emerald-50 text-emerald-700 ring-emerald-200/70 dark:bg-emerald-950/60 dark:text-emerald-300 dark:ring-emerald-900",
  amber: "bg-amber-50 text-amber-700 ring-amber-200/70 dark:bg-amber-950/60 dark:text-amber-300 dark:ring-amber-900",
  red: "bg-red-50 text-red-700 ring-red-200/70 dark:bg-red-950/60 dark:text-red-300 dark:ring-red-900",
  blue: "bg-sky-50 text-sky-700 ring-sky-200/70 dark:bg-sky-950/60 dark:text-sky-300 dark:ring-sky-900",
  violet: "bg-accent-soft text-accent ring-accent-line",
};
const DOTS: Record<Tone, string> = {
  neutral: "bg-subtle", green: "bg-emerald-500", amber: "bg-amber-500", red: "bg-red-500", blue: "bg-sky-500", violet: "bg-accent",
};

export function Badge({ children, tone = "neutral", dot }: { children: React.ReactNode; tone?: Tone; dot?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-[11.5px] font-medium ring-1 ring-inset", TONES[tone])}>
      {dot && <span className={cn("h-1.5 w-1.5 rounded-full", DOTS[tone])} />}
      {sentence(children)}
    </span>
  );
}

type BtnVariant = "primary" | "accent" | "ghost" | "outline" | "danger";
export function Btn({ children, onClick, variant = "primary", size = "md", className, type, disabled, title }: {
  children: React.ReactNode; onClick?: () => void; variant?: BtnVariant; size?: "sm" | "md";
  className?: string; type?: "button" | "submit"; disabled?: boolean; title?: string;
}) {
  const v: Record<BtnVariant, string> = {
    primary: "bg-ink text-bg hover:opacity-90 shadow-sm",
    accent: "bg-accent text-accent-ink hover:opacity-90 shadow-sm",
    ghost: "text-muted hover:bg-surface-2 hover:text-ink",
    outline: "border border-line bg-surface text-ink hover:bg-surface-2",
    danger: "bg-red-600 text-white hover:bg-red-500",
  };
  const s = size === "sm" ? "h-8 px-2.5 text-[12.5px] rounded-lg" : "h-9 px-3.5 text-[13.5px] rounded-xl";
  return (
    <button type={type ?? "button"} onClick={onClick} disabled={disabled} title={title}
      className={cn("inline-flex items-center justify-center gap-1.5 whitespace-nowrap font-medium transition-all active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40", s, v[variant], className)}>
      {children}
    </button>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1.5 text-[12.5px] font-medium text-muted">{label}</div>
      {children}
      {hint && <div className="mt-1 text-[11.5px] text-subtle">{hint}</div>}
    </label>
  );
}

export const inputCls =
  "w-full h-9 rounded-xl border border-line bg-surface px-3 text-[13.5px] text-ink placeholder:text-subtle outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/10 [&:is(textarea)]:h-auto [&:is(textarea)]:py-2";

export function Tabs<T extends string>({ tabs, value, onChange, className }: { tabs: readonly T[] | { id: T; label: React.ReactNode }[]; value: T; onChange: (t: T) => void; className?: string }) {
  const items = (tabs as readonly (T | { id: T; label: React.ReactNode })[]).map((t) => (typeof t === "string" ? { id: t, label: t } : t));
  return (
    <div className={cn("inline-flex items-center gap-0.5 rounded-xl border border-line bg-surface-2 p-0.5", className)}>
      {items.map((t) => (
        <button key={t.id} onClick={() => onChange(t.id)}
          className={cn("rounded-[10px] px-3 py-1.5 text-[13px] font-medium transition", value === t.id ? "bg-surface text-ink shadow-sm ring-1 ring-line" : "text-muted hover:text-ink")}>
          {sentence(t.label)}
        </button>
      ))}
    </div>
  );
}

export function Progress({ value, tone = "ink", className }: { value: number; tone?: "ink" | "accent" | "green"; className?: string }) {
  const c = tone === "accent" ? "bg-accent" : tone === "green" ? "bg-emerald-500" : "bg-ink";
  return (
    <div className={cn("h-1.5 overflow-hidden rounded-full bg-surface-2", className)}>
      <div className={cn("h-full rounded-full transition-all", c)} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

export function Avatar({ name, className }: { name: string; className?: string }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "?";
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return (
    <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[12.5px] font-semibold text-white", className)}
      style={{ background: `linear-gradient(135deg, hsl(${h} 55% 52%), hsl(${(h + 40) % 360} 60% 42%))` }}>
      {initials}
    </div>
  );
}

export function Empty({ title, sub, action, icon }: { title: string; sub: string; action?: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line-strong bg-surface/50 px-6 py-14 text-center">
      {icon && <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-surface-2 text-muted">{icon}</div>}
      <div className="text-[15px] font-semibold">{title}</div>
      <div className="mt-1 max-w-sm text-[13.5px] text-muted">{sub}</div>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Modal({ open, onClose, title, children, wide, footer }: { open: boolean; onClose: () => void; title: React.ReactNode; children: React.ReactNode; wide?: boolean; footer?: React.ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/35 p-0 backdrop-blur-[2px] sm:items-center sm:p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}
        className={cn("animate-pop-in flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl border border-line bg-surface shadow-2xl sm:rounded-2xl", wide ? "sm:max-w-3xl" : "sm:max-w-lg")}>
        <div className="flex items-center justify-between gap-3 border-b border-line px-6 py-4">
          <h3 className="min-w-0 truncate text-[16px] font-semibold tracking-tight">{title}</h3>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-subtle transition hover:bg-surface-2 hover:text-ink"><X size={16} /></button>
        </div>
        <div className="overflow-auto px-6 py-5">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-line bg-surface-2/60 px-6 py-3">{footer}</div>}
      </div>
    </div>
  );
}
