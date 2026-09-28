import { createHash } from "node:crypto";
import type { ActivityEntry } from "../domain/types.ts";
import type { DeliveryEvent, WeeklyReview } from "../delivery/types.ts";
import { cairoDay, isoWeek } from "../delivery/model.ts";
import { displayDate } from "../delivery/roadmap.ts";
import type { PortfolioRow } from "../workspace/portfolio.ts";
import type { Commitment } from "../workspace/commitments.ts";
import type { OpenQuestion } from "../workspace/questions.ts";
import type { RiskEvent } from "../workspace/risks.ts";

/**
 * Notifications are derived from canonical records on every read — never stored —
 * so they cannot disagree with the records they point at. Only a person's
 * "read" marks are persisted, keyed by fingerprint. A fingerprint includes the
 * version of what it describes, so a changed record becomes unread again.
 * There is no priority score: order is by kind, then time.
 */
export const NOTIFICATION_KINDS = ["DECISION", "DUE", "CHANGED", "SETUP"] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];
export const KIND_LABEL: Record<NotificationKind, string> = { DECISION: "Decisions", DUE: "Dates & deadlines", CHANGED: "Changes to review", SETUP: "Setup & connections" };

export type NotificationType =
  | "DECISION_NEEDED" | "DECISION_REOPENED" | "DEPENDENCY_DATE"
  | "COMMITMENT_OVERDUE" | "COMMITMENT_DUE_SOON" | "QUESTION_OVERDUE" | "TARGET_PASSED" | "WEEKLY_REVIEW_DUE"
  | "SOURCE_CHANGED" | "TARGET_MOVED" | "RISK_OPENED" | "DECISION_FROM_EVIDENCE"
  | "SETUP_INCOMPLETE" | "CONNECTOR_RECONNECT" | "SOURCE_UNAVAILABLE";

const KIND_OF: Record<NotificationType, NotificationKind> = {
  DECISION_NEEDED: "DECISION", DECISION_REOPENED: "DECISION", DEPENDENCY_DATE: "DUE",
  COMMITMENT_OVERDUE: "DUE", COMMITMENT_DUE_SOON: "DUE", QUESTION_OVERDUE: "DUE", TARGET_PASSED: "DUE", WEEKLY_REVIEW_DUE: "DUE",
  SOURCE_CHANGED: "CHANGED", TARGET_MOVED: "CHANGED", RISK_OPENED: "CHANGED", DECISION_FROM_EVIDENCE: "CHANGED",
  SETUP_INCOMPLETE: "SETUP", CONNECTOR_RECONNECT: "SETUP", SOURCE_UNAVAILABLE: "SETUP",
};

export interface Notification {
  fingerprint: string; type: NotificationType; kind: NotificationKind;
  title: string; detail: string; initiativeId: string | null; initiativeName: string | null;
  href: string; at: string; forMe: boolean;
  /** Derived from a date, not an event: shown without a time of day. */
  dateOnly?: boolean;
}

export interface NotificationInput {
  asOf: string;
  me: { userId: string; memberId: string | null; canFinalizeReviews: boolean };
  rows: PortfolioRow[];
  commitments: Commitment[];
  questions: OpenQuestion[];
  riskEvents: RiskEvent[];
  activity: ActivityEntry[];
  deliveryEvents: DeliveryEvent[];
  reviews: WeeklyReview[];
  connectors: { label: string; status: "CONNECTED" | "NEEDS_RECONNECT" | "DISCONNECTED" | "NOT_CONNECTED" }[];
}

