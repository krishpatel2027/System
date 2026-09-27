import { NextResponse } from "next/server";
import { ConfigError, configProblem, requireToken, serverLoad, serverSave } from "@/lib/server-store";

const noStore = { "Cache-Control": "no-store" };

function preflight(req: Request) {
  const problem = configProblem();
  if (problem) return NextResponse.json({ error: problem, problem }, { status: 503, headers: noStore });
  if (!requireToken(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: noStore });
  return null;
}

function failure(e: unknown) {
  const status = e instanceof ConfigError ? 503 : 500;
  const message = e instanceof Error ? e.message : "Unexpected error";
  return NextResponse.json({ error: message, problem: status === 503 ? message : undefined }, { status, headers: noStore });
}

// GET /api/store — the current workspace document and its version.
export async function GET(req: Request) {
  const blocked = preflight(req);
  if (blocked) return blocked;
  try {
    const { mode, data, version, updatedAt } = await serverLoad();
    return NextResponse.json({ mode, data, version, updatedAt }, { headers: noStore });
  } catch (e) {
    return failure(e);
  }
}

// PUT /api/store — { data, baseVersion }. 409 with the server's copy when
// someone else saved first; the client merges and retries.
export async function PUT(req: Request) {
  const blocked = preflight(req);
  if (blocked) return blocked;
  try {
    const body = (await req.json()) as { data?: Record<string, unknown>; baseVersion?: unknown };
    const data = body?.data;
    if (!data || typeof data !== "object" || !Array.isArray(data.leads) || !Array.isArray(data.clients) || typeof data.settings !== "object") {
      return NextResponse.json({ error: "Invalid workspace document" }, { status: 400, headers: noStore });
    }
    const baseVersion = Number(body.baseVersion);
    if (!Number.isInteger(baseVersion) || baseVersion < 0) {
      return NextResponse.json({ error: "baseVersion must be a non-negative integer" }, { status: 400, headers: noStore });
    }
    const out = await serverSave(data, baseVersion);
    if (!out.ok) {
      return NextResponse.json({ conflict: true, mode: out.mode, ...out.conflict }, { status: 409, headers: noStore });
    }
    return NextResponse.json({ ok: true, mode: out.mode, version: out.version, updatedAt: out.updatedAt }, { headers: noStore });
  } catch (e) {
    return failure(e);
  }
}
