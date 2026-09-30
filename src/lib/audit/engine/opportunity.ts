import type { Service } from "../../types";
import type { AuditResult, Finding, ScoreKey, ServiceFit, Strength } from "../types";
import type { Ctx } from "./context";
import { sevRank } from "./conversion";

// Arkria opportunity engine: which service the observed issues point to, how
// strongly, and the sales intelligence for the team. This measures how closely
// publicly observable issues match Arkria's services — not whether a company
// will buy.

type Scores = AuditResult["scores"];
const gap = (sc: Scores, k: ScoreKey) => (sc[k].score === null ? null : (100 - sc[k].score!) / 100);
const g0 = (sc: Scores, k: ScoreKey) => gap(sc, k) ?? 0;
const titles = (fs: Finding[], pred: (f: Finding) => boolean, n = 3) => fs.filter(pred).sort((a, b) => sevRank(a.severity) - sevRank(b.severity)).slice(0, n).map((f) => `${f.title} — ${f.evidence}`);

const PREMIUM = ["real_estate", "interior", "hotel", "agency", "portfolio"];
const BOOKING = ["clinic", "restaurant", "hotel", "education"];
const SUPPORT = ["clinic", "education", "real_estate", "hotel", "saas", "ecommerce"];

export const IMPROVES: Record<string, string[]> = {
  s1: ["Mobile experience", "UX & navigation", "Conversion paths", "Brand presentation", "SEO foundations", "Lead generation"],
  s2: ["Conversion", "Lead generation", "Campaign performance"],
  s3: ["Brand presentation", "Visual design", "UX", "Conversion", "Performance"],
  s4: ["Online sales", "Product discovery", "Checkout experience", "Mobile shopping", "Performance"],
  s5: ["Operations & workflows", "Customer portal experience", "Data visibility"],
  s6: ["Customer engagement", "Bookings & repeat visits", "Mobile experience"],
  s7: ["Enquiry handling", "Lead capture outside business hours", "Response time"],
  s8: ["Performance", "Core Web Vitals", "SEO", "Search visibility"],
};

