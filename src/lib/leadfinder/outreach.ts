import type { Prospect, Settings, Signal } from "../types";
import { dialDigits, isForeign, marketOf, moneyFor, type Fx } from "./markets";

// Evidence-based outreach: observation → opportunity → solution → CTA. Every
// sentence is built from something we actually detected; nothing is invented.
// These are drafts for a person to review and send — nothing is sent from here.

export type Channel = "whatsapp" | "email" | "instagram" | "linkedin" | "call";
export const CHANNELS: { id: Channel; label: string }[] = [
  { id: "whatsapp", label: "WhatsApp" },
  { id: "email", label: "Email" },
  { id: "instagram", label: "Instagram DM" },
  { id: "linkedin", label: "LinkedIn" },
  { id: "call", label: "Call script" },
];

interface Angle { observation: string; opportunity: string }

const ANGLES: Partial<Record<Signal, (p: Prospect) => Angle>> = {
  no_website: (p) => ({
    observation: `I came across ${p.name}${p.city ? ` in ${p.city}` : ""}${p.reviewCount ? ` — ${p.reviewCount} Google reviews${p.rating ? ` at ${p.rating.toFixed(1)}★` : ""} is a strong reputation` : ""}, but I couldn't find a website for the business.`,
    opportunity: "People who search for you online currently have nowhere to see your work, compare options or enquire.",
  }),
  listing_old_website: (p) => ({
    observation: p.website
      ? `I noticed the website button on your Google listing goes to ${host(p.websiteCheck?.listingWebsite)} rather than ${host(p.website)}.`
      : `I noticed the website button on your Google listing goes to ${host(p.websiteCheck?.listingWebsite)} rather than a site of your own.`,
    opportunity: "People who find you on Google Maps may be landing on the wrong page before they ever see your current work.",
  }),
  website_unreachable: (p) => ({
    observation: `I tried visiting ${host(p.website)} and it didn't load for me.`,
    opportunity: "Anyone clicking through from Google or Instagram may be hitting the same wall and leaving.",
  }),
  outdated_website: (p) => ({
    observation: `I had a look at ${host(p.website)}. ${topIssue(p) ?? "It looks like it was built a while ago."}`,
    opportunity: "An older site can quietly undersell a business that's doing well offline.",
  }),
  not_mobile_friendly: (p) => ({
    observation: `I opened ${host(p.website)} on my phone and it doesn't adapt to mobile screens.`,
    opportunity: "Most visitors will be on their phones, and a desktop-only layout makes it hard for them to enquire.",
  }),
  basic_website: (p) => ({
    observation: `I had a look at ${host(p.website)}. ${topIssue(p) ?? "It covers the basics."}`,
    opportunity: "With a few focused changes it could turn more visitors into enquiries.",
  }),
  no_online_store: (p) => ({
    observation: `${p.name} ${p.website ? `shows products on ${host(p.website)}` : "sells products"}, but I couldn't find a way to buy online.`,
    opportunity: "An online store would let customers order directly, beyond walk-ins and DMs.",
  }),
  no_cta: (p) => ({
    observation: `On ${host(p.website)} I couldn't find a clear way to call, book or enquire from the homepage.`,
    opportunity: "A clear next step on the first screen usually lifts enquiries noticeably.",
  }),
  slow_website: (p) => ({
    observation: `${host(p.website)} ${p.audit?.pagespeed ? `scored ${p.audit.pagespeed.performance}/100 on Google's PageSpeed mobile test` : "was slow to load when I checked"}.`,
    opportunity: "Slow pages lose visitors before they see anything, and Google ranks them lower.",
  }),
  weak_seo: (p) => ({
    observation: `${host(p.website)} is missing some search basics — ${seoIssue(p) ?? "titles and descriptions"}.`,
    opportunity: "Fixing these helps you show up when people nearby search for what you offer.",
  }),
  support_heavy: (p) => ({
    observation: `${p.name} clearly gets a lot of customer interest${p.reviewCount ? ` (${p.reviewCount} Google reviews)` : ""}.`,
    opportunity: "Answering the same questions about timings, pricing and availability takes a lot of team time.",
  }),
  booking_business: (p) => ({
    observation: `${p.name} runs on appointments and bookings.`,
    opportunity: "Letting customers book and manage visits themselves saves calls and reduces no-shows.",
  }),
  tech_business: (p) => ({
    observation: `I came across ${p.name}.`,
    opportunity: "Growing product teams often need extra hands for dashboards, portals and internal tools.",
  }),
};

