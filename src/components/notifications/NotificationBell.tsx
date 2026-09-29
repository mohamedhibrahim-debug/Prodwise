"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { FloatingLayer, usePopover } from "@/components/primitives/Popover";
import { InstrumentIcon } from "@/components/shell/InstrumentIcon";
import { TONE, type GlanceGroup } from "@/lib/notifications/presentation";
import { formatDate, formatDateTime } from "@/lib/domain/labels";
import { NOTIFICATIONS_CHANGED } from "./events";
import styles from "./NotificationBell.module.css";

/**
 * One shared unread count per browser tab. Every bell (desktop bar, mobile
 * bar, drawer) reads the same value; the server is asked at most once a
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
function useUnread() {
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
  return unread;
}

/**
 * The bell. In the top bar and the mobile bar it opens a quick-glance panel
 * anchored to the bell (a bottom sheet on phones); the full Notifications
 * page stays the "View all" destination. In the navigation drawer it remains
 * a plain link, because the drawer is itself a list of destinations.
 */
export function NotificationBell({ compact = false }: { compact?: boolean }) {
  const unread = useUnread(), path = usePathname();
  const label = unread ? `Notifications, ${unread} new` : "Notifications";
  const badge = unread ? <b aria-hidden="true">{unread > 99 ? "99+" : unread}</b> : null;
  if (!compact) return <Link href="/notifications" aria-label={label} aria-current={path === "/notifications" ? "page" : undefined} data-notifications="">
    <InstrumentIcon name="bell" /><span>Notifications</span>{badge}
  </Link>;
  return <NotificationGlance label={label} badge={badge} current={path === "/notifications"} />;
}

type Scope = "mine" | "all";
interface Glance { groups: GlanceGroup[]; total: number; unread: { mine: number; all: number } }
type Load = { state: "idle" | "loading" } | { state: "ready"; data: Glance } | { state: "failed" };

function NotificationGlance({ label, badge, current }: { label: string; badge: React.ReactNode; current: boolean }) {
  const popover = usePopover({ placement: "bottom-end", kind: "dialog" });
  const [scope, setScope] = useState<Scope>("mine");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [load, setLoad] = useState<Load>({ state: "idle" });
  const [marking, setMarking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchList = useCallback(async (s: Scope, u: boolean) => {
    setLoad(prev => prev.state === "ready" ? prev : { state: "loading" });
    try {
      const r = await fetch(`/api/notifications/recent?scope=${s}${u ? "&unread=1" : ""}`, { cache: "no-store" });
      const d = r.ok ? await r.json() as Glance & { ok: boolean } : null;
      setLoad(d?.ok ? { state: "ready", data: d } : { state: "failed" });
    } catch { setLoad({ state: "failed" }); }
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- the list is fetched when the panel opens or its filters change
  useEffect(() => { if (popover.open) void fetchList(scope, unreadOnly); }, [popover.open, scope, unreadOnly, fetchList]);

  const mark = async (fingerprints: string[]) => {
    if (!fingerprints.length) return;
    setMarking(true); setError(null);
    try {
      const r = await fetch("/api/notifications/read", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ fingerprints }) });
      if (!r.ok) throw new Error();
      window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED));
      await fetchList(scope, unreadOnly);
    } catch { setError("Read marks could not be saved. Try again."); }
    finally { setMarking(false); }
  };

  const data = load.state === "ready" ? load.data : null;
  const visibleUnread = data ? data.groups.flatMap(g => g.items).filter(i => i.unread).map(i => i.fingerprint) : [];
  return <>
    <button type="button" className={styles.trigger} aria-label={label} data-notifications="" data-current={current || undefined} {...popover.triggerProps}>
      <InstrumentIcon name="bell" />{badge}
    </button>
    <FloatingLayer popover={popover} role="dialog" label="Notifications" width={400} className={styles.panel}>
      <header className={styles.head}>
        <h2>Notifications</h2>
        <button type="button" className={styles.markAll} disabled={marking || !visibleUnread.length} onClick={() => void mark(visibleUnread)}>{marking ? "Marking…" : "Mark all read"}</button>
      </header>
      <div className={styles.filters}>
        <div className={styles.scope} role="radiogroup" aria-label="Whose notifications">
          {(["mine", "all"] as const).map(s => <button key={s} type="button" role="radio" aria-checked={scope === s} onClick={() => setScope(s)}>
            {s === "mine" ? "For me" : "Everything"}{data && <span>{s === "mine" ? data.unread.mine : data.unread.all}</span>}
          </button>)}
        </div>
        <label className={styles.toggle}><input type="checkbox" checked={unreadOnly} onChange={e => setUnreadOnly(e.target.checked)} />Unread only</label>
      </div>
      {error && <p role="alert" className={styles.error}>{error}</p>}
      <div className={styles.body} aria-busy={load.state === "loading" || undefined}>
        {load.state === "loading" || load.state === "idle" ? <p className={styles.state}><span className="pw-spinner" aria-hidden="true" />Loading notifications…</p>
        : load.state === "failed" ? <p className={styles.state}>Notifications could not be loaded. <button type="button" className={styles.linkButton} onClick={() => void fetchList(scope, unreadOnly)}>Try again</button></p>
        : !data!.groups.length ? <div className={styles.empty}>
            <p><strong>{unreadOnly ? "Nothing unread" : scope === "mine" ? "Nothing needs you right now" : "Nothing needs attention right now"}</strong> in the recorded information.</p>
            <p>{scope === "mine" ? "Only items assigned to you, or unassigned on initiatives you own." : "Everything recorded in this organization."}</p>
          </div>
        : data!.groups.map(g => <section key={g.key} aria-label={g.label}>
            <h3 className={styles.group}>{g.label}</h3>
            <ul className={styles.list}>{g.items.map(n => { const t = TONE[n.type]; return <li key={n.fingerprint} className={styles.item} data-unread={n.unread || undefined}>
              <Link prefetch={false} href={`/notifications/open?n=${n.fingerprint}`} className={styles.row} onClick={() => popover.close()}>
                <span className={styles.marker} data-tone={t.tone} aria-hidden="true">{t.glyph}</span>
                <span className={styles.text}>
                  <span className={styles.meta}><span className={styles.kind} data-tone={t.tone}>{t.label}</span>{n.initiativeName && <span className={styles.initiative}>{n.initiativeName}</span>}</span>
                  <span className={styles.detail}>{n.detail}</span>
                  <span className={styles.when}><time dateTime={n.dateOnly ? n.at.slice(0, 10) : n.at}>{n.dateOnly ? formatDate(n.at) : formatDateTime(n.at)}</time>{scope === "all" && !n.forMe && " · not assigned to you"}</span>
                </span>
                {n.unread && <span className={styles.dot}><span className="visually-hidden">New</span></span>}
              </Link>
              {n.unread && <button type="button" className={styles.readOne} disabled={marking} onClick={() => void mark([n.fingerprint])} aria-label={`Mark read: ${n.detail}`} data-tip="Mark read"><InstrumentIcon name="check" /></button>}
            </li>; })}</ul>
          </section>)}
      </div>
      <footer className={styles.foot}>
        {data && data.total > data.groups.reduce((s, g) => s + g.items.length, 0) && <span>{data.groups.reduce((s, g) => s + g.items.length, 0)} of {data.total} shown</span>}
        <Link prefetch={false} href={`/notifications${scope === "all" ? "?scope=all" : ""}`} className={styles.viewAll} onClick={() => popover.close()}>View all notifications <span aria-hidden="true">→</span></Link>
      </footer>
    </FloatingLayer>
  </>;
}
