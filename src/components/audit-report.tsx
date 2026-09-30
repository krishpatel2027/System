"use client";
import React, { useMemo, useState } from "react";
import { ArrowDown, ArrowRight, Check, Minus, X } from "lucide-react";
import type { AuditRaw, AuditResult, Category, Finding, ScoreKey, Severity } from "@/lib/audit/types";
import type { CompareRow } from "@/lib/audit/engine/report";
import { CAT_SCORE, SCORE_KEYS, SCORE_LABEL } from "@/lib/audit/engine/report";
import type { SalesIntel } from "@/lib/audit/engine/opportunity";
import { cn, inr } from "@/lib/utils";
import { Badge, Card, Modal, Tabs } from "@/components/ui";
import { FindingCard, FindingList, Pill, ScoreCard, Section, SevBadge, Shot, SourceTag, catLabel, scoreTone } from "@/components/audit";

const kb = (b?: number) => (b === undefined ? "—" : b >= 1_000_000 ? `${(b / 1_000_000).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1000))} KB`);
const pathOf = (u: string) => { try { const x = new URL(u); return x.pathname + x.search || "/"; } catch { return u; } };
const inCats = (fs: Finding[], cats: Category[]) => fs.filter((f) => cats.includes(f.category));
const SEVS: Severity[] = ["critical", "high", "medium", "low", "info"];

export const OPP_LABEL: Partial<Record<ScoreKey, string>> = {
  conversion: "Conversion architecture", leadGeneration: "Lead capture", mobile: "Mobile experience", design: "Visual design & brand presentation",
  ux: "User experience", seo: "Search visibility", performance: "Speed & performance", trust: "Trust & credibility", content: "Content & messaging",
};
export function biggestOpportunity(r: AuditResult) {
  const keys = Object.keys(OPP_LABEL) as ScoreKey[];
  const k = keys.filter((x) => r.scores[x].score !== null).sort((a, b) => r.scores[a].score! - r.scores[b].score!)[0];
  return k ? { key: k, label: OPP_LABEL[k]!, score: r.scores[k].score! } : null;
}

export const TOC: { id: string; title: string }[] = [
  { id: "summary", title: "Executive summary" }, { id: "scores", title: "Overall scores" }, { id: "critical", title: "Critical findings" }, { id: "overview", title: "Website overview" },
  { id: "performance", title: "Performance" }, { id: "vitals", title: "Core Web Vitals" }, { id: "mobile", title: "Mobile" }, { id: "design", title: "UI / Visual design" },
  { id: "ux", title: "UX" }, { id: "conversion", title: "Conversion" }, { id: "leadgen", title: "Lead generation" }, { id: "seo", title: "SEO" }, { id: "local", title: "Local SEO" },
  { id: "content", title: "Content" }, { id: "trust", title: "Trust" }, { id: "a11y", title: "Accessibility" }, { id: "security", title: "Security" }, { id: "tech", title: "Technology" },
  { id: "images", title: "Images" }, { id: "fonts", title: "Fonts" }, { id: "js", title: "JavaScript" }, { id: "css", title: "CSS" }, { id: "pages", title: "Page-by-page" },
  { id: "issues", title: "All issues" }, { id: "quick", title: "Quick wins" }, { id: "impact", title: "High-impact improvements" }, { id: "competitors", title: "Competitor comparison" },
  { id: "opportunity", title: "Arkria opportunity" }, { id: "service", title: "Recommended service" }, { id: "internal", title: "Internal sales intelligence" }, { id: "client", title: "Client report" },
];

function KV({ rows }: { rows: [string, React.ReactNode][] }) {
  return (
    <dl className="divide-y divide-line rounded-2xl border border-line bg-surface">
      {rows.map(([k, v]) => <div key={k} className="grid grid-cols-[150px_1fr] gap-3 px-4 py-2.5 text-[13px] sm:grid-cols-[200px_1fr]"><dt className="text-muted">{k}</dt><dd className="break-words">{v}</dd></div>)}
    </dl>
  );
}

