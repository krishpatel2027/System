import type { AuditResult, Finding, Strength } from "../types";
import { type Ctx, type ModuleOut, finding as F, strength as S, list, path, plural } from "./context";

// Mobile experience, responsive breakpoints, UI / visual design, first impression.

export function mobile(ctx: Ctx): ModuleOut {
  const f: Finding[] = [];
  const s: Strength[] = [];
  const noViewport = ctx.pages.filter((p) => !p.viewport);
  if (noViewport.length) f.push(F("mobile.viewport", noViewport.length === ctx.pages.length ? "critical" : "high", "mobile", "Not set up for mobile screens",
    `${noViewport.length === ctx.pages.length ? "No page" : `${plural(noViewport.length, "page")}`} ${noViewport.length === ctx.pages.length ? "has" : "lack"} a <meta name="viewport"> tag${noViewport.length < ctx.pages.length ? ` (${list(noViewport.map((p) => path(p.finalUrl)))})` : ""}, so phones render the desktop layout zoomed out.`,
    "Most visitors are on phones; they have to pinch and zoom to read or tap anything.", "Rebuild the layout responsively and add <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">.",
    { pages: noViewport.map((p) => p.finalUrl), affects: ["mobile", "ux", "seo", "conversion"], effort: "project", kind: "ux" }));
  else if (ctx.pages.length) s.push(S("mobile", "Viewport configured for mobile on every page"));
  const zoom = ctx.pages.find((p) => p.a11y.zoomDisabled);
  if (zoom) f.push(F("mobile.zoom", "low", "accessibility", "Pinch-zoom is disabled", `The viewport tag (${zoom.viewport}) prevents zooming.`, "People with low vision can't enlarge text.", "Remove user-scalable=no / maximum-scale=1.", { pages: [zoom.finalUrl], affects: ["mobile", "accessibility"], kind: "ux" }));
  if (ctx.home && ctx.home.mediaQueries === 0 && !ctx.home.stylesheets.length && ctx.home.viewport === undefined) f.push(F("mobile.no_responsive_css", "high", "mobile", "No responsive styles detected", "The homepage has no media queries in its inline styles and no external stylesheets.", "The layout can't adapt to phone screens.", "Rebuild with a responsive layout.", { pages: [ctx.home.finalUrl], affects: ["mobile"], effort: "project", kind: "ux" }));

  const runs = ctx.runs.filter((r) => r.viewport === "mobile" && r.mobile);
  const where = (r: (typeof runs)[number]) => path(r.url);
  const over = runs.filter((r) => r.mobile!.overflowPx > 5);
  if (over.length) f.push(F("mobile.overflow", "high", "mobile", `Pages scroll sideways on phones`, `At 390px wide: ${over.map((r) => `${where(r)} is ${r.mobile!.overflowPx}px too wide`).join("; ")}. Culprits: ${list(over[0].mobile!.offenders, 3) || "not identified"}.`, "Content is cut off and the page wobbles sideways while scrolling.", "Fix fixed-width elements (tables, images, iframes, wide containers) with max-width: 100% or responsive rules.", { pages: over.map((r) => r.url), affects: ["mobile", "ux"], source: "browser", screenshot: over[0].screenshot, kind: "ux", samples: over.flatMap((r) => r.mobile!.offenders) }));
  const small = runs.filter((r) => r.mobile!.smallText > 10);
  if (small.length) f.push(F("mobile.small_text", "medium", "mobile", "Small text on mobile", `${small.map((r) => `${where(r)}: ${r.mobile!.smallText} text elements under 12px`).join("; ")} — e.g. ${list(small[0].mobile!.smallTextSamples, 2)}.`, "Hard to read without zooming.", "Use at least 16px for body text and 12px for captions on mobile.", { pages: small.map((r) => r.url), affects: ["mobile", "accessibility"], source: "browser", kind: "ux" }));
  const taps = runs.filter((r) => r.mobile!.tapSmall > 5);
  if (taps.length) f.push(F("mobile.tap", "medium", "mobile", "Tap targets too small on phones", `Controls smaller than 24×24px at 390px: ${taps.map((r) => `${where(r)} (${r.mobile!.tapSmall})`).join(", ")}. e.g. ${list(taps[0].mobile!.tapSamples, 3)}.`, "Visitors mis-tap or can't hit the control.", "Make tap targets at least 44×44px with spacing between them.", { pages: taps.map((r) => r.url), affects: ["mobile", "accessibility", "ux"], source: "browser", kind: "ux", samples: taps.flatMap((r) => r.mobile!.tapSamples) }));
  const fixed = runs.filter((r) => r.mobile!.fixedCoverage > 0.25);
  if (fixed.length) f.push(F("mobile.fixed", "medium", "mobile", `Sticky elements cover up to ${Math.round(Math.max(...fixed.map((r) => r.mobile!.fixedCoverage)) * 100)}% of the phone screen`, `Fixed/sticky headers, bars or buttons cover a large part of the first screen at 390×844 on ${list(fixed.map(where))}.`, "Less room for content; feels cramped.", "Shrink the sticky header on scroll and keep floating buttons small.", { pages: fixed.map((r) => r.url), affects: ["mobile", "ux"], source: "browser", kind: "ux", screenshot: fixed[0].screenshot }));
  const pops = runs.filter((r) => r.mobile!.popups.length);
  if (pops.length) f.push(F("mobile.popup", "medium", "mobile", "Pop-up covers the page on mobile", `An overlay covering over 40% of the screen was visible after load on ${list(pops.map(where))}: "${pops[0].mobile!.popups[0]}".`, "Intrusive pop-ups annoy visitors and Google penalises them on mobile.", "Delay pop-ups, make them small, or show them only on exit intent.", { pages: pops.map((r) => r.url), affects: ["mobile", "ux", "seo"], source: "browser", kind: "ux", screenshot: pops[0].screenshot }));
  const hm = runs.find((r) => r.url === ctx.mob?.url);
  if (hm) {
    const m = hm.mobile!;
    if (!m.ctaAboveFold.length) f.push(F("mobile.cta", "medium", "conversion", "No call-to-action on the first mobile screen", "No call, WhatsApp, book or enquire button is visible on the homepage's first screen at 390×844.", "Mobile visitors must scroll or hunt to contact you.", "Put one clear primary button (e.g. \"WhatsApp us\" or \"Book a visit\") in the first screen, plus a sticky contact button.", { pages: [hm.url], affects: ["mobile", "conversion", "leadGeneration"], source: "browser", kind: "business", screenshot: hm.screenshot }));
    else s.push(S("mobile", `Call-to-action visible on the first mobile screen ("${m.ctaAboveFold[0]}")`));
    if (!m.navToggle && (ctx.home?.nav.items.length ?? 0) > 6) f.push(F("mobile.nav", "low", "mobile", "No compact mobile menu detected", `The homepage navigation has ${ctx.home?.nav.items.length} links and no menu toggle was found on mobile.`, "A long list of links pushes content down on phones.", "Use a compact menu (hamburger or bottom bar) on mobile.", { pages: [hm.url], affects: ["mobile", "ux"], source: "browser", kind: "ux" }));
    if (m.overflowPx <= 5 && ctx.home?.viewport) s.push(S("mobile", "No sideways scrolling on the homepage at 390px"));
  }

  // Breakpoints
  const bad = ctx.raw.breakpoints.filter((b) => b.ok && b.overflowPx > 5);
  if (bad.length) {
    const worst = bad.sort((a, b) => b.overflowPx - a.overflowPx)[0];
    f.push(F("responsive.overflow", bad.some((b) => b.width <= 414) ? "high" : "medium", "mobile", `Layout breaks at ${list(bad.map((b) => `${b.width}px`), 5)}`, `Horizontal overflow at ${bad.map((b) => `${b.width}px (+${b.overflowPx}px)`).join(", ")}. Worst offenders at ${worst.width}px: ${list(worst.offenders, 3)}.`, "Content is clipped and the page scrolls sideways on those screen sizes.", "Add responsive rules for these widths; constrain wide elements with max-width: 100%.", { pages: ctx.home ? [ctx.home.finalUrl] : [], affects: ["mobile", "ux", "design"], source: "browser", screenshot: worst.screenshot, kind: "ux", effort: "project" }));
  } else if (ctx.raw.breakpoints.filter((b) => b.ok).length >= 6) s.push(S("mobile", "No layout overflow from 320px to 1440px"));

  return { findings: f, strengths: s };
}

