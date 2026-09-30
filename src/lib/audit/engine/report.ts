import type { Service } from "../../types";
import type { AuditRaw, AuditRecord, AuditResult, AuditSummary, Category, Finding, ScoreCell, ScoreKey, Strength } from "../types";
import { detectTech, mergeTech } from "../technology";
import { buildCtx, path, type Ctx } from "./context";
import { performance, vitals } from "./performance";
import { design, firstImpression, mobile, mobileRating } from "./experience";
import { conversion, journeys, sevRank, ux } from "./conversion";
import { localSeo, seo } from "./seo";
import { accessibility, business, content, security, trust } from "./quality";
import { opportunity } from "./opportunity";

// Runs every analyzer module and assembles the normalized audit result.

export const SCORE_KEYS: ScoreKey[] = ["performance", "ux", "design", "mobile", "seo", "accessibility", "security", "conversion", "content", "technical", "trust", "leadGeneration"];
export const SCORE_LABEL: Record<ScoreKey, string> = {
  performance: "Performance", ux: "UX", design: "UI / Design", mobile: "Mobile", seo: "SEO", accessibility: "Accessibility", security: "Security",
  conversion: "Conversion", content: "Content", technical: "Technical quality", trust: "Trust", leadGeneration: "Lead generation",
};
const WEIGHT: Record<ScoreKey, number> = { performance: 1.2, mobile: 1.2, ux: 1, design: 0.8, seo: 1, accessibility: 0.8, security: 0.6, conversion: 1.2, content: 0.8, technical: 0.8, trust: 0.8, leadGeneration: 1.2 };
export const CAT_SCORE: Record<Category, ScoreKey> = {
  performance: "performance", vitals: "performance", images: "performance", fonts: "performance", javascript: "performance", css: "performance",
  mobile: "mobile", design: "design", ux: "ux", seo: "seo", localSeo: "seo", accessibility: "accessibility", security: "security",
  conversion: "conversion", forms: "conversion", ecommerce: "conversion", business: "conversion", content: "content", technical: "technical", trust: "trust", leadGeneration: "leadGeneration",
};
const DED: Record<Finding["severity"], number> = { critical: 45, high: 22, medium: 10, low: 4, info: 0 };

// Penalty points → score on a smooth curve (one high ≈ 80, one critical ≈ 64),
// so a score never collapses to zero from many small issues.
const curve = (points: number) => Math.round(100 * Math.exp(-points / 100));
const points = (fs: Finding[]) => fs.filter((f) => f.severity !== "low").reduce((a, f) => a + DED[f.severity], 0) + Math.min(16, fs.filter((f) => f.severity === "low").length * DED.low);
export function deduct(fs: Finding[]) {
  return curve(points(fs));
}

function scores(ctx: Ctx, fs: Finding[]): Record<ScoreKey, ScoreCell> {
  const out = {} as Record<ScoreKey, ScoreCell>;
  for (const k of SCORE_KEYS) {
    const mine = fs.filter((f) => CAT_SCORE[f.category] === k);
    // Issues whose main category is elsewhere but that clearly affect this area count at reduced weight.
    const secondary = fs.filter((f) => CAT_SCORE[f.category] !== k && f.affects.includes(k) && f.severity !== "info" && f.severity !== "low");
    const cross = Math.min(25, secondary.reduce((a, f) => a + DED[f.severity] * 0.4, 0));
    let score: number | null = curve(points(mine) + cross);
    let basis = `${ctx.pages.length} page${ctx.pages.length === 1 ? "" : "s"} analyzed`;
    if (k === "performance") {
      const src = [ctx.psi && "Google PageSpeed (mobile)", ctx.runs.length && "Arkria browser measurements", "server response timing"].filter(Boolean);
      basis = src.join(" + ");
      if (ctx.psi?.scores) score = Math.round((score + ctx.psi.scores.performance) / 2);
    }
    if (k === "design") {
      if (!ctx.desk?.design && !ctx.ai) { score = null; basis = "Not measured — needs a browser (Chrome/Edge) on the server or AI analysis"; }
      else basis = [ctx.desk?.design && "computed styles (homepage)", ctx.ai && "AI ANALYSIS of screenshots"].filter(Boolean).join(" + ");
    }
    if (k === "mobile") basis = ctx.mob ? `real mobile rendering (390px)${ctx.raw.breakpoints.length ? " + 8 breakpoints" : ""} + HTML checks` : "HTML only (viewport tag, responsive CSS) — browser checks not available";
    if (k === "accessibility") basis = ctx.desk?.axe ? "axe-core automated rules (homepage) + HTML checks — automated only" : "HTML checks only — automated, limited";
    if (k === "security") basis = "Passive checks: HTTPS, certificate, headers, cookies, exposed versions";
    out[k] = { score, basis, findings: mine.length + secondary.length };
  }
  return out;
}

