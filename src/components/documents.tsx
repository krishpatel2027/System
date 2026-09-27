"use client";
import React from "react";
import { inr, quoteTotals } from "@/lib/utils";
import type { Client, Policy, Proposal, Quote, Settings } from "@/lib/types";

// Client-facing documents. Rendered with fixed light colours (not theme
// tokens) so they look identical on screen, in dark mode, and when printed.

export type StudioInfo = Pick<Settings, "studio" | "email" | "phone" | "website" | "address" | "gstin" | "upi" | "bank">;
export type ClientInfo = Pick<Client, "company" | "contactName" | "email" | "phone" | "location">;

export const fmtDate = (iso?: string) =>
  iso ? new Date(iso + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }) : "—";

const LABEL = "text-[11px] font-semibold uppercase tracking-[0.12em] text-[#9b9ba3]";

function Paper({ children }: { children: React.ReactNode }) {
  return (
    <article className="animate-fade-up mx-auto max-w-[860px] overflow-hidden rounded-2xl border border-[#e8e7e3] bg-white text-[#141417] shadow-[0_30px_80px_-40px_rgba(20,20,23,0.35)] print:rounded-none print:border-0 print:shadow-none">
      <div className="h-1.5 bg-gradient-to-r from-[#4f46e5] via-[#7c6cf2] to-[#b8a9ff]" />
      <div className="px-6 py-10 sm:px-12">{children}</div>
    </article>
  );
}

function Letterhead({ studio, kind, number }: { studio: StudioInfo; kind: string; number?: string }) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-6">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#141417] text-[17px] font-bold text-white">{(studio.studio || "A")[0]}</div>
        <div>
          <div className="text-[18px] font-semibold tracking-tight">{studio.studio}</div>
          <div className="text-[12.5px] text-[#676770]">{[studio.email, studio.phone, studio.website].filter(Boolean).join(" · ")}</div>
          {(studio.address || studio.gstin) && <div className="text-[12px] text-[#9b9ba3]">{[studio.address, studio.gstin && `GSTIN ${studio.gstin}`].filter(Boolean).join(" · ")}</div>}
        </div>
      </div>
      <div className="text-right">
        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#4f46e5]">{kind}</div>
        {number && <div className="mt-1 font-mono text-[15px] font-medium">{number}</div>}
      </div>
    </header>
  );
}

function PaymentDetails({ studio, terms }: { studio: StudioInfo; terms?: string }) {
  return (
    <section>
      <h3 className={LABEL}>Payment</h3>
      {terms && <p className="mt-2 text-[13px] leading-relaxed text-[#3d3d44]">{terms}</p>}
      {studio.upi && <p className="mt-2 text-[13px] text-[#3d3d44]">UPI: <span className="font-mono">{studio.upi}</span></p>}
      {studio.bank && <p className="mt-2 whitespace-pre-line text-[12.5px] leading-relaxed text-[#3d3d44]">{studio.bank}</p>}
    </section>
  );
}

function Signatures({ studio }: { studio: StudioInfo }) {
  return (
    <div className="mt-12 grid gap-10 sm:grid-cols-2">
      {["Accepted by (client)", `For ${studio.studio}`].map((label) => (
        <div key={label}>
          <div className="h-10 border-b border-[#d9d8d3]" />
          <div className="mt-2 text-[12px] text-[#9b9ba3]">{label} · Signature & date</div>
        </div>
      ))}
    </div>
  );
}

