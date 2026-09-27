"use client";
import React, { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useDB } from "@/lib/store";
import { merge3, sameDoc } from "@/lib/merge";
import { migrate } from "@/lib/migrate";
import { DEFAULT_PRICING, packageBundle } from "@/lib/pricing-data";
import { inr, uid, cn } from "@/lib/utils";
import { Card, Btn, Field, inputCls, PageHeader, Badge } from "@/components/ui";
import {
  Building2, Receipt, Package as PackageIcon, ListChecks, Wrench, ScrollText, Users, Database,
  Plus, Trash2, ArrowUp, ArrowDown, X, Check, Search, RotateCcw, Download, Upload, LogOut, RefreshCw, AlertTriangle, Star,
} from "lucide-react";
import type { DB, PricingConfig, Settings, RateItem } from "@/lib/types";

const SECTIONS = [
  { id: "studio", label: "Studio profile", icon: Building2, desc: "How your studio appears on quotes and proposals." },
  { id: "quotes", label: "Quotes & payments", icon: Receipt, desc: "Numbering, GST, validity and how clients pay you." },
  { id: "packages", label: "Packages", icon: PackageIcon, desc: "Your package tiers, prices and what each one bundles." },
  { id: "rates", label: "Rate card", icon: ListChecks, desc: "Prices for every extra the calculator can add." },
  { id: "care", label: "Care plans", icon: Wrench, desc: "Monthly maintenance plans offered after launch." },
  { id: "terms", label: "Terms & policies", icon: ScrollText, desc: "Your policies, and which ones print on quotes." },
  { id: "team", label: "Team & access", icon: Users, desc: "Who's signed in, sync status and access." },
  { id: "data", label: "Data & backup", icon: Database, desc: "Export, restore or clear workspace data." },
] as const;
type SectionId = (typeof SECTIONS)[number]["id"];
const DRAFT_SECTIONS: SectionId[] = ["studio", "quotes", "packages", "rates", "care", "terms"];

type Draft = { settings: Settings; pricing: PricingConfig };

