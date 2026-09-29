import { NextResponse, type NextRequest } from "next/server";
import { AccessError } from "@/lib/auth/core";
import { contextForRequest } from "@/lib/auth/service";
import { markRead } from "@/lib/notifications/service";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store" };

/**
 * Marks notifications read for the current person. Only fingerprints the
 * person can currently see are marked (markRead re-derives the visible set);
 * read marks never change a product record.
 */
export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== request.nextUrl.origin) return NextResponse.json({ ok: false, message: "Request origin refused." }, { status: 403, headers });
  try { await contextForRequest(); } catch (error) { if (error instanceof AccessError) return NextResponse.json({ ok: false }, { status: 401, headers }); throw error; }
  let fingerprints: unknown;
  try { fingerprints = ((await request.json()) as { fingerprints?: unknown }).fingerprints; } catch { fingerprints = null; }
  if (!Array.isArray(fingerprints) || fingerprints.length > 200 || fingerprints.some(f => typeof f !== "string")) return NextResponse.json({ ok: false, message: "Nothing to mark." }, { status: 400, headers });
  try {
    const marked = await markRead(fingerprints as string[]);
    return NextResponse.json({ ok: true, marked }, { headers });
  } catch {
    return NextResponse.json({ ok: false, message: "Read marks could not be saved. Try again." }, { status: 503, headers });
  }
}
