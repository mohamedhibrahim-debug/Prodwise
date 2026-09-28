import { NextResponse, type NextRequest } from "next/server";
import { markRead, readNotifications } from "@/lib/notifications/service";

export const dynamic = "force-dynamic";

/**
 * Opens a notification: marks it read, then goes to its own deep link. The target
 * comes from the derived notification, never from the request, so this cannot be
 * used as an open redirect.
 */
export async function GET(request: NextRequest) {
  const fingerprint = request.nextUrl.searchParams.get("n") ?? "";
  const { items } = await readNotifications();
  const item = items.find(n => n.fingerprint === fingerprint);
  if (!item) return NextResponse.redirect(new URL("/notifications?gone=1", request.nextUrl.origin), { headers: { "Cache-Control": "no-store" } });
  try { await markRead([item.fingerprint]); } catch { /* Opening still works; the item simply stays unread. */ }
  return NextResponse.redirect(new URL(item.href, request.nextUrl.origin), { headers: { "Cache-Control": "no-store" } });
}
