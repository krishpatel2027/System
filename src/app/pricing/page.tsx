"use client";
import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { inr, uid } from "@/lib/utils";
import { Card, Btn, Field, inputCls, Badge } from "@/components/ui";
import { ArrowRight, Copy, Download, Save, FolderOpen, Check } from "lucide-react";
import {
  FEATURES, CALC_PACKAGES, HOURLY, CARE, POLICIES,
  PACKAGE_ORDER, getPackageIncluded, TYPE_PRESETS,
} from "@/lib/pricing-data";
import { PENDING_KEY, PRICING_SAVE_KEY as SAVE_KEY } from "./_studio";
import type { QuoteItem } from "@/lib/types";

const TABS = ["Calculator", "Rate Card", "Care Plans", "Policies"] as const;
const DEFAULT_PKG = "Business";

export default function PricingPage() {
  const router = useRouter();
  const [tab, setTab] = useState<(typeof TABS)[number]>("Calculator");

  const [pkg, setPkg] = useState(DEFAULT_PKG);
  const [quickStart, setQuickStart] = useState("");
  const [discount, setDiscount] = useState(0);
  const [gst, setGst] = useState(18);
  const [q, setQ] = useState("");

  // User-picked extras only — never the current package's bundled basics.
  // Bundled items are always ₹0 and always shown checked, purely from
  // includedSet(pkg); they're never written into sel, so switching to a
  // cheaper package can't turn yesterday's "included" into today's "extra".
  const [sel, setSel] = useState<Set<string>>(new Set());

  const includedSet = useMemo(() => new Set(getPackageIncluded(pkg)), [pkg]);

  const choosePackage = (name: string) => {
    setPkg(name);
    setQuickStart("");
  };

  const applyQuickStart = (name: string) => {
    setQuickStart(name);
    const preset = TYPE_PRESETS[name];
    if (!preset) return;
    setPkg(preset.pkg);
    setSel((prev) => new Set([...prev, ...preset.features]));
  };

  const toggleFeature = (name: string) => {
    if (includedSet.has(name)) return; // bundled — locked on, not user-toggleable
    setSel((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const categories = useMemo(() => [...new Set(FEATURES.map((f) => f.category))], []);
  const grouped = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const filtered = needle
      ? FEATURES.filter((f) => `${f.feature} ${f.category} ${f.notes}`.toLowerCase().includes(needle))
      : FEATURES;
    return categories
      .map((c) => ({ category: c, items: filtered.filter((f) => f.category === c) }))
      .filter((g) => g.items.length > 0);
  }, [categories, q]);

  const calc = useMemo(() => {
    const pkgObj = CALC_PACKAGES.find((p) => p.name === pkg);
    const base = pkgObj?.price ?? 0;
    const extras = [...sel].filter((name) => !includedSet.has(name));
    const included = [...includedSet];
    const extrasTotal = extras.reduce((s, name) => s + (FEATURES.find((f) => f.feature === name)?.standard ?? 0), 0);
    const subtotal = base + extrasTotal;
    const disc = (subtotal * discount) / 100;
    const beforeGST = subtotal - disc;
    const gstAmt = (beforeGST * gst) / 100;
    const total = beforeGST + gstAmt;
    const rounded = Math.round(beforeGST / 1000) * 1000;

    const quoteText =
      `Investment — ${inr(rounded)}\n` +
      `Package: ${pkgObj?.name ?? pkg} — ${pkgObj?.scope ?? ""}\n` +
      `Includes\n• Custom responsive design & development\n` +
      `${included.map((n) => `• ${n} (Included)`).join("\n")}${included.length ? "\n" : ""}` +
      `${extras.map((n) => `• ${n}`).join("\n") || "• Selected scope/features"}\n` +
      `• SEO / performance foundations as scoped\n• Deployment\n` +
      `Third-party subscriptions and usage-based services are billed separately unless explicitly included.\n\n` +
      `GST @ ${gst}%: ${inr(gstAmt)}\nClient total incl. GST: ${inr(total)}`;

    return { base, extras, included, extrasTotal, subtotal, disc, beforeGST, gstAmt, total, rounded, quoteText, pkgObj };
  }, [pkg, sel, discount, gst, includedSet]);

  const sendToQuote = () => {
    const items: QuoteItem[] = [
      { id: uid("qi"), label: `${calc.pkgObj?.name ?? pkg} package — ${calc.pkgObj?.scope ?? ""}`, qty: 1, price: calc.base },
      ...calc.extras.map((name) => ({ id: uid("qi"), label: name, qty: 1, price: FEATURES.find((f) => f.feature === name)?.standard ?? 0 })),
    ];
    try {
      localStorage.setItem(PENDING_KEY, JSON.stringify({ items, discount: Math.round(calc.disc), note: `GST extra` }));
    } catch {}
    router.push("/quotes?action=new&from=pricing");
  };

  const saveProject = () => {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({ package: pkg, discount, gst, selected: [...sel] }));
      alert("Project saved in this browser.");
    } catch {}
  };
  const loadProject = () => {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return alert("No saved project found.");
      const s = JSON.parse(raw);
      setPkg(s.package ?? DEFAULT_PKG);
      setDiscount(s.discount ?? 0);
      setGst(s.gst ?? 18);
      setSel(new Set(s.selected ?? []));
      alert("Saved project loaded.");
    } catch {}
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight">Pricing Calculator</h1>
          <p className="text-[13px] text-neutral-500">Pick a package, tick extras, get a client-ready quote.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Btn variant="outline" onClick={saveProject}><Save size={14} /> Save</Btn>
          <Btn variant="outline" onClick={loadProject}><FolderOpen size={14} /> Load</Btn>
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
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-[14px] font-semibold">1. Package</div>
                <select className={`${inputCls} !w-auto text-[12.5px]`} value={quickStart} onChange={(e) => applyQuickStart(e.target.value)}>
                  <option value="">Quick start by project type (optional)…</option>
                  {Object.keys(TYPE_PRESETS).map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
                {CALC_PACKAGES.map((p) => {
                  const idx = PACKAGE_ORDER.indexOf(p.name);
                  const prev = idx > 0 ? PACKAGE_ORDER[idx - 1] : null;
                  const active = pkg === p.name;
                  return (
                    <button key={p.name} onClick={() => choosePackage(p.name)} className={`rounded-xl border p-3 text-left transition ${active ? "border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-900" : "border-neutral-200 hover:border-neutral-400 dark:border-neutral-700"}`}>
                      <div className={`text-[10px] uppercase tracking-widest ${active ? "opacity-70" : "text-neutral-400"}`}>{p.positioning}</div>
                      <div className="text-[14px] font-bold">{p.name}</div>
                      <div className="text-[18px] font-bold">{inr(p.price)}+</div>
                      <div className={`text-[11.5px] ${active ? "opacity-80" : "text-neutral-500"}`}>{p.scope}</div>
                      {prev && <div className={`mt-1 text-[10.5px] ${active ? "opacity-80" : "text-neutral-400"}`}>+ everything in {prev}</div>}
                      {active && <div className="mt-1 flex items-center gap-1 text-[11px] font-semibold"><Check size={12} /> Selected</div>}
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-[12px] text-neutral-500">{getPackageIncluded(pkg).length} basics are bundled into {pkg} at no extra charge — see them marked <b className="text-emerald-600">Included</b> below.</p>
            </Card>

            <Card className="p-5">
              <div className="text-[14px] font-semibold">2. Extras <span className="font-normal text-neutral-400">— {calc.extras.length} added on top of {pkg}</span></div>
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search features…" className={`${inputCls} mt-3`} />
              <div className="mt-3 max-h-[480px] space-y-3 overflow-auto pr-1">
                {grouped.map((g) => (
                  <div key={g.category}>
                    <div className="sticky top-0 bg-white px-1 py-1 text-[10.5px] font-bold uppercase tracking-wider text-neutral-400 dark:bg-neutral-900">{g.category}</div>
                    <div className="divide-y divide-neutral-100 rounded-xl border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-700">
                      {g.items.map((f) => {
                        const bundled = includedSet.has(f.feature);
                        const checked = bundled || sel.has(f.feature);
                        return (
                          <label key={f.feature} className={`flex items-center gap-2 px-3 py-2 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 ${bundled ? "cursor-default bg-emerald-50/60 dark:bg-emerald-950/20" : "cursor-pointer"}`}>
                            <input type="checkbox" checked={checked} disabled={bundled} title={bundled ? `Bundled in ${pkg} — always included` : "Add as paid extra"} onChange={() => toggleFeature(f.feature)} className="h-4 w-4 accent-emerald-600 disabled:opacity-70" />
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-[13px] font-semibold">{f.feature} {bundled && <span className="ml-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">INCLUDED</span>}</div>
                              <div className="truncate text-[11.5px] text-neutral-500">{f.notes}</div>
                            </div>
                            <div className="shrink-0 text-[13px] font-semibold">{bundled ? "₹0" : inr(f.standard)}</div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
                {grouped.length === 0 && <div className="p-6 text-center text-[13px] text-neutral-500">No features match &ldquo;{q}&rdquo;.</div>}
              </div>
            </Card>

            <Card className="p-5">
              <div className="text-[14px] font-semibold">3. Discount &amp; GST</div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <Field label="Discount %"><input type="number" min={0} max={100} className={inputCls} value={discount} onChange={(e) => setDiscount(Math.max(0, Number(e.target.value) || 0))} /></Field>
                <Field label="GST %"><input type="number" min={0} max={28} className={inputCls} value={gst} onChange={(e) => setGst(Math.max(0, Number(e.target.value) || 0))} /></Field>
              </div>
            </Card>
          </div>

          <Card className="h-fit p-5 lg:sticky lg:top-20">
            <div className="text-[11px] font-semibold uppercase tracking-widest text-neutral-400">Client quote</div>
            <div className="text-[38px] font-bold leading-none tracking-tight">{inr(calc.rounded)}</div>
            <div className="text-[12px] text-neutral-500">before GST · rounded for presentation</div>
            <div className="mt-2 space-y-0 text-[13px]">
              <Row k={`${pkg} package`} v={inr(calc.base)} />
              <Row k={`Extras (${calc.extras.length})`} v={inr(calc.extrasTotal)} />
              {calc.included.length > 0 && <Row k={`Bundled in ${pkg} (${calc.included.length})`} v="₹0 Included" tone="text-emerald-600" />}
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

      {tab === "Rate Card" && (
        <Card className="p-5">
          <Badge>{FEATURES.length} rows · standard tier shown</Badge>
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
    </div>
  );
}

function Row({ k, v, big, tone }: { k: string; v: string; big?: boolean; tone?: string }) {
  return <div className={`flex justify-between gap-2 border-b border-dashed border-neutral-100 py-1.5 last:border-0 dark:border-neutral-800 ${big ? "text-[15px] font-bold" : ""} ${tone ?? ""}`}><span className="text-neutral-500">{k}</span><span className="text-right font-semibold">{v}</span></div>;
}