const uniqById = (fs: Finding[]) => { const m = new Map<string, Finding>(); for (const f of fs) if (!m.has(f.id)) m.set(f.id, f); return [...m.values()]; };

export interface ComputeOpts { services: Service[]; industryHint?: string }

export function computeAudit(url: string, raw: AuditRaw, opts: ComputeOpts): AuditResult {
  const ctx = buildCtx(raw, opts.industryHint);
  const mods = [performance(ctx), mobile(ctx), design(ctx), ux(ctx), seo(ctx), content(ctx), trust(ctx), accessibility(ctx), security(ctx), business(ctx)];
  const conv = conversion(ctx);
  const loc = localSeo(ctx);
  const cont = mods[5] as ReturnType<typeof content>;
  const issues = uniqById([...mods.flatMap((m) => m.findings), ...conv.findings, ...loc.findings]).sort((a, b) => sevRank(a.severity) - sevRank(b.severity) || (a.kind === "business" ? -1 : 1));
  const strengths: Strength[] = [...mods.flatMap((m) => m.strengths), ...conv.strengths, ...loc.strengths];
  const sc = scores(ctx, issues);
  const avail = SCORE_KEYS.filter((k) => sc[k].score !== null);
  const overall = avail.length ? Math.round(avail.reduce((a, k) => a + sc[k].score! * WEIGHT[k], 0) / avail.reduce((a, k) => a + WEIGHT[k], 0)) : null;
  const opp = opportunity(ctx, overall, sc, issues, strengths, opts.services);

  const tech = mergeTech([
    ...ctx.pages.map((p) => p.tech),
    detectTech({ headers: ctx.site.headers }),
    ...ctx.runs.map((r) => detectTech({ urls: (r.resources ?? []).map((x) => x.url) })),
  ]);
  const quickWins = issues.filter((f) => f.effort === "quick" && f.severity !== "info").slice(0, 10);
  const highImpact = issues.filter((f) => f.severity !== "info" && (f.effort === "project" || ((f.severity === "critical" || f.severity === "high") && f.affects.some((a) => ["conversion", "leadGeneration", "ux", "design", "mobile"].includes(a))))).slice(0, 10);
  const crossImpact = issues.filter((f) => new Set([CAT_SCORE[f.category], ...f.affects]).size >= 3 && f.severity !== "info").slice(0, 8);

  const pageTable = raw.pages.slice(0, 100).map((p) => {
    const mine = issues.filter((f) => f.pages.includes(p.finalUrl) || f.pages.includes(p.url));
    const by = (keys: ScoreKey[]) => deduct(mine.filter((f) => keys.includes(CAT_SCORE[f.category])));
    return {
      url: p.finalUrl, path: path(p.finalUrl),
      performance: p.ok && p.ttfbMs !== undefined ? by(["performance"]) : null,
      seo: p.ok ? by(["seo"]) : 0, ux: p.ok ? by(["ux", "mobile"]) : 0, conversion: p.ok ? by(["conversion", "leadGeneration"]) : 0,
      issues: mine.length + (p.ok ? 0 : 1),
    };
  });

  const topOf = (cats: Category[]) => issues.find((f) => cats.includes(f.category) && f.severity !== "info");
  const qLabel = overall === null ? "Not enough data" : overall >= 80 ? "Strong" : overall >= 65 ? "Good, with gaps" : overall >= 45 ? "Needs work" : "Weak";
  const find = (cat: string) => tech.filter((t) => t.category === cat).map((t) => `${t.name}${t.version ? ` ${t.version}` : ""}`);
  const home = ctx.home;
  const mScore = sc.mobile.score;
  const overview: Record<string, string> = {
    Domain: ctx.site.host.replace(/^www\./, ""),
    Title: home?.title ?? "Not found",
    "Detected business type": `${ctx.business.label} (${ctx.business.confidence})`,
    "Pages analyzed": `${ctx.pages.length}${raw.pages.length > ctx.pages.length ? ` (+${raw.pages.length - ctx.pages.length} not readable)` : ""}`,
    Framework: find("Framework").join(", ") || "None detected",
    CMS: [...find("CMS"), ...find("Site builder"), ...find("E-commerce")].join(", ") || "None detected",
    "Hosting / CDN": [...find("Hosting"), ...find("CDN")].join(", ") || "None detected",
    "Web server": find("Web server").join(", ") || "Not disclosed",
    Analytics: [...find("Analytics"), ...find("Tag manager")].join(", ") || "None detected",
    "Tracking / ads": find("Advertising").join(", ") || "None detected",
    "Website age": "Not verified (no reliable public source checked)",
    SSL: !ctx.site.https ? "No HTTPS" : ctx.site.tls?.valid ? `Valid${ctx.site.tls.issuer ? ` · ${ctx.site.tls.issuer}` : ""}${ctx.site.tls.daysLeft !== undefined ? ` · ${ctx.site.tls.daysLeft} days left` : ""}` : `Problem: ${ctx.site.tls?.error ?? "unknown"}`,
    "Mobile responsiveness": mobileRating(ctx, mScore),
  };

  const bestStrengths = strengths.filter((s) => !/^Has /.test(s.text)).slice(0, 3).map((s) => s.text);
  const notes = [
    ...raw.notes,
    "Forms were never submitted, so validation, error and success states are not verified.",
    "Keyboard navigation, focus states and screen-reader behaviour need manual testing; accessibility results are automated findings only.",
    ...(ctx.psi?.field?.inp === undefined ? ["Interaction to Next Paint needs real-user data from the Chrome UX Report and was not available."] : []),
  ];

  return {
    url,
    overallScore: overall,
    scores: sc,
    pagesAnalyzed: raw.pages.map((p) => ({ url: p.finalUrl, status: p.status, title: p.title })),
    issues,
    quickWins,
    highImpact,
    strengths,
    technology: tech,
    business: ctx.business,
    ecommerce: ctx.ecommerce,
    vitals: vitals(ctx),
    mobileRating: mobileRating(ctx, mScore),
    leadGen: conv.leadGen,
    localSeo: loc.local,
    journeys: journeys(ctx),
    contentAnswers: cont.answers,
    firstImpression: firstImpression(ctx),
    crossImpact,
    pageTable,
    overview,
    executive: {
      quality: overall === null ? qLabel : `${qLabel} (${overall}/100)`,
      strengths: bestStrengths,
      weaknesses: issues.filter((f) => f.severity !== "info").slice(0, 3).map((f) => f.title),
      conversion: topOf(["conversion", "leadGeneration", "forms"])?.title,
      technical: topOf(["technical", "performance", "vitals", "security", "javascript"])?.title,
      mobile: topOf(["mobile"])?.title,
      seo: topOf(["seo", "localSeo"])?.title,
      service: opp.recommended ? `${opp.recommended.name}` : undefined,
    },
    opportunity: opp,
    notes,
  };
}

