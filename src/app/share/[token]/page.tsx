"use client";
import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { QuoteDocument, ProposalDocument, DocToolbar, type StudioInfo, type ClientInfo } from "@/components/documents";
import { Btn } from "@/components/ui";
import { Printer, FileX2 } from "lucide-react";
import type { Policy, Proposal, Quote } from "@/lib/types";

type Payload =
  | { kind: "quote"; quote: Quote; client: ClientInfo | null; studio: StudioInfo; policies: Policy[] }
  | { kind: "proposal"; proposal: Proposal; studio: StudioInfo };

export default function SharedDocumentPage() {
  const { token } = useParams<{ token: string }>();
  const [doc, setDoc] = useState<Payload | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetch(`/api/share/${token}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: Payload) => {
        setDoc(d);
        document.title = d.kind === "quote" ? `Quotation ${d.quote.no} — ${d.studio.studio}` : `${d.proposal.title} — ${d.studio.studio}`;
      })
      .catch(() => setFailed(true));
  }, [token]);

  if (failed) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-surface-2 text-muted"><FileX2 size={20} /></div>
        <h1 className="text-[18px] font-semibold">This link isn&apos;t available</h1>
        <p className="max-w-sm text-[13.5px] text-muted">It may have expired or been turned off. Please ask the sender for a new link.</p>
      </div>
    );
  }
  if (!doc) return <div className="flex min-h-screen items-center justify-center text-[13px] text-muted">Loading…</div>;

  return (
    <div className="min-h-screen bg-bg pb-16 print:bg-white print:pb-0">
      <DocToolbar>
        <span className="text-[13.5px] font-medium">{doc.studio.studio}</span>
        <span className="text-[13px] text-subtle">· {doc.kind === "quote" ? "Quotation" : "Proposal"}</span>
        <Btn className="ml-auto" onClick={() => window.print()}><Printer size={14} /> Download PDF</Btn>
      </DocToolbar>
      <div className="mt-8 px-4 print:mt-0 print:px-0">
        {doc.kind === "quote"
          ? <QuoteDocument quote={doc.quote} client={doc.client} studio={doc.studio} policies={doc.policies} />
          : <ProposalDocument proposal={doc.proposal} studio={doc.studio} />}
      </div>
    </div>
  );
}