export function QuoteDocument({ quote, client, studio, policies }: { quote: Quote; client: ClientInfo | null; studio: StudioInfo; policies: Policy[] }) {
  const t = quoteTotals(quote);
  const terms = policies.filter((p) => p.onQuotes);
  return (
    <Paper>
      <Letterhead studio={studio} kind="Quotation" number={quote.no} />

      <div className="mt-10 grid gap-6 border-y border-[#ecebe7] py-6 sm:grid-cols-3">
        <div>
          <div className={LABEL}>Prepared for</div>
          <div className="mt-1.5 text-[15px] font-semibold">{quote.clientName}</div>
          {client && <div className="mt-0.5 text-[12.5px] leading-relaxed text-[#676770]">{[client.contactName !== "—" ? client.contactName : "", client.email, client.phone, client.location].filter(Boolean).join(" · ")}</div>}
        </div>
        <div><div className={LABEL}>Issued</div><div className="mt-1.5 text-[14px]">{fmtDate(quote.created)}</div></div>
        <div><div className={LABEL}>Valid until</div><div className="mt-1.5 text-[14px]">{fmtDate(quote.validUntil)}</div></div>
      </div>

      <div className="mt-8 overflow-x-auto">
        <table className="w-full min-w-[520px] text-[13.5px]">
          <thead>
            <tr className={`text-left ${LABEL}`}>
              <th className="pb-3 font-semibold">Deliverable</th>
              <th className="w-16 pb-3 text-right font-semibold">Qty</th>
              <th className="w-28 pb-3 text-right font-semibold">Rate</th>
              <th className="w-32 pb-3 text-right font-semibold">Amount</th>
            </tr>
          </thead>
          <tbody>
            {quote.items.map((i, n) => (
              <tr key={i.id} className="border-t border-[#ecebe7] align-top">
                <td className="py-3.5 pr-4"><span className="mr-3 text-[12px] tabular-nums text-[#9b9ba3]">{String(n + 1).padStart(2, "0")}</span>{i.label}</td>
                <td className="py-3.5 text-right tabular-nums text-[#676770]">{i.qty}</td>
                <td className="py-3.5 text-right tabular-nums text-[#676770]">{inr(i.price)}</td>
                <td className="py-3.5 text-right font-medium tabular-nums">{inr(i.qty * i.price)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-2 flex justify-end border-t border-[#ecebe7] pt-4">
        <div className="w-full max-w-[300px] space-y-1.5 text-[13.5px]">
          <Row k="Subtotal" v={inr(t.subtotal)} />
          {t.discount > 0 && <Row k="Discount" v={`− ${inr(t.discount)}`} />}
          {quote.taxPct > 0 && <Row k={`GST (${quote.taxPct}%)`} v={inr(t.tax)} />}
          <div className="mt-3 flex items-baseline justify-between rounded-xl bg-[#f4f3ff] px-4 py-3">
            <span className="text-[13px] font-medium text-[#4f46e5]">Total investment</span>
            <span className="text-[22px] font-semibold tracking-tight tabular-nums">{inr(t.total)}</span>
          </div>
          {quote.taxPct === 0 && <div className="pt-1 text-right text-[11.5px] text-[#9b9ba3]">GST extra as applicable</div>}
        </div>
      </div>

      <div className="mt-10 grid gap-8 sm:grid-cols-2">
        <PaymentDetails studio={studio} terms={quote.notes} />
        {terms.length > 0 && (
          <section>
            <h3 className={LABEL}>Terms</h3>
            <ul className="mt-2 space-y-1.5 text-[12.5px] leading-relaxed text-[#3d3d44]">
              {terms.map((p) => <li key={p.policy} className="flex gap-2"><span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-[#9b9ba3]" />{p.client}</li>)}
            </ul>
          </section>
        )}
      </div>

      <Signatures studio={studio} />
      <footer className="mt-12 border-t border-[#ecebe7] pt-6 text-center text-[12.5px] text-[#9b9ba3]">
        Thank you for considering {studio.studio}.{studio.email ? ` Questions? Write to ${studio.email} — we're happy to walk you through it.` : ""}
      </footer>
    </Paper>
  );
}

export function ProposalDocument({ proposal: p, studio }: { proposal: Proposal; studio: StudioInfo }) {
  const sections: [string, React.ReactNode][] = [
    ["Our understanding", p.understanding],
    ["The opportunity", p.opportunity],
    ["Approach", p.approach.length > 0 && <ol className="flex flex-wrap gap-2">{p.approach.map((a, i) => <li key={a + i} className="rounded-full border border-[#e8e7e3] px-3 py-1 text-[12.5px]"><span className="mr-1.5 text-[#9b9ba3]">{i + 1}</span>{a}</li>)}</ol>],
    ["Proposed solution", p.solution],
    ["Sitemap", p.sitemap.length > 0 && <div className="flex flex-wrap gap-2">{p.sitemap.map((s) => <span key={s} className="rounded-lg bg-[#f5f5f3] px-2.5 py-1 text-[12.5px]">{s}</span>)}</div>],
    ["Design direction", p.designDirection],
    ["Deliverables", p.deliverables.length > 0 && <ul className="grid gap-1.5 sm:grid-cols-2">{p.deliverables.map((d) => <li key={d} className="flex gap-2 text-[13.5px]"><span className="text-[#4f46e5]">✓</span>{d}</li>)}</ul>],
    ["Timeline", p.timeline],
  ];
  const total = p.paymentPlan.reduce((a, x) => a + x.pct, 0);
  return (
    <Paper>
      <Letterhead studio={studio} kind="Proposal" />
      <div className="mt-12">
        <div className={LABEL}>Prepared for {p.clientName} · {fmtDate(p.created)}</div>
        <h1 className="mt-3 text-[32px] font-semibold leading-tight tracking-[-0.02em] sm:text-[38px]">{p.title}</h1>
      </div>

      <div className="mt-10 space-y-8">
        {sections.filter(([, body]) => body).map(([h, body], i) => (
          <section key={h} className="grid gap-2 border-t border-[#ecebe7] pt-6 sm:grid-cols-[180px_1fr] sm:gap-8">
            <h2 className="text-[13px] font-semibold"><span className="mr-2 tabular-nums text-[#9b9ba3]">{String(i + 1).padStart(2, "0")}</span>{h}</h2>
            <div className="text-[14px] leading-relaxed text-[#3d3d44]">{body}</div>
          </section>
        ))}

        <section className="grid gap-2 border-t border-[#ecebe7] pt-6 sm:grid-cols-[180px_1fr] sm:gap-8">
          <h2 className="text-[13px] font-semibold">Investment</h2>
          <div>
            <div className="flex items-baseline justify-between rounded-xl bg-[#f4f3ff] px-5 py-4">
              <span className="text-[13px] font-medium text-[#4f46e5]">Total investment</span>
              <span className="text-[26px] font-semibold tracking-tight tabular-nums">{inr(p.investment)}</span>
            </div>
            {p.paymentPlan.length > 0 && (
              <div className="mt-3 divide-y divide-[#ecebe7] rounded-xl border border-[#ecebe7]">
                {p.paymentPlan.map((x) => (
                  <div key={x.label} className="flex items-center justify-between px-4 py-2.5 text-[13px]">
                    <span>{x.label} <span className="text-[#9b9ba3]">· {x.pct}%</span></span>
                    <span className="tabular-nums">{inr((p.investment * x.pct) / 100)}</span>
                  </div>
                ))}
              </div>
            )}
            {total !== 100 && p.paymentPlan.length > 0 && <p className="mt-2 text-[12px] text-[#b45309]">Payment plan adds up to {total}%.</p>}
            <p className="mt-2 text-[12px] text-[#9b9ba3]">GST extra as applicable.</p>
          </div>
        </section>

        {p.terms && (
          <section className="grid gap-2 border-t border-[#ecebe7] pt-6 sm:grid-cols-[180px_1fr] sm:gap-8">
            <h2 className="text-[13px] font-semibold">Terms & next steps</h2>
            <p className="whitespace-pre-line text-[14px] leading-relaxed text-[#3d3d44]">{p.terms}</p>
          </section>
        )}
      </div>

      <div className="mt-10 grid gap-8 border-t border-[#ecebe7] pt-6 sm:grid-cols-2">
        <PaymentDetails studio={studio} />
      </div>
      <Signatures studio={studio} />
    </Paper>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return <div className="flex justify-between text-[#676770]"><span>{k}</span><span className="tabular-nums text-[#141417]">{v}</span></div>;
}

export function DocToolbar({ children }: { children: React.ReactNode }) {
  return (
    <div className="no-print sticky top-0 z-20 border-b border-line bg-bg/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-[860px] flex-wrap items-center gap-2 px-4 py-3 sm:px-6">{children}</div>
    </div>
  );
}