const host = (url?: string) => {
  try { return new URL(/^https?:/.test(url ?? "") ? url! : `https://${url}`).hostname.replace(/^www\./, ""); } catch { return url ?? "your website"; }
};
// Client-facing wording for audit findings (the audit itself keeps the technical evidence).
const PLAIN: Record<string, (p: Prospect) => string> = {
  no_viewport: () => "it doesn't adapt to phone screens",
  legacy_markup: () => "it's built with older web techniques",
  stale_copyright: (p) => `the footer still says © ${p.audit?.found.copyrightYear}`,
  no_https: () => "browsers mark it as \"Not secure\"",
  slow_response: () => "it's slow to load",
  no_cta: () => "there's no clear way to call, book or enquire from the homepage",
  no_form: () => "there's no enquiry form",
  no_whatsapp: () => "there's no WhatsApp button",
  no_title: () => "it's missing basic search information",
  no_meta_description: () => "it's missing basic search information",
  thin_content: () => "there's very little about your work on it",
};
const topIssue = (p: Prospect) => {
  const order = Object.keys(PLAIN);
  const found = (p.audit?.findings ?? []).filter((f) => PLAIN[f.id]).sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
  const bits = [...new Set(found.map((f) => PLAIN[f.id](p)))].slice(0, 2);
  return bits.length ? `I noticed ${bits.join(" and ")}.` : undefined;
};
const seoIssue = (p: Prospect) => p.audit?.findings.filter((f) => f.category === "seo").slice(0, 2).map((f) => f.issue.toLowerCase()).join(" and ");

const ORDER: Signal[] = ["no_website", "website_unreachable", "listing_old_website", "no_online_store", "outdated_website", "not_mobile_friendly", "slow_website", "no_cta", "weak_seo", "basic_website", "support_heavy", "booking_business", "tech_business"];

export function angleFor(p: Prospect): Angle {
  const serviceSignals = new Set(p.match ? ORDER.filter((s) => p.signals.includes(s)) : []);
  for (const s of ORDER) if (serviceSignals.has(s) && ANGLES[s]) return ANGLES[s]!(p);
  return {
    observation: `I came across ${p.name}${p.city ? ` in ${p.city}` : ""}.`,
    opportunity: "I had a few ideas for how your online presence could bring in more enquiries.",
  };
}

const solutionLine = (p: Prospect, studio: string) => {
  const m = p.match;
  if (!m) return `${studio} is a small studio that designs and builds websites and digital products for growing businesses.`;
  const what: Record<string, string> = {
    s1: "a fast, mobile-first website with clear enquiry options",
    s2: "a focused landing page built to turn visitors into enquiries",
    s3: "a premium website that reflects the quality of your work",
    s4: "an online store with payments and order management",
    s5: "a custom dashboard or web app for your team",
    s6: "a mobile app for bookings and customer engagement",
    s7: "an AI assistant that answers customer questions and captures leads 24/7",
    s8: "a speed and SEO tune-up for your current site",
  };
  return `At ${studio} we build ${what[m.serviceId] ?? m.serviceName.toLowerCase()}.`;
};

export interface Draft { subject?: string; body: string }

// The starting price in the lead's currency. Undefined when the lead is abroad
// and no exchange rate is saved: a rupee amount would mean nothing to them.
export function priceText(p: Prospect, fx?: Fx): string | undefined {
  if (!p.match) return undefined;
  const m = moneyFor(p.country, fx);
  return m.needsRate ? undefined : m.fmt(p.match.price);
}

// Where a first message should go. WhatsApp is the norm in India and the Gulf;
// elsewhere, email and calls are more usual.
export const preferredChannel = (p: Prospect): Channel => (marketOf(p.country)?.whatsapp === false ? "email" : "whatsapp");

