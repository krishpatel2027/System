"use client";
import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { inr, uid } from "@/lib/utils";
import { Card, Btn, Field, inputCls, Badge } from "@/components/ui";
import { ArrowRight, Copy, Download, Save, FolderOpen, RotateCcw, Printer } from "lucide-react";
import {
  FEATURES, CALC_PACKAGES, PROJECT_TYPES, HOURLY, CARE, POLICIES, COMPLEXITY_MAP,
} from "@/lib/pricing-data";
import { PENDING_KEY, PRICING_SAVE_KEY as SAVE_KEY } from "./_studio";
import type { QuoteItem } from "@/lib/types";

type Tier = "entry" | "standard" | "premium";
const TABS = ["Calculator", "Packages", "Rate Card", "Care Plans", "Policies"] as const;

export default function PricingPage() {
  const router = useRouter();
  const [tab, setTab] = useState<(typeof TABS)[number]>("Calculator");

  // project inputs (same model as original studio)
  const [projectType, setProjectType] = useState("Website 5–8 pages");
  const [pkg, setPkg] = useState("Business");
  const [complexity, setComplexity] = useState("Standard");
  const [pages, setPages] = useState(5);
  const [margin, setMargin] = useState(40);
  const [contingency, setContingency] = useState(10);
  const [rush, setRush] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [gst, setGst] = useState(18);

  // feature builder state: index-keyed
  const [sel, setSel] = useState<Record<number, boolean>>({});
  const [tier, setTier] = useState<Record<number, Tier>>({});
  const [qty, setQty] = useState<Record<number, number>>({});
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [rateQ, setRateQ] = useState("");
  const [rateCat, setRateCat] = useState("");

  const cats = useMemo(() => [...new Set(FEATURES.map((f) => f.category))], []);
  const visible = useMemo(
    () =>
      FEATURES.map((f, i) => ({ ...f, i })).filter(
        (f) =>
          (!q || `${f.feature} ${f.category} ${f.notes}`.toLowerCase().includes(q.toLowerCase())) &&
          (!cat || f.category === cat)
      ),
    [q, cat]
  );
  const rateRows = useMemo(
    () =>
      FEATURES.filter(
        (f) =>
          (!rateQ || `${f.feature} ${f.category} ${f.notes}`.toLowerCase().includes(rateQ.toLowerCase())) &&
          (!rateCat || f.category === rateCat)
      ),
    [rateQ, rateCat]
  );

  const selectVisible = (v: boolean) => {
    const n = { ...sel };
    visible.forEach((f) => (n[f.i] = v));
    setSel(n);
  };

  // exact original formula
  const calc = useMemo(() => {
    const base = CALC_PACKAGES.find((p) => p.name === pkg)?.price ?? 0;
    const pkgObj = CALC_PACKAGES.find((p) => p.name === pkg);
    const ft = FEATURES.reduce(
      (s, f, i) => (sel[i] ? s + f[tier[i] ?? "standard"] * (qty[i] ?? 1) : s),
      0
    );
    const mult = COMPLEXITY_MAP[complexity] ?? 1;
    const scope = (base + ft) * mult;
    const cont = (scope * contingency) / 100;
    const rushAmt = (scope * rush) / 100;
    const delivery = scope + cont + rushAmt;
    const preDiscount = delivery / (1 - margin / 100);
    const disc = (preDiscount * discount) / 100;
    const beforeGST = preDiscount - disc;
    const gstAmt = (beforeGST * gst) / 100;
    const total = beforeGST + gstAmt;
    const rounded = Math.ceil(beforeGST / 5000) * 5000;
    const internalCost = Math.max(1, delivery * (1 - margin / 100));
    const actualMargin = beforeGST ? (beforeGST - internalCost) / beforeGST : 0;
    const selectedCount = FEATURES.filter((_, i) => sel[i]).length;

    const selectedNames = FEATURES.filter((_, i) => sel[i]).map((f) => `• ${f.feature}`);
    const quoteText =
      `Investment — ${inr(rounded)}\nIncludes\n• ${pkgObj?.scope ?? pages + " pages / screens"}\n• Custom responsive design & development\n` +
      `${selectedNames.slice(0, 12).join("\n") || "• Selected scope/features"}\n` +
      `${selectedCount > 12 ? `• + ${selectedCount - 12} additional selected feature(s)` : ""}\n` +
      `• SEO / performance foundations as scoped\n• Deployment\n` +
      `Third-party subscriptions and usage-based services are billed separately unless explicitly included.\n\n` +
      `GST @ ${gst}%: ${inr(gstAmt)}\nClient total incl. GST: ${inr(total)}`;

    return { base, ft, mult, scope, cont, rushAmt, delivery, preDiscount, disc, beforeGST, gstAmt, total, rounded, internalCost, actualMargin, selectedCount, quoteText, pkgObj };
  }, [pkg, sel, tier, qty, complexity, contingency, rush, margin, discount, gst, pages]);

  const status = calc.actualMargin < 0.3 ? "low" : calc.actualMargin < 0.4 ? "watch" : "healthy";

  const sendToQuote = () => {
    // group selected features by category → client-safe deliverable lines
    const byCat: Record<string, { count: number; sum: number }> = {};
    FEATURES.forEach((f, i) => {
      if (!sel[i]) return;
      const v = f[tier[i] ?? "standard"] * (qty[i] ?? 1);
      byCat[f.category] = byCat[f.category] ?? { count: 0, sum: 0 };
      byCat[f.category].count += 1;
      byCat[f.category].sum += v;
    });
    const items: QuoteItem[] = [
      { id: uid("qi"), label: `${calc.pkgObj?.name ?? pkg} package — ${calc.pkgObj?.scope ?? ""}`, qty: 1, price: Math.round(calc.base * calc.mult) },
      ...Object.entries(byCat).map(([c, v]) => ({
        id: uid("qi"),
        label: `${c} — ${v.count} scoped item${v.count > 1 ? "s" : ""}`,
        qty: 1,
        price: Math.round(v.sum * calc.mult),
      })),
    ];
    const discPct = Math.round((calc.disc / Math.max(1, calc.preDiscount)) * 100);
    try {
      localStorage.setItem(PENDING_KEY, JSON.stringify({ items, discount: Math.round(calc.disc), note: `Margin-adjusted · GST extra` }));
    } catch {}
    router.push("/quotes?action=new&from=pricing");
    void discPct;
  };

  const saveProject = () => {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({ projectType, package: pkg, complexity, pages, margin, contingency, rush, discount, gst, selected: sel, tier, qty }));
      alert("Project saved in this browser.");
    } catch {}
  };
  const loadProject = () => {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return alert("No saved project found.");
      const s = JSON.parse(raw);
      setProjectType(s.projectType); setPkg(s.package); setComplexity(s.complexity); setPages(s.pages);
      setMargin(s.margin); setContingency(s.contingency); setRush(s.rush); setDiscount(s.discount); setGst(s.gst);
      setSel(s.selected ?? {}); setTier(s.tier ?? {}); setQty(s.qty ?? {});
      alert("Saved project loaded.");
    } catch {}
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight">Pricing Studio <span className="font-normal text-neutral-400">· 2026 India model</span></h1>
          <p className="text-[13px] text-neutral-500">143 internal starting prices · complexity, contingency, margin, rush, discount, GST</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Btn variant="outline" onClick={saveProject}><Save size={14} /> Save</Btn>
          <Btn variant="outline" onClick={loadProject}><FolderOpen size={14} /> Load</Btn>
          <Btn variant="outline" onClick={() => window.print()}><Printer size={14} /> PDF</Btn>
          <Btn onClick={sendToQuote}>Send to Quote <ArrowRight size={14} /></Btn>
        </div>
      </div>

      <div className="flex gap-1.5">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`rounded-xl px-3.5 py-2 text-[13.5px] font-medium ${tab === t ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900" : "border border-neutral-200 dark:border-neutral-700"}`}>{t}</button>
        ))}
      </div>

      {tab === "Calculator" && (
        <div className="grid gap-3 lg:grid-cols-[1fr_360px]">
          <div className="space-y-3">
            <Card className="p-5">
              <div className="text-[14px] font-semibold">Project inputs <span className="font-normal text-neutral-400">— internal</span></div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <Field label="Project type"><select className={inputCls} value={projectType} onChange={(e) => setProjectType(e.target.value)}>{PROJECT_TYPES.map((p) => <option key={p.name}>{p.name}</option>)}</select></Field>
                <Field label="Package"><select className={inputCls} value={pkg} onChange={(e) => setPkg(e.target.value)}>{CALC_PACKAGES.map((p) => <option key={p.name}>{p.name}</option>)}</select></Field>
                <Field label="Complexity"><select className={inputCls} value={complexity} onChange={(e) => setComplexity(e.target.value)}>{Object.keys(COMPLEXITY_MAP).map((c) => <option key={c}>{c}</option>)}</select></Field>
                <Field label="Pages / screens"><input type="number" min={0} className={inputCls} value={pages} onChange={(e) => setPages(Number(e.target.value))} /></Field>
                <SliderRow label="Gross margin target" v={margin} set={setMargin} min={20} max={60} />
                <SliderRow label="Contingency" v={contingency} set={setContingency} min={0} max={25} />
                <SliderRow label="Rush premium" v={rush} set={setRush} min={0} max={50} />
                <SliderRow label="Client discount" v={discount} set={setDiscount} min={0} max={20} />
                <SliderRow label="GST" v={gst} set={setGst} min={0} max={28} />
              </div>
              <p className="mt-2 text-[12px] text-neutral-400">Reference: {PROJECT_TYPES.find((p) => p.name === projectType)?.notes} · entry {inr(PROJECT_TYPES.find((p) => p.name === projectType)?.entry ?? 0)} / standard {inr(PROJECT_TYPES.find((p) => p.name === projectType)?.standard ?? 0)} / premium {inr(PROJECT_TYPES.find((p) => p.name === projectType)?.premium ?? 0)}</p>
            </Card>

            <Card className="p-5">
              <div className="text-[14px] font-semibold">Feature builder <span className="font-normal text-neutral-400">— {FEATURES.length} internal starting prices · {calc.selectedCount} selected</span></div>
              <div className="mt-3 flex flex-wrap gap-2">
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search features: CMS, GSAP, booking, AI, payment…" className={`${inputCls} min-w-[220px] flex-1`} />
                <select value={cat} onChange={(e) => setCat(e.target.value)} className={`${inputCls} !w-auto`}><option value="">All categories</option>{cats.map((c) => <option key={c}>{c}</option>)}</select>
                <Btn variant="outline" onClick={() => selectVisible(true)}>Select visible</Btn>
                <Btn variant="outline" onClick={() => selectVisible(false)}>Clear visible</Btn>
              </div>
              <div className="mt-3 max-h-[560px] divide-y divide-neutral-100 overflow-auto rounded-xl border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-700">
                {visible.map((f) => {
                  const t = tier[f.i] ?? "standard";
                  return (
                    <div key={f.i} className="grid grid-cols-[28px_1fr_92px_104px_76px] items-center gap-2 px-3 py-2 hover:bg-neutral-50 dark:hover:bg-neutral-800/50">
                      <input type="checkbox" checked={!!sel[f.i]} onChange={(e) => setSel({ ...sel, [f.i]: e.target.checked })} className="h-4 w-4" />
                      <div className="min-w-0">
                        <div className="truncate text-[13px] font-semibold">{f.feature}</div>
                        <div className="truncate text-[11.5px] text-neutral-500">{f.notes} · {inr(f[t])} / {f.unit}</div>
                      </div>
                      <span className="hidden rounded-full bg-neutral-100 px-2 py-0.5 text-center text-[10.5px] text-neutral-500 sm:block dark:bg-neutral-800">{f.category}</span>
                      <select value={t} onChange={(e) => setTier({ ...tier, [f.i]: e.target.value as Tier })} className="rounded-lg border border-neutral-200 px-1.5 py-1 text-[12px] dark:border-neutral-700 dark:bg-neutral-900">
                        <option value="entry">Entry</option><option value="standard">Standard</option><option value="premium">Premium</option>
                      </select>
                      <input type="number" min={1} value={qty[f.i] ?? 1} onChange={(e) => setQty({ ...qty, [f.i]: Math.max(1, Number(e.target.value) || 1) })} className="rounded-lg border border-neutral-200 px-1.5 py-1 text-[12px] dark:border-neutral-700 dark:bg-neutral-900" />
                    </div>
                  );
                })}
                {visible.length === 0 && <div className="p-6 text-center text-[13px] text-neutral-500">No features match “{q}”.</div>}
              </div>
            </Card>
          </div>

          <Card className="h-fit p-5 lg:sticky lg:top-20">
            <div className="text-[11px] font-semibold uppercase tracking-widest text-neutral-400">Recommended client quote</div>
            <div className="text-[38px] font-bold leading-none tracking-tight">{inr(calc.rounded)}</div>
            <div className="text-[12px] text-neutral-500">before GST · rounded for client presentation</div>
            <div className={`mt-2 rounded-xl px-3 py-2 text-[13px] font-bold ${status === "healthy" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" : status === "watch" ? "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300" : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"}`}>
              {status === "healthy" ? "HEALTHY MARGIN" : status === "watch" ? "WATCH MARGIN — CHECK DISCOUNT" : "LOW MARGIN — REVIEW SCOPE"}
            </div>
            <div className="mt-2 space-y-0 text-[13px]">
              <Row k="Package base" v={inr(calc.base)} />
              <Row k={`Selected features (${calc.selectedCount})`} v={inr(calc.ft)} />
              <Row k={`Complexity ${complexity} ×${calc.mult}`} v={inr((calc.base + calc.ft) * (calc.mult - 1))} />
              <Row k={`Contingency ${contingency}%`} v={inr(calc.cont)} />
              <Row k={`Rush ${rush}%`} v={inr(calc.rushAmt)} />
              <Row k="Delivery value" v={inr(calc.delivery)} />
              <Row k={`Margin-adjusted (${margin}%)`} v={inr(calc.preDiscount)} />
              <Row k={`Discount ${discount}%`} v={"− " + inr(calc.disc)} />
              <Row k="Before GST" v={inr(calc.beforeGST)} />
              <Row k={`GST ${gst}%`} v={inr(calc.gstAmt)} />
              <Row k="Client total" v={inr(calc.total)} big />
              <Row k="Internal cost" v={inr(calc.internalCost)} tone="text-neutral-500" />
              <Row k="Actual margin" v={(calc.actualMargin * 100).toFixed(1) + "%"} tone="text-neutral-500" />
            </div>
            <div className="mt-3 rounded-2xl bg-neutral-900 p-4 text-white dark:bg-neutral-800">
              <div className="text-[10.5px] uppercase tracking-widest text-neutral-400">Client-facing copy</div>
              <pre className="mt-1 max-h-56 overflow-auto whitespace-pre-wrap text-[12.5px] leading-relaxed">{calc.quoteText}</pre>
            </div>
            <div className="mt-2 flex gap-2">
              <Btn variant="outline" className="flex-1 !bg-transparent !text-current" onClick={() => { navigator.clipboard.writeText(calc.quoteText); alert("Quote copied."); }}><Copy size={14} /> Copy</Btn>
              <Btn variant="outline" className="flex-1 !bg-transparent !text-current" onClick={() => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([calc.quoteText], { type: "text/plain" })); a.download = "Arkria-Quote.txt"; a.click(); }}><Download size={14} /> .txt</Btn>
            </div>
            <Btn className="mt-2 w-full" onClick={sendToQuote}>Send to Quote Builder <ArrowRight size={14} /></Btn>
          </Card>
        </div>
      )}

      {tab === "Packages" && (
        <div>
          <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-5">
            {CALC_PACKAGES.map((p) => (
              <Card key={p.name} className={`p-4 ${pkg === p.name ? "ring-2 ring-neutral-900 dark:ring-white" : ""}`}>
                <div className="text-[10.5px] uppercase tracking-widest text-neutral-400">{p.positioning}</div>
                <div className="text-[15px] font-bold">{p.name}</div>
                <div className="text-[20px] font-bold">{inr(p.price)}+</div>
                <div className="text-[12px] text-neutral-500">{p.scope}</div>
                <p className="mt-1 text-[12px]"><b>Best for:</b> {p.bestFor}</p>
                <ul className="mt-1 list-disc pl-4 text-[12px] text-neutral-600 dark:text-neutral-300">{p.included.split(", ").map((x) => <li key={x}>{x}</li>)}</ul>
                <Btn variant="outline" className="mt-2 w-full" onClick={() => { setPkg(p.name); setTab("Calculator"); }}>Use package</Btn>
              </Card>
            ))}
          </div>
          <Card className="mt-3 border-indigo-200 bg-indigo-50/50 p-4 text-[13px] dark:bg-indigo-950/30"><b>Positioning rule:</b> entry websites have genuinely limited scope. Premium animation, custom CMS, portals, apps and complex integrations move the quote upward.</Card>
        </div>
      )}

      {tab === "Rate Card" && (
        <Card className="p-5">
          <div className="flex flex-wrap gap-2">
            <input value={rateQ} onChange={(e) => setRateQ(e.target.value)} placeholder="Search rate card" className={`${inputCls} min-w-[220px] flex-1`} />
            <select value={rateCat} onChange={(e) => setRateCat(e.target.value)} className={`${inputCls} !w-auto`}><option value="">All categories</option>{cats.map((c) => <option key={c}>{c}</option>)}</select>
            <Badge>{rateRows.length} rows</Badge>
          </div>
          <p className="mt-1 text-[12px] text-neutral-500">Internal starting prices — not client-facing line-item promises.</p>
          <div className="mt-2 max-h-[65vh] overflow-auto">
            <table className="w-full text-[12.5px]">
              <thead className="sticky top-0 bg-neutral-50 dark:bg-neutral-800"><tr><th className="p-2 text-left">Category</th><th className="p-2 text-left">Feature</th><th className="p-2 text-left">Unit</th><th className="p-2 text-right">Entry</th><th className="p-2 text-right">Standard</th><th className="p-2 text-right">Premium</th><th className="p-2 text-left">Notes</th></tr></thead>
              <tbody>{rateRows.map((f, i) => <tr key={i} className="border-b border-neutral-100 dark:border-neutral-800"><td className="p-2 text-neutral-500">{f.category}</td><td className="p-2 font-semibold">{f.feature}</td><td className="p-2">{f.unit}</td><td className="p-2 text-right">{inr(f.entry)}</td><td className="p-2 text-right">{inr(f.standard)}</td><td className="p-2 text-right">{inr(f.premium)}</td><td className="p-2 text-neutral-500">{f.notes}</td></tr>)}</tbody>
            </table>
          </div>
          <div className="mt-4 text-[13.5px] font-semibold">Hourly reference (internal)</div>
          <div className="mt-1 grid gap-1.5 sm:grid-cols-2 lg:grid-cols-5">{HOURLY.map((h) => <div key={h.role} className="rounded-xl border border-neutral-200 px-3 py-2 text-[12.5px] dark:border-neutral-700"><b>{h.role}</b> · ₹{h.rate}/h <span className="text-neutral-500">(₹{h.low}–₹{h.high})</span></div>)}</div>
        </Card>
      )}

      {tab === "Care Plans" && (
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-5">
          {CARE.map((c) => (
            <Card key={c.name} className="p-4">
              <div className="text-[10.5px] uppercase tracking-widest text-neutral-400">Care plan</div>
              <div className="text-[15px] font-bold">{c.name}</div>
              <div className="text-[20px] font-bold">{inr(c.price)}<span className="text-[12px] font-normal">/mo</span></div>
              <div className="text-[12px] text-neutral-500">~{c.hours} support hours</div>
              <p className="mt-1 text-[12.5px]">{c.includes}</p>
              <p className="text-[12px] text-neutral-500"><b>Best for:</b> {c.bestFor}</p>
            </Card>
          ))}
        </div>
      )}

      {tab === "Policies" && (
        <Card className="overflow-auto p-0">
          <table className="w-full text-[13px]">
            <thead><tr className="bg-neutral-50 text-left dark:bg-neutral-800"><th className="p-3">Policy</th><th className="p-3">Standard</th><th className="p-3">Details</th><th className="p-3">Client-facing wording</th></tr></thead>
            <tbody>{POLICIES.map((p) => <tr key={p.policy} className="border-t border-neutral-100 align-top dark:border-neutral-800"><td className="p-3 font-semibold">{p.policy}</td><td className="p-3">{p.standard}</td><td className="p-3 text-neutral-500">{p.details}</td><td className="p-3 text-neutral-500">{p.client}</td></tr>)}</tbody>
          </table>
        </Card>
      )}

      <div className="flex gap-2">
        <Btn variant="outline" onClick={() => setTab("Calculator")}><RotateCcw size={14} /> Back to Calculator</Btn>
      </div>
    </div>
  );
}

function SliderRow({ label, v, set, min, max }: { label: string; v: number; set: (n: number) => void; min: number; max: number }) {
  return (
    <Field label={`${label} — ${v}%`}>
      <div className="flex items-center gap-2">
        <input type="range" min={min} max={max} value={v} onChange={(e) => set(Number(e.target.value))} className="w-full" />
        <span className="w-12 text-right text-[13px] font-bold">{v}%</span>
      </div>
    </Field>
  );
}

function Row({ k, v, big, tone }: { k: string; v: string; big?: boolean; tone?: string }) {
  return <div className={`flex justify-between gap-2 border-b border-dashed border-neutral-100 py-1.5 last:border-0 dark:border-neutral-800 ${big ? "text-[15px] font-bold" : ""} ${tone ?? ""}`}><span className="text-neutral-500">{k}</span><span className="text-right font-semibold">{v}</span></div>;
}
