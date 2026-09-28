"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { NOTIFICATIONS_CHANGED } from "./events";
import { InstrumentIcon } from "@/components/shell/InstrumentIcon";

/**
 * Bell with the unread count for "For me". Loaded in the background after the
 * page renders, on focus and after read marks change — never blocking navigation.
 */
export function NotificationBell({ compact = false }: { compact?: boolean }) {
  const [unread, setUnread] = useState<number | null>(null), path = usePathname();
  useEffect(() => {
    let alive = true;
    const load = () => fetch("/api/notifications/count", { cache: "no-store" }).then(r => r.ok ? r.json() : null).then(d => { if (alive && d && typeof d.unread === "number") setUnread(d.unread); }).catch(() => {});
    load();
    const onFocus = () => { if (document.visibilityState === "visible") load(); };
    document.addEventListener("visibilitychange", onFocus); window.addEventListener(NOTIFICATIONS_CHANGED, load);
    return () => { alive = false; document.removeEventListener("visibilitychange", onFocus); window.removeEventListener(NOTIFICATIONS_CHANGED, load); };
  }, [path === "/notifications"]);
  const label = unread ? `Notifications, ${unread} new` : "Notifications";
  return <Link href="/notifications" aria-label={label} aria-current={path === "/notifications" ? "page" : undefined} data-notifications="">
    <InstrumentIcon name="bell" />{!compact && <span>Notifications</span>}{unread ? <b aria-hidden="true">{unread > 99 ? "99+" : unread}</b> : null}
  </Link>;
}