function Table({ head, rows, empty = "Nothing to show.", right = [] }: { head: string[]; rows: React.ReactNode[][]; empty?: string; right?: number[] }) {
  if (!rows.length) return <div className="rounded-xl bg-surface-2 px-4 py-3 text-[13px] text-muted">{empty}</div>;
  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
      <table className="w-full min-w-[560px] text-[12.5px]">
        <thead><tr className="border-b border-line bg-surface-2/60 text-left text-[11.5px] text-muted">{head.map((h, i) => <th key={h} className={cn("px-3 py-2 font-medium", right.includes(i) && "text-right")}>{h}</th>)}</tr></thead>
        <tbody className="divide-y divide-line">{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className={cn("px-3 py-2 align-top", right.includes(j) && "text-right tabular-nums")}>{c}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

const Note = ({ children }: { children: React.ReactNode }) => <div className="rounded-xl border border-dashed border-line-strong bg-surface-2/50 px-4 py-2.5 text-[12.5px] text-muted">{children}</div>;
const NotMeasured = ({ why }: { why: string }) => <Note><span className="font-semibold uppercase tracking-wide text-subtle">Not measured</span> — {why}</Note>;

export function Report({ r, raw, comparison, intel, onGotoClient }: { r: AuditResult; raw: AuditRaw; comparison: CompareRow[]; intel: SalesIntel; onGotoClient: () => void }) {
  const shots = raw.screenshots;
  const desk = raw.browser.find((b) => b.viewport === "desktop" && b.ok);
  const mob = raw.browser.find((b) => b.viewport === "mobile" && b.ok);
  const byScore = (k: ScoreKey) => r.issues.filter((f) => CAT_SCORE[f.category] === k);
  let n = 0;
  const N = () => ++n;
  const noBrowser = !raw.browserAvailable || (!desk && !mob);

  return (
    <div className="space-y-14">
      {/* 01 */}
      <Section n={N()} id="summary" title="Executive summary">
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="p-5">
            <div className="text-[12px] text-muted">Website quality</div>
            <div className="mt-1 text-[20px] font-semibold">{r.executive.quality}</div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div><div className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">Strengths</div><ul className="mt-1.5 space-y-1 text-[13px]">{(r.executive.strengths.length ? r.executive.strengths : ["No standout strengths detected"]).map((s) => <li key={s} className="flex gap-2"><Check size={14} className="mt-0.5 shrink-0 text-emerald-500" />{s}</li>)}</ul></div>
              <div><div className="text-[11px] font-semibold uppercase tracking-wide text-red-700 dark:text-red-400">Weaknesses</div><ul className="mt-1.5 space-y-1 text-[13px]">{r.executive.weaknesses.map((s) => <li key={s} className="flex gap-2"><X size={14} className="mt-0.5 shrink-0 text-red-500" />{s}</li>)}</ul></div>
            </div>
          </Card>
          <KV rows={[
            ["Biggest conversion opportunity", r.executive.conversion ?? "None detected"],
            ["Biggest technical issue", r.executive.technical ?? "None detected"],
            ["Biggest mobile issue", r.executive.mobile ?? (noBrowser ? "Not measured (no browser)" : "None detected")],
            ["Biggest SEO opportunity", r.executive.seo ?? "None detected"],
            ["Potential Arkria service", r.opportunity.recommended ? `${r.opportunity.recommended.name} — recommended for review` : "No strong match"],
          ]} />
        </div>
      </Section>

      {/* 02 */}
      <Section n={N()} id="scores" title="Overall scores" sub="Each score is 100 minus weighted deductions for specific findings. Hover a card for its basis.">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{SCORE_KEYS.map((k) => <ScoreCard key={k} k={k} cell={r.scores[k]} onClick={() => document.getElementById(k === "leadGeneration" ? "leadgen" : k === "accessibility" ? "a11y" : k === "technical" ? "tech" : k)?.scrollIntoView({ behavior: "smooth" })} />)}</div>
      </Section>

      {/* 03 */}
      <Section n={N()} id="critical" title="Critical findings" sub="Critical and high-severity issues">
        <FindingList items={r.issues.filter((i) => i.severity === "critical" || i.severity === "high")} shots={shots} empty="No critical or high-severity issues." />
      </Section>

      {/* 04 */}
      <Section n={N()} id="overview" title="Website overview">
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <KV rows={[...Object.entries(r.overview), ["Overall audit score", r.overallScore === null ? "Not enough data" : `${r.overallScore}/100`], ["Arkria opportunity score", `${r.opportunity.score}/100`]]} />
          <div className="space-y-3">
            <Shot src={desk?.screenshot ? shots[desk.screenshot] : undefined} alt="Homepage — desktop" className="aspect-[16/10]" />
            <div className="text-[12px] text-muted">Business type: <span className="text-ink">{r.business.label}</span> ({r.business.confidence}) — {r.business.evidence.join("; ")}</div>
          </div>
        </div>
      </Section>

      {/* 05 */}
      <Section n={N()} id="performance" title="Performance">
        {desk?.metrics && (
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[["Page weight", kb(desk.metrics.transferBytes)], ["Requests", String(desk.metrics.requests)], ["Third-party", `${kb(desk.metrics.thirdPartyBytes)} · ${desk.metrics.thirdPartyRequests} req`], ["DOM elements", String(desk.metrics.domNodes)],
              ["Images", kb(desk.metrics.byType.image?.bytes)], ["JavaScript", kb(desk.metrics.byType.script?.bytes)], ["CSS", kb(desk.metrics.byType.stylesheet?.bytes)], ["Fonts", kb(desk.metrics.byType.font?.bytes)]].map(([k, v]) => (
              <Card key={k} className="p-3.5"><div className="text-[11.5px] text-muted">{k}</div><div className="mt-0.5 text-[16px] font-semibold tabular-nums">{v}</div></Card>
            ))}
          </div>
        )}
        {raw.pagespeed?.ok && raw.pagespeed.scores && <div className="mb-4 flex flex-wrap gap-2 text-[12.5px]"><Badge tone="violet">Google PageSpeed (mobile)</Badge><Badge>Performance {raw.pagespeed.scores.performance}</Badge><Badge>SEO {raw.pagespeed.scores.seo}</Badge><Badge>Accessibility {raw.pagespeed.scores.accessibility}</Badge><Badge>Best practices {raw.pagespeed.scores.bestPractices}</Badge></div>}
        {raw.pagespeed && !raw.pagespeed.ok && <div className="mb-4"><Note>Google PageSpeed: {raw.pagespeed.error}</Note></div>}
        {noBrowser && <div className="mb-4"><NotMeasured why="page weight, requests and rendering need a browser on the server. Server timing and HTML checks were used." /></div>}
        <FindingList items={inCats(r.issues, ["performance"])} shots={shots} />
      </Section>

      {/* 06 */}
      <Section n={N()} id="vitals" title="Core Web Vitals" sub="Real-user data is used when Google has it; otherwise lab measurements, labelled by source. Nothing is estimated.">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {r.vitals.map((v) => (
            <Card key={v.key} className="p-4">
              <div className="text-[12px] font-medium text-muted">{v.label} <span className="uppercase text-subtle">({v.key})</span></div>
              <div className={cn("mt-1 text-[24px] font-semibold tabular-nums", v.rating === "good" ? "text-emerald-600 dark:text-emerald-400" : v.rating === "needs-improvement" ? "text-amber-600 dark:text-amber-400" : v.rating === "poor" ? "text-red-600 dark:text-red-400" : "text-subtle")}>
                {v.value === undefined ? "—" : v.key === "cls" ? v.value.toFixed(2) : v.value >= 1000 ? `${(v.value / 1000).toFixed(1)} s` : `${Math.round(v.value)} ms`}
              </div>
              <div className="mt-1"><Badge tone={v.rating === "good" ? "green" : v.rating === "needs-improvement" ? "amber" : v.rating === "poor" ? "red" : "neutral"}>{v.rating === "good" ? "Good" : v.rating === "needs-improvement" ? "Needs improvement" : v.rating === "poor" ? "Poor" : "Not measured"}</Badge></div>
              <div className="mt-2 text-[11px] leading-snug text-subtle">{v.source}</div>
            </Card>
          ))}
        </div>
        <div className="mt-4"><FindingList items={inCats(r.issues, ["vitals"])} shots={shots} empty="No Core Web Vitals problems among the metrics measured." /></div>
      </Section>

      {/* 07 */}
      <Section n={N()} id="mobile" title="Mobile" sub={<>Mobile experience: <span className={cn("font-semibold", r.mobileRating === "Poor" ? "text-red-600" : r.mobileRating === "Needs work" ? "text-amber-600" : "text-emerald-600")}>{r.mobileRating}</span></>}>
        <div className="grid gap-5 lg:grid-cols-[220px_1fr]">
          <div className="space-y-2">
            {mob?.screenshot ? <Shot src={shots[mob.screenshot]} alt="Homepage — mobile (390px)" className="aspect-[390/844]" /> : <NotMeasured why="no mobile render (browser unavailable)." />}
            {mob?.mobile && <div className="space-y-1 text-[12px] text-muted"><div>Overflow: {mob.mobile.overflowPx}px</div><div>Small text: {mob.mobile.smallText}</div><div>Small tap targets: {mob.mobile.tapSmall}</div><div>Sticky coverage: {Math.round(mob.mobile.fixedCoverage * 100)}%</div><div>Menu toggle: {mob.mobile.navToggle ? "yes" : "no"}</div></div>}
          </div>
          <div className="space-y-4">
            <FindingList items={inCats(r.issues, ["mobile"])} shots={shots} />
            {raw.breakpoints.length > 0 && (
              <div>
                <div className="mb-2 text-[13px] font-semibold">Responsive breakpoints</div>
                <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
                  {raw.breakpoints.map((b) => <div key={b.width} className={cn("rounded-xl border px-2 py-2 text-center", b.overflowPx > 5 ? "border-red-300 bg-red-50 dark:border-red-900 dark:bg-red-950/40" : "border-line bg-surface")}><div className="text-[12px] font-semibold tabular-nums">{b.width}px</div><div className={cn("text-[11px]", b.overflowPx > 5 ? "text-red-600" : "text-emerald-600")}>{b.overflowPx > 5 ? `+${b.overflowPx}px` : "OK"}</div></div>)}
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {raw.breakpoints.filter((b) => b.screenshot && shots[b.screenshot]).map((b) => <div key={b.width}><Shot src={shots[b.screenshot!]} alt={`${b.width}px`} className="aspect-[4/5]" /><div className="mt-1 text-center text-[11px] text-muted">{b.width}px{b.overflowPx > 5 ? ` · overflow ${b.overflowPx}px` : ""}</div></div>)}
                </div>
              </div>
            )}
          </div>
        </div>
      </Section>

      {/* 08 */}
      <Section n={N()} id="design" title="UI / Visual design" sub={r.scores.design.basis}>
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="space-y-4">
            <Card className="p-4">
              <div className="text-[13px] font-semibold">First impression</div>
              <ul className="mt-2 space-y-1.5 text-[13px]">{r.firstImpression.observations.map((o, i) => <li key={i} className="flex gap-2">{o.basis === "ai" ? <span className="mt-0.5 shrink-0 text-[10px] font-bold text-fuchsia-600">AI</span> : <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />}<span>{o.text}</span></li>)}</ul>
            </Card>
            {desk?.design ? (
              <Card className="space-y-3 p-4 text-[12.5px]">
                <div><span className="text-muted">Typefaces: </span>{desk.design.fontFamilies.slice(0, 5).map((f) => `${f.family} (${f.count})`).join(", ")}</div>
                <div><span className="text-muted">Type scale: </span>{desk.design.fontSizes.filter((s) => s.count >= 2).map((s) => `${s.size}px`).join(" · ")}</div>
                <div><span className="text-muted">H1 / body: </span>{desk.design.h1Size ?? "—"}px / {desk.design.bodySize ?? "—"}px · line-height ×{desk.design.lineHeightRatio ?? "—"}</div>
                <div className="flex flex-wrap items-center gap-1.5"><span className="text-muted">Text colours:</span>{desk.design.textColors.slice(0, 10).map((c) => <span key={c.color} title={c.color} className="h-4 w-4 rounded-full ring-1 ring-line" style={{ background: c.color }} />)}</div>
                <div className="flex flex-wrap items-center gap-1.5"><span className="text-muted">Section backgrounds:</span>{desk.design.bgColors.slice(0, 10).map((c) => <span key={c.color} title={c.color} className="h-4 w-6 rounded ring-1 ring-line" style={{ background: c.color }} />)}</div>
                <div><span className="text-muted">Button styles: </span>{desk.design.buttonStyles.length} ({desk.design.buttonStyles.slice(0, 3).map((b) => `"${b.sample}"`).join(", ")})</div>
                <div><span className="text-muted">Contrast (first screen): </span>{desk.design.contrastFails.length} of {desk.design.contrastChecked} text elements below WCAG AA</div>
              </Card>
            ) : <NotMeasured why="computed styles need a browser on the server." />}
          </div>
          <Shot src={desk?.screenshot ? shots[desk.screenshot] : undefined} alt="First screen — desktop" className="aspect-[16/10]" />
        </div>
        <div className="mt-4"><FindingList items={byScore("design")} shots={shots} /></div>
      </Section>

      {/* 09 */}
      <Section n={N()} id="ux" title="UX">
        <div className="mb-4 grid gap-3 md:grid-cols-3">
          {r.journeys.map((j) => (
            <Card key={j.name} className="p-4">
              <div className="text-[13px] font-semibold">{j.name}</div>
              <div className="mt-1 text-[12px] text-muted">{j.clicks === null ? "No path found" : j.clicks === 0 ? "On the homepage" : `${j.clicks} click${j.clicks === 1 ? "" : "s"} from the homepage`}</div>
              <ol className="mt-2 space-y-1 text-[12.5px]">{j.steps.map((s, i) => <li key={i} className="flex items-center gap-1.5">{i > 0 && <ArrowDown size={11} className="text-subtle" />}<span className="truncate">{s}</span></li>)}</ol>
              {j.friction.length > 0 && <ul className="mt-2 space-y-0.5 text-[12px] text-amber-700 dark:text-amber-400">{j.friction.map((x) => <li key={x}>• {x}</li>)}</ul>}
            </Card>
          ))}
        </div>
        <FindingList items={byScore("ux")} shots={shots} />
        <div className="mt-3"><Note>Loading, empty and error states, back navigation and modal behaviour need interactive testing and are <b>not verified</b> by this automated audit.</Note></div>
      </Section>

      {/* 10 */}
      <Section n={N()} id="conversion" title="Conversion">
        <FindingList items={inCats(r.issues, ["conversion", "business"])} shots={shots} />
        {r.ecommerce && <div className="mt-6"><div className="mb-2 text-[15px] font-semibold">E-commerce audit</div><FindingList items={inCats(r.issues, ["ecommerce"])} shots={shots} /><div className="mt-2"><Note>Cart and checkout pages are not entered by the auditor; checkout friction is <b>not verified</b>.</Note></div></div>}
      </Section>

      {/* 11 */}
      <Section n={N()} id="leadgen" title="Lead generation" sub="Can this website generate leads effectively?">
        <Card className="mb-4 flex flex-wrap items-center gap-4 p-5">
          <div className={cn("text-[28px] font-semibold", r.leadGen.verdict === "Yes" ? "text-emerald-600" : r.leadGen.verdict === "Partly" ? "text-amber-600" : "text-red-600")}>{r.leadGen.verdict}</div>
          <div className="flex flex-wrap gap-1.5">{["Tap-to-call phone", "WhatsApp", "Email", "Enquiry form", "Online booking", "Live chat / chat widget", "Newsletter"].map((c) => <Pill key={c} ok={r.leadGen.channels.includes(c)}>{c}</Pill>)}</div>
        </Card>
        {r.leadGen.opportunities.length > 0 && <Card className="mb-4 p-4"><div className="text-[13px] font-semibold">Lead generation opportunities</div><ol className="mt-2 list-decimal space-y-1 pl-5 text-[13px]">{r.leadGen.opportunities.map((o) => <li key={o}>{o}</li>)}</ol></Card>}
        <FindingList items={inCats(r.issues, ["leadGeneration", "forms"])} shots={shots} />
      </Section>

      {/* 12 */}
      <Section n={N()} id="seo" title="SEO">
        <FindingList items={inCats(r.issues, ["seo"])} shots={shots} />
      </Section>

      {/* 13 */}
      <Section n={N()} id="local" title="Local SEO" sub={r.localSeo.applicable ? `Local search opportunity: ${r.localSeo.rating === "Weak" ? "High (signals weak)" : r.localSeo.rating === "Fair" ? "Medium" : "Low (signals strong)"}` : "Not a local business — not applicable"}>
        {r.localSeo.applicable && <div className="mb-4 flex flex-wrap gap-1.5">{r.localSeo.present.map((x) => <Pill key={x} ok>{x}</Pill>)}{r.localSeo.missing.map((x) => <Pill key={x} ok={false}>{x}</Pill>)}</div>}
        <FindingList items={inCats(r.issues, ["localSeo"])} shots={shots} />
      </Section>

      {/* 14 */}
      <Section n={N()} id="content" title="Content">
        <Table head={["Question", "Answer", "Basis"]} rows={r.contentAnswers.map((a) => [a.question, a.answer, a.basis === "ai" ? <span key="b" className="text-[11px] font-semibold text-fuchsia-600">AI ANALYSIS</span> : a.basis === "detected" ? <span key="b" className="text-[11px] text-sky-600">Detected</span> : <span key="b" className="text-[11px] text-subtle">Not verified</span>])} />
        {raw.ai?.positioning && <div className="mt-3"><Note><span className="font-semibold text-fuchsia-600">AI ANALYSIS · Positioning:</span> {raw.ai.positioning}</Note></div>}
        <div className="mt-4"><FindingList items={byScore("content")} shots={shots} /></div>
      </Section>

      {/* 15 */}
      <Section n={N()} id="trust" title="Trust & credibility">
        <div className="mb-4 flex flex-wrap gap-1.5">
          {["Testimonials", "Reviews / ratings", "Case studies", "Portfolio / our work", "Client logos", "Certifications / registrations", "Awards", "Team", "Company history", "Guarantees", "Social profiles", "Privacy policy"].map((t) => <Pill key={t} ok={r.strengths.some((s) => s.category === "trust" && s.text === t)}>{t}</Pill>)}
        </div>
        <FindingList items={byScore("trust")} shots={shots} />
      </Section>

      {/* 16 */}
      <Section n={N()} id="a11y" title="Accessibility" sub={r.scores.accessibility.basis}>
        <div className="mb-4"><Note>These are <b>automated findings</b>. Automated tools catch only part of WCAG issues and can&apos;t confirm full compliance or non-compliance; keyboard use, focus order and screen-reader behaviour need manual testing.</Note></div>
        <FindingList items={byScore("accessibility")} shots={shots} />
      </Section>

      {/* 17 */}
      <Section n={N()} id="security" title="Security" sub="Passive, public checks only. No scanning or exploitation was attempted.">
        <div className="mb-4 flex flex-wrap gap-1.5">
          <Pill ok={raw.site.https}>HTTPS</Pill>
          <Pill ok={raw.site.tls ? raw.site.tls.valid : null}>Valid certificate</Pill>
          <Pill ok={raw.site.https ? raw.site.httpRedirectsToHttps : null}>HTTP → HTTPS redirect</Pill>
          {["strict-transport-security", "content-security-policy", "x-content-type-options", "referrer-policy", "permissions-policy", "x-frame-options"].map((h) => <Pill key={h} ok={Object.keys(raw.site.headers).some((k) => k.toLowerCase() === h)}>{h}</Pill>)}
        </div>
        <FindingList items={byScore("security")} shots={shots} />
      </Section>

      {/* 18 */}
      <Section n={N()} id="tech" title="Technology & technical quality" sub="Only technologies with a concrete signature are listed.">
        <Table head={["Technology", "Category", "Version", "Evidence"]} rows={r.technology.map((t) => [<span key="n" className="font-medium">{t.name}</span>, t.category, t.version ?? "—", <span key="e" className="text-muted">{t.evidence}</span>])} empty="No technology could be identified from public signals." />
        <div className="mt-4"><FindingList items={byScore("technical")} shots={shots} /></div>
      </Section>

      {/* 19 */}
      <Section n={N()} id="images" title="Images">
        {(mob?.images ?? desk?.images)?.length ? (
          <Table head={["Image", "Role", "Displayed", "File", "Size", "Format", "Alt", "Lazy"]} right={[4]} rows={(mob?.images ?? desk?.images ?? []).slice(0, 40).map((i) => [
            <span key="s" className="block max-w-[200px] truncate" title={i.src}>{i.src.split("/").pop()?.split("?")[0] || i.src.slice(0, 40)}</span>, i.role, `${i.renderedW}×${i.renderedH}`, `${i.naturalW}×${i.naturalH}`, kb(i.bytes), i.format,
            i.alt === null ? <span key="a" className="text-red-600">missing</span> : i.alt === "" ? "decorative" : "✓", i.lazy ? "✓" : i.inViewport ? "—" : <span key="l" className="text-amber-600">no</span>,
          ])} />
        ) : <NotMeasured why="image sizes need a browser render." />}
        <div className="mt-4"><FindingList items={inCats(r.issues, ["images"])} shots={shots} /></div>
      </Section>

      {/* 20 */}
      <Section n={N()} id="fonts" title="Fonts">
        {desk?.fonts ? (
          <div className="grid gap-4 md:grid-cols-2">
            <Table head={["Family", "Weight", "Style", "Status"]} rows={desk.fonts.map((f) => [f.family, f.weight, f.style, f.status])} empty="No web fonts loaded." />
            <Table head={["Font file", "Size"]} right={[1]} rows={(desk.fontFiles ?? []).map((f) => [<span key="u" className="block max-w-[240px] truncate">{f.url.split("/").pop()}</span>, kb(f.bytes)])} empty="No font files downloaded." />
          </div>
        ) : <NotMeasured why="font loading needs a browser render." />}
        <div className="mt-4"><FindingList items={inCats(r.issues, ["fonts"])} shots={shots} /></div>
      </Section>

      {/* 21 */}
      <Section n={N()} id="js" title="JavaScript">
        {desk?.scripts ? <Table head={["Script", "Size", "Unused on load", "Party / purpose", "Blocking"]} right={[1, 2]} rows={desk.scripts.map((s) => [<span key="u" className="block max-w-[260px] truncate" title={s.url}>{s.url.split("/").pop()?.split("?")[0] || s.url}</span>, kb(s.bytes), s.unusedBytes !== undefined ? kb(s.unusedBytes) : "—", s.purpose ?? (s.thirdParty ? "Third-party" : "First-party"), s.blocking ? <span key="b" className="text-amber-600">yes</span> : "no"])} empty="No external scripts." /> : <NotMeasured why="script sizes and coverage need a browser render." />}
        <div className="mt-4"><FindingList items={inCats(r.issues, ["javascript"])} shots={shots} /></div>
      </Section>

      {/* 22 */}
      <Section n={N()} id="css" title="CSS">
        {desk?.stylesheets ? <Table head={["Stylesheet", "Size", "Unused on load", "Render-blocking"]} right={[1, 2]} rows={desk.stylesheets.map((s) => [<span key="u" className="block max-w-[300px] truncate" title={s.url}>{s.url.split("/").pop()?.split("?")[0] || s.url}</span>, kb(s.bytes), s.unusedBytes !== undefined ? kb(s.unusedBytes) : "—", s.blocking ? "yes" : "no"])} empty="No external stylesheets." /> : <NotMeasured why="stylesheet coverage needs a browser render." />}
        <div className="mt-4"><FindingList items={inCats(r.issues, ["css"])} shots={shots} /></div>
      </Section>

      {/* 23 */}
      <Section n={N()} id="pages" title="Page-by-page" sub="Click a page for its findings. Per-page scores only reflect issues attributed to that page.">
        <PageTable r={r} shots={shots} />
      </Section>

      {/* 24 */}
      <Section n={N()} id="issues" title="All issues"><IssueExplorer r={r} shots={shots} /></Section>

      {/* 25 */}
      <Section n={N()} id="quick" title="Quick wins" sub="Relatively easy fixes with meaningful improvement"><FindingList items={r.quickWins} shots={shots} empty="No quick wins identified." /></Section>

      {/* 26 */}
      <Section n={N()} id="impact" title="High-impact improvements" sub="Larger projects and issues affecting conversion, UX, design or mobile"><FindingList items={r.highImpact} shots={shots} empty="No high-impact projects identified." /></Section>

      {/* 27 competitors */}
      <Section n={N()} id="competitors" title="Competitor comparison" sub="Evidence-based differences only">
        {comparison.length ? <Comparison rows={comparison} /> : <Note>No competitors were included in this audit. Start a new audit with “Compare with competitors” to add up to three.</Note>}
      </Section>

      {/* 28 */}
      <Section n={N()} id="opportunity" title="Arkria opportunity" sub="How closely the publicly observable website issues match Arkria’s services. Not a prediction of whether the company will buy.">
        <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
          <Card className="p-5"><div className="text-[12px] text-muted">Arkria opportunity score</div><div className="mt-1 text-[44px] font-semibold leading-none tabular-nums text-accent">{r.opportunity.score}<span className="text-[16px] text-subtle">/100</span></div><div className="mt-2 text-[12px] text-muted">From website deficiencies, conversion, design, performance, mobile and SEO gaps, business fit and service compatibility.</div></Card>
          <div className="grid gap-3 md:grid-cols-[1fr_auto_1fr_auto_1fr] md:items-center">
            <Card className="h-full p-4"><div className="text-[11px] font-semibold uppercase tracking-wider text-red-600">Current</div><ul className="mt-2 space-y-1 text-[12.5px]">{r.issues.filter((i) => i.severity !== "info").slice(0, 4).map((i) => <li key={i.id}>• {i.title}</li>)}</ul></Card>
            <ArrowRight className="mx-auto hidden text-subtle md:block" />
            <Card className="h-full p-4"><div className="text-[11px] font-semibold uppercase tracking-wider text-accent">Potential Arkria solution</div><div className="mt-2 text-[15px] font-semibold">{r.opportunity.recommended?.name ?? "Focused fixes"}</div>{r.opportunity.secondary.map((s) => <div key={s.serviceId} className="text-[12.5px] text-muted">+ {s.name}</div>)}</Card>
            <ArrowRight className="mx-auto hidden text-subtle md:block" />
            <Card className="h-full p-4"><div className="text-[11px] font-semibold uppercase tracking-wider text-emerald-600">Expected improvement areas</div><ul className="mt-2 space-y-1 text-[12.5px]">{(r.opportunity.improvementAreas.length ? r.opportunity.improvementAreas : ["Performance", "UX", "Conversion"]).map((a) => <li key={a}>• {a}</li>)}</ul></Card>
          </div>
        </div>
        <div className="mt-2 text-[11.5px] text-subtle">Improvement areas, not promised outcomes.</div>
        {r.crossImpact.length > 0 && (
          <div className="mt-6">
            <div className="mb-2 text-[15px] font-semibold">Cross-impact issues</div>
            <div className="grid gap-3 md:grid-cols-2">
              {r.crossImpact.map((f) => (
                <Card key={f.id} className="p-4">
                  <div className="flex items-center gap-2"><SevBadge s={f.severity} /><span className="text-[13.5px] font-semibold">{f.title}</span></div>
                  <div className="mt-2 flex flex-wrap items-center gap-1 text-[12px] text-muted">This issue affects: {[...new Set([CAT_SCORE[f.category], ...f.affects])].map((a, i) => <React.Fragment key={a}>{i > 0 && <ArrowRight size={11} />}<span className="rounded-md bg-surface-2 px-1.5 py-0.5 text-ink ring-1 ring-inset ring-line">{SCORE_LABEL[a]}</span></React.Fragment>)}</div>
                </Card>
              ))}
            </div>
          </div>
        )}
      </Section>

      {/* 29 */}
      <Section n={N()} id="service" title="Recommended service">
        {r.opportunity.recommended ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="p-5">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-subtle">Recommended for review</div>
              <div className="mt-1 text-[22px] font-semibold tracking-tight">{r.opportunity.recommended.name}</div>
              <div className="text-[15px] font-semibold text-accent">{inr(r.opportunity.recommended.price)}</div>
              <div className="mt-4 text-[12px] font-semibold uppercase tracking-wide text-muted">Why</div>
              <ol className="mt-1.5 list-decimal space-y-1.5 pl-5 text-[13px]">{r.opportunity.reasons.map((x) => <li key={x}>{x}</li>)}</ol>
              <div className="mt-3 text-[11.5px] text-subtle">Potential opportunity based on detected improvement areas — not a claim that the business needs it.</div>
            </Card>
            <div className="space-y-3">
              {r.opportunity.secondary.map((s) => (
                <Card key={s.serviceId} className="p-4">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-subtle">Secondary opportunity</div>
                  <div className="mt-0.5 flex items-center justify-between"><span className="text-[15px] font-semibold">{s.name}</span><span className="font-semibold text-accent">{inr(s.price)}</span></div>
                  <ul className="mt-2 space-y-1 text-[12.5px] text-muted">{s.reasons.map((x) => <li key={x}>• {x}</li>)}</ul>
                </Card>
              ))}
            </div>
          </div>
        ) : <Note>No service matched strongly — the site is in reasonable shape. Consider a focused conversation about growth instead.</Note>}
      </Section>

      {/* 30 */}
      <Section n={N()} id="internal" title="Internal sales intelligence" sub="Internal only — never included in the client report">
        <InternalIntel r={r} intel={intel} />
      </Section>

      {/* 31 */}
      <Section n={N()} id="client" title="Client report">
        <Card className="flex flex-wrap items-center justify-between gap-3 p-5">
          <div className="text-[13.5px] text-muted">A polished, client-facing version with the overview, strengths, opportunities, evidence and next steps. Internal scoring, cost, margin and sales strategy are excluded.</div>
          <button onClick={onGotoClient} className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-ink px-3.5 text-[13.5px] font-medium text-bg">Generate client audit <ArrowRight size={14} /></button>
        </Card>
      </Section>

      {r.notes.length > 0 && <div className="space-y-1 rounded-2xl border border-line bg-surface-2/50 p-4 text-[12px] text-muted"><div className="font-semibold text-ink">Audit limitations</div>{r.notes.map((x) => <div key={x}>• {x}</div>)}</div>}
    </div>
  );
}