export function serviceFits(ctx: Ctx, sc: Scores, fs: Finding[], strengths: Strength[], services: Service[]): ServiceFit[] {
  const has = (id: string) => fs.some((f) => f.id === id || f.id.startsWith(`${id}:`));
  const legacy = has("mobile.viewport") || has("content.legacy") || has("mobile.no_responsive_css");
  const trustCount = strengths.filter((s) => s.category === "trust").length;
  const pricesNoCart = ctx.pages.some((p) => p.ecommerce.prices >= 5) && !ctx.ecommerce;
  const chat = ctx.pages.some((p) => p.chatWidget);
  const raw: Record<string, { strength: number; reasons: string[] }> = {
    s1: {
      strength: Math.min(1, 0.35 * ((100 - (avg(sc) ?? 60)) / 100) * 2 + 0.2 * g0(sc, "mobile") + 0.15 * g0(sc, "design") + 0.15 * g0(sc, "conversion") + (legacy ? 0.35 : 0) + (!ctx.site.https ? 0.1 : 0)),
      reasons: titles(fs, (f) => ["mobile", "design", "technical", "content", "conversion"].includes(f.category) && f.severity !== "info"),
    },
    s3: {
      strength: (g0(sc, "design") > 0.15 || ctx.ai?.design.some((d) => !d.positive)) ? Math.min(1, 0.45 * g0(sc, "design") + 0.2 * g0(sc, "ux") + (PREMIUM.includes(ctx.business.type) ? 0.3 : 0) + (trustCount >= 3 ? 0.15 : 0)) : 0.1,
      reasons: [...titles(fs, (f) => f.category === "design" || f.category === "ux", 3), ...(PREMIUM.includes(ctx.business.type) ? [`${ctx.business.label} businesses benefit from a premium, portfolio-led presentation`] : [])],
    },
    s2: {
      strength: Math.min(1, 0.7 * ((g0(sc, "conversion") + g0(sc, "leadGeneration")) / 2) * ((avg(sc) ?? 0) >= 55 ? 1 : 0.6)),
      reasons: titles(fs, (f) => ["conversion", "leadGeneration", "forms"].includes(f.category)),
    },
    s4: {
      strength: ctx.ecommerce ? Math.min(1, 0.35 + 0.5 * ((g0(sc, "conversion") + g0(sc, "ux") + g0(sc, "performance")) / 3) + (fs.filter((f) => f.category === "ecommerce").length * 0.05)) : pricesNoCart ? 0.75 : 0,
      reasons: ctx.ecommerce ? titles(fs, (f) => f.category === "ecommerce" || f.category === "conversion") : pricesNoCart ? ["Products with prices are shown, but there's no cart or online checkout"] : [],
    },
    s5: { strength: ctx.business.type === "saas" ? 0.35 : 0, reasons: ctx.business.type === "saas" ? ["Software business — dashboards, portals and internal tools are a potential fit"] : [] },
    s6: {
      strength: BOOKING.includes(ctx.business.type) ? ((avg(sc) ?? 0) >= 65 ? 0.45 : 0.25) : 0,
      reasons: BOOKING.includes(ctx.business.type) ? [`${ctx.business.label} businesses run on bookings and repeat visits`] : [],
    },
    s7: {
      strength: !chat && (SUPPORT.includes(ctx.business.type) || ctx.pages.length >= 15) ? 0.4 + (sc.leadGeneration.score !== null && sc.leadGeneration.score < 70 ? 0.15 : 0) : 0,
      reasons: !chat ? ["No chat assistant was detected on the site", ...(SUPPORT.includes(ctx.business.type) ? [`${ctx.business.label} businesses answer many repeat questions`] : [])] : [],
    },
    s8: {
      strength: Math.min(1, 0.55 * g0(sc, "performance") + 0.45 * g0(sc, "seo") + ((avg(sc) ?? 0) >= 65 ? 0.15 : 0)),
      reasons: titles(fs, (f) => ["performance", "vitals", "images", "javascript", "css", "fonts", "seo", "localSeo"].includes(f.category)),
    },
  };
  return Object.entries(raw)
    .map(([id, r]) => {
      const svc = services.find((s) => s.id === id && s.active);
      return svc ? { serviceId: id, name: svc.name, price: svc.basePrice, cost: svc.internalCost, hours: svc.hours, strength: Math.round(r.strength * 100) / 100, reasons: r.reasons.filter(Boolean).slice(0, 4) } : null;
    })
    .filter((x): x is ServiceFit => !!x && x.strength > 0)
    .sort((a, b) => b.strength - a.strength);
}

function avg(sc: Scores) {
  const v = Object.values(sc).map((c) => c.score).filter((x): x is number => x !== null);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}

export function opportunity(ctx: Ctx, overall: number | null, sc: Scores, fs: Finding[], strengths: Strength[], services: Service[]): AuditResult["opportunity"] {
  const fits = serviceFits(ctx, sc, fs, strengths, services);
  const best = fits[0] && fits[0].strength >= 0.25 ? fits[0] : null;
  const secondary = fits.slice(best ? 1 : 0).filter((f) => f.strength >= 0.3).slice(0, 2);
  const parts: [number | null, number][] = [
    [overall === null ? null : (100 - overall) / 100, 0.3],
    [sc.conversion.score === null && sc.leadGeneration.score === null ? null : ((gap(sc, "conversion") ?? 0) + (gap(sc, "leadGeneration") ?? 0)) / 2, 0.2],
    [gap(sc, "design"), 0.1],
    [gap(sc, "performance"), 0.1],
    [gap(sc, "mobile"), 0.1],
    [gap(sc, "seo"), 0.05],
    [["general"].includes(ctx.business.type) ? 0.5 : 1, 0.05],
    [best?.strength ?? 0, 0.1],
  ];
  const avail = parts.filter(([v]) => v !== null) as [number, number][];
  const wsum = avail.reduce((a, [, w]) => a + w, 0) || 1;
  const score = Math.round((avail.reduce((a, [v, w]) => a + v * w, 0) / wsum) * 100);
  const reasons = best?.reasons ?? [];
  return { score: Math.max(0, Math.min(100, score)), recommended: best, secondary, reasons, improvementAreas: best ? IMPROVES[best.serviceId] ?? [] : [] };
}

