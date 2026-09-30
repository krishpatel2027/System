import type { PageSpeedData } from "../types";

// Google PageSpeed Insights (Lighthouse lab data) plus Chrome UX Report field
// data when Google has it for the page or origin. Works without a key at a low
// quota; GOOGLE_PAGESPEED_API_KEY raises it. Missing values stay missing.

interface PsiJson {
  lighthouseResult?: {
    categories?: Record<string, { score: number | null }>;
    audits?: Record<string, { numericValue?: number; title?: string; details?: { type?: string; overallSavingsMs?: number; overallSavingsBytes?: number } }>;
  };
  loadingExperience?: { metrics?: Record<string, { percentile: number }> ; origin_fallback?: boolean };
  originLoadingExperience?: { metrics?: Record<string, { percentile: number }> };
  error?: { message?: string };
}

export async function pagespeed(url: string): Promise<PageSpeedData> {
  const key = (process.env.GOOGLE_PAGESPEED_API_KEY ?? "").trim();
  const q = new URLSearchParams({ url, strategy: "mobile" });
  if (key) q.set("key", key);
  for (const c of ["performance", "accessibility", "seo", "best-practices"]) q.append("category", c);
  let res: Response;
  try {
    res = await fetch(`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${q}`, { signal: AbortSignal.timeout(58_000), cache: "no-store" });
  } catch (e) {
    return { ok: false, strategy: "mobile", error: (e as Error).name === "TimeoutError" ? "PageSpeed took too long to respond." : "PageSpeed couldn't be reached." };
  }
  const j = (await res.json().catch(() => ({}))) as PsiJson;
  if (!res.ok) {
    const msg = res.status === 429 ? `PageSpeed quota reached${key ? "" : " (no API key set — add GOOGLE_PAGESPEED_API_KEY for a higher quota)"}.` : `PageSpeed: ${j.error?.message?.slice(0, 160) ?? `HTTP ${res.status}`}`;
    return { ok: false, strategy: "mobile", error: msg };
  }
  const cats = j.lighthouseResult?.categories ?? {};
  const audits = j.lighthouseResult?.audits ?? {};
  const s = (k: string) => Math.round((cats[k]?.score ?? 0) * 100);
  const n = (k: string) => (audits[k]?.numericValue !== undefined ? Math.round(audits[k]!.numericValue! * (k === "cumulative-layout-shift" ? 1000 : 1)) / (k === "cumulative-layout-shift" ? 1000 : 1) : undefined);
  const pageField = j.loadingExperience?.metrics && !j.loadingExperience.origin_fallback ? j.loadingExperience.metrics : undefined;
  const fieldSrc = pageField ?? j.originLoadingExperience?.metrics;
  const f = (k: string) => (fieldSrc?.[k]?.percentile !== undefined ? fieldSrc[k].percentile : undefined);
  const field = fieldSrc && Object.keys(fieldSrc).length ? {
    scope: pageField ? ("page" as const) : ("origin" as const),
    lcp: f("LARGEST_CONTENTFUL_PAINT_MS"),
    inp: f("INTERACTION_TO_NEXT_PAINT"),
    cls: f("CUMULATIVE_LAYOUT_SHIFT_SCORE") !== undefined ? f("CUMULATIVE_LAYOUT_SHIFT_SCORE")! / 100 : undefined,
    fcp: f("FIRST_CONTENTFUL_PAINT_MS"),
    ttfb: f("EXPERIMENTAL_TIME_TO_FIRST_BYTE"),
  } : undefined;
  const opportunities = Object.entries(audits)
    .filter(([, a]) => a.details?.type === "opportunity" && ((a.details.overallSavingsMs ?? 0) > 150 || (a.details.overallSavingsBytes ?? 0) > 50_000))
    .map(([id, a]) => ({ id, title: a.title ?? id, savingsMs: a.details?.overallSavingsMs ? Math.round(a.details.overallSavingsMs) : undefined, savingsBytes: a.details?.overallSavingsBytes ? Math.round(a.details.overallSavingsBytes) : undefined }))
    .sort((a, b) => (b.savingsMs ?? 0) - (a.savingsMs ?? 0))
    .slice(0, 10);
  return {
    ok: true,
    strategy: "mobile",
    fetchedAt: new Date().toISOString(),
    scores: { performance: s("performance"), accessibility: s("accessibility"), seo: s("seo"), bestPractices: s("best-practices") },
    lab: { fcp: n("first-contentful-paint"), lcp: n("largest-contentful-paint"), cls: n("cumulative-layout-shift"), tbt: n("total-blocking-time"), si: n("speed-index"), ttfb: n("server-response-time") },
    field,
    opportunities,
  };
}