export function summarize(r: AuditResult): AuditSummary {
  return {
    overall: r.overallScore,
    opportunity: r.opportunity.score,
    service: r.opportunity.recommended?.name,
    servicePrice: r.opportunity.recommended?.price,
    issues: r.issues.filter((i) => i.severity !== "info").length,
    high: r.issues.filter((i) => i.severity === "critical" || i.severity === "high").length,
    pages: r.pagesAnalyzed.length,
  };
}

// ---------- competitor comparison ----------

export interface CompareRow { aspect: string; target: string; others: string[]; differences: string[] }

function facts(raw: AuditRaw, r: AuditResult) {
  const ctx = buildCtx(raw);
  const ctas = new Set(ctx.pages.flatMap((p) => p.ctas.map((c) => c.kind)));
  const forms = ctx.pages.flatMap((p) => p.forms).filter((f) => f.purpose === "contact" || f.purpose === "booking");
  const lcp = r.vitals.find((v) => v.key === "lcp");
  return {
    score: (k: ScoreKey) => (r.scores[k].score === null ? "Not measured" : `${r.scores[k].score}/100`),
    lcp: lcp?.value !== undefined ? `${(lcp.value / 1000).toFixed(1)} s` : "Not measured",
    booking: ctas.has("booking") || forms.some((f) => f.purpose === "booking"),
    whatsapp: ctas.has("whatsapp"),
    call: ctas.has("call"),
    form: forms.length ? `${forms[0].fields.length}-field form` : "",
    formFields: forms[0]?.fields.length ?? 0,
    testimonials: ctx.pages.some((p) => p.trust.testimonials || p.trust.reviews),
    work: ctx.pages.some((p) => p.trust.portfolio || p.trust.caseStudies),
    schema: [...new Set(ctx.pages.flatMap((p) => p.schema.types))],
    words: ctx.home?.wordCount ?? 0,
    pages: ctx.pages.length,
    mobile: r.mobileRating,
    headerCta: !!ctx.home?.ctas.some((c) => c.inHeader),
  };
}

