"use client";
import React, { useState } from "react";
import Link from "next/link";
import { Btn } from "@/components/ui";
import { newShareToken } from "@/lib/utils";
import { Link2, Check, Copy, FileX2, Globe, X } from "lucide-react";

export function DocLoading() {
  return <div className="flex min-h-screen items-center justify-center text-[13px] text-muted">Loading…</div>;
}

export function DocMissing({ kind, back }: { kind: string; back: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center">
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-surface-2 text-muted"><FileX2 size={20} /></div>
      <h1 className="text-[18px] font-semibold">{kind} not found</h1>
      <p className="max-w-sm text-[13.5px] text-muted">It may have been deleted by a teammate.</p>
      <Link href={back} className="mt-2 text-[13.5px] font-medium text-accent hover:underline">Go back</Link>
    </div>
  );
}

export function StatusSelect<T extends string>({ value, options, onChange }: { value: T; options: T[]; onChange: (v: T) => void }) {
  return (
    <select aria-label="Status" value={value} onChange={(e) => onChange(e.target.value as T)}
      className="h-9 rounded-xl border border-line bg-surface px-2.5 text-[13px] capitalize outline-none focus:border-accent">
      {options.map((s) => <option key={s} value={s}>{s}</option>)}
    </select>
  );
}

// Creates / copies / revokes the public link a client can open without logging in.
export function ShareButton({ token, onChange }: { token?: string; onChange: (token: string | undefined) => void }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const url = token ? `${typeof window !== "undefined" ? window.location.origin : ""}/share/${token}` : "";

  const copy = async (u: string) => {
    try {
      await navigator.clipboard.writeText(u);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {}
  };
  const create = () => {
    const t = newShareToken();
    onChange(t);
    void copy(`${window.location.origin}/share/${t}`);
  };

  return (
    <div className="relative">
      <Btn variant={token ? "outline" : "accent"} onClick={() => setOpen((o) => !o)}>
        {token ? <Globe size={14} /> : <Link2 size={14} />} {token ? "Shared" : "Share with client"}
      </Btn>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="animate-pop-in absolute right-0 top-full z-40 mt-2 w-[340px] rounded-2xl border border-line bg-surface p-4 shadow-xl">
            <div className="flex items-center justify-between">
              <div className="text-[13.5px] font-semibold">Share with your client</div>
              <button onClick={() => setOpen(false)} className="rounded-lg p-1 text-subtle hover:bg-surface-2" aria-label="Close"><X size={14} /></button>
            </div>
            {token ? (
              <>
                <p className="mt-1 text-[12.5px] text-muted">Anyone with this link can view and download this document — nothing else in your workspace.</p>
                <div className="mt-3 flex gap-2">
                  <input readOnly value={url} onFocus={(e) => e.target.select()} className="h-9 min-w-0 flex-1 rounded-xl border border-line bg-surface-2 px-3 text-[12px] text-muted outline-none" />
                  <Btn onClick={() => copy(url)}>{copied ? <Check size={14} /> : <Copy size={14} />}{copied ? "Copied" : "Copy"}</Btn>
                </div>
                <button onClick={() => { onChange(undefined); setOpen(false); }} className="mt-3 text-[12.5px] font-medium text-red-600 hover:underline">Stop sharing — disable this link</button>
              </>
            ) : (
              <>
                <p className="mt-1 text-[12.5px] text-muted">Create a private link your client can open without an account. You can turn it off at any time.</p>
                <Btn variant="accent" className="mt-3 w-full" onClick={create}><Link2 size={14} /> Create & copy link</Btn>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
