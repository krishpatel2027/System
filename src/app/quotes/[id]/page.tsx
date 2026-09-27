"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useDB } from "@/lib/store";
import { inr, quoteTotals } from "@/lib/utils";
import { quoteTone } from "@/lib/stages";
import { POLICIES } from "@/lib/pricing-data";
import { Badge, Btn } from "@/components/ui";
import { ArrowLeft, Printer, Link2, Check, FileX2 } from "lucide-react";
import type { Quote } from "@/lib/types";

const STATUSES: Quote["status"][] = ["draft", "sent", "accepted", "rejected", "expired"];
const TERMS = ["Revisions", "Scope changes", "Third-party costs", "Warranty", "Handover"];

const fmtDate = (iso?: string) =>
  iso ? new Date(iso + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }) : "—";

export default function QuoteDocumentPage() {
  const { id } = useParams<{ id: string }>();
  const { db, ready, update } = useDB();
  const [copied, setCopied] = useState(false);
  const quote = db.quotes.find((q) => q.id === id);

  useEffect(() => {
    if (quote) document.title = `Quotation ${quote.no} — ${quote.clientName}`;
  }, [quote]);

  if (!ready) return <div className="flex min-h-screen items-center justify-center text-[13px] text-muted">Loading quote…</div>;

  if (!quote) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-surface-2 text-muted"><FileX2 size={20} /></div>
        <h1 className="text-[18px] font-semibold">Quote not found</h1>
        <p className="max-w-sm text-[13.5px] text-muted">It may have been deleted, or it was created in a different browser that hasn&apos;t synced yet.</p>
        <Link href="/quotes" className="mt-2 text-[13.5px] font-medium text-accent hover:underline">Back to quotes</Link>
      </div>
    );
  }

  const t = quoteTotals(quote);
  const client = db.clients.find((c) => c.id === quote.clientId || c.company === quote.clientName);
  const s = db.settings;
  const setStatus = (status: Quote["status"]) => update("quotes", db.quotes.map((q) => (q.id === quote.id ? { ...q, status } : q)));
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {}
  };

  return (
    <div className="min-h-screen bg-bg pb-16 print:bg-white print:pb-0">
      <div className="no-print sticky top-0 z-20 border-b border-line bg-bg/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-[860px] flex-wrap items-center gap-2 px-4 py-3 sm:px-6">
          <Link href="/quotes" className="inline-flex h-9 items-center gap-1.5 rounded-xl px-2.5 text-[13.5px] font-medium text-muted hover:bg-surface-2 hover:text-ink"><ArrowLeft size={15} /> Quotes</Link>
          <Badge tone={quoteTone(quote.status)} dot>{quote.status}</Badge>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <select aria-label="Status" value={quote.status} onChange={(e) => setStatus(e.target.value as Quote["status"])}
              className="h-9 rounded-xl border border-line bg-surface px-2.5 text-[13px] capitalize outline-none focus:border-accent">
              {STATUSES.map((st) => <option key={st} value={st}>{st}</option>)}
            </select>
            <Btn variant="outline" onClick={copyLink}>{copied ? <Check size={14} /> : <Link2 size={14} />}{copied ? "Copied" : "Copy link"}</Btn>
            {quote.status !== "accepted" && <Btn variant="outline" onClick={() => setStatus("accepted")}><Check size={14} /> Mark accepted</Btn>}
            <Btn onClick={() => window.print()}><Printer size={14} /> Download PDF</Btn>
          </div>
        </div>
      </div>

      <article className="animate-fade-up mx-auto mt-8 max-w-[860px] overflow-hidden rounded-2xl border border-line bg-white text-[#141417] shadow-[0_30px_80px_-40px_rgba(20,20,23,0.35)] print:mt-0 print:rounded-none print:border-0 print:shadow-none">
        <div className="h-1.5 bg-gradient-to-r from-[#4f46e5] via-[#7c6cf2] to-[#b8a9ff]" />
        <div className="px-8 py-10 sm:px-12">
          <header className="flex flex-wrap items-start justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#141417] text-[17px] font-bold text-white">{(s.studio || "A")[0]}</div>
              <div>
                <div className="text-[18px] font-semibold tracking-tight">{s.studio || "Arkria"}</div>
                <div className="text-[12.5px] text-[#676770]">{[s.email, s.phone].filter(Boolean).join(" · ")}</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#4f46e5]">Quotation</div>
              <div className="mt-1 font-mono text-[15px] font-medium">{quote.no}</div>
            </div>
          </header>

          <div className="mt-10 grid gap-6 border-y border-[#ecebe7] py-6 sm:grid-cols-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#9b9ba3]">Prepared for</div>
              <div className="mt-1.5 text-[15px] font-semibold">{quote.clientName}</div>
              {client && <div className="mt-0.5 text-[12.5px] leading-relaxed text-[#676770]">{[client.contactName !== "—" ? client.contactName : "", client.email, client.phone, client.location].filter(Boolean).join(" · ")}</div>}
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#9b9ba3]">Issued</div>
              <div className="mt-1.5 text-[14px]">{fmtDate(quote.created)}</div>
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#9b9ba3]">Valid until</div>
              <div className="mt-1.5 text-[14px]">{fmtDate(quote.validUntil)}</div>
            </div>
          </div>

          <table className="mt-8 w-full text-[13.5px]">
            <thead>
              <tr className="text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-[#9b9ba3]">
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
            <section>
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#9b9ba3]">Payment</h3>
              <p className="mt-2 text-[13px] leading-relaxed text-[#3d3d44]">{quote.notes || "50% advance to begin · 30% at development milestone · 20% on launch."}</p>
              {s.upi && <p className="mt-2 text-[13px] text-[#3d3d44]">UPI: <span className="font-mono">{s.upi}</span></p>}
            </section>
            <section>
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#9b9ba3]">Terms</h3>
              <ul className="mt-2 space-y-1.5 text-[12.5px] leading-relaxed text-[#3d3d44]">
                {POLICIES.filter((p) => TERMS.includes(p.policy)).map((p) => (
                  <li key={p.policy} className="flex gap-2"><span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-[#9b9ba3]" />{p.client}</li>
                ))}
              </ul>
            </section>
          </div>

          <div className="mt-12 grid gap-10 sm:grid-cols-2">
            {["Accepted by (client)", `For ${s.studio || "Arkria"}`].map((label) => (
              <div key={label}>
                <div className="h-10 border-b border-[#d9d8d3]" />
                <div className="mt-2 text-[12px] text-[#9b9ba3]">{label} · Signature & date</div>
              </div>
            ))}
          </div>

          <footer className="mt-12 border-t border-[#ecebe7] pt-6 text-center text-[12.5px] text-[#9b9ba3]">
            Thank you for considering {s.studio || "Arkria"}. Questions? Reply to {s.email || "us"} — we&apos;re happy to walk you through it.
          </footer>
        </div>
      </article>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return <div className="flex justify-between text-[#676770]"><span>{k}</span><span className="tabular-nums text-[#141417]">{v}</span></div>;
}