export function mobileRating(ctx: Ctx, score: number | null): AuditResult["mobileRating"] {
  if (score === null) return "Not measured";
  return score >= 90 ? "Excellent" : score >= 75 ? "Good" : score >= 50 ? "Needs work" : "Poor";
}

export function design(ctx: Ctx): ModuleOut {
  const f: Finding[] = [];
  const s: Strength[] = [];
  const d = ctx.desk?.design;
  const hp = ctx.home ? [ctx.home.finalUrl] : [];
  if (d) {
    const fams = d.fontFamilies.filter((x) => !/icon|awesome|material|eicons|dashicons/i.test(x.family) && x.count >= 2);
    if (fams.length > 3) f.push(F("design.typefaces", "medium", "design", `${fams.length} typefaces in use`, `Text uses ${list(fams.map((x) => x.family), 5)}.`, "Too many typefaces make a site feel inconsistent and less premium.", "Standardise on one heading and one body typeface.", { pages: hp, affects: ["design"], source: "browser", kind: "ux" }));
    else if (fams.length && fams.length <= 2) s.push(S("design", `Consistent typography (${fams.map((x) => x.family).join(" + ")})`));
    const sizes = d.fontSizes.filter((x) => x.count >= 2).length;
    if (sizes > 12) f.push(F("design.type_scale", "low", "design", `${sizes} different font sizes`, `Text on the homepage uses ${sizes} distinct sizes (counting sizes used at least twice).`, "An inconsistent type scale weakens hierarchy and polish.", "Define a type scale of 5–7 sizes and apply it consistently.", { pages: hp, affects: ["design"], source: "browser", kind: "ux" }));
    if (d.h1Size && d.bodySize && d.h1Size < d.bodySize * 1.6) f.push(F("design.hierarchy", "medium", "design", "Weak visual hierarchy", `The main heading (${d.h1Size}px) is only ${(d.h1Size / d.bodySize).toFixed(1)}× the body text (${d.bodySize}px).`, "Visitors can't tell at a glance what matters most.", "Make the H1 clearly dominant (roughly 2.5–4× body size on desktop) and group supporting text.", { pages: hp, affects: ["design", "ux"], source: "browser", kind: "ux", screenshot: ctx.desk?.screenshot }));
    if (d.bodySize && d.bodySize < 14) f.push(F("design.body_size", "medium", "design", `Body text is ${d.bodySize}px`, `The most common paragraph size on desktop is ${d.bodySize}px.`, "Small text is tiring to read.", "Use 16–18px body text.", { pages: hp, affects: ["design", "accessibility"], source: "browser", kind: "ux" }));
    if (d.lineHeightRatio && d.lineHeightRatio < 1.3) f.push(F("design.line_height", "low", "design", "Tight line spacing", `Paragraph line-height is about ${d.lineHeightRatio}× the font size.`, "Dense text is harder to read.", "Use a line-height of 1.5–1.7 for body copy.", { pages: hp, affects: ["design"], source: "browser", kind: "ux" }));
    const btns = d.buttonStyles.filter((b) => b.count >= 1);
    if (btns.length > 4) f.push(F("design.buttons", "low", "design", `${btns.length} different button styles`, `Buttons use ${btns.length} different combinations of colour, radius and size (e.g. "${btns[0].sample}", "${btns[1].sample}").`, "Inconsistent components look unpolished and dilute the primary action.", "Define primary, secondary and text button styles and use them everywhere.", { pages: hp, affects: ["design", "conversion"], source: "browser", kind: "ux" }));
    const colors = d.textColors.filter((c) => c.count >= 2).length;
    if (colors > 10) f.push(F("design.colors", "low", "design", `${colors} different text colours`, `The homepage uses ${colors} distinct text colours.`, "A scattered palette weakens brand consistency.", "Limit text to 2–3 neutrals plus the brand/accent colour.", { pages: hp, affects: ["design"], source: "browser", kind: "ux" }));
    if (d.sectionPaddings.length > 10) f.push(F("design.spacing", "low", "design", "Inconsistent section spacing", `Sections use ${d.sectionPaddings.length} different top-padding values (${list(d.sectionPaddings.map((x) => `${x}px`), 6)}).`, "Irregular spacing makes layouts feel unplanned.", "Use a spacing scale (e.g. 8px steps) for section padding.", { pages: hp, affects: ["design"], source: "browser", kind: "ux" }));
    if (d.ctaContrast && d.ctaContrast.ratio < 1.8) f.push(F("design.cta_contrast", "medium", "design", "Primary button blends into the background", `The first-screen button "${d.ctaContrast.text}" has a ${d.ctaContrast.ratio}:1 contrast with the area around it.`, "The main action doesn't stand out.", "Give the primary button a distinct, high-contrast colour used for nothing else.", { pages: hp, affects: ["design", "conversion"], source: "browser", kind: "ux", screenshot: ctx.desk?.screenshot }));
  }
  for (const o of ctx.ai?.design ?? []) {
    if (o.positive) s.push(S("design", o.observation, `AI ANALYSIS · ${o.aspect}`));
    else f.push(F(`ai.design.${o.aspect.replace(/\s+/g, "_")}.${f.length}`, o.severity === "critical" ? "high" : o.severity, "design", `${o.aspect[0].toUpperCase()}${o.aspect.slice(1)}: AI analysis`, o.observation, "Affects how professional and trustworthy the site feels.", "Review in a redesign of the affected sections.", { pages: hp, affects: ["design"], source: "ai", kind: "ux", screenshot: ctx.desk?.screenshot, effort: "project" }));
  }
  return { findings: f, strengths: s };
}

