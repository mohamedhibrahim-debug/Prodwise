import Link from "next/link";
import { requireWorkspaceAccess } from "@/lib/auth/access";
import { workspacePresentation } from "@/lib/workspace/context";
import { readNotifications } from "@/lib/notifications/service";
import { KIND_LABEL, NOTIFICATION_KINDS, type NotificationKind, type NotificationType } from "@/lib/notifications/model";
import { formatDate, formatDateTime } from "@/lib/domain/labels";
import { MarkAllRead } from "@/components/notifications/MarkAllRead";
import { markAllReadAction } from "./actions";
import { Segmented } from "@/components/workspace/TabToolbar";
import styles from "./notifications.module.css";

export const metadata = { title: "Notifications" };
export const dynamic = "force-dynamic";

/**
 * Semantic treatment per notification type: a status or information-type
 * tone with a glyph. Only rows that describe a state (overdue, passed,
 * blocked, a decision waiting) carry a status hue; changes and setup stay
 * quiet, so the feed as a whole does not shout.
 */
type Tone = "overdue" | "decision" | "soon" | "change" | "setup";
const TONE: Record<NotificationType, { tone: Tone; glyph: string; label: string }> = {
  DECISION_NEEDED: { tone: "decision", glyph: "?", label: "Decision needed" },
  DECISION_REOPENED: { tone: "decision", glyph: "?", label: "Decision reopened" },
  DEPENDENCY_DATE: { tone: "overdue", glyph: "⇢", label: "Dependency late" },
  COMMITMENT_OVERDUE: { tone: "overdue", glyph: "▲", label: "Overdue" },
  QUESTION_OVERDUE: { tone: "overdue", glyph: "▲", label: "Overdue" },
  TARGET_PASSED: { tone: "overdue", glyph: "▲", label: "Past target" },
  COMMITMENT_DUE_SOON: { tone: "soon", glyph: "◆", label: "Due soon" },
  WEEKLY_REVIEW_DUE: { tone: "soon", glyph: "▣", label: "Review due" },
  SOURCE_CHANGED: { tone: "change", glyph: "↻", label: "Changed" },
  TARGET_MOVED: { tone: "change", glyph: "↻", label: "Target moved" },
  RISK_OPENED: { tone: "change", glyph: "▲", label: "Risk opened" },
  DECISION_FROM_EVIDENCE: { tone: "change", glyph: "≡", label: "From evidence" },
  SETUP_INCOMPLETE: { tone: "setup", glyph: "○", label: "Setup" },
  CONNECTOR_RECONNECT: { tone: "setup", glyph: "○", label: "Reconnect" },
  SOURCE_UNAVAILABLE: { tone: "setup", glyph: "○", label: "Unavailable" },
};

