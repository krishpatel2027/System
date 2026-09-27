"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useDB } from "@/lib/store";
import { sameDoc } from "@/lib/merge";
import { DEFAULT_PRICING } from "@/lib/pricing-data";
import { Card } from "@/components/ui";
import { Check, ArrowRight, X } from "lucide-react";
import { cn } from "@/lib/utils";

const DISMISS_KEY = "arkria_getting_started_dismissed";

export function GettingStarted() {
  const { db, ready } = useDB();
  const [dismissed, setDismissed] = useState(true);
  useEffect(() => {
    /* eslint-disable-next-line react-hooks/set-state-in-effect -- read per-device preference once */
    try { setDismissed(localStorage.getItem(DISMISS_KEY) === "1"); } catch { setDismissed(false); }
  }, []);

  const s = db.settings;
  const steps = [
    { title: "Add your studio details", sub: "Phone, UPI or bank details and address appear on every quote.", href: "/settings?section=studio", done: !!(s.phone || s.upi || s.bank || s.address) },
    { title: "Review your packages & prices", sub: "Make the calculator match what you actually charge.", href: "/settings?section=packages", done: !sameDoc(db.pricing, DEFAULT_PRICING) || db.quotes.length > 0 },
    { title: "Add your first lead", sub: "Every enquiry, from first message to won.", href: "/leads?action=new", done: db.leads.length > 0 || db.clients.length > 0 },
    { title: "Send your first quote", sub: "Price it in the calculator, then share a link with the client.", href: "/pricing", done: db.quotes.length > 0 },
  ];
  const done = steps.filter((x) => x.done).length;
  if (!ready || dismissed || done === steps.length) return null;

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-line bg-gradient-to-r from-accent-soft to-surface px-5 py-4">
        <div>
          <div className="text-[14.5px] font-semibold">Get your studio set up</div>
          <div className="text-[12.5px] text-muted">{done} of {steps.length} done</div>
        </div>
        <button aria-label="Hide checklist" onClick={() => { setDismissed(true); try { localStorage.setItem(DISMISS_KEY, "1"); } catch {} }} className="rounded-lg p-1.5 text-subtle hover:bg-surface-2 hover:text-ink"><X size={15} /></button>
      </div>
      <div className="grid divide-y divide-line sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4 lg:divide-x">
        {steps.map((x, i) => (
          <Link key={x.title} href={x.href} className="group flex gap-3 p-4 transition hover:bg-surface-2/60">
            <span className={cn("mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold", x.done ? "bg-emerald-500 text-white" : "bg-surface-2 text-muted ring-1 ring-line")}>
              {x.done ? <Check size={12} strokeWidth={3} /> : i + 1}
            </span>
            <span className="min-w-0">
              <span className={cn("flex items-center gap-1 text-[13px] font-medium", x.done && "text-muted line-through")}>{x.title}{!x.done && <ArrowRight size={12} className="text-subtle transition group-hover:translate-x-0.5" />}</span>
              <span className="mt-0.5 block text-[12px] text-muted">{x.sub}</span>
            </span>
          </Link>
        ))}
      </div>
    </Card>
  );
}
