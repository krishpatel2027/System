"use client";
import React from "react";
import Link from "next/link";
import { useDB } from "@/lib/store";
import { inr } from "@/lib/utils";
import { packageBundle } from "@/lib/pricing-data";
import { Card, Badge, Btn, PageHeader } from "@/components/ui";
import { Check, Pencil, Printer, ArrowRight, Wrench } from "lucide-react";

export default function PackagesPage() {
  const { db } = useDB();
  const { packages, carePlans } = db.pricing;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Packages"
        description="Your offer at a glance — walk clients through it, or print it as a one-page price sheet."
        actions={<>
          <Link href="/settings?section=packages" className="no-print inline-flex h-9 items-center gap-1.5 rounded-xl border border-line bg-surface px-3.5 text-[13.5px] font-medium hover:bg-surface-2"><Pencil size={14} /> Edit packages</Link>
          <Btn variant="outline" onClick={() => window.print()} className="no-print"><Printer size={14} /> Print</Btn>
          <Link href="/pricing" className="no-print inline-flex h-9 items-center gap-1.5 rounded-xl bg-ink px-3.5 text-[13.5px] font-medium text-bg shadow-sm hover:opacity-90">Price a project <ArrowRight size={14} /></Link>
        </>}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {packages.map((p, i) => {
          const prev = i > 0 ? packages[i - 1].name : null;
          const bundled = packageBundle(packages, p.id).length;
          const highlights = p.highlights.split(",").map((h) => h.trim()).filter(Boolean);
          return (
            <Card key={p.id} className={`relative flex flex-col p-5 ${p.popular ? "border-accent ring-1 ring-accent" : ""}`}>
              {p.popular && <div className="absolute -top-2.5 left-5"><Badge tone="violet">Most popular</Badge></div>}
              <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-subtle">{p.positioning}</div>
              <div className="mt-1 text-[17px] font-semibold tracking-tight">{p.name}</div>
              <div className="mt-3 text-[12px] text-muted">Starting at</div>
              <div className="text-[26px] font-semibold tracking-[-0.02em] tabular-nums">{inr(p.price)}</div>
              <div className="mt-1 text-[12.5px] text-muted">{p.scope}</div>
              <p className="mt-3 text-[12.5px] text-muted">Best for {p.bestFor.charAt(0).toLowerCase() + p.bestFor.slice(1)}</p>
              <div className="my-4 h-px bg-line" />
              {prev && <div className="mb-2 text-[12.5px] font-medium">Everything in {prev}, plus:</div>}
              <ul className="flex-1 space-y-1.5">
                {highlights.map((h) => (
                  <li key={h} className="flex gap-2 text-[13px]"><Check size={14} className="mt-0.5 shrink-0 text-accent" />{h}</li>
                ))}
              </ul>
              <div className="mt-4 text-[11.5px] text-subtle">{bundled} essentials included at no extra cost</div>
              <Link href={`/pricing?package=${p.id}`} className="no-print mt-4 inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-line text-[13px] font-medium hover:bg-surface-2">Build a quote</Link>
            </Card>
          );
        })}
      </div>

      {carePlans.length > 0 && (
        <section>
          <div className="mb-4 flex items-center gap-2">
            <Wrench size={16} className="text-subtle" />
            <h2 className="text-[17px] font-semibold tracking-tight">After launch: care plans</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {carePlans.map((c) => (
              <Card key={c.name} className="p-4">
                <div className="text-[13.5px] font-semibold">{c.name}</div>
                <div className="mt-1 text-[20px] font-semibold tabular-nums">{inr(c.monthly)}<span className="text-[12px] font-normal text-subtle">/mo</span></div>
                <div className="text-[12px] text-muted">Up to {c.hours}h support</div>
                <p className="mt-2 text-[12.5px] leading-relaxed text-muted">{c.desc}</p>
              </Card>
            ))}
          </div>
        </section>
      )}

      <p className="text-[12px] text-subtle">Prices exclude GST. Third-party costs (hosting, domains, paid plugins, APIs) are billed separately.</p>
    </div>
  );
}