export function firstImpression(ctx: Ctx): AuditResult["firstImpression"] {
  const out: AuditResult["firstImpression"]["observations"] = [];
  const fv = ctx.desk?.firstViewport ?? ctx.mob?.firstViewport;
  const home = ctx.home;
  const h1 = fv?.h1 ?? home?.headings.h1[0];
  out.push({ text: h1 ? `Main heading: "${h1.slice(0, 120)}"` : "No main heading (H1) on the homepage", basis: "detected" });
  if (fv) out.push({ text: fv.ctas.length ? `Buttons visible in the first screen (desktop): ${fv.ctas.slice(0, 4).map((c) => `"${c}"`).join(", ")}` : "No call-to-action button is visible in the first screen (desktop)", basis: "detected" });
  if (ctx.mob?.mobile) out.push({ text: ctx.mob.mobile.ctaAboveFold.length ? `First mobile screen offers: ${ctx.mob.mobile.ctaAboveFold.slice(0, 3).map((c) => `"${c}"`).join(", ")}` : "No call-to-action on the first mobile screen", basis: "detected" });
  if (home?.metaDescription) out.push({ text: `Search snippet: "${home.metaDescription.slice(0, 140)}"`, basis: "detected" });
  for (const o of ctx.ai?.firstImpression.observations ?? []) out.push({ text: o, basis: "ai" });
  return { observations: out.slice(0, 9) };
}
