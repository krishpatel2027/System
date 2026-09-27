"use client";
import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { inr, uid } from "@/lib/utils";
import { Card, CardHeader, Btn, Field, inputCls, Badge, PageHeader, Tabs } from "@/components/ui";
import { ArrowRight, Copy, Download, Save, FolderOpen, Check, Search } from "lucide-react";
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
    <div className="space-y-6">
      <PageHeader
        title="Pricing"
        description="Pick a package, add extras, and turn it into a client-ready quote in one click."
        actions={<>
          <Btn variant="ghost" onClick={loadProject}><FolderOpen size={14} /> Load</Btn>
          <Btn variant="outline" onClick={saveProject}><Save size={14} /> Save</Btn>
          <Btn onClick={sendToQuote}>Create quote <ArrowRight size={14} /></Btn>
        </>}
      />

      <Tabs tabs={TABS} value={tab} onChange={setTab} />

      {tab === "Calculator" && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_360px]">
          <div className="space-y-4">
            <Card>
              <CardHeader title={<span className="flex items-center gap-2"><Step n={1} />Choose a package</span>}
                sub={`${getPackageIncluded(pkg).length} essentials are bundled into ${pkg} at no extra charge.`}
                action={
                  <select className={`${inputCls} !w-auto text-[12.5px]`} value={quickStart} onChange={(e) => applyQuickStart(e.target.value)}>
                    <option value="">Quick start by project type…</option>
                    {Object.keys(TYPE_PRESETS).map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                } />
              <div className="grid gap-2 p-5 sm:grid-cols-2 xl:grid-cols-5">
                {CALC_PACKAGES.map((p) => {
                  const idx = PACKAGE_ORDER.indexOf(p.name);
                  const prev = idx > 0 ? PACKAGE_ORDER[idx - 1] : null;
                  const active = pkg === p.name;
                  return (
                    <button key={p.name} onClick={() => choosePackage(p.name)}
                      className={`relative flex flex-col items-start rounded-xl border p-3.5 text-left transition ${active ? "border-accent bg-accent-soft ring-1 ring-accent" : "border-line bg-surface hover:border-line-strong hover:bg-surface-2/60"}`}>
                      <div className={`text-[10.5px] font-semibold uppercase tracking-[0.1em] ${active ? "text-accent" : "text-subtle"}`}>{p.positioning}</div>
                      <div className="mt-1 text-[14px] font-semibold">{p.name}</div>
                      <div className="mt-0.5 text-[19px] font-semibold tracking-tight tabular-nums">{inr(p.price)}<span className="text-[13px] font-normal text-subtle">+</span></div>
                      <div className="mt-1 text-[11.5px] text-muted">{p.scope}</div>
                      {prev && <div className="mt-0.5 text-[11px] text-subtle">Everything in {prev}, plus more</div>}
                      {active && <div className="absolute right-2.5 top-2.5 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-accent-ink"><Check size={12} strokeWidth={3} /></div>}
                    </button>
                  );
                })}
              </div>
            </Card>

            <Card>
              <CardHeader title={<span className="flex items-center gap-2"><Step n={2} />Add extras</span>}
                sub={calc.extras.length ? `${calc.extras.length} extra${calc.extras.length === 1 ? "" : "s"} added · ${inr(calc.extrasTotal)}` : "Anything beyond the package. Bundled items are marked Included."} />
              <div className="p-5 pt-4">
                <div className="relative">
                  <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-subtle" />
                  <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search 140+ features — booking, payments, CMS, AI…" className={`${inputCls} pl-8`} />
                </div>
                <div className="mt-3 max-h-[480px] space-y-4 overflow-auto pr-1">
                  {grouped.map((g) => (
                    <div key={g.category}>
                      <div className="sticky top-0 z-10 bg-surface py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-subtle">{g.category}</div>
                      <div className="divide-y divide-line overflow-hidden rounded-xl border border-line">
                        {g.items.map((f) => {
                          const bundled = includedSet.has(f.feature);
                          const checked = bundled || sel.has(f.feature);
                          return (
                            <label key={f.feature} className={`flex items-center gap-3 px-3.5 py-2.5 transition ${bundled ? "cursor-default bg-emerald-50/50 dark:bg-emerald-950/20" : checked ? "cursor-pointer bg-accent-soft/60" : "cursor-pointer hover:bg-surface-2/60"}`}>
                              <input type="checkbox" checked={checked} disabled={bundled} title={bundled ? `Bundled in ${pkg} — always included` : "Add as paid extra"} onChange={() => toggleFeature(f.feature)} className="h-4 w-4 rounded accent-[var(--accent)] disabled:accent-emerald-600" />
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 truncate text-[13px] font-medium">{f.feature}{bundled && <Badge tone="green">Included</Badge>}</div>
                                <div className="truncate text-[12px] text-muted">{f.notes}</div>
                              </div>
                              <div className={`shrink-0 text-[13px] font-medium tabular-nums ${bundled ? "text-subtle" : ""}`}>{bundled ? "₹0" : inr(f.standard)}</div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                  {grouped.length === 0 && <div className="p-6 text-center text-[13px] text-muted">No features match &ldquo;{q}&rdquo;.</div>}
                </div>
              </div>
            </Card>

            <Card>
              <CardHeader title={<span className="flex items-center gap-2"><Step n={3} />Discount & GST</span>} />
              <div className="grid gap-4 p-5 sm:grid-cols-2">
                <Field label="Discount %"><input type="number" min={0} max={100} className={inputCls} value={discount} onChange={(e) => setDiscount(Math.max(0, Number(e.target.value) || 0))} /></Field>
                <Field label="GST %"><input type="number" min={0} max={28} className={inputCls} value={gst} onChange={(e) => setGst(Math.max(0, Number(e.target.value) || 0))} /></Field>
              </div>
            </Card>
          </div>

          <div className="h-fit space-y-3 lg:sticky lg:top-24">
            <Card className="overflow-hidden">
              <div className="border-b border-line bg-gradient-to-br from-accent-soft to-surface p-5">
                <div className="text-[12px] font-medium text-muted">Client price · before GST</div>
                <div className="mt-1 text-[38px] font-semibold leading-none tracking-[-0.03em] tabular-nums">{inr(calc.rounded)}</div>
                <div className="mt-2 text-[12.5px] text-muted">{inr(calc.total)} including {gst}% GST</div>
              </div>
              <div className="p-5 text-[13px]">
                <Row k={`${pkg} package`} v={inr(calc.base)} />
                <Row k={`Extras (${calc.extras.length})`} v={inr(calc.extrasTotal)} />
                {calc.included.length > 0 && <Row k={`Bundled essentials (${calc.included.length})`} v="Included" tone="text-emerald-600 dark:text-emerald-400" />}
                {discount > 0 && <Row k={`Discount ${discount}%`} v={"− " + inr(calc.disc)} />}
                <Row k="Before GST" v={inr(calc.beforeGST)} />
                <Row k={`GST ${gst}%`} v={inr(calc.gstAmt)} />
                <Row k="Client total" v={inr(calc.total)} big />
                <Btn variant="accent" className="mt-4 w-full" onClick={sendToQuote}>Create quote from this <ArrowRight size={14} /></Btn>
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div className="text-[12.5px] font-medium text-muted">Copy-ready summary</div>
                <div className="flex gap-1">
                  <Btn size="sm" variant="ghost" onClick={() => { navigator.clipboard.writeText(calc.quoteText); alert("Summary copied."); }}><Copy size={13} /> Copy</Btn>
                  <Btn size="sm" variant="ghost" onClick={() => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([calc.quoteText], { type: "text/plain" })); a.download = "Arkria-Quote.txt"; a.click(); }}><Download size={13} /> .txt</Btn>
                </div>
              </div>
              <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded-xl bg-surface-2 p-3 font-sans text-[12px] leading-relaxed text-muted">{calc.quoteText}</pre>
            </Card>
          </div>
        </div>
      )}

      {tab === "Rate Card" && (
        <Card className="overflow-hidden">
          <CardHeader title="Rate card" sub={`${FEATURES.length} internal starting prices — not client-facing line-item promises.`} />
          <div className="mt-4 max-h-[65vh] overflow-auto border-t border-line">
            <table className="w-full min-w-[640px] text-[13px]">
              <thead className="sticky top-0 bg-surface-2 text-left text-[12px] text-muted">
                <tr><th className="px-4 py-2.5 font-medium">Feature</th><th className="px-4 py-2.5 font-medium">Category</th><th className="px-4 py-2.5 font-medium">Unit</th><th className="px-4 py-2.5 text-right font-medium">Entry</th><th className="px-4 py-2.5 text-right font-medium">Standard</th><th className="px-4 py-2.5 text-right font-medium">Premium</th></tr>
              </thead>
              <tbody className="divide-y divide-line">
                {FEATURES.map((f, i) => (
                  <tr key={i} className="hover:bg-surface-2/50">
                    <td className="px-4 py-2.5 font-medium">{f.feature}</td>
                    <td className="px-4 py-2.5 text-muted">{f.category}</td>
                    <td className="px-4 py-2.5 text-muted">{f.unit}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-muted">{inr(f.entry)}</td>
                    <td className="px-4 py-2.5 text-right font-medium tabular-nums">{inr(f.standard)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-muted">{inr(f.premium)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t border-line p-5">
            <div className="text-[13px] font-semibold">Hourly reference</div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
              {HOURLY.map((h) => (
                <div key={h.role} className="rounded-xl border border-line px-3 py-2.5">
                  <div className="text-[12.5px] text-muted">{h.role}</div>
                  <div className="text-[15px] font-semibold tabular-nums">₹{h.rate}<span className="text-[12px] font-normal text-subtle">/h</span></div>
                  <div className="text-[11.5px] text-subtle">₹{h.low}–₹{h.high}</div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      {tab === "Care Plans" && (
        <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-5">
          {CARE.map((c, i) => (
            <Card key={c.name} className={`flex flex-col p-5 ${i === 1 ? "border-accent ring-1 ring-accent" : ""}`}>
              <div className="flex items-center justify-between">
                <div className="text-[13px] font-semibold capitalize">{c.name.toLowerCase()}</div>
                {i === 1 && <Badge tone="violet">Popular</Badge>}
              </div>
              <div className="mt-3 text-[24px] font-semibold tracking-tight tabular-nums">{inr(c.monthly)}<span className="text-[13px] font-normal text-subtle">/mo</span></div>
              <div className="text-[12.5px] text-muted">Up to {c.hours} hours of support</div>
              <p className="mt-4 flex-1 text-[13px] leading-relaxed">{c.desc}</p>
              <p className="mt-4 border-t border-line pt-3 text-[12px] text-muted">Best for {c.bestFor.toLowerCase()}</p>
            </Card>
          ))}
        </div>
      )}

      {tab === "Policies" && (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-[13px]">
              <thead className="bg-surface-2 text-left text-[12px] text-muted"><tr><th className="px-4 py-2.5 font-medium">Policy</th><th className="px-4 py-2.5 font-medium">Standard</th><th className="px-4 py-2.5 font-medium">Internal detail</th><th className="px-4 py-2.5 font-medium">What the client sees</th></tr></thead>
              <tbody className="divide-y divide-line">
                {POLICIES.map((p) => (
                  <tr key={p.policy} className="align-top">
                    <td className="px-4 py-3 font-medium">{p.policy}</td>
                    <td className="px-4 py-3">{p.standard}</td>
                    <td className="px-4 py-3 text-muted">{p.details}</td>
                    <td className="px-4 py-3 text-muted">{p.client}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

function Step({ n }: { n: number }) {
  return <span className="flex h-5 w-5 items-center justify-center rounded-full bg-ink text-[11px] font-semibold text-bg">{n}</span>;
}

function Row({ k, v, big, tone }: { k: string; v: string; big?: boolean; tone?: string }) {
  return (
    <div className={`flex justify-between gap-2 py-1.5 ${big ? "mt-1.5 border-t border-line pt-3 text-[15px] font-semibold" : ""} ${tone ?? ""}`}>
      <span className={big ? "" : "text-muted"}>{k}</span>
      <span className="text-right font-medium tabular-nums">{v}</span>
    </div>
  );
}
