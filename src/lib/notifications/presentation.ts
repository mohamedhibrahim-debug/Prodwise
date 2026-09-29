import type { Notification, NotificationType } from "./model.ts";

/**
 * Semantic treatment per notification type: a status or information-type
 * tone with a glyph. Only rows that describe a state (overdue, passed,
 * blocked, a decision waiting) carry a status hue; changes and setup stay
 * quiet, so the feed as a whole does not shout. Shared by the full page and
 * the bell popover so both read the same.
 */
export type Tone = "overdue" | "decision" | "soon" | "change" | "setup";
export const TONE: Record<NotificationType, { tone: Tone; glyph: string; label: string }> = {
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

/** What the bell popover receives: display fields only, never workspace identifiers. */
export interface GlanceItem {
  fingerprint: string; type: NotificationType; title: string; detail: string;
  initiativeName: string | null; at: string; dateOnly: boolean; forMe: boolean; unread: boolean;
}
export interface GlanceGroup { key: "today" | "week" | "earlier"; label: string; items: GlanceItem[] }

const day = (iso: string) => iso.slice(0, 10);
const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);

/**
 * The quick-glance list: scope (for me / everything), optionally unread only,
 * newest first, capped, grouped by recency against the page's own "today"
 * (the scenario day in the Demo), never against the browser clock.
 */
export function glance(items: Notification[], read: ReadonlySet<string>, opts: { scope: "mine" | "all"; unreadOnly: boolean; today: string; limit?: number }): { groups: GlanceGroup[]; total: number; unread: { mine: number; all: number } } {
  const limit = opts.limit ?? 30;
  const isUnread = (n: Notification) => !read.has(n.fingerprint);
  const scoped = items.filter(n => opts.scope === "all" || n.forMe).filter(n => !opts.unreadOnly || isUnread(n))
    .sort((a, b) => b.at.localeCompare(a.at));
  const shown = scoped.slice(0, limit).map<GlanceItem>(n => ({ fingerprint: n.fingerprint, type: n.type, title: n.title, detail: n.detail, initiativeName: n.initiativeName, at: n.at, dateOnly: Boolean(n.dateOnly), forMe: n.forMe, unread: isUnread(n) }));
  const bucket = (n: GlanceItem): GlanceGroup["key"] => { const d = daysBetween(day(n.at), opts.today); return d <= 0 ? "today" : d <= 7 ? "week" : "earlier"; };
  const labels: Record<GlanceGroup["key"], string> = { today: "Today", week: "This week", earlier: "Earlier" };
  const groups = (["today", "week", "earlier"] as const).map(key => ({ key, label: labels[key], items: shown.filter(n => bucket(n) === key) })).filter(g => g.items.length);
  return { groups, total: scoped.length, unread: { mine: items.filter(n => n.forMe && isUnread(n)).length, all: items.filter(isUnread).length } };
}