function PageTable({ r, shots }: { r: AuditResult; shots: Record<string, string> }) {
  const [open, setOpen] = useState<string | null>(null);
  const cell = (v: number | null) => <span className={cn("font-semibold", scoreTone(v))}>{v ?? "—"}</span>;
  const items = open ? r.issues.filter((f) => f.pages.includes(open)) : [];
  return (
    <>
      <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
        <table className="w-full min-w-[620px] text-[12.5px]">
          <thead><tr className="border-b border-line bg-surface-2/60 text-left text-[11.5px] text-muted"><th className="px-3 py-2 font-medium">Page</th><th className="px-3 py-2 text-right font-medium">Performance</th><th className="px-3 py-2 text-right font-medium">SEO</th><th className="px-3 py-2 text-right font-medium">UX</th><th className="px-3 py-2 text-right font-medium">Conversion</th><th className="px-3 py-2 text-right font-medium">Issues</th></tr></thead>
          <tbody className="divide-y divide-line">
            {r.pageTable.map((p) => {
              const st = r.pagesAnalyzed.find((x) => x.url === p.url)?.status ?? 0;
              return (
                <tr key={p.url} onClick={() => setOpen(p.url)} className="cursor-pointer hover:bg-surface-2/60">
                  <td className="max-w-[280px] truncate px-3 py-2 font-medium">{p.path}{st !== 200 && <span className="ml-2 text-red-600">{st || "error"}</span>}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{cell(p.performance)}</td><td className="px-3 py-2 text-right tabular-nums">{cell(p.seo)}</td><td className="px-3 py-2 text-right tabular-nums">{cell(p.ux)}</td><td className="px-3 py-2 text-right tabular-nums">{cell(p.conversion)}</td><td className="px-3 py-2 text-right tabular-nums">{p.issues}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Modal open={!!open} onClose={() => setOpen(null)} wide title={open ? pathOf(open) : ""}>
        <div className="space-y-3">{items.length ? items.map((f) => <FindingCard key={f.id} f={f} shots={shots} compact />) : <div className="text-[13px] text-muted">No page-specific issues.</div>}</div>
      </Modal>
    </>
  );
}

function IssueExplorer({ r, shots }: { r: AuditResult; shots: Record<string, string> }) {
  const [sev, setSev] = useState<Severity | "">("");
  const [cat, setCat] = useState("");
  const [page, setPage] = useState("");
  const [kind, setKind] = useState("");
  const [sort, setSort] = useState<"severity" | "impact" | "quick">("severity");
  const cats = [...new Set(r.issues.map((i) => i.category))];
  const pages = [...new Set(r.issues.flatMap((i) => i.pages))];
  const list = useMemo(() => {
    const l = r.issues.filter((i) => (!sev || i.severity === sev) && (!cat || i.category === cat) && (!page || i.pages.includes(page)) && (!kind || i.kind === kind));
    const rank = (s: Severity) => SEVS.indexOf(s);
    if (sort === "impact") return [...l].sort((a, b) => b.affects.length - a.affects.length || rank(a.severity) - rank(b.severity));
    if (sort === "quick") return [...l].sort((a, b) => (a.effort === "quick" ? 0 : 1) - (b.effort === "quick" ? 0 : 1) || rank(a.severity) - rank(b.severity));
    return l;
  }, [r.issues, sev, cat, page, kind, sort]);
  const sel = "h-8 rounded-lg border border-line bg-surface px-2 text-[12.5px]";
  return (
    <div className="space-y-3">
      <div className="no-print flex flex-wrap items-center gap-2">
        <select className={sel} value={sev} onChange={(e) => setSev(e.target.value as Severity | "")} aria-label="Severity"><option value="">All severities</option>{SEVS.map((s) => <option key={s} value={s}>{s.toUpperCase()} ({r.issues.filter((i) => i.severity === s).length})</option>)}</select>
        <select className={sel} value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Category"><option value="">All categories</option>{cats.map((c) => <option key={c} value={c}>{catLabel(c)}</option>)}</select>
        <select className={sel} value={page} onChange={(e) => setPage(e.target.value)} aria-label="Page"><option value="">All pages</option>{pages.map((p) => <option key={p} value={p}>{pathOf(p)}</option>)}</select>
        <select className={sel} value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Type"><option value="">Technical / UX / Business</option><option value="technical">Technical</option><option value="ux">UX</option><option value="business">Business</option></select>
        <Tabs className="ml-auto" value={sort} onChange={setSort} tabs={[{ id: "severity", label: "Highest severity" }, { id: "impact", label: "Highest impact" }, { id: "quick", label: "Quick wins" }]} />
      </div>
      <div className="text-[12px] text-muted">{list.length} of {r.issues.length} findings</div>
      <FindingList items={list} shots={shots} limit={12} empty="No findings match these filters." />
    </div>
  );
}

function Comparison({ rows }: { rows: CompareRow[] }) {
  const heads = rows[0]?.others.length ?? 0;
  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
        <table className="w-full min-w-[560px] text-[12.5px]">
          <thead><tr className="border-b border-line bg-surface-2/60 text-left text-[11.5px] text-muted"><th className="px-3 py-2 font-medium">Aspect</th><th className="px-3 py-2 font-medium">Target site</th>{Array.from({ length: heads }, (_, i) => <th key={i} className="px-3 py-2 font-medium">Competitor {String.fromCharCode(65 + i)}</th>)}</tr></thead>
          <tbody className="divide-y divide-line">{rows.map((r) => <tr key={r.aspect}><td className="px-3 py-2 text-muted">{r.aspect}</td><td className="px-3 py-2 font-medium">{r.target}</td>{r.others.map((o, i) => <td key={i} className="px-3 py-2">{o}</td>)}</tr>)}</tbody>
        </table>
      </div>
      {rows.some((r) => r.differences.length) && (
        <Card className="p-4">
          <div className="text-[13px] font-semibold">Differences</div>
          <ul className="mt-2 space-y-1.5 text-[13px]">{rows.flatMap((r) => r.differences.map((d) => <li key={d} className="flex gap-2"><Minus size={14} className="mt-0.5 shrink-0 text-accent" />{d}</li>))}</ul>
        </Card>
      )}
    </div>
  );
}

function InternalIntel({ r, intel }: { r: AuditResult; intel: SalesIntel }) {
  const svc = r.opportunity.recommended;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <KV rows={[
        ["Opportunity score", `${r.opportunity.score}/100`],
        ["Recommended service", svc?.name ?? "—"],
        ["Arkria price", svc ? inr(svc.price) : "—"],
        ["Arkria cost", svc ? inr(svc.cost) : "—"],
        ["Margin", svc ? `${inr(svc.price - svc.cost)} · ${svc.price ? Math.round(((svc.price - svc.cost) / svc.price) * 100) : 0}%` : "—"],
        ["Estimated hours", svc ? `${svc.hours} h` : "—"],
        ["Lead quality", <span key="q"><b>{intel.leadQuality.level}</b> — {intel.leadQuality.reasons.join(" · ")}</span>],
      ]} />
      <div className="space-y-3">
        <Card className="p-4"><div className="text-[12px] font-semibold uppercase tracking-wide text-muted">Why the lead matters</div><ul className="mt-1.5 space-y-1 text-[13px]">{intel.whyItMatters.map((w) => <li key={w}>• {w}</li>)}</ul></Card>
        <Card className="p-4"><div className="text-[12px] font-semibold uppercase tracking-wide text-muted">Recommended outreach angle</div><p className="mt-1.5 text-[13px]">{intel.angle}</p></Card>
      </div>
      <Card className="p-4 lg:col-span-2"><div className="text-[12px] font-semibold uppercase tracking-wide text-muted">Potential objections</div><div className="mt-2 grid gap-2 md:grid-cols-2">{intel.objections.map((o) => <div key={o.objection} className="rounded-xl bg-surface-2 p-3 text-[12.5px]"><div className="font-semibold">“{o.objection}”</div><div className="mt-1 text-muted">{o.response}</div></div>)}</div></Card>
      <Card className="p-4 lg:col-span-2"><div className="text-[12px] font-semibold uppercase tracking-wide text-muted">Suggested pitch</div><p className="mt-1.5 whitespace-pre-wrap text-[13px] leading-relaxed">{intel.pitch}</p></Card>
    </div>
  );
}

export { SourceTag };
