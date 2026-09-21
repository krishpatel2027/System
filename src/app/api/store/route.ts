import { NextResponse } from "next/server";
import { requireToken, serverLoad, serverSave } from "@/lib/server-store";

// GET /api/store — load the persisted DB document (or null when empty).
export async function GET(req: Request) {
  if (!requireToken(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { mode, data, updatedAt } = await serverLoad();
    return NextResponse.json(
      { mode, data, updatedAt },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Load failed" }, { status: 500 });
  }
}

// PUT /api/store — persist the whole DB document. Minimal shape validation.
export async function PUT(req: Request) {
  if (!requireToken(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = (await req.json()) as Record<string, unknown>;
    if (typeof body !== "object" || body === null || !Array.isArray(body.leads) || !Array.isArray(body.clients)) {
      return NextResponse.json({ error: "Invalid DB document (leads/clients arrays required)" }, { status: 400 });
    }
    // Guard against accidentally persisting an empty object wiping real data.
    if ((body.leads as unknown[]).length === 0 && (body.clients as unknown[]).length === 0 && !body.settings) {
      return NextResponse.json({ error: "Refusing to save empty DB document" }, { status: 400 });
    }
    const { mode, updatedAt } = await serverSave(body);
    return NextResponse.json({ ok: true, mode, updatedAt });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Save failed" }, { status: 500 });
  }
}
