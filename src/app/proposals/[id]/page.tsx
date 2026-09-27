"use client";
import React, { useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useDB } from "@/lib/store";
import { proposalTone } from "@/lib/stages";
import { Badge, Btn } from "@/components/ui";
import { ProposalDocument, DocToolbar } from "@/components/documents";
import { ShareButton, DocMissing, DocLoading, StatusSelect } from "@/components/doc-actions";
import { ArrowLeft, Printer, Check, Pencil, Trash2 } from "lucide-react";
import type { Proposal } from "@/lib/types";

const STATUSES: Proposal["status"][] = ["draft", "sent", "accepted", "rejected"];

export default function ProposalDocumentPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { db, ready, update } = useDB();
  const proposal = db.proposals.find((p) => p.id === id);

  useEffect(() => {
    if (proposal) document.title = `${proposal.title} — ${proposal.clientName}`;
  }, [proposal]);

  if (!ready) return <DocLoading />;
  if (!proposal) return <DocMissing kind="Proposal" back="/proposals" />;

  const patch = (p: Partial<Proposal>) => update("proposals", db.proposals.map((x) => (x.id === proposal.id ? { ...x, ...p } : x)));
  const remove = () => {
    if (!confirm(`Delete "${proposal.title}"? This can't be undone.`)) return;
    update("proposals", db.proposals.filter((x) => x.id !== proposal.id));
    router.push("/proposals");
  };

  return (
    <div className="min-h-screen bg-bg pb-16 print:bg-white print:pb-0">
      <DocToolbar>
        <Link href="/proposals" className="inline-flex h-9 items-center gap-1.5 rounded-xl px-2.5 text-[13.5px] font-medium text-muted hover:bg-surface-2 hover:text-ink"><ArrowLeft size={15} /> Proposals</Link>
        <Badge tone={proposalTone(proposal.status)} dot>{proposal.status}</Badge>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <StatusSelect value={proposal.status} options={STATUSES} onChange={(status) => patch({ status })} />
          <Btn variant="ghost" onClick={() => router.push(`/proposals?edit=${proposal.id}`)}><Pencil size={14} /> Edit</Btn>
          {proposal.status !== "accepted" && <Btn variant="outline" onClick={() => patch({ status: "accepted" })}><Check size={14} /> Mark accepted</Btn>}
          <ShareButton token={proposal.shareToken} onChange={(shareToken) => patch({ shareToken })} />
          <Btn onClick={() => window.print()}><Printer size={14} /> PDF</Btn>
          <Btn variant="ghost" onClick={remove} title="Delete proposal" className="px-2.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-950"><Trash2 size={14} /></Btn>
        </div>
      </DocToolbar>
      <div className="mt-8 px-4 print:mt-0 print:px-0">
        <ProposalDocument proposal={proposal} studio={db.settings} />
      </div>
    </div>
  );
}
