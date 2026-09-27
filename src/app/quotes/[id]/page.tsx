"use client";
import React, { useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useDB } from "@/lib/store";
import { quoteTone } from "@/lib/stages";
import { Badge, Btn } from "@/components/ui";
import { QuoteDocument, DocToolbar } from "@/components/documents";
import { ShareButton, DocMissing, DocLoading, StatusSelect } from "@/components/doc-actions";
import { ArrowLeft, Printer, Check, Pencil, Trash2 } from "lucide-react";
import type { Quote } from "@/lib/types";

const STATUSES: Quote["status"][] = ["draft", "sent", "accepted", "rejected", "expired"];

export default function QuoteDocumentPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { db, ready, update } = useDB();
  const quote = db.quotes.find((q) => q.id === id);

  useEffect(() => {
    if (quote) document.title = `Quotation ${quote.no} — ${quote.clientName}`;
  }, [quote]);

  if (!ready) return <DocLoading />;
  if (!quote) return <DocMissing kind="Quote" back="/quotes" />;

  const patch = (p: Partial<Quote>) => update("quotes", db.quotes.map((q) => (q.id === quote.id ? { ...q, ...p } : q)));
  const client = db.clients.find((c) => c.id === quote.clientId || c.company === quote.clientName) ?? null;
  const remove = () => {
    if (!confirm(`Delete quotation ${quote.no}? This can't be undone.`)) return;
    update("quotes", db.quotes.filter((q) => q.id !== quote.id));
    router.push("/quotes");
  };

  return (
    <div className="min-h-screen bg-bg pb-16 print:bg-white print:pb-0">
      <DocToolbar>
        <Link href="/quotes" className="inline-flex h-9 items-center gap-1.5 rounded-xl px-2.5 text-[13.5px] font-medium text-muted hover:bg-surface-2 hover:text-ink"><ArrowLeft size={15} /> Quotes</Link>
        <Badge tone={quoteTone(quote.status)} dot>{quote.status}</Badge>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <StatusSelect value={quote.status} options={STATUSES} onChange={(status) => patch({ status })} />
          <Btn variant="ghost" onClick={() => router.push(`/quotes?edit=${quote.id}`)}><Pencil size={14} /> Edit</Btn>
          {quote.status !== "accepted" && <Btn variant="outline" onClick={() => patch({ status: "accepted" })}><Check size={14} /> Mark accepted</Btn>}
          <ShareButton token={quote.shareToken} onChange={(shareToken) => patch({ shareToken })} />
          <Btn onClick={() => window.print()}><Printer size={14} /> PDF</Btn>
          <Btn variant="ghost" onClick={remove} title="Delete quote" className="px-2.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-950"><Trash2 size={14} /></Btn>
        </div>
      </DocToolbar>
      <div className="mt-8 px-4 print:mt-0 print:px-0">
        <QuoteDocument quote={quote} client={client} studio={db.settings} policies={db.pricing.policies} />
      </div>
    </div>
  );
}