export default async function Notifications({ searchParams }: { searchParams: Promise<{ scope?: string; kind?: string; gone?: string }> }) {
  const [ctx, q, { items, read }] = await Promise.all([requireWorkspaceAccess(), searchParams, readNotifications()]);
  const presentation = await workspacePresentation(ctx);
  const scope = q.scope === "all" ? "all" : "mine";
  const kind = NOTIFICATION_KINDS.includes(q.kind as NotificationKind) ? q.kind as NotificationKind : null;
  const inScope = items.filter(n => scope === "all" || n.forMe), shown = inScope.filter(n => !kind || n.kind === kind);
  const unread = (list: typeof items) => list.filter(n => !read.has(n.fingerprint)).length;
  const href = (o: { scope?: string; kind?: string | null }) => { const p = new URLSearchParams(); const s = o.scope ?? scope, k = o.kind === undefined ? kind : o.kind; if (s === "all") p.set("scope", "all"); if (k) p.set("kind", k); const t = p.toString(); return `/notifications${t ? `?${t}` : ""}`; };
  const mineCount = items.filter(n => n.forMe);
  const viewLabel = `${scope === "mine" ? "For me" : "Everything"}${kind ? ` · ${KIND_LABEL[kind]}` : ""}`;
  const urgent = shown.filter(n => TONE[n.type].tone === "overdue" || TONE[n.type].tone === "decision").length;
  return <div className={styles.page}>
    <header className={styles.head}><div><h1>Notifications</h1>
      <p className={styles.intro}><strong>{unread(mineCount)} new for you</strong> · {unread(items)} new across {presentation.organizationName} · derived from current records, ordered by kind then time — never scored.</p></div>
      {unread(shown) > 0 ? <MarkAllRead action={markAllReadAction} fingerprints={shown.filter(n => !read.has(n.fingerprint)).map(n => n.fingerprint)} count={unread(shown)} /> : shown.length > 0 && <p role="status" className={styles.muted}>All {shown.length} in this view ({viewLabel}) are read. New or changed items appear as new.</p>}</header>
    {q.gone && <p role="status" className={styles.notice}>That notification no longer applies — its record changed or was resolved.</p>}
    <div className={styles.controls}><Segmented label="Whose notifications" items={[
      { key: "mine", label: "For me", count: unread(mineCount), href: href({ scope: "mine" }), current: scope === "mine" },
      { key: "all", label: "Everything", count: unread(items), href: href({ scope: "all" }), current: scope === "all" },
    ]} /><span className={styles.muted}>{scope === "mine" ? "Assigned to you, or unassigned on initiatives you own · counts are new items" : "Whoever it is assigned to · counts are new items"}</span></div>
    <div className={styles.chips} role="group" aria-label="Filter by kind">
      <Link href={href({ kind: null })} aria-pressed={!kind} className={styles.chip}>All <span>{inScope.length}</span></Link>
      {NOTIFICATION_KINDS.map(k => { const n = inScope.filter(x => x.kind === k).length; return n ? <Link key={k} href={href({ kind: k })} aria-pressed={kind === k} className={styles.chip}>{KIND_LABEL[k]} <span>{n}</span></Link> : null; })}
    </div>
    {!shown.length ? <div className={styles.empty}><p><strong>{scope === "mine" ? "Nothing needs you right now in the recorded information." : "Nothing needs attention right now in the recorded information."}</strong></p>
      <p>Notifications come only from what is recorded in Prodwise. Anything not recorded — or not assigned to you{scope === "mine" ? "; see Everything for the whole organization" : ""} — can’t appear here.</p>
      {scope === "mine" && items.length > 0 && <p><Link href={href({ scope: "all" })}>Show everything in {presentation.organizationName} →</Link></p>}</div>
    : <>
      {urgent > 0 && <p className={styles.urgentLine}><span aria-hidden="true">▲</span>{urgent} of {shown.length} in this view describe a state waiting on a person — an overdue date, a passed target or a decision. The rest are changes and setup.</p>}
      {NOTIFICATION_KINDS.filter(k => shown.some(n => n.kind === k)).map(k => <section key={k} className={styles.group} aria-labelledby={`k-${k}`}>
      <h2 id={`k-${k}`}>{KIND_LABEL[k]} <span>{shown.filter(n => n.kind === k).length}</span></h2>
      <ol className={styles.list}>{shown.filter(n => n.kind === k).map(n => { const isNew = !read.has(n.fingerprint); const t = TONE[n.type]; return <li key={n.fingerprint} className={styles.item} data-unread={isNew || undefined} data-tone={t.tone}>
        <span className={styles.marker} data-tone={t.tone} aria-hidden="true">{t.glyph}</span>
        <div className={styles.body}>
          <p className={styles.detail}><Link prefetch={false} className={styles.open} href={`/notifications/open?n=${n.fingerprint}`}>{n.detail}</Link></p>
          <p className={styles.meta}>{isNew && <span className={styles.new}>New</span>}{t.label.toLowerCase() !== n.title.toLowerCase() && <span className={styles.kindTag} data-tone={t.tone}>{t.label}</span>}<span>{n.title}</span>{n.initiativeName && <span>· {n.initiativeName}</span>}<span>· <time dateTime={n.dateOnly ? n.at.slice(0, 10) : n.at}>{n.dateOnly ? formatDate(n.at) : formatDateTime(n.at)}</time></span>{!n.forMe && scope === "all" && <span>· not assigned to you</span>}</p>
        </div><span className={styles.go} aria-hidden="true">Open →</span></li>; })}</ol></section>)}
    </>}
  </div>;
}
