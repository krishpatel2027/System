"use client";
import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { inr, uid } from "@/lib/utils";
import { Card, Btn, Field, inputCls, Badge } from "@/components/ui";
import { ArrowRight, Copy, Download, Save, FolderOpen, RotateCcw, Printer } from "lucide-react";
import {
  FEATURES, CALC_PACKAGES, HOURLY, CARE, POLICIES,
  PACKAGE_ORDER, getPackageIncluded, TYPE_PRESETS, TYPE_CATEGORIES,
} from "@/lib/pricing-data";
import { PENDING_KEY, PRICING_SAVE_KEY as SAVE_KEY } from "./_studio";
import type { QuoteItem } from "@/lib/types";

const TABS = ["Calculator", "Packages", "Rate Card", "Care Plans", "Policies"] as const;

export default function PricingPage() {
  const router = useRouter();
  const [tab, setTab] = useState<(typeof TABS)[number]>("Calculator");

  const [projectType, setProjectType] = useState("Website 5–8 pages");
  const [pkg, setPkg] = useState("Business");
  const [discount, setDiscount] = useState(0);
  const [gst, setGst] = useState(18);

  // Extra features: simple on/off list at standard price. Bundled basics
  // start ticked automatically and are never charged separately.
  const [sel, setSel] = useState<Record<number, boolean>>(() => {
    const init: Record<number, boolean> = {};
    const bundle = new Set(getPackageIncluded("Business"));
    FEATURES.forEach((f, i) => {
      if (bundle.has(f.feature)) init[i] = true;
    });
    return init;
  });
  const [q, setQ] = useState("");
  const [showAll, setShowAll] = useState(false);

  const relevantCats = useMemo(() => TYPE_CATEGORIES[projectType] ?? [], [projectType]);
  const visible = useMemo(
    () =>
      FEATURES.map((f, i) => ({ ...f, i })).filter(
        (f) =>
          (!q || `${f.feature} ${f.category} ${f.notes}`.toLowerCase().includes(q.toLowerCase())) &&
          (showAll || q.trim() !== "" || relevantCats.length === 0 || relevantCats.includes(f.category))
      ),
    [q, showAll, relevantCats]
  );

  const includedSet = useMemo(() => new Set(getPackageIncluded(pkg)), [pkg]);
  const isIncluded = (featureName: string) => includedSet.has(featureName);

  const applyPackage = (name: string) => {
    setPkg(name);
    const bundle = new Set(getPackageIncluded(name));
    setSel((prev) => {
      const next = { ...prev };
      FEATURES.forEach((f, i) => {
        if (bundle.has(f.feature)) next[i] = true;
      });
      return next;
    });
  };

  // Switching product type applies its preset: suggested package + relevant
  // features. Extras the user already picked are preserved.
  const applyProjectType = (name: string) => {
    setProjectType(name);
    setQ("");
    const preset = TYPE_PRESETS[name];
    if (!preset) return;
    setPkg(preset.pkg);
    const bundle = new Set(getPackageIncluded(preset.pkg));
    const wanted = new Set([...bundle, ...preset.features]);
    setSel((prev) => {
      const next = { ...prev };
      FEATURES.forEach((f, i) => {
        if (wanted.has(f.feature)) next[i] = true;
      });
      return next;
    });
  };

  const calc = useMemo(() => {
    const pkgObj = CALC_PACKAGES.find((p) => p.name === pkg);
    const base = pkgObj?.price ?? 0;
    const extraIdx = FEATURES.map((f, i) => i).filter((i) => sel[i] && !includedSet.has(FEATURES[i].feature));
    const includedIdx = FEATURES.map((f, i) => i).filter((i) => sel[i] && includedSet.has(FEATURES[i].feature));
    const extras = extraIdx.reduce((s, i) => s + FEATURES[i].standard, 0);
    const subtotal = base + extras;
    const disc = (subtotal * discount) / 100;
    const beforeGST = subtotal - disc;
    const gstAmt = (beforeGST * gst) / 100;
    const total = beforeGST + gstAmt;
    const rounded = Math.round(beforeGST / 1000) * 1000;

    const extraNames = extraIdx.map((i) => `• ${FEATURES[i].feature}`);
    const includedNames = includedIdx.map((i) => `• ${FEATURES[i].feature} (Included)`);
    const quoteText =
      `Investment — ${inr(rounded)}\nProject: ${projectType}\nIncludes\n• ${pkgObj?.scope ?? ""}\n• Custom responsive design & development\n` +
      `${includedNames.join("\n")}${includedNames.length ? "\n" : ""}` +
      `${extraNames.join("\n") || "• Selected scope/features"}\n` +
      `• SEO / performance foundations as scoped\n• Deployment\n` +
      `Third-party subscriptions and usage-based services are billed separately unless explicitly included.\n\n` +
      `GST @ ${gst}%: ${inr(gstAmt)}\nClient total incl. GST: ${inr(total)}`;

    return { base, extras, subtotal, disc, beforeGST, gstAmt, total, rounded, extraCount: extraIdx.length, includedCount: includedIdx.length, quoteText, pkgObj, extraIdx, includedIdx };
  }, [pkg, projectType, sel, discount, gst, includedSet]);

  const sendToQuote = () => {
    const items: QuoteItem[] = [
      { id: uid("qi"), label: `${calc.pkgObj?.name ?? pkg} package — ${calc.pkgObj?.scope ?? ""}`, qty: 1, price: calc.base },
      ...calc.extraIdx.map((i) => ({ id: uid("qi"), label: FEATURES[i].feature, qty: 1, price: FEATURES[i].standard })),
    ];
    try {
      localStorage.setItem(PENDING_KEY, JSON.stringify({ items, discount: Math.round(calc.disc), note: `GST extra` }));
    } catch {}
    router.push("/quotes?action=new&from=pricing");
  };

  const saveProject = () => {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({ projectType, package: pkg, discount, gst, selected: sel }));
      alert("Project saved in this browser.");
    } catch {}
  };
  const loadProject = () => {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return alert("No saved project found.");
      const s = JSON.parse(raw);
      setProjectType(s.projectType); setDiscount(s.discount ?? 0); setGst(s.gst ?? 18);
      const bundle = new Set(getPackageIncluded(s.package ?? pkg));
      const merged: Record<number, boolean> = { ...(s.selected ?? {}) };
      FEATURES.forEach((f, i) => {
        if (bundle.has(f.feature)) merged[i] = true;
      });
      setPkg(s.package); setSel(merged);
      alert("Saved project loaded.");
    } catch {}
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight">Pricing Studio</h1>
          <p className="text-[13px] text-neutral-500">Pick a project type and package, add extras, done.</p>
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
              <div className="text-[14px] font-semibold">Project</div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <Field label="Project type"><select className={inputCls} value={projectType} onChange={(e) => applyProjectType(e.target.value)}>{Object.keys(TYPE_PRESETS).map((p) => <option key={p}>{p}</option>)}</select></Field>
                <Field label="Package"><select className={inputCls} value={pkg} onChange={(e) => applyPackage(e.target.value)}>{CALC_PACKAGES.map((p) => <option key={p.name}>{p.name}</option>)}</select></Field>
                <Field label={`Discount — ${discount}%`}><input type="range" min={0} max={20} value={discount} onChange={(e) => setDiscount(Number(e.target.value))} className="mt-2 w-full" /></Field>
                <Field label={`GST — ${gst}%`}><input type="range" min={0} max={28} value={gst} onChange={(e) => setGst(Number(e.target.value))} className="mt-2 w-full" /></Field>
              </div>
              <p className="mt-2 text-[12px] text-neutral-500">Switching project type sets a starting package and ticks its typical features. Change the package or extras any time.</p>
            </Card>

            <Card className="p-5">
              <div className="text-[14px] font-semibold">Extras <span className="font-normal text-neutral-400">— {calc.extraCount} added on top of {pkg}</span></div>
              <p className="mt-1 text-[12px] text-neutral-500">Basics already in <b>{pkg}</b> are marked <span className="font-semibold text-emerald-600">Included</span> — ₹0, never charged again. Tick anything else to add it.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search features…" className={`${inputCls} min-w-[220px] flex-1`} />
                <Btn variant="outline" onClick={() => setShowAll(!showAll)}>{showAll ? "Relevant only" : `Show all ${FEATURES.length}`}</Btn>
              </div>
              <div className="mt-3 max-h-[520px] divide-y divide-neutral-100 overflow-auto rounded-xl border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-700">
                {visible.map((f) => {
                  const bundled = isIncluded(f.feature);
                  return (
                    <label key={f.i} className={`flex cursor-pointer items-center gap-2 px-3 py-2 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 ${bundled && sel[f.i] ? "bg-emerald-50/60 dark:bg-emerald-950/20" : ""}`}>
                      <input type="checkbox" checked={!!sel[f.i]} title={bundled ? `Bundled in ${pkg}` : "Add as paid extra"} onChange={(e) => setSel({ ...sel, [f.i]: e.target.checked })} className="h-4 w-4 accent-emerald-600" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13px] font-semibold">{f.feature} {bundled && <span className="ml-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">INCLUDED</span>}</div>
                        <div className="truncate text-[11.5px] text-neutral-500">{f.category} · {f.notes}</div>
                      </div>
                      <div className="shrink-0 text-[13px] font-semibold">{bundled ? "₹0" : inr(f.standard)}</div>
                    </label>
                  );
                })}
                {visible.length === 0 && <div className="p-6 text-center text-[13px] text-neutral-500">No features match "{q}".</div>}
              </div>
            </Card>
          </div>

          <Card className="h-fit p-5 lg:sticky lg:top-20">
            <div className="text-[11px] font-semibold uppercase tracking-widest text-neutral-400">Client quote</div>
            <div className="text-[38px] font-bold leading-none tracking-tight">{inr(calc.rounded)}</div>
            <div className="text-[12px] text-neutral-500">before GST · rounded for presentation</div>
            <div className="mt-2 space-y-0 text-[13px]">
              <Row k={`${pkg} package`} v={inr(calc.base)} />
              <Row k={`Extras (${calc.extraCount})`} v={inr(calc.extras)} />
              {calc.includedCount > 0 && <Row k={`Bundled in ${pkg} (${calc.includedCount})`} v="₹0 Included" tone="text-emerald-600" />}
              <Row k="Subtotal" v={inr(calc.subtotal)} />
              <Row k={`Discount ${discount}%`} v={"− " + inr(calc.disc)} />
              <Row k="Before GST" v={inr(calc.beforeGST)} />
              <Row k={`GST ${gst}%`} v={inr(calc.gstAmt)} />
              <Row k="Client total" v={inr(calc.total)} big />
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
            {CALC_PACKAGES.map((p) => {
              const idx = PACKAGE_ORDER.indexOf(p.name);
              const prev = idx > 0 ? PACKAGE_ORDER[idx - 1] : null;
              return (
              <Card key={p.name} className={`p-4 ${pkg === p.name ? "ring-2 ring-neutral-900 dark:ring-white" : ""}`}>
                <div className="text-[10.5px] uppercase tracking-widest text-neutral-400">{p.positioning}</div>
                <div className="text-[15px] font-bold">{p.name}</div>
                <div className="text-[20px] font-bold">{inr(p.price)}+</div>
                <div className="text-[12px] text-neutral-500">{p.scope}</div>
                {prev && <div className="mt-1 rounded-lg bg-emerald-50 px-2 py-1 text-[11.5px] font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">✓ Everything in {prev} +</div>}
                <p className="mt-1 text-[12px]"><b>Best for:</b> {p.bestFor}</p>
                <ul className="mt-1 list-disc pl-4 text-[12px] text-neutral-600 dark:text-neutral-300">{p.included.split(", ").map((x) => <li key={x}>{x}</li>)}</ul>
                <div className="mt-1 text-[11.5px] text-neutral-400">{getPackageIncluded(p.name).length} basics bundled · extras only on top</div>
                <Btn variant="outline" className="mt-2 w-full" onClick={() => { applyPackage(p.name); setTab("Calculator"); }}>Use package</Btn>
              </Card>
              );
            })}
          </div>
          <Card className="mt-3 border-indigo-200 bg-indigo-50/50 p-4 text-[13px] dark:bg-indigo-950/30"><b>Positioning rule:</b> each tier includes every lower tier&apos;s basics at no extra charge. Only the difference is priced.</Card>
        </div>
      )}

      {tab === "Rate Card" && (
        <Card className="p-5">
          <div className="flex flex-wrap gap-2">
            <Badge>{FEATURES.length} rows · standard tier shown</Badge>
          </div>
          <p className="mt-1 text-[12px] text-neutral-500">Internal starting prices — not client-facing line-item promises.</p>
          <div className="mt-2 max-h-[65vh] overflow-auto">
            <table className="w-full text-[12.5px]">
              <thead className="sticky top-0 bg-neutral-50 dark:bg-neutral-800"><tr><th className="p-2 text-left">Category</th><th className="p-2 text-left">Feature</th><th className="p-2 text-left">Unit</th><th className="p-2 text-right">Entry</th><th className="p-2 text-right">Standard</th><th className="p-2 text-right">Premium</th></tr></thead>
              <tbody>{FEATURES.map((f, i) => <tr key={i} className="border-b border-neutral-100 dark:border-neutral-800"><td className="p-2 text-neutral-500">{f.category}</td><td className="p-2 font-semibold">{f.feature}</td><td className="p-2">{f.unit}</td><td className="p-2 text-right">{inr(f.entry)}</td><td className="p-2 text-right">{inr(f.standard)}</td><td className="p-2 text-right">{inr(f.premium)}</td></tr>)}</tbody>
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
              <div className="text-[20px] font-bold">{inr(c.monthly)}<span className="text-[12px] font-normal">/mo</span></div>
              <div className="text-[12px] text-neutral-500">~{c.hours} support hours</div>
              <p className="mt-1 text-[12.5px]">{c.desc}</p>
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

function Row({ k, v, big, tone }: { k: string; v: string; big?: boolean; tone?: string }) {
  return <div className={`flex justify-between gap-2 border-b border-dashed border-neutral-100 py-1.5 last:border-0 dark:border-neutral-800 ${big ? "text-[15px] font-bold" : ""} ${tone ?? ""}`}><span className="text-neutral-500">{k}</span><span className="text-right font-semibold">{v}</span></div>;
}
