import { NextResponse } from "next/server";
import { AccessError } from "@/lib/auth/core";
import { contextForRequest } from "@/lib/auth/service";
import { readNotifications } from "@/lib/notifications/service";
import { unreadCount } from "@/lib/notifications/model";

export const dynamic = "force-dynamic";

/** Unread count for the shell bell. Loaded in the background; it never blocks a page. */
export async function GET() {
  try { await contextForRequest(); } catch (error) { if (error instanceof AccessError) return NextResponse.json({ unread: null }, { status: 401, headers: { "Cache-Control": "no-store" } }); throw error; }
  try {
    const { items, read } = await readNotifications();
    return NextResponse.json({ unread: unreadCount(items, read, "mine") }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ unread: null }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
