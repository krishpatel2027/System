import { NextResponse } from "next/server";
import { authMode, backendMode, configProblem } from "@/lib/server-store";

export async function GET() {
  const problem = configProblem();
  return NextResponse.json(
    { ok: !problem, backend: backendMode(), auth: authMode(), problem, time: new Date().toISOString() },
    { headers: { "Cache-Control": "no-store" } }
  );
}
