"use client";
import React, { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useDB } from "@/lib/store";
import { inr, uid, todayISO } from "@/lib/utils";
import { Card, Badge, Btn, Empty, Modal, Field, inputCls } from "@/components/ui";
import { Plus, Printer } from "lucide-react";
import type { Proposal } from "@/lib/types";

function ProposalsInner() {
  const { db, update } = useDB();
  const params = useSearchParams();
  const [open, setOpen] = useState(params.get("action") === "new");
  const [view, setView] = useState<Proposal | null>(null);
  const [form, setForm] = useState({ clientName: db.clients[0]?.company ?? "ABC Properties", investment: 35000 });

  const save = () => {
    const tpl: Proposal = {
      id: uid("pr"), clientName: form.clientName, title: "Growth Website + Lead Engine",
      understanding: "Current presence is slow and generates no tracked enquiries.",
      opportunity: "A fast premium site with clear CTAs can lift bookings + credibility.",
      approach: ["Discover", "Direction", "Design", "Build", "Launch"],
      solution: "Custom 6-page build + CMS + lead system.",
      sitemap: ["Home", "Projects", "Project Detail", "About", "Contact"],
      designDirection: "Editorial, warm neutrals, large imagery, subtle motion.",
      deliverables: ["Custom UI/UX", "Responsive build", "CMS", "Lead forms + WhatsApp", "SEO", "Analytics"],
      timeline: "Week 1 Discovery · Week 2 UI · Week 3 Build · Week 4 QA + Launch",
      investment: form.investment,
      paymentPlan: [{ label: "Project commencement", pct: 50 }, { label: "Development milestone", pct: 30 }, { label: "Final approval", pct: 20 }],
      terms: "2 revision rounds per stage. Content by client. Hosting billed separately.",
      status: "sent", created: todayISO(),
    };
    update("proposals", [tpl, ...db.proposals]);
    setOpen(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><h1 className="text-[22px] font-semibold tracking-tight">Proposals</h1><p className="text-[13px] text-neutral-500">12-page narrative: cover → terms</p></div>
        <Btn onClick={() => setOpen(true)}><Plus size={15} /> New Proposal</Btn>
      </div>
      {db.proposals.length === 0 && <Empty title="No proposals yet" sub="Turn a quote into a story the client can say yes to." action={<Btn onClick={() => setOpen(true)}>+ New Proposal</Btn>} />}
      <div className="grid gap-3 md:grid-cols-2">
        {db.proposals.map((p) => (
          <Card key={p.id} className="cursor-pointer p-5" >
            <div onClick={() => setView(p)}>
              <div className="flex items-center justify-between"><span className="text-[15px] font-semibold">Arkria × {p.clientName}</span><Badge tone={p.status === "accepted" ? "green" : p.status === "sent" ? "amber" : "neutral"}>{p.status}</Badge></div>
              <div className="text-[13px] text-neutral-500">{p.title} · {p.created}</div>
              <div className="mt-2 text-[18px] font-semibold">{inr(p.investment)}</div>
            </div>
          </Card>
        ))}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="New Proposal">
        <div className="grid gap-3">
          <Field label="Client"><input className={inputCls} value={form.clientName} onChange={(e) => setForm({ ...form, clientName: e.target.value })} /></Field>
          <Field label="Investment (₹)"><input type="number" className={inputCls} value={form.investment} onChange={(e) => setForm({ ...form, investment: Number(e.target.value) })} /></Field>
          <p className="text-[13px] text-neutral-500">Generates full 12-section doc: Understanding → Opportunity → Approach → Solution → Sitemap → Design → Deliverables → Timeline → Investment → Payment → Terms.</p>
        </div>
        <div className="mt-4 flex justify-end gap-2"><Btn variant="ghost" onClick={() => setOpen(false)}>Cancel</Btn><Btn onClick={save}>Generate</Btn></div>
      </Modal>

      <Modal open={!!view} onClose={() => setView(null)} title={view ? `Arkria × ${view.clientName}` : ""} wide>
        {view && (
          <div className="space-y-4 text-[13.5px]">
            <div className="flex justify-between"><Badge>{view.status}</Badge><Btn variant="outline" onClick={() => window.print()}><Printer size={14} /> Export PDF</Btn></div>
            {[
              ["1 · Understanding", view.understanding],
              ["2 · Opportunity", view.opportunity],
              ["3 · Our Approach", view.approach.join(" → ")],
              ["4 · Proposed Solution", view.solution],
              ["5 · Sitemap", view.sitemap.join(" · ")],
              ["6 · Design Direction", view.designDirection],
              ["7 · Features & Deliverables", view.deliverables.join(" · ")],
              ["8 · Timeline", view.timeline],
              ["9 · Investment", inr(view.investment)],
              ["10 · Payment Structure", view.paymentPlan.map((p) => `${p.pct}% — ${p.label}`).join(" · ")],
              ["11 · Terms & Next Steps", view.terms],
            ].map(([h, b]) => (
              <div key={h as string}><div className="text-[12px] font-semibold uppercase tracking-wide text-neutral-400">{h}</div><div className="mt-0.5">{b}</div></div>
            ))}
            <div className="flex gap-2">
              {(["sent", "accepted", "rejected"] as const).map((s) => (
                <Btn key={s} variant={view.status === s ? "primary" : "outline"} onClick={() => { update("proposals", db.proposals.map((x) => (x.id === view.id ? { ...x, status: s } : x))); setView({ ...view, status: s }); }}>{s}</Btn>
              ))}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
export default function ProposalsPage() { return <Suspense><ProposalsInner /></Suspense>; }