export function outreach(p: Prospect, channel: Channel, s: Pick<Settings, "owner" | "studio" | "phone" | "website">, fx?: Fx): Draft {
  const a = angleFor(p);
  const greet = p.decisionMaker?.name ? `Hi ${p.decisionMaker.name.split(" ")[0]}` : "Hi";
  const me = s.owner || "the team";
  const studio = s.studio || "Arkria";
  const sign = [`— ${me}, ${studio}`, s.website].filter(Boolean).join("\n");
  const sol = solutionLine(p, studio);
  const price = priceText(p, fx);
  const via = marketOf(p.country)?.whatsapp === false ? "email" : "WhatsApp";
  // Cold email abroad always gives an easy way out.
  const optOut = isForeign(p.country) ? "\n\nIf this isn't relevant, just let me know and I won't follow up." : "";

  switch (channel) {
    case "whatsapp":
      return { body: `${greet}, this is ${me} from ${studio}.\n\n${a.observation} ${a.opportunity}\n\n${sol} Happy to share a couple of quick ideas for ${p.name} — would a 10-minute call this week work?` };
    case "instagram":
      return { body: `${greet}! ${a.observation.replace(/^I came across/, "Came across")} ${a.opportunity}\n\n${sol} Would it be okay if I sent over 2–3 quick ideas?` };
    case "linkedin":
      return { body: `${greet}, ${a.observation.charAt(0).toLowerCase() + a.observation.slice(1)} ${a.opportunity} ${sol} Open to a short conversation?` };
    case "email":
      return {
        subject: p.websiteStatus === "none" ? `A website for ${p.name}` : `A few ideas for ${p.name}'s website`,
        body: `${greet},\n\n${a.observation}\n\n${a.opportunity}\n\n${sol}${price ? ` Projects like this typically start from ${price}.` : ""}\n\nWould you be open to a 15-minute call to see if it's a fit? I can share a quick audit beforehand, no obligation.${optOut}\n\n${sign}`,
      };
    case "call":
      return {
        body: [
          `OPEN: "Hi, this is ${me} from ${studio}. Am I speaking with ${p.decisionMaker?.name ?? "the owner or someone who handles marketing"}?"`,
          `REASON: "${a.observation}"`,
          `OPPORTUNITY: "${a.opportunity}"`,
          `SOLUTION: "${sol}"`,
          `QUESTION: "How are most of your new customers finding you right now?"`,
          `CTA: "Could I send you a short audit by ${via === "email" ? "email" : "WhatsApp"} and set up 15 minutes to walk through it?"`,
          `IF BUSY: "No problem — what's the best time or number to reach you?"`,
        ].join("\n\n"),
      };
  }
}

// A short, shareable audit a client can read in 30 seconds.
export function miniAudit(p: Prospect, fx?: Fx): string {
  const lines: string[] = [`Quick digital audit — ${p.name}`, ""];
  if (p.websiteStatus === "none") lines.push("• Website: none found on the business listing.");
  else if (p.audit?.ok) {
    const sc = p.audit.scores;
    lines.push(`• Website: ${host(p.website)} (checked ${new Date(p.audit.analyzedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })})`);
    const NAMES = { mobile: "Mobile", seo: "SEO", performance: "Speed", conversion: "Enquiry flow" } as const;
    const bits = (["mobile", "seo", "performance", "conversion"] as const).filter((k) => sc[k] !== undefined).map((k) => `${NAMES[k]} ${sc[k]}/100`);
    if (bits.length) lines.push(`• Scores: ${bits.join(" · ")}`);
    if (p.audit.pagespeed) lines.push(`• Google PageSpeed (mobile): ${p.audit.pagespeed.performance}/100`);
  } else if (p.website) lines.push(`• Website: ${host(p.website)} — ${p.audit ? "could not be loaded" : "not checked yet"}.`);
  if (p.reviewCount !== undefined) lines.push(`• Google: ${p.reviewCount} reviews${p.rating ? `, ${p.rating.toFixed(1)}★` : ""}`);

  const top = (p.audit?.findings ?? []).slice().sort((a, b) => rank(a.severity) - rank(b.severity)).slice(0, 3);
  if (top.length) {
    lines.push("", "Top issues:");
    top.forEach((f, i) => lines.push(`${i + 1}. ${f.issue} — ${f.improvement}`));
  } else if (p.websiteStatus === "none") {
    lines.push("", "Top opportunity:", "1. A simple, mobile-first website so people searching online can see your work and enquire directly.");
  }
  const price = priceText(p, fx);
  if (p.match) lines.push("", `Recommended: ${p.match.serviceName}${price ? ` (from ${price})` : ""}`);
  return lines.join("\n");
}

const rank = (s: "high" | "medium" | "low") => (s === "high" ? 0 : s === "medium" ? 1 : 2);

export function waLink(phone: string | undefined, text: string, country?: string) {
  const num = dialDigits(phone, country);
  return num ? `https://wa.me/${num}?text=${encodeURIComponent(text)}` : undefined;
}
