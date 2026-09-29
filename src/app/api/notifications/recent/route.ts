import { NextResponse, type NextRequest } from "next/server";
import { AccessError } from "@/lib/auth/core";
import { contextForRequest } from "@/lib/auth/service";
import { readNotifications } from "@/lib/notifications/service";
import { glance } from "@/lib/notifications/presentation";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store" };

/**
 * The bell popover's quick-glance list. Read-only; items are the same derived
 * notifications the full page shows, for the current person in the current
 * organization. Targets are not sent: a row opens through /notifications/open,
 * which re-derives the link server-side.
 */
export async function GET(request: NextRequest) {
  try { await contextForRequest(); } catch (error) { if (error instanceof AccessError) return NextResponse.json({ ok: false }, { status: 401, headers }); throw error; }
  const q = request.nextUrl.searchParams;
  const scope = q.get("scope") === "all" ? "all" : "mine", unreadOnly = q.get("unread") === "1";
  try {
    const { items, read, asOf } = await readNotifications();
    return NextResponse.json({ ok: true, scope, unreadOnly, ...glance(items, read, { scope, unreadOnly, today: asOf.slice(0, 10) }) }, { headers });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503, headers });
  }
}
