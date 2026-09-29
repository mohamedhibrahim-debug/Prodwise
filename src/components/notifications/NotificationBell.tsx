"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { NOTIFICATIONS_CHANGED } from "./events";
import { InstrumentIcon } from "@/components/shell/InstrumentIcon";

/**
 * One shared unread count per browser tab. Every bell (desktop bar, initiative
 * header, mobile bar) reads the same value; the server is asked at most once a
 * minute, plus when read marks change or the tab becomes visible again.
 */
const FRESH_MS = 60_000;
let value: number | null = null, fetchedAt = 0, inflight: Promise<void> | null = null;
const listeners = new Set<(n: number | null) => void>();
function refresh(force = false): Promise<void> {
  if (inflight) return inflight;
  if (!force && Date.now() - fetchedAt < FRESH_MS) return Promise.resolve();
  inflight = fetch("/api/notifications/count", { cache: "no-store" })
    .then(r => (r.ok ? r.json() : null))
    .then(d => { if (d && typeof d.unread === "number") { value = d.unread; fetchedAt = Date.now(); listeners.forEach(l => l(value)); } })
    .catch(() => {})
    .finally(() => { inflight = null; });
  return inflight;
}

export function NotificationBell({ compact = false }: { compact?: boolean }) {
  const [unread, setUnread] = useState<number | null>(value), path = usePathname();
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- subscribes to the shared unread store and adopts the server value
    listeners.add(setUnread); setUnread(value); void refresh();
    const onVisible = () => { if (document.visibilityState === "visible") void refresh(); };
    const onChanged = () => { void refresh(true); };
    document.addEventListener("visibilitychange", onVisible); window.addEventListener(NOTIFICATIONS_CHANGED, onChanged);
    return () => { listeners.delete(setUnread); document.removeEventListener("visibilitychange", onVisible); window.removeEventListener(NOTIFICATIONS_CHANGED, onChanged); };
  }, []);
  // Leaving the notifications page (where items may have been opened) re-checks.
  useEffect(() => { if (path !== "/notifications") void refresh(fetchedAt > 0 && Date.now() - fetchedAt > 5_000); }, [path]);
  const label = unread ? `Notifications, ${unread} new` : "Notifications";
  return <Link href="/notifications" aria-label={label} aria-current={path === "/notifications" ? "page" : undefined} data-notifications="">
    <InstrumentIcon name="bell" />{!compact && <span>Notifications</span>}{unread ? <b aria-hidden="true">{unread > 99 ? "99+" : unread}</b> : null}
  </Link>;
}
