import { NextResponse } from "next/server";
import { configProblem, requireToken } from "../../server-store";

export const noStore = { "Cache-Control": "no-store" };

export const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: noStore });

// Same gate as /api/store: team password + a correctly configured server.
export function gate(req: Request) {
  const problem = configProblem();
  if (problem) return json({ error: problem, problem }, 503);
  if (!requireToken(req)) return json({ error: "Unauthorized" }, 401);
  return null;
}

export async function body<T>(req: Request): Promise<T | null> {
  try { return (await req.json()) as T; } catch { return null; }
}