// ---------- internal sales intelligence ----------

export interface SalesIntel {
  leadQuality: { level: "High" | "Medium" | "Low"; reasons: string[] };
  whyItMatters: string[];
  angle: string;
  objections: { objection: string; response: string }[];
  pitch: string;
}

const plain = (f: Finding) => `${f.title.replace(/\s*\(.*\)$/, "")}: ${f.evidence.replace(/\s+/g, " ").slice(0, 160)}`;

export function salesIntel(ctx: Ctx, r: AuditResult, studio: string): SalesIntel {
  const opp = r.opportunity;
  const contacts = ctx.pages.some((p) => p.contact.phones.length || p.contact.emails.length || p.contact.whatsapp);
  const level: SalesIntel["leadQuality"]["level"] = opp.score >= 65 && contacts ? "High" : opp.score >= 40 ? "Medium" : "Low";
  const leadReasons = [
    `Arkria opportunity score ${opp.score}/100`,
    contacts ? "Public business contact details found on the site" : "No public contact details found on the site",
    `${r.issues.filter((i) => i.severity === "critical" || i.severity === "high").length} critical/high issues`,
    `${ctx.business.label} (${ctx.business.confidence})`,
  ];
  const biz = r.issues.filter((i) => i.kind !== "technical" && i.severity !== "info").slice(0, 3);
  const tech = r.issues.filter((i) => i.kind === "technical" && i.severity !== "info").slice(0, 2);
  const why = [...biz, ...tech].slice(0, 4).map(plain);
  const lead = r.issues.find((i) => i.kind !== "technical" && (i.severity === "critical" || i.severity === "high")) ?? r.issues.find((i) => i.severity !== "info");
  const angle = lead ? `Lead with "${lead.title}". Evidence: ${lead.evidence}` : "The site is in good shape — lead with a specific growth idea rather than problems.";
  const svc = opp.recommended;
  const quick = r.quickWins.length;
  const objections: SalesIntel["objections"] = [
    { objection: "We already have a website.", response: `It's about what the site does for enquiries, not whether you have one. Show: ${r.issues.slice(0, 2).map((i) => i.title.toLowerCase()).join("; ") || "the audit findings"}.` },
    { objection: "It's too expensive right now.", response: `Offer a phased start: ${quick ? `${quick} quick wins` : "quick fixes"} first${services(r).includes("s8") ? " via SEO + Performance" : ""}, then the larger build. Payments can be split by milestone.` },
    { objection: "Most of our clients come from referrals.", response: `Referred clients check the website before calling. ${r.issues.find((i) => i.category === "trust")?.title ?? "Stronger proof on the site"} weakens that moment.` },
    { objection: "We don't have time for a website project.", response: `Arkria handles structure, copy and design; the team only reviews. Typical delivery ~${svc ? Math.max(2, Math.round(svc.hours / 30)) : 4} weeks.` },
  ];
  const mob = r.issues.find((i) => i.category === "mobile" && (i.severity === "high" || i.severity === "critical"));
  if (mob) objections.push({ objection: "Our website works fine.", response: `It may on a laptop — on a phone: ${mob.evidence}` });
  const name = ctx.home?.title?.split(/[|–—-]/)[0].trim() || ctx.site.host.replace(/^www\./, "");
  const pitch = [
    `Hi — I was looking at ${ctx.site.host.replace(/^www\./, "")}.`,
    lead ? `${lead.evidence}` : "",
    lead ? lead.impact : "",
    svc ? `At ${studio} we'd approach this with a ${svc.name.toLowerCase()}, focused on ${(opp.improvementAreas.slice(0, 3).join(", ") || "the issues above").toLowerCase()}.` : `At ${studio} we'd start with a few focused improvements.`,
    `I've put together a short audit for ${name} — happy to walk you through it in 15 minutes?`,
  ].filter(Boolean).join(" ");
  return { leadQuality: { level, reasons: leadReasons }, whyItMatters: why, angle, objections, pitch };
}

const services = (r: AuditResult) => [r.opportunity.recommended?.serviceId, ...r.opportunity.secondary.map((s) => s.serviceId)].filter(Boolean) as string[];
