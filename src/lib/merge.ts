import type { DB } from "./types";

// Three-way merge used when two people edit the workspace at the same time.
// base = last copy this browser got from the server, local = this browser's
// copy, remote = the server's current copy. Collections of records are merged
// per record id, so edits to different records never overwrite each other.
// When both sides changed the same record, this browser's edit wins.

type Rec = { id: string };
type Obj = Record<string, unknown>;

const same = (a: unknown, b: unknown) => a === b || JSON.stringify(a) === JSON.stringify(b);
const isRecordArray = (v: unknown): v is Rec[] =>
  Array.isArray(v) && v.every((x) => !!x && typeof x === "object" && typeof (x as Rec).id === "string");
const isPlainObject = (v: unknown): v is Obj => !!v && typeof v === "object" && !Array.isArray(v);

function mergeRecords(b: Rec[] = [], l: Rec[] = [], r: Rec[] = [], depth: number): Rec[] {
  const B = new Map(b.map((x) => [x.id, x]));
  const L = new Map(l.map((x) => [x.id, x]));
  const R = new Map(r.map((x) => [x.id, x]));
  const out: Rec[] = [];
  const seen = new Set<string>();
  const emit = (id: string) => {
    if (seen.has(id)) return;
    seen.add(id);
    const v = mergeValue(B.get(id), L.get(id), R.get(id), depth + 1) as Rec | undefined;
    if (v !== undefined) out.push(v);
  };
  for (const x of r) if (!B.has(x.id) && !L.has(x.id)) emit(x.id); // teammates' new records first
  for (const x of l) emit(x.id);
  for (const x of r) emit(x.id);
  return out;
}

function mergeValue(b: unknown, l: unknown, r: unknown, depth: number): unknown {
  if (same(l, b)) return r;
  if (same(r, b)) return l;
  if (same(l, r)) return l;
  const present = [b, l, r].filter((v) => v !== undefined);
  if (present.length > 0 && present.every(isRecordArray)) return mergeRecords(b as Rec[], l as Rec[], r as Rec[], depth);
  if (depth < 4 && isPlainObject(l) && isPlainObject(r)) {
    const bo = isPlainObject(b) ? b : {};
    const out: Obj = {};
    for (const k of new Set([...Object.keys(bo), ...Object.keys(l), ...Object.keys(r)])) {
      const v = mergeValue(bo[k], l[k], r[k], depth + 1);
      if (v !== undefined) out[k] = v;
    }
    return out;
  }
  return l !== undefined ? l : r;
}

// No common base (first sync on this browser): keep every record from both
// sides, prefer the server's version of anything that exists on both.
function unionPreferRemote(local: DB, remote: DB): DB {
  const out: Obj = { ...(remote as unknown as Obj) };
  for (const [k, lv] of Object.entries(local as unknown as Obj)) {
    const rv = out[k];
    if (isRecordArray(lv) && isRecordArray(rv)) {
      const ids = new Set(rv.map((x) => x.id));
      out[k] = [...lv.filter((x) => !ids.has(x.id)), ...rv];
    } else if (rv === undefined) out[k] = lv;
  }
  return out as unknown as DB;
}

export function merge3(base: DB | null, local: DB, remote: DB): DB {
  if (!base) return unionPreferRemote(local, remote);
  return mergeValue(base, local, remote, 0) as DB;
}

export const sameDoc = same;