/** Events older than this are history, not notifications. */
export const EVENT_WINDOW_DAYS = 14;
const DUE_SOON_DAYS = 3;
const fp = (...parts: (string | number | null | undefined)[]) => createHash("sha256").update(parts.map(p => String(p ?? "")).join("␟")).digest("hex").slice(0, 32);
const dayDiff = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
const noon = (day: string) => `${day}T09:00:00.000Z`;
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export function deriveNotifications(input: NotificationInput): Notification[] {
  const today = cairoDay(input.asOf), since = Date.parse(input.asOf) - EVENT_WINDOW_DAYS * 86_400_000;
  const rows = input.rows.filter(r => !r.initiative.archivedAt), byId = new Map(rows.map(r => [r.initiative.id, r]));
  /** Mine: assigned to me, or unassigned (or not assignable) on an initiative I own. */
  const mine = (initiativeId: string | null, assignee?: string | null) => {
    if (!input.me.memberId) return false;
    if (assignee) return assignee === input.me.memberId;
    return Boolean(initiativeId && byId.get(initiativeId)?.ownerId === input.me.memberId);
  };
  const base = (id: string) => `/initiatives/${byId.get(id)?.initiative.slug ?? ""}`;
  const recent = (at: string) => { const t = Date.parse(at); return t >= since && t <= Date.parse(input.asOf); };
  const out: Notification[] = [];
  const push = (n: Omit<Notification, "kind" | "initiativeName"> & { initiativeName?: string | null }) =>
    out.push({ ...n, kind: KIND_OF[n.type], initiativeName: n.initiativeName ?? (n.initiativeId ? byId.get(n.initiativeId)?.initiative.name ?? null : null) });

  // Current states that need someone: derived from the same attention the Home page shows.
  for (const r of rows) {
    const id = r.initiative.id;
    for (const a of r.attention) {
      if (a.kind === "DECISION") push({ fingerprint: fp("DECISION_NEEDED", id, a.detail), type: "DECISION_NEEDED", title: "Decision needed", detail: a.detail, initiativeId: id, href: `${base(id)}/decisions`, at: noon(a.date ?? today), dateOnly: true, forMe: mine(id) });
      if (a.kind === "DEPENDENCY") push({ fingerprint: fp("DEPENDENCY_DATE", id, a.detail), type: "DEPENDENCY_DATE", title: "Dependency date impact", detail: a.detail, initiativeId: id, href: a.href || `${base(id)}#relationships`, at: noon(a.date ?? today), dateOnly: true, forMe: mine(id) });
      if (a.kind === "PAST_TARGET") push({ fingerprint: fp("TARGET_PASSED", id, r.target?.id, r.target?.revision), type: "TARGET_PASSED", title: "Target date passed · update needed", detail: a.detail, initiativeId: id, href: `${base(id)}/delivery`, at: noon(a.date ?? today), dateOnly: true, forMe: mine(id) });
    }
    if (!r.setup.ready && mine(id)) { const missing = r.setup.requirements.filter(x => !x.met).map(x => x.label);
      push({ fingerprint: fp("SETUP_INCOMPLETE", id, missing.join(",")), type: "SETUP_INCOMPLETE", title: `Setup incomplete · ${r.setup.completed} of ${r.setup.total}`, detail: `Still needed: ${missing.join(", ")}.`, initiativeId: id, href: r.setup.next?.href ?? `${base(id)}/setup`, at: r.initiative.updatedAt, forMe: true }); }
  }

  for (const c of input.commitments) {
    if (!byId.has(c.initiativeId) || !c.dueDate || c.status === "DONE" || c.status === "CANCELLED") continue;
    const days = dayDiff(today, c.dueDate);
    if (days < 0) push({ fingerprint: fp("COMMITMENT_OVERDUE", c.id, c.dueDate), type: "COMMITMENT_OVERDUE", title: `Commitment overdue by ${plural(-days, "day")}`, detail: c.title, initiativeId: c.initiativeId, href: `${base(c.initiativeId)}/actions?action=${c.id}`, at: noon(c.dueDate), dateOnly: true, forMe: mine(c.initiativeId, c.assigneeMemberId) });
    else if (days <= DUE_SOON_DAYS) push({ fingerprint: fp("COMMITMENT_DUE_SOON", c.id, c.dueDate), type: "COMMITMENT_DUE_SOON", title: days === 0 ? "Commitment due today" : `Commitment due in ${plural(days, "day")}`, detail: c.title, initiativeId: c.initiativeId, href: `${base(c.initiativeId)}/actions?action=${c.id}`, at: noon(today), dateOnly: true, forMe: mine(c.initiativeId, c.assigneeMemberId) });
  }
  for (const q of input.questions) {
    if (!byId.has(q.initiativeId) || q.status !== "OPEN" || !q.dueDate || q.dueDate >= today) continue;
    push({ fingerprint: fp("QUESTION_OVERDUE", q.id, q.dueDate), type: "QUESTION_OVERDUE", title: `Question past its needed-by date (${plural(dayDiff(q.dueDate, today), "day")})`, detail: q.question, initiativeId: q.initiativeId, href: `${base(q.initiativeId)}/context#question-${q.id}`, at: noon(q.dueDate), dateOnly: true, forMe: mine(q.initiativeId, q.ownerMemberId) });
  }

  // Recent events worth a look, within the window. One per underlying thing: the latest wins.
  const latest = new Map<string, Notification>();
  const event = (key: string, n: Omit<Notification, "kind" | "initiativeName">) => { const prev = latest.get(key); if (!prev || prev.at < n.at) latest.set(key, { ...n, kind: KIND_OF[n.type], initiativeName: n.initiativeId ? byId.get(n.initiativeId)?.initiative.name ?? null : null }); };
  for (const e of input.activity) {
    if (!byId.has(e.initiativeId) || !recent(e.occurredAt)) continue;
    const payload = (e.payload ?? {}) as Record<string, unknown>;
    if (e.eventType === "SOURCE_CHANGED") event(`src:${payload.sourceItemId}`, { fingerprint: fp("SOURCE_CHANGED", e.id), type: "SOURCE_CHANGED", title: "Source changed since its last snapshot", detail: e.summary.replace(/^Source changed since the last snapshot: /, ""), initiativeId: e.initiativeId, href: typeof payload.submissionId === "string" ? `${base(e.initiativeId)}/evidence/${payload.submissionId}` : `${base(e.initiativeId)}/sources`, at: e.occurredAt, forMe: mine(e.initiativeId) });
    if (e.eventType === "SOURCE_UNAVAILABLE") event(`src:${e.entityId}`, { fingerprint: fp("SOURCE_UNAVAILABLE", e.id), type: "SOURCE_UNAVAILABLE", title: "Source unavailable at last check", detail: e.summary, initiativeId: e.initiativeId, href: `${base(e.initiativeId)}/sources`, at: e.occurredAt, forMe: mine(e.initiativeId) });
    if (e.eventType === "FINDING_DISPOSITION_REOPENED") event(`reopen:${e.entityId}`, { fingerprint: fp("DECISION_REOPENED", e.id), type: "DECISION_REOPENED", title: "Decision item reopened", detail: e.summary.replace(/^Reopened: /, "Reopened because ").replace(/\.$/, "."), initiativeId: e.initiativeId, href: `${base(e.initiativeId)}/decisions`, at: e.occurredAt, forMe: mine(e.initiativeId) });
    if (e.eventType === "AI_PROPOSAL_CONFIRMED" && /^Human confirmed decision proposal/.test(e.summary)) event(`dec:${e.id}`, { fingerprint: fp("DECISION_FROM_EVIDENCE", e.id), type: "DECISION_FROM_EVIDENCE", title: "Decision entry confirmed from evidence", detail: e.summary.replace(/^Human confirmed decision proposal from /, "From ").replace(/ · unverified Knowledge$/, " · awaiting verification"), initiativeId: e.initiativeId, href: `${base(e.initiativeId)}/knowledge?view=all`, at: e.occurredAt, forMe: mine(e.initiativeId) });
  }
  for (const e of input.deliveryEvents) {
    if (!byId.has(e.initiativeId) || !recent(e.occurredAt) || e.after.kind !== "TARGET_LIVE" || e.before?.state !== "SET" || e.after.state !== "SET") continue;
    const from = e.before.value.date, to = e.after.value.date; if (!from || !to || from === to) continue;
    event(`target:${e.initiativeId}`, { fingerprint: fp("TARGET_MOVED", e.id), type: "TARGET_MOVED", title: `Target Live moved ${dayDiff(from, to) > 0 ? "later" : "earlier"} by ${plural(Math.abs(dayDiff(from, to)), "day")}`, detail: `${displayDate(from)} → ${displayDate(to)}${e.after.note ? ` · ${e.after.note}` : ""}`, initiativeId: e.initiativeId, href: `${base(e.initiativeId)}/delivery`, at: e.occurredAt, forMe: mine(e.initiativeId) });
  }
  for (const e of input.riskEvents) {
    if (!byId.has(e.initiativeId) || !recent(e.at)) continue;
    const opened = e.type === "STARTED" || (e.type === "STATUS" && e.after.status === "OPEN" && e.before?.status !== "OPEN");
    if (opened) event(`risk:${e.trackingId}`, { fingerprint: fp("RISK_OPENED", e.id), type: "RISK_OPENED", title: e.type === "STARTED" ? "Risk tracking started" : "Risk reopened", detail: e.statement, initiativeId: e.initiativeId, href: `${base(e.initiativeId)}/context#risk-${e.claimId}`, at: e.at, forMe: mine(e.initiativeId, e.after.ownerMemberId) });
  }
  out.push(...latest.values());

  // Weekly Review: due when this week has no Final and the week is past its middle (Thursday, Cairo).
  const week = isoWeek(input.asOf), weekday = new Date(`${today}T12:00:00Z`).getUTCDay();
  const final = input.reviews.some(r => r.week === week && r.status === "FINAL");
  if (!final && (weekday >= 4 || weekday === 0) && rows.length) {
    const draft = input.reviews.find(r => r.week === week && r.status === "DRAFT");
    const open = draft ? draft.sections.filter(s => s.needsRecheck || !(s.editedByMemberId || s.editedByUserId)).length : null;
    push({ fingerprint: fp("WEEKLY_REVIEW_DUE", week, open), type: "WEEKLY_REVIEW_DUE", title: `${week.replace(/^\d{4}-/, "")} Weekly Review not finalized`, detail: draft ? `${plural(open ?? 0, "section")} still to review before finalizing.` : "No draft has been prepared for this week yet.", initiativeId: null, href: "/weekly-review", at: noon(today), dateOnly: true, forMe: input.me.canFinalizeReviews });
  }
  for (const c of input.connectors) if (c.status === "NEEDS_RECONNECT") push({ fingerprint: fp("CONNECTOR_RECONNECT", c.label), type: "CONNECTOR_RECONNECT", title: `${c.label} needs reconnecting`, detail: "Access expired or was revoked. Imported sources are unchanged; refreshing them needs a new connection.", initiativeId: null, href: "/account/connections", at: noon(today), dateOnly: true, forMe: true });

  // One dependency is one fact, even though both initiatives show it: keep one item, "for me" if I own either side.
  const deps = new Map<string, Notification>();
  // Both sides of one dependency describe the same date impact: keep one, preferring the side that is mine.
  for (const n of out.filter(n => n.type === "DEPENDENCY_DATE")) { const prev = deps.get(n.detail); if (!prev) deps.set(n.detail, n); else if (n.forMe && !prev.forMe) deps.set(n.detail, n); }
  const merged = out.filter(n => n.type !== "DEPENDENCY_DATE" || deps.get(n.detail) === n);
  const seen = new Set<string>();
  return merged.filter(n => !seen.has(n.fingerprint) && seen.add(n.fingerprint))
    .sort((a, b) => NOTIFICATION_KINDS.indexOf(a.kind) - NOTIFICATION_KINDS.indexOf(b.kind) || b.at.localeCompare(a.at) || a.fingerprint.localeCompare(b.fingerprint));
}

export function unreadCount(all: Notification[], read: ReadonlySet<string>, scope: "mine" | "all" = "mine"): number {
  return all.filter(n => (scope === "all" || n.forMe) && !read.has(n.fingerprint)).length;
}
