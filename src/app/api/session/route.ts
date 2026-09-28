import { NextResponse } from "next/server";
import { contextForRequest } from "@/lib/auth/service";

export const dynamic = "force-dynamic";

/** Cheap check a form uses after a failed save: 204 while signed in, 401 once the session ended (answered by the proxy). */
export async function GET() {
  try { await contextForRequest(); return new NextResponse(null, { status: 204, headers: { "Cache-Control": "no-store" } }); }
  catch { return new NextResponse(null, { status: 401, headers: { "Cache-Control": "no-store" } }); }
}