function SettingsInner() {
  const { db, ready, update, replace } = useDB();
  const router = useRouter();
  const params = useSearchParams();
  const section = (SECTIONS.find((s) => s.id === params.get("section"))?.id ?? "studio") as SectionId;
  const go = (id: SectionId) => router.replace(`/settings?section=${id}`, { scroll: false });

  const live = useMemo<Draft>(() => ({ settings: db.settings, pricing: db.pricing }), [db.settings, db.pricing]);
  const [draft, setDraft] = useState<Draft>(live);
  const [start, setStart] = useState<Draft>(live);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const dirty = !sameDoc(draft, start);

  // Follow the saved data (initial load, teammates' edits) while nothing is being edited.
  useEffect(() => {
    if (!ready || dirty) return;
    /* eslint-disable react-hooks/set-state-in-effect -- mirror saved data into the idle form */
    setStart(live);
    setDraft(live);
    /* eslint-enable react-hooks/set-state-in-effect */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live, ready]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const setS = (patch: Partial<Settings>) => setDraft((d) => ({ ...d, settings: { ...d.settings, ...patch } }));
  const setP = (patch: Partial<PricingConfig>) => setDraft((d) => ({ ...d, pricing: { ...d.pricing, ...patch } }));

  const validate = (d: Draft) => {
    const out: string[] = [];
    if (!d.settings.studio.trim()) out.push("Studio name can't be empty.");
    if (!d.settings.quotePrefix.trim()) out.push("Quote number prefix can't be empty.");
    const pk = d.pricing.packages.map((p) => p.name.trim().toLowerCase());
    if (pk.some((n) => !n)) out.push("Every package needs a name.");
    if (new Set(pk).size !== pk.length) out.push("Two packages have the same name.");
    if (d.pricing.packages.length === 0) out.push("Keep at least one package.");
    const fn = d.pricing.features.map((f) => f.feature.trim().toLowerCase());
    if (fn.some((n) => !n)) out.push("Every rate-card item needs a name.");
    if (new Set(fn).size !== fn.length) out.push("Two rate-card items have the same name.");
    if (d.pricing.carePlans.some((c) => !c.name.trim())) out.push("Every care plan needs a name.");
    if (d.pricing.policies.some((p) => !p.policy.trim())) out.push("Every policy needs a title.");
    return out;
  };

  const save = () => {
    const errs = validate(draft);
    setErrors(errs);
    if (errs.length) return;
    // Fold in anything a teammate saved while this form was open.
    const merged = merge3(
      { ...db, ...start },
      { ...db, ...draft },
      db,
    );
    update("settings", merged.settings);
    update("pricing", merged.pricing);
    const next = { settings: merged.settings, pricing: merged.pricing };
    setStart(next);
    setDraft(next);
    setSavedAt(Date.now());
  };
  const discard = () => { setDraft(start); setErrors([]); };

  const meta = SECTIONS.find((s) => s.id === section)!;
  const isDraftSection = DRAFT_SECTIONS.includes(section);

  return (
    <div className="space-y-6 pb-24">
      <PageHeader
        title="Settings"
        description="Studio details, pricing and workspace controls. Changes to details and pricing apply for the whole team once saved."
        actions={<>
          {dirty && <Btn variant="ghost" onClick={discard}>Discard</Btn>}
          <Btn onClick={save} disabled={!dirty}>{dirty ? <><Check size={14} /> Save changes</> : savedAt ? <><Check size={14} /> Saved</> : "Save changes"}</Btn>
        </>}
      />

      {errors.length > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700 dark:border-red-900 dark:bg-red-950/60 dark:text-red-300">
          <div className="mb-1 flex items-center gap-2 font-medium"><AlertTriangle size={14} /> Fix these before saving</div>
          <ul className="list-disc pl-5">{errors.map((e) => <li key={e}>{e}</li>)}</ul>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[230px_1fr]">
        <nav className="-mx-4 flex gap-1 overflow-x-auto px-4 lg:sticky lg:top-24 lg:mx-0 lg:h-fit lg:flex-col lg:overflow-visible lg:px-0">
          {SECTIONS.map((s) => {
            const Icon = s.icon;
            const active = s.id === section;
            return (
              <button key={s.id} onClick={() => go(s.id)}
                className={cn("flex h-9 shrink-0 items-center gap-2.5 rounded-xl px-3 text-left text-[13.5px] font-medium transition",
                  active ? "bg-surface text-ink shadow-sm ring-1 ring-line" : "text-muted hover:bg-surface-2 hover:text-ink")}>
                <Icon size={15} className={active ? "text-accent" : "text-subtle"} />{s.label}
              </button>
            );
          })}
        </nav>

        <div className="min-w-0 space-y-4">
          <div>
            <h2 className="text-[17px] font-semibold tracking-tight">{meta.label}</h2>
            <p className="text-[13px] text-muted">{meta.desc}{isDraftSection ? "" : " These actions apply immediately."}</p>
          </div>
          {section === "studio" && <StudioSection s={draft.settings} set={setS} />}
          {section === "quotes" && <QuotesSection s={draft.settings} set={setS} />}
          {section === "packages" && <PackagesSection p={draft.pricing} set={setP} />}
          {section === "rates" && <RatesSection p={draft.pricing} set={setP} />}
          {section === "care" && <CareSection p={draft.pricing} set={setP} />}
          {section === "terms" && <TermsSection p={draft.pricing} set={setP} />}
          {section === "team" && <TeamSection />}
          {section === "data" && <DataSection db={db} update={update} replace={replace} />}
        </div>
      </div>

      {dirty && (
        <div className="fixed inset-x-0 bottom-4 z-30 flex justify-center px-4 lg:pl-[260px]">
          <div className="animate-pop-in flex w-full max-w-xl items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3 shadow-2xl">
            <span className="h-2 w-2 shrink-0 rounded-full bg-amber-500" />
            <span className="flex-1 text-[13.5px] font-medium">You have unsaved changes</span>
            <Btn variant="ghost" size="sm" onClick={discard}>Discard</Btn>
            <Btn size="sm" onClick={save}><Check size={13} /> Save changes</Btn>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- sections ----------

function StudioSection({ s, set }: { s: Settings; set: (p: Partial<Settings>) => void }) {
  return (
    <Card className="p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Studio name *"><input className={inputCls} value={s.studio} onChange={(e) => set({ studio: e.target.value })} /></Field>
        <Field label="Owner" hint="Used as the default name when nobody is signed in"><input className={inputCls} value={s.owner} onChange={(e) => set({ owner: e.target.value })} /></Field>
        <Field label="Email"><input type="email" className={inputCls} value={s.email} onChange={(e) => set({ email: e.target.value })} placeholder="hello@yourstudio.com" /></Field>
        <Field label="Phone"><input className={inputCls} value={s.phone} onChange={(e) => set({ phone: e.target.value })} placeholder="+91" /></Field>
        <Field label="Website"><input className={inputCls} value={s.website} onChange={(e) => set({ website: e.target.value })} placeholder="yourstudio.com" /></Field>
        <Field label="GSTIN" hint="Printed on quotes when filled"><input className={inputCls} value={s.gstin} onChange={(e) => set({ gstin: e.target.value.toUpperCase() })} placeholder="22AAAAA0000A1Z5" /></Field>
        <div className="sm:col-span-2"><Field label="Business address"><textarea rows={2} className={inputCls} value={s.address} onChange={(e) => set({ address: e.target.value })} /></Field></div>
      </div>
      <div className="mt-5 rounded-xl border border-dashed border-line-strong p-4">
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-subtle">Preview on documents</div>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-ink text-[16px] font-bold text-bg">{(s.studio || "A")[0]}</div>
          <div className="min-w-0">
            <div className="text-[15px] font-semibold">{s.studio || "Studio name"}</div>
            <div className="truncate text-[12px] text-muted">{[s.email, s.phone, s.website].filter(Boolean).join(" · ") || "Add contact details"}</div>
            {(s.address || s.gstin) && <div className="truncate text-[11.5px] text-subtle">{[s.address, s.gstin && `GSTIN ${s.gstin}`].filter(Boolean).join(" · ")}</div>}
          </div>
        </div>
      </div>
    </Card>
  );
}

function QuotesSection({ s, set }: { s: Settings; set: (p: Partial<Settings>) => void }) {
  const year = new Date().getFullYear();
  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Quote number prefix *" hint={`Next quotes look like ${s.quotePrefix || "Q"}-${year}-001`}>
            <input className={inputCls} value={s.quotePrefix} onChange={(e) => set({ quotePrefix: e.target.value.replace(/\s/g, "").toUpperCase() })} maxLength={10} />
          </Field>
          <Field label="Default GST %"><input type="number" min={0} max={28} className={inputCls} value={s.defaultGst} onChange={(e) => set({ defaultGst: Math.max(0, Number(e.target.value) || 0) })} /></Field>
          <Field label="Quotes valid for (days)"><input type="number" min={1} className={inputCls} value={s.quoteValidityDays} onChange={(e) => set({ quoteValidityDays: Math.max(1, Number(e.target.value) || 14) })} /></Field>
          <div className="sm:col-span-3"><Field label="Default payment terms" hint="Pre-filled on every new quote; you can change it per quote"><textarea rows={2} className={inputCls} value={s.paymentTerms} onChange={(e) => set({ paymentTerms: e.target.value })} /></Field></div>
        </div>
      </Card>
      <Card className="p-5">
        <div className="mb-3 text-[13.5px] font-semibold">How clients pay you</div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="UPI ID"><input className={inputCls} value={s.upi} onChange={(e) => set({ upi: e.target.value })} placeholder="yourstudio@okbank" /></Field>
          <div />
          <div className="sm:col-span-2"><Field label="Bank transfer details" hint="Shown on quotes and proposals. Leave empty to hide."><textarea rows={3} className={inputCls} value={s.bank} onChange={(e) => set({ bank: e.target.value })} placeholder={"Account name: …\nAccount no: …\nIFSC: …"} /></Field></div>
        </div>
      </Card>
    </div>
  );
}

function PackagesSection({ p, set }: { p: PricingConfig; set: (x: Partial<PricingConfig>) => void }) {
  const pk = p.packages;
  const setPkg = (i: number, patch: Partial<PricingConfig["packages"][number]>) =>
    set({ packages: pk.map((x, j) => (j === i ? { ...x, ...patch } : patch.popular ? { ...x, popular: false } : x)) });
  const move = (i: number, d: -1 | 1) => {
    const next = [...pk];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    set({ packages: next });
  };
  const featureNames = p.features.map((f) => f.feature);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 text-[12.5px] text-muted">
        <span>Order runs from entry to top tier. Each tier includes everything bundled in the tiers above it in this list.</span>
        <Btn size="sm" variant="ghost" onClick={() => { if (confirm("Restore all packages, rates, care plans and terms to the original defaults? You can still discard before saving.")) set(DEFAULT_PRICING); }}><RotateCcw size={13} /> Restore defaults</Btn>
      </div>
      {pk.map((x, i) => {
        const inherited = new Set(i > 0 ? packageBundle(pk, pk[i - 1].id) : []);
        const available = featureNames.filter((f) => !x.bundle.includes(f) && !inherited.has(f));
        return (
          <Card key={x.id} className={cn("p-5", x.popular && "ring-1 ring-accent")}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-surface-2 text-[11.5px] font-semibold text-muted">{i + 1}</span>
              <input className={cn(inputCls, "h-9 max-w-[220px] font-semibold")} value={x.name} onChange={(e) => setPkg(i, { name: e.target.value })} placeholder="Package name" />
              <button onClick={() => setPkg(i, { popular: !x.popular })} className={cn("inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[12.5px] font-medium", x.popular ? "bg-accent-soft text-accent" : "text-muted hover:bg-surface-2")}>
                <Star size={13} className={x.popular ? "fill-current" : ""} /> {x.popular ? "Most popular" : "Mark popular"}
              </button>
              <div className="ml-auto flex items-center gap-1">
                <IconBtn label="Move up" disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp size={14} /></IconBtn>
                <IconBtn label="Move down" disabled={i === pk.length - 1} onClick={() => move(i, 1)}><ArrowDown size={14} /></IconBtn>
                <IconBtn label="Delete package" danger onClick={() => { if (confirm(`Remove the ${x.name || "untitled"} package?`)) set({ packages: pk.filter((_, j) => j !== i) }); }}><Trash2 size={14} /></IconBtn>
              </div>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-4">
              <Field label="Starting price (₹)"><input type="number" min={0} className={inputCls} value={x.price} onChange={(e) => setPkg(i, { price: Math.max(0, Number(e.target.value) || 0) })} /></Field>
              <Field label="Scope"><input className={inputCls} value={x.scope} onChange={(e) => setPkg(i, { scope: e.target.value })} placeholder="5–7 pages" /></Field>
              <Field label="Label"><input className={inputCls} value={x.positioning} onChange={(e) => setPkg(i, { positioning: e.target.value })} placeholder="Core" /></Field>
              <Field label="Best for"><input className={inputCls} value={x.bestFor} onChange={(e) => setPkg(i, { bestFor: e.target.value })} /></Field>
              <div className="sm:col-span-4"><Field label="Highlights (comma separated, shown to clients)"><textarea rows={2} className={inputCls} value={x.highlights} onChange={(e) => setPkg(i, { highlights: e.target.value })} /></Field></div>
            </div>
            <div className="mt-4">
              <div className="mb-1.5 text-[12.5px] font-medium text-muted">Bundled at no extra charge {inherited.size > 0 && <span className="text-subtle">· plus {inherited.size} from lower tiers</span>}</div>
              <div className="flex flex-wrap items-center gap-1.5">
                {x.bundle.map((f) => (
                  <span key={f} className={cn("inline-flex items-center gap-1 rounded-full py-0.5 pl-2.5 pr-1 text-[12px] ring-1 ring-inset", featureNames.includes(f) ? "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:ring-emerald-900" : "bg-red-50 text-red-700 ring-red-200")} title={featureNames.includes(f) ? "" : "Not on the rate card"}>
                    {f}
                    <button aria-label={`Remove ${f}`} onClick={() => setPkg(i, { bundle: x.bundle.filter((b) => b !== f) })} className="rounded-full p-0.5 hover:bg-black/5"><X size={11} /></button>
                  </span>
                ))}
                <select value="" onChange={(e) => e.target.value && setPkg(i, { bundle: [...x.bundle, e.target.value] })}
                  className="h-7 rounded-full border border-dashed border-line-strong bg-transparent px-2.5 text-[12px] text-muted outline-none hover:border-accent">
                  <option value="">+ Add feature…</option>
                  {available.map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
            </div>
          </Card>
        );
      })}
      <Btn variant="outline" onClick={() => set({ packages: [...pk, { id: uid("pkg"), name: "", price: 0, scope: "", positioning: "", bestFor: "", highlights: "", bundle: [] }] })}><Plus size={14} /> Add package</Btn>
    </div>
  );
}

function RatesSection({ p, set }: { p: PricingConfig; set: (x: Partial<PricingConfig>) => void }) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("All");
  const cats = ["All", ...new Set(p.features.map((f) => f.category))];
  const rows = p.features.map((f, i) => ({ f, i })).filter(({ f }) =>
    (cat === "All" || f.category === cat) && (!q.trim() || `${f.feature} ${f.notes}`.toLowerCase().includes(q.toLowerCase())));

  const setRow = (i: number, patch: Partial<RateItem>) => {
    const old = p.features[i];
    const features = p.features.map((f, j) => (j === i ? { ...f, ...patch } : f));
    // Renaming an item keeps package bundles pointing at it.
    const packages = patch.feature !== undefined && patch.feature !== old.feature
      ? p.packages.map((pk) => ({ ...pk, bundle: pk.bundle.map((b) => (b === old.feature ? patch.feature! : b)) }))
      : p.packages;
    set({ features, packages });
  };
  const remove = (i: number) => {
    const name = p.features[i].feature;
    set({ features: p.features.filter((_, j) => j !== i), packages: p.packages.map((pk) => ({ ...pk, bundle: pk.bundle.filter((b) => b !== name) })) });
  };
  const num = "h-8 w-full rounded-lg border border-transparent bg-transparent px-2 text-right text-[13px] tabular-nums outline-none hover:border-line focus:border-accent focus:bg-surface";
  const txt = "h-8 w-full rounded-lg border border-transparent bg-transparent px-2 text-[13px] outline-none hover:border-line focus:border-accent focus:bg-surface";

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
          <div className="relative min-w-[200px] flex-1">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-subtle" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${p.features.length} items…`} className={cn(inputCls, "pl-8")} />
          </div>
          <select value={cat} onChange={(e) => setCat(e.target.value)} className={cn(inputCls, "!w-auto")}>{cats.map((c) => <option key={c}>{c}</option>)}</select>
          <Btn variant="outline" onClick={() => { set({ features: [{ category: cat === "All" ? "Website" : cat, feature: "", unit: "project", entry: 0, standard: 0, premium: 0, notes: "" }, ...p.features] }); setQ(""); }}><Plus size={14} /> Add item</Btn>
        </div>
        <div className="max-h-[60vh] overflow-auto">
          <table className="w-full min-w-[860px] text-[13px]">
            <thead className="sticky top-0 z-10 bg-surface-2 text-left text-[12px] text-muted">
              <tr>
                <th className="px-3 py-2 font-medium">Item</th><th className="w-36 px-3 py-2 font-medium">Category</th><th className="w-28 px-3 py-2 font-medium">Unit</th>
                <th className="w-28 px-3 py-2 text-right font-medium">Entry</th><th className="w-28 px-3 py-2 text-right font-medium">Standard ★</th><th className="w-28 px-3 py-2 text-right font-medium">Premium</th>
                <th className="px-3 py-2 font-medium">Notes</th><th className="w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map(({ f, i }) => (
                <tr key={i} className="group">
                  <td className="px-1 py-1"><input className={cn(txt, "font-medium", !f.feature.trim() && "border-red-300")} value={f.feature} onChange={(e) => setRow(i, { feature: e.target.value })} placeholder="Item name" /></td>
                  <td className="px-1 py-1"><input list="rate-cats" className={txt} value={f.category} onChange={(e) => setRow(i, { category: e.target.value })} /></td>
                  <td className="px-1 py-1"><input className={txt} value={f.unit} onChange={(e) => setRow(i, { unit: e.target.value })} /></td>
                  <td className="px-1 py-1"><input type="number" min={0} className={num} value={f.entry} onChange={(e) => setRow(i, { entry: Number(e.target.value) || 0 })} /></td>
                  <td className="px-1 py-1"><input type="number" min={0} className={cn(num, "font-semibold")} value={f.standard} onChange={(e) => setRow(i, { standard: Number(e.target.value) || 0 })} /></td>
                  <td className="px-1 py-1"><input type="number" min={0} className={num} value={f.premium} onChange={(e) => setRow(i, { premium: Number(e.target.value) || 0 })} /></td>
                  <td className="px-1 py-1"><input className={cn(txt, "text-muted")} value={f.notes} onChange={(e) => setRow(i, { notes: e.target.value })} /></td>
                  <td className="px-1 py-1"><IconBtn label="Delete item" danger onClick={() => remove(i)}><Trash2 size={13} /></IconBtn></td>
                </tr>
              ))}
            </tbody>
          </table>
          <datalist id="rate-cats">{cats.slice(1).map((c) => <option key={c} value={c} />)}</datalist>
          {rows.length === 0 && <div className="px-4 py-10 text-center text-[13px] text-muted">No items match.</div>}
        </div>
        <div className="border-t border-line bg-surface-2/50 px-4 py-2.5 text-[12px] text-muted">★ The calculator charges the Standard price. Entry and Premium are reference points for custom quotes.</div>
      </Card>

      <Card className="p-5">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-[13.5px] font-semibold">Hourly reference rates</div>
          <Btn size="sm" variant="ghost" onClick={() => set({ hourly: [...p.hourly, { role: "", rate: 0, low: 0, high: 0 }] })}><Plus size={13} /> Add role</Btn>
        </div>
        <div className="space-y-2">
          <div className="grid grid-cols-[minmax(0,1fr)_64px_64px_64px_32px] sm:grid-cols-[1fr_90px_90px_90px_32px] gap-2 text-[12px] text-muted"><span>Role</span><span>Rate/h</span><span>Low</span><span>High</span><span /></div>
          {p.hourly.map((h, i) => (
            <div key={i} className="grid grid-cols-[minmax(0,1fr)_64px_64px_64px_32px] sm:grid-cols-[1fr_90px_90px_90px_32px] items-center gap-2">
              <input className={inputCls} value={h.role} onChange={(e) => set({ hourly: p.hourly.map((x, j) => (j === i ? { ...x, role: e.target.value } : x)) })} />
              {(["rate", "low", "high"] as const).map((k) => (
                <input key={k} type="number" min={0} className={inputCls} value={h[k]} onChange={(e) => set({ hourly: p.hourly.map((x, j) => (j === i ? { ...x, [k]: Number(e.target.value) || 0 } : x)) })} />
              ))}
              <IconBtn label="Delete role" danger onClick={() => set({ hourly: p.hourly.filter((_, j) => j !== i) })}><Trash2 size={13} /></IconBtn>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function CareSection({ p, set }: { p: PricingConfig; set: (x: Partial<PricingConfig>) => void }) {
  const setPlan = (i: number, patch: Partial<PricingConfig["carePlans"][number]>) => set({ carePlans: p.carePlans.map((c, j) => (j === i ? { ...c, ...patch } : c)) });
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        {p.carePlans.map((c, i) => (
          <Card key={i} className="p-5">
            <div className="flex items-center gap-2">
              <input className={cn(inputCls, "font-semibold")} value={c.name} onChange={(e) => setPlan(i, { name: e.target.value })} placeholder="Plan name" />
              <IconBtn label="Delete plan" danger onClick={() => set({ carePlans: p.carePlans.filter((_, j) => j !== i) })}><Trash2 size={14} /></IconBtn>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <Field label="Monthly price (₹)"><input type="number" min={0} className={inputCls} value={c.monthly} onChange={(e) => setPlan(i, { monthly: Number(e.target.value) || 0 })} /></Field>
              <Field label="Support hours / month"><input type="number" min={0} className={inputCls} value={c.hours} onChange={(e) => setPlan(i, { hours: Number(e.target.value) || 0 })} /></Field>
              <div className="col-span-2"><Field label="What's included"><textarea rows={2} className={inputCls} value={c.desc} onChange={(e) => setPlan(i, { desc: e.target.value })} /></Field></div>
              <div className="col-span-2"><Field label="Best for"><input className={inputCls} value={c.bestFor} onChange={(e) => setPlan(i, { bestFor: e.target.value })} /></Field></div>
            </div>
          </Card>
        ))}
      </div>
      <Btn variant="outline" onClick={() => set({ carePlans: [...p.carePlans, { name: "", monthly: 0, hours: 0, desc: "", bestFor: "" }] })}><Plus size={14} /> Add care plan</Btn>
    </div>
  );
}

function TermsSection({ p, set }: { p: PricingConfig; set: (x: Partial<PricingConfig>) => void }) {
  const setPol = (i: number, patch: Partial<PricingConfig["policies"][number]>) => set({ policies: p.policies.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
  return (
    <div className="space-y-3">
      {p.policies.map((x, i) => (
        <Card key={i} className="p-5">
          <div className="flex flex-wrap items-center gap-2">
            <input className={cn(inputCls, "max-w-xs font-semibold")} value={x.policy} onChange={(e) => setPol(i, { policy: e.target.value })} placeholder="Policy title" />
            <input className={cn(inputCls, "max-w-[200px]")} value={x.standard} onChange={(e) => setPol(i, { standard: e.target.value })} placeholder="Standard (e.g. 14 days)" />
            <label className="ml-auto inline-flex cursor-pointer items-center gap-2 text-[12.5px] text-muted">
              <input type="checkbox" checked={!!x.onQuotes} onChange={(e) => setPol(i, { onQuotes: e.target.checked })} className="h-4 w-4 accent-[var(--accent)]" /> Print on quotes
            </label>
            <IconBtn label="Delete policy" danger onClick={() => set({ policies: p.policies.filter((_, j) => j !== i) })}><Trash2 size={14} /></IconBtn>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field label="What the client sees"><textarea rows={2} className={inputCls} value={x.client} onChange={(e) => setPol(i, { client: e.target.value })} /></Field>
            <Field label="Internal notes"><textarea rows={2} className={inputCls} value={x.details} onChange={(e) => setPol(i, { details: e.target.value })} /></Field>
          </div>
        </Card>
      ))}
      <Btn variant="outline" onClick={() => set({ policies: [...p.policies, { policy: "", standard: "", details: "", client: "", onQuotes: false }] })}><Plus size={14} /> Add policy</Btn>
    </div>
  );
}

function TeamSection() {
  const { sync, backend, lastSyncedAt, refreshFromServer, userName, setUserName, logout, problem } = useDB();
  const [health, setHealth] = useState<{ auth: string; backend: string; problem: string | null } | null>(null);
  const [name, setName] = useState(userName);
  const [savedName, setSavedName] = useState(false);
  useEffect(() => { fetch("/api/health", { cache: "no-store" }).then((r) => r.json()).then(setHealth).catch(() => {}); }, []);
  const statusTone = sync === "synced" ? "green" : sync === "error" || sync === "misconfigured" ? "red" : "amber";

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="text-[13.5px] font-semibold">You</div>
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <div className="min-w-[220px] flex-1"><Field label="Your name on this device"><input className={inputCls} value={name} onChange={(e) => { setName(e.target.value); setSavedName(false); }} /></Field></div>
          <Btn variant="outline" onClick={() => { setUserName(name.trim()); setSavedName(true); }}>{savedName ? <><Check size={14} /> Saved</> : "Update name"}</Btn>
          <Btn variant="ghost" onClick={logout}><LogOut size={14} /> Sign out</Btn>
        </div>
      </Card>

      <Card className="p-5">
        <div className="flex flex-wrap items-center gap-2">
          <div className="text-[13.5px] font-semibold">Workspace</div>
          <Badge tone={statusTone} dot>{sync}</Badge>
          <Btn size="sm" variant="outline" className="ml-auto" onClick={() => void refreshFromServer()}><RefreshCw size={13} /> Sync now</Btn>
        </div>
        <dl className="mt-4 grid gap-3 text-[13px] sm:grid-cols-3">
          <div className="rounded-xl bg-surface-2 px-3 py-2.5"><dt className="text-[12px] text-muted">Storage</dt><dd className="font-medium capitalize">{backend ?? health?.backend ?? "—"}</dd></div>
          <div className="rounded-xl bg-surface-2 px-3 py-2.5"><dt className="text-[12px] text-muted">Access</dt><dd className="font-medium">{health ? (health.auth === "password" ? "Team password" : "Open — no password") : "—"}</dd></div>
          <div className="rounded-xl bg-surface-2 px-3 py-2.5"><dt className="text-[12px] text-muted">Last synced</dt><dd className="font-medium">{lastSyncedAt ? new Date(lastSyncedAt).toLocaleString("en-IN") : "—"}</dd></div>
        </dl>
        {(problem || health?.problem) && <p className="mt-3 flex gap-2 text-[12.5px] text-red-600"><AlertTriangle size={14} className="mt-0.5 shrink-0" />{problem || health?.problem}</p>}
        {health?.auth === "open" && !health.problem && <p className="mt-3 text-[12.5px] text-amber-700 dark:text-amber-300">Anyone who can reach this app can open it. Set <code>ARKRIA_ADMIN_PASSWORD</code> on the server before sharing it with your team.</p>}
      </Card>

      <Card className="p-5 text-[13px] leading-relaxed text-muted">
        <div className="mb-1 text-[13.5px] font-semibold text-ink">Adding teammates</div>
        Share the app&apos;s address and the team password. Everyone works on the same data: changes save automatically, appear for others within about 15 seconds, and edits by different people to different records never overwrite each other.
      </Card>
    </div>
  );
}

function DataSection({ db, update, replace }: { db: DB; update: ReturnType<typeof useDB>["update"]; replace: (d: DB) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [confirmText, setConfirmText] = useState("");
  const RECORDS: [keyof DB, string][] = [["leads", "Leads"], ["clients", "Clients"], ["quotes", "Quotes"], ["proposals", "Proposals"], ["projects", "Projects"], ["payments", "Payments"], ["scopes", "Scope changes"], ["subs", "Care subscriptions"], ["comms", "Conversation log"]];

  const exportJSON = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(db, null, 2)], { type: "application/json" }));
    a.download = `${(db.settings.studio || "studio").toLowerCase()}-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const importJSON = (f: File) => {
    const r = new FileReader();
    r.onload = () => {
      try {
        const doc = migrate(JSON.parse(String(r.result)));
        if (!doc) return alert("That file isn't a Studio OS backup.");
        if (!confirm("Replace everything in this workspace with the backup? This affects your whole team.")) return;
        replace(doc);
        alert("Backup restored.");
      } catch {
        alert("Couldn't read that file.");
      }
    };
    r.readAsText(f);
  };
  const wipe = () => {
    RECORDS.forEach(([k]) => update(k, [] as never));
    setConfirmText("");
  };

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="text-[13.5px] font-semibold">What&apos;s in this workspace</div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {RECORDS.map(([k, label]) => (
            <div key={k} className="rounded-xl bg-surface-2 px-3 py-2.5">
              <div className="text-[18px] font-semibold tabular-nums">{(db[k] as unknown[]).length}</div>
              <div className="text-[12px] text-muted">{label}</div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-5">
        <div className="text-[13.5px] font-semibold">Backup</div>
        <p className="mt-1 text-[13px] text-muted">Download everything (records, pricing and settings) as one file, or restore from one.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Btn variant="outline" onClick={exportJSON}><Download size={14} /> Download backup</Btn>
          <Btn variant="outline" onClick={() => fileRef.current?.click()}><Upload size={14} /> Restore from backup</Btn>
          <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) importJSON(f); e.target.value = ""; }} />
        </div>
      </Card>

      <Card className="border-red-200 p-5 dark:border-red-900">
        <div className="text-[13.5px] font-semibold text-red-700 dark:text-red-400">Delete all records</div>
        <p className="mt-1 text-[13px] text-muted">Removes every lead, client, quote, proposal, project, payment, scope change, care subscription and log entry — for the whole team. Settings, pricing, services and templates are kept. Download a backup first.</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder='Type "DELETE" to confirm' className={cn(inputCls, "max-w-[220px]")} />
          <Btn variant="danger" disabled={confirmText !== "DELETE"} onClick={wipe}><Trash2 size={14} /> Delete all records</Btn>
        </div>
      </Card>

      <p className="text-[12px] text-subtle">Starting prices in use: {db.pricing.packages.map((p) => `${p.name} ${inr(p.price)}`).join(" · ")}</p>
    </div>
  );
}

function IconBtn({ children, label, onClick, disabled, danger }: { children: React.ReactNode; label: string; onClick: () => void; disabled?: boolean; danger?: boolean }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} disabled={disabled}
      className={cn("flex h-8 w-8 items-center justify-center rounded-lg text-subtle transition disabled:opacity-30",
        danger ? "hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950" : "hover:bg-surface-2 hover:text-ink")}>
      {children}
    </button>
  );
}

export default function SettingsPage() {
  return <Suspense><SettingsInner /></Suspense>;
}
