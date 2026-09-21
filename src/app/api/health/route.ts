import { NextResponse } from "next/server";
import { backendMode } from "@/lib/server-store";

export async function GET() {
  return NextResponse.json({
    ok: true,
    backend: backendMode(),
    auth: process.env.ARKRIA_ADMIN_PASSWORD ? "password" : "open",
    time: new Date().toISOString(),
  });
}
