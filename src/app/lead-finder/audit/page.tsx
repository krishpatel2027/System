"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Gauge, Plus, ScanSearch } from "lucide-react";
import { useDB } from "@/lib/store";
import type { Prospect } from "@/lib/types";
import { INDUSTRIES } from "@/lib/leadfinder/catalog";
import { evaluate } from "@/lib/leadfinder/engine";
import { newProspect } from "@/lib/leadfinder/prospect";
import { miniAudit } from "@/lib/leadfinder/outreach";
import { DedupeIndex } from "@/lib/leadfinder/dedupe";
import { analyzeUrl, applyAudit, useFinderStatus } from "@/lib/leadfinder/client";
import { cn } from "@/lib/utils";
import { Btn, Card, CardHeader, Field, inputCls, PageHeader } from "@/components/ui";
import { AuditView, FinderTabs, OpportunityCard, WebsiteBadge } from "@/components/leadfinder";

export default function AuditPage() {
  const { db, mutate } = useDB();
  const router = useRouter();
  const { status } = useFinderStatus();
  const [url, setUrl] = useState("");
  const [ps, setPs] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<Prospect | null>(null);
  const [meta, setMeta] = useState({ name: "", industry: "", city: "" });
  const [copied, setCopied] = useState(false);
  const pagespeedOn = !!status?.integrations.find((i) => i.id === "pagespeed")?.connected;

  const run = async () => {
    if (!url.trim()) return;
    setBusy(true); setErr(null); setResult(null);
    try {
      const audit = await analyzeUrl(url.trim(), ps && pagespeedOn);
      let host = url.trim();
      try { host = new URL(audit.finalUrl ?? audit.url).hostname.replace(/^www\./, ""); } catch {}
      const name = audit.found.title?.split(/[|–—-]/)[0].trim() || host;
      const p = evaluate(applyAudit(newProspect({ name, industry: "", website: audit.finalUrl ?? audit.url, socials: {} }, "manual"), audit), db.services, db.finder.scoring);
      setResult(p);
      setMeta({ name, industry: "", city: "" });
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const existing = result ? new DedupeIndex(db.prospects).find({ ...result, name: "" }) : undefined;

  const save = () => {
    if (!result) return;
    if (existing) return router.push(`/lead-finder/${existing}`);
    const p = evaluate({ ...result, name: meta.name.trim() || result.name, industry: meta.industry.trim(), city: meta.city.trim() || undefined }, db.services, db.finder.scoring);
    p.provenance = { ...p.provenance, name: { source: "manual", confidence: "verified" } };
    mutate((d) => ({ prospects: [p, ...d.prospects] }));
    router.push(`/lead-finder/${p.id}`);
  };

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Lead Finder" title="Website auditor" description="Paste any business website. Get the issues, the evidence, the opportunity and the service that fits — in seconds." />
      <FinderTabs />

      <Card className="p-5">
        <form onSubmit={(e) => { e.preventDefault(); void run(); }} className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <ScanSearch size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-subtle" />
            <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="businesswebsite.in" className={cn(inputCls, "h-11 rounded-2xl pl-10 text-[15px]")} autoFocus />
          </div>
          <Btn type="submit" variant="accent" disabled={busy || !url.trim()} className="h-11 px-5">{busy ? "Analyzing…" : "Analyze website"}</Btn>
        </form>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-[12.5px] text-muted">
          <label className={cn("flex items-center gap-2", !pagespeedOn && "opacity-50")} title={pagespeedOn ? "" : "Set GOOGLE_PAGESPEED_API_KEY to enable"}>
            <input type="checkbox" disabled={!pagespeedOn} checked={ps && pagespeedOn} onChange={(e) => setPs(e.target.checked)} className="accent-[var(--accent)]" />
            <Gauge size={13} /> Include Google PageSpeed (mobile, ~30s)
          </label>
          <span className="text-subtle">Reads the public homepage only and respects robots.txt.</span>
        </div>
        {err && <div className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-[13px] text-red-700 dark:bg-red-950/50 dark:text-red-300">{err}</div>}
      </Card>

      {busy && <Card className="p-8"><div className="mx-auto max-w-sm space-y-3">{["Fetching homepage", "Checking mobile & speed", "Reading SEO & contact options"].map((t, i) => <div key={t} className="flex items-center gap-3 text-[13px] text-muted"><span className="h-2 w-2 animate-pulse rounded-full bg-accent" style={{ animationDelay: `${i * 200}ms` }} />{t}</div>)}</div></Card>}

      {result && (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="min-w-0 space-y-6 lg:col-span-2">
            <Card>
              <CardHeader title={result.audit?.found.title || result.name} sub={<span className="inline-flex items-center gap-2">{result.website}<WebsiteBadge status={result.websiteStatus} /></span>} />
              <div className="p-5"><AuditView p={result} /></div>
            </Card>
            <Card>
              <CardHeader title="30-second mini audit" action={<Btn size="sm" variant="outline" onClick={() => { void navigator.clipboard?.writeText(miniAudit(result)); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>{copied ? <Check size={13} /> : <Copy size={13} />} {copied ? "Copied" : "Copy"}</Btn>} />
              <pre className="m-5 mt-3 whitespace-pre-wrap rounded-xl bg-surface-2 p-4 font-sans text-[13px] leading-relaxed">{miniAudit(result)}</pre>
            </Card>
          </div>
          <div className="space-y-6">
            <OpportunityCard p={result} compact />
            <Card className="p-5">
              <div className="text-[14px] font-semibold">{existing ? "Already in your database" : "Save as a lead"}</div>
              {existing ? (
                <p className="mt-1 text-[13px] text-muted">This website matches a business you&apos;ve already saved.</p>
              ) : (
                <div className="mt-3 space-y-3">
                  <Field label="Business name"><input className={inputCls} value={meta.name} onChange={(e) => setMeta({ ...meta, name: e.target.value })} /></Field>
                  <Field label="Industry"><input list="aud-ind" className={inputCls} value={meta.industry} onChange={(e) => setMeta({ ...meta, industry: e.target.value })} /><datalist id="aud-ind">{INDUSTRIES.map((i) => <option key={i} value={i} />)}</datalist></Field>
                  <Field label="City"><input className={inputCls} value={meta.city} onChange={(e) => setMeta({ ...meta, city: e.target.value })} /></Field>
                </div>
              )}
              <Btn className="mt-4 w-full" onClick={save}>{existing ? "Open lead" : <><Plus size={14} /> Save to lead database</>}</Btn>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