export function compare(target: { raw: AuditRaw; result: AuditResult }, comps: { url: string; raw: AuditRaw; result: AuditResult }[]): CompareRow[] {
  const t = facts(target.raw, target.result);
  const cs = comps.map((c) => ({ url: c.url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, ""), f: facts(c.raw, c.result) }));
  const yes = (b: boolean) => (b ? "Yes" : "Not detected");
  const rows: CompareRow[] = [];
  const bool = (aspect: string, get: (x: ReturnType<typeof facts>) => boolean, phrase: string) => {
    const tv = get(t);
    rows.push({ aspect, target: yes(tv), others: cs.map((c) => yes(get(c.f))), differences: cs.filter((c) => get(c.f) !== tv).map((c) => (get(c.f) ? `${c.url} has ${phrase}; target site: none detected.` : `Target site has ${phrase}; ${c.url}: none detected.`)) });
  };
  const val = (aspect: string, get: (x: ReturnType<typeof facts>) => string) => rows.push({ aspect, target: get(t), others: cs.map((c) => get(c.f)), differences: [] });
  val("Performance", (x) => x.score("performance"));
  val("Largest Contentful Paint", (x) => x.lcp);
  val("Mobile", (x) => x.mobile);
  val("UX", (x) => x.score("ux"));
  val("SEO", (x) => x.score("seo"));
  val("Conversion", (x) => x.score("conversion"));
  val("Trust", (x) => x.score("trust"));
  val("Design", (x) => x.score("design"));
  bool("Booking CTA", (x) => x.booking, "a visible booking option");
  bool("WhatsApp", (x) => x.whatsapp, "a WhatsApp contact link");
  bool("Tap-to-call", (x) => x.call, "a tap-to-call phone link");
  bool("CTA in header", (x) => x.headerCta, "a call-to-action in the header");
  rows.push({ aspect: "Enquiry form", target: t.form || "Not detected", others: cs.map((c) => c.f.form || "Not detected"), differences: cs.filter((c) => !!c.f.form !== !!t.form || (c.f.formFields && t.formFields && Math.abs(c.f.formFields - t.formFields) >= 3)).map((c) => (!t.form ? `${c.url} has a ${c.f.form}; target site: no enquiry form detected.` : !c.f.form ? `Target site has a ${t.form}; ${c.url}: none detected.` : `${c.url} asks for ${c.f.formFields} fields; the target site asks for ${t.formFields}.`)) });
  bool("Testimonials / reviews", (x) => x.testimonials, "testimonials or reviews");
  bool("Portfolio / case studies", (x) => x.work, "a portfolio or case studies");
  rows.push({ aspect: "Structured data", target: t.schema.join(", ") || "None", others: cs.map((c) => c.f.schema.join(", ") || "None"), differences: cs.filter((c) => c.f.schema.length && !t.schema.length).map((c) => `${c.url} uses structured data (${c.f.schema.slice(0, 3).join(", ")}); target site: none detected.`) });
  rows.push({ aspect: "Homepage words", target: String(t.words), others: cs.map((c) => String(c.f.words)), differences: cs.filter((c) => c.f.words > t.words * 2 && c.f.words > 300).map((c) => `${c.url}'s homepage has ${c.f.words} words vs ${t.words} on the target site.`) });
  rows.push({ aspect: "Pages found", target: String(t.pages), others: cs.map((c) => String(c.f.pages)), differences: [] });
  return rows;
}

export function computeRecord(rec: AuditRecord, services: Service[]) {
  const result = computeAudit(rec.url, rec.raw, { services, industryHint: rec.industryHint });
  const comps = rec.competitors.map((c) => ({ url: c.url, raw: c.raw, result: computeAudit(c.url, c.raw, { services }) }));
  return { result, comps, comparison: comps.length ? compare({ raw: rec.raw, result }, comps) : [] };
}
