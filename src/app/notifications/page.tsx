import Link from "next/link";
import { requireWorkspaceAccess } from "@/lib/auth/access";
import { workspacePresentation } from "@/lib/workspace/context";
import { readNotifications } from "@/lib/notifications/service";
import { KIND_LABEL, NOTIFICATION_KINDS, type NotificationKind } from "@/lib/notifications/model";
import { formatDate, formatDateTime } from "@/lib/domain/labels";
import { MarkAllRead } from "@/components/notifications/MarkAllRead";
import { markAllReadAction } from "./actions";
import styles from "./notifications.module.css";

export const metadata = { title: "Notifications" };
export const dynamic = "force-dynamic";

export default async function Notifications({ searchParams }: { searchParams: Promise<{ scope?: string; kind?: string; gone?: string }> }) {
  const [ctx, q, { items, read }] = await Promise.all([requireWorkspaceAccess(), searchParams, readNotifications()]);
  const presentation = await workspacePresentation(ctx);
  const scope = q.scope === "all" ? "all" : "mine";
  const kind = NOTIFICATION_KINDS.includes(q.kind as NotificationKind) ? q.kind as NotificationKind : null;
  const inScope = items.filter(n => scope === "all" || n.forMe), shown = inScope.filter(n => !kind || n.kind === kind);
  const unread = (list: typeof items) => list.filter(n => !read.has(n.fingerprint)).length;
  const href = (o: { scope?: string; kind?: string | null }) => { const p = new URLSearchParams(); const s = o.scope ?? scope, k = o.kind === undefined ? kind : o.kind; if (s === "all") p.set("scope", "all"); if (k) p.set("kind", k); const t = p.toString(); return `/notifications${t ? `?${t}` : ""}`; };
  const mineCount = items.filter(n => n.forMe);
  return <div className={styles.page}>
    <header className={styles.head}><div><p className={styles.eyebrow}>Attention center · {presentation.organizationName}</p><h1>Notifications</h1>
      <p className={styles.intro}>Everything waiting on someone, derived from the current records: decisions, dates, commitments, questions, risks and sources. Home’s “Needs attention” is narrower: only each initiative’s decisions, blockers and missed dates. Nothing is scored; items are ordered by kind, then time.{presentation.scenarioAt ? " Dates are relative to the Demo scenario date." : ""}</p></div>
      {unread(shown) > 0 ? <MarkAllRead action={markAllReadAction} fingerprints={shown.filter(n => !read.has(n.fingerprint)).map(n => n.fingerprint)} count={unread(shown)} /> : shown.length > 0 && <p role="status" className={styles.muted}>All {shown.length} marked read. New or changed items will appear as new.</p>}</header>
    {q.gone && <p role="status" className={styles.notice}>That notification no longer applies — its record changed or was resolved.</p>}
    <nav className={styles.scope} aria-label="Whose notifications">
      <Link href={href({ scope: "mine" })} aria-current={scope === "mine" ? "page" : undefined}>For me <span>{unread(mineCount)} new</span></Link>
      <Link href={href({ scope: "all" })} aria-current={scope === "all" ? "page" : undefined}>Everything in {presentation.organizationName} <span>{unread(items)} new</span></Link>
    </nav>
    <p className={styles.muted}>{scope === "mine" ? "For me: items assigned to you, and unassigned items on initiatives you own. Home shows the whole portfolio." : "Everything that needs attention in this organization, whoever it is assigned to."}</p>
    <div className={styles.chips} role="group" aria-label="Filter by kind">
      <Link href={href({ kind: null })} aria-pressed={!kind} className={styles.chip}>All <span>{inScope.length}</span></Link>
      {NOTIFICATION_KINDS.map(k => { const n = inScope.filter(x => x.kind === k).length; return n ? <Link key={k} href={href({ kind: k })} aria-pressed={kind === k} className={styles.chip}>{KIND_LABEL[k]} <span>{n}</span></Link> : null; })}
    </div>
    {!shown.length ? <div className={styles.empty}><p><strong>{scope === "mine" ? "Nothing needs you right now in the recorded information." : "Nothing needs attention right now in the recorded information."}</strong></p>
      <p>Notifications come only from what is recorded in Prodwise. Anything not recorded — or not assigned to you{scope === "mine" ? "; see Everything for the whole organization" : ""} — can’t appear here.</p>
      {scope === "mine" && items.length > 0 && <p><Link href={href({ scope: "all" })}>Show everything in {presentation.organizationName} →</Link></p>}</div>
    : NOTIFICATION_KINDS.filter(k => shown.some(n => n.kind === k)).map(k => <section key={k} className={styles.group} aria-labelledby={`k-${k}`}>
      <h2 id={`k-${k}`}>{KIND_LABEL[k]} <span>{shown.filter(n => n.kind === k).length}</span></h2>
      <ol className={styles.list}>{shown.filter(n => n.kind === k).map(n => { const isNew = !read.has(n.fingerprint); return <li key={n.fingerprint} className={styles.item} data-unread={isNew || undefined}>
        <span className={styles.marker} aria-hidden="true" />
        <div className={styles.body}>
          <p className={styles.meta}>{isNew && <span className={styles.new}>New</span>}<span>{n.title}</span>{n.initiativeName && <span>· {n.initiativeName}</span>}</p>
          <p className={styles.detail}><Link href={`/notifications/open?n=${n.fingerprint}`}>{n.detail}</Link></p>
          <p className={styles.time}><time dateTime={n.dateOnly ? n.at.slice(0, 10) : n.at}>{n.dateOnly ? formatDate(n.at) : formatDateTime(n.at)}</time>{!n.forMe && scope === "all" && <span> · not assigned to you</span>}</p>
        </div></li>; })}</ol></section>)}
  </div>;
}
