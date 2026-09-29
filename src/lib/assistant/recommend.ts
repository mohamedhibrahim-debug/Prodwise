import type { PortfolioRow } from '../workspace/portfolio.ts';
import type { Commitment } from '../workspace/commitments.ts';
import type { OpenQuestion } from '../workspace/questions.ts';
import { dayDifference } from '../delivery/model.ts';
import { questionOverdueDays } from '../workspace/questions.ts';
import { displayDate } from '../delivery/roadmap.ts';

/**
 * "Prodwise recommends": one to three next actions, each grounded in a
 * recorded state and saying why. Deterministic and pure — no provider, no
 * clock — so Home, the Brief and Ask Prodwise show the same list.
 *
 * Ranking follows CLAUDE.md §14: a recorded difference awaiting a decision,
 * then a recorded blocker, then dates that have passed, then what would keep
 * the record honest (proposals, the review, setup, measurement). It never
 * manufactures an action: with nothing recorded it returns nothing.
 */
export type RecommendationKind = 'decision' | 'blocker' | 'commitment' | 'question' | 'schedule' | 'proposal' | 'review' | 'setup' | 'metric';
export interface Recommendation {
  key: string;
  kind: RecommendationKind;
  /** The action, as an imperative sentence. */
  action: string;
  /** Why now — the recorded state behind it. */
  why: string;
  href: string;
  /** Where the action lands, as a short verb phrase. */
  go: string;
  initiative: { name: string; slug: string } | null;
}
export interface RecommendInput {
  today: string;
  me: { memberId: string | null; writer: boolean; canFinalize: boolean };
  rows: PortfolioRow[];
  commitments: Commitment[];
  questions: OpenQuestion[];
  review: { week: string; status: 'DRAFT' | 'FINAL' | 'NONE'; pending: number; total: number; started: boolean; next: { week: string; started: boolean; exists: boolean } | null };
  proposals?: { initiativeId: string; pending: number; sourceTitle: string | null }[];
  metrics?: { initiativeId: string; configured: number }[];
  limit?: number;
}

const shortWeek = (week: string) => week.replace(/^\d{4}-/, '');
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function recommend(input: RecommendInput): Recommendation[] {
  const limit = input.limit ?? 3;
  const rows = input.rows.filter(r => !r.initiative.archivedAt);
  const byId = new Map(rows.map(r => [r.initiative.id, r]));
  const initiative = (r: PortfolioRow) => ({ name: r.initiative.name, slug: r.initiative.slug });
  const out: Recommendation[] = [];
  const seen = new Set<string>();
  const push = (r: Recommendation) => { if (!seen.has(r.key)) { seen.add(r.key); out.push(r); } };

  // 1–2. A recorded difference awaiting a decision, then a recorded blocker.
  for (const kind of ['DECISION', 'BLOCKER'] as const) for (const r of rows) {
    const a = r.attention.find(x => x.kind === kind); if (!a) continue;
    push(kind === 'DECISION'
      ? { key: `decision:${r.initiative.id}`, kind: 'decision', action: `Decide the recorded difference on ${r.initiative.name}.`, why: `Two recorded values disagree: ${a.detail}. Until a person decides, both stay in Knowledge and the difference is carried into every review.`, href: a.href, go: 'Review decision', initiative: initiative(r) }
      : { key: `blocker:${r.initiative.id}`, kind: 'blocker', action: `Clear or update the recorded blocker on ${r.initiative.name}.`, why: `A blocker is recorded: ${a.detail}. It stays until someone withdraws it or records what changed.`, href: a.href, go: 'Open delivery facts', initiative: initiative(r) });
  }

  // 3. Overdue or blocked commitments routed to me.
  const live = new Set(rows.map(r => r.initiative.id));
  const ownerOf = (id: string) => byId.get(id)?.ownerId ?? null;
  const mine = input.commitments.filter(a => live.has(a.initiativeId) && !['DONE', 'CANCELLED'].includes(a.status) && (a.assigneeMemberId === input.me.memberId || (!a.assigneeMemberId && ownerOf(a.initiativeId) === input.me.memberId)));
  for (const a of mine.filter(a => a.blockedNote || (a.dueDate && a.dueDate < input.today)).sort((x, y) => (x.dueDate ?? '9999').localeCompare(y.dueDate ?? '9999'))) {
    const r = byId.get(a.initiativeId)!;
    push({ key: `commitment:${a.id}`, kind: 'commitment', action: `${a.blockedNote ? 'Unblock' : 'Complete or re-date'} the commitment “${cap(a.title)}”.`, why: a.blockedNote ? `It is recorded as blocked: ${a.blockedNote}.` : `Its due date, ${displayDate(a.dueDate!)}, has passed and it is still open.`, href: `/initiatives/${r.initiative.slug}/actions?action=${a.id}`, go: 'Open commitment', initiative: initiative(r) });
  }

  // 4. Overdue questions on initiatives I own.
  for (const q of input.questions.filter(q => q.status === 'OPEN' && live.has(q.initiativeId) && ownerOf(q.initiativeId) === input.me.memberId)) {
    const days = questionOverdueDays(q, input.today); if (!days) continue;
    const r = byId.get(q.initiativeId)!;
    push({ key: `question:${q.id}`, kind: 'question', action: `Answer the open question on ${r.initiative.name}.`, why: `“${q.question}” was needed ${days} ${days === 1 ? 'day' : 'days'} ago and has no recorded answer.`, href: `/initiatives/${r.initiative.slug}/context#question-${q.id}`, go: 'Answer question', initiative: initiative(r) });
  }

  // 5. A Target Live that passed with no Actual Live: a human update, not a missed launch.
  for (const r of rows) {
    const a = r.attention.find(x => x.kind === 'PAST_TARGET'); if (!a) continue;
    push({ key: `past:${r.initiative.id}`, kind: 'schedule', action: `Update the delivery facts for ${r.initiative.name}.`, why: `Target Live was ${r.target?.value.date ? displayDate(r.target.value.date) : 'recorded'} and no Actual Live is recorded. Only a person can say whether it launched.`, href: a.href, go: 'Update delivery facts', initiative: initiative(r) });
  }

  // 6. Pending proposals: evidence read but not yet decided by a person.
  for (const p of (input.proposals ?? []).filter(p => p.pending > 0 && live.has(p.initiativeId)).sort((a, b) => b.pending - a.pending)) {
    const r = byId.get(p.initiativeId)!;
    push({ key: `proposal:${p.initiativeId}`, kind: 'proposal', action: `Review ${p.pending} pending ${p.pending === 1 ? 'proposal' : 'proposals'} on ${r.initiative.name}.`, why: `${p.sourceTitle ? `They come from “${p.sourceTitle}” and ` : 'They '}are not part of Product Truth until a person confirms or rejects them.`, href: `/initiatives/${r.initiative.slug}/sources`, go: 'Review proposals', initiative: initiative(r) });
  }

  // 7. The weekly review.
  if (input.me.writer) {
    const w = input.review;
    if (w.status === 'DRAFT' && w.pending > 0) push({ key: `review:${w.week}`, kind: 'review', action: `Review ${w.pending} of ${w.total} sections in the ${shortWeek(w.week)} review.`, why: `The Draft is prepared; ${w.pending} ${w.pending === 1 ? 'section is' : 'sections are'} not yet reviewed, so it cannot be finalized.`, href: `/weekly-review?week=${w.week}`, go: 'Continue review', initiative: null });
    else if (w.status === 'DRAFT' && w.pending === 0 && input.me.canFinalize) push({ key: `finalize:${w.week}`, kind: 'review', action: `Finalize the ${shortWeek(w.week)} review.`, why: 'Every section is reviewed. Finalizing freezes the week’s record and makes it the next baseline.', href: `/weekly-review?week=${w.week}`, go: 'Open review', initiative: null });
    else if (w.status === 'NONE' && w.started && rows.length > 0) push({ key: `prepare:${w.week}`, kind: 'review', action: `Prepare the ${shortWeek(w.week)} weekly review.`, why: 'The week has started and no review is prepared, so changes since the last Final are not yet on record.', href: `/weekly-review?week=${w.week}`, go: 'Prepare review', initiative: null });
    else if (w.status === 'FINAL' && w.next?.started && !w.next.exists) push({ key: `prepare:${w.next.week}`, kind: 'review', action: `Prepare the ${shortWeek(w.next.week)} weekly review.`, why: `${shortWeek(w.week)} is Final and ${shortWeek(w.next.week)} has started.`, href: `/weekly-review?week=${w.next.week}`, go: 'Prepare review', initiative: null });
  }

  // 8. A Target Live within 14 days with no next step recorded.
  for (const r of rows) {
    const d = r.target?.value.date ? dayDifference(input.today, r.target.value.date) : null;
    if (d === null || d < 0 || d > 14 || r.nextStep?.value.text) continue;
    push({ key: `nextstep:${r.initiative.id}`, kind: 'schedule', action: `Record the next step for ${r.initiative.name}.`, why: `Target Live is ${d === 0 ? 'today' : `in ${d} ${d === 1 ? 'day' : 'days'}`} (${displayDate(r.target!.value.date!)}) and no next step is recorded.`, href: `/initiatives/${r.initiative.slug}/delivery`, go: 'Record next step', initiative: initiative(r) });
  }

  // 9. Setup gaps that block planning: an owner, then a Target Live.
  for (const r of rows) {
    const next = r.setup.next; if (!next) continue;
    if (next.key === 'owner') push({ key: `owner:${r.initiative.id}`, kind: 'setup', action: `Assign an owner to ${r.initiative.name}.`, why: 'No active owner is recorded, so nothing on it can be routed to a person.', href: next.href, go: 'Assign owner', initiative: initiative(r) });
    else if (next.key === 'target' || (!r.target?.value.date && !r.target?.value.unknown && r.setup.requirements.some(x => x.key === 'target' && !x.met))) push({ key: `target:${r.initiative.id}`, kind: 'setup', action: `Set a Target Live for ${r.initiative.name}.`, why: 'No Target Live is recorded, so it cannot be placed on the Roadmap or compared in a review.', href: `/initiatives/${r.initiative.slug}/setup?step=delivery`, go: 'Record Target Live', initiative: initiative(r) });
  }

  // 10. Live with nothing measured.
  for (const m of input.metrics ?? []) {
    const r = byId.get(m.initiativeId); if (!r || m.configured > 0 || !r.actual?.value.date) continue;
    push({ key: `metric:${r.initiative.id}`, kind: 'metric', action: `Define a first metric for ${r.initiative.name}.`, why: `It went live on ${displayDate(r.actual.value.date)} and has no metric definition, so Analysis cannot measure it.`, href: `/analysis/projects/${r.initiative.slug}`, go: 'Open Analysis', initiative: initiative(r) });
  }

  // One recommendation per initiative first, so a busy initiative does not crowd out the rest.
  const perInitiative = new Set<string>();
  const first = out.filter(r => { const k = r.initiative?.slug ?? `:${r.kind}`; if (perInitiative.has(k)) return false; perInitiative.add(k); return true; });
  return [...first, ...out.filter(r => !first.includes(r))].slice(0, limit);
}

/** Setup and coverage gaps for a sparse workspace, as a short prioritized queue with direct links. */
export interface SetupQueueItem { key: string; label: string; detail: string; href: string }
export function setupQueue(rows: PortfolioRow[], review: RecommendInput['review'], writer: boolean, limit = 5): SetupQueueItem[] {
  const active = rows.filter(r => !r.initiative.archivedAt);
  const items: SetupQueueItem[] = [];
  const missing = (key: string) => active.filter(r => r.setup.requirements.some(x => x.key === key && !x.met));
  const owners = missing('owner'); if (owners.length) items.push({ key: 'owner', label: `Assign owners to ${owners.length} ${owners.length === 1 ? 'initiative' : 'initiatives'}`, detail: owners.slice(0, 3).map(r => r.initiative.name).join(', ') + (owners.length > 3 ? '…' : ''), href: owners.length === 1 ? owners[0]!.setup.requirements.find(x => x.key === 'owner')!.href : '/initiatives?setup=incomplete' });
  const targets = missing('target'); if (targets.length) items.push({ key: 'target', label: `Record Target Live for ${targets.length} ${targets.length === 1 ? 'initiative' : 'initiatives'}`, detail: 'Unplaced on the Roadmap until a planned date or an explicit “unknown” is recorded.', href: targets.length === 1 ? `/initiatives/${targets[0]!.initiative.slug}/setup?step=delivery` : '/roadmap?view=unknown' });
  const sources = missing('source'); if (sources.length) items.push({ key: 'source', label: `Link a source to ${sources.length} ${sources.length === 1 ? 'initiative' : 'initiatives'}`, detail: 'Evidence comes only from linked sources; nothing is inferred.', href: sources.length === 1 ? `/initiatives/${sources[0]!.initiative.slug}/setup?step=sources` : '/initiatives?setup=incomplete' });
  const confirmed = missing('confirmed'); if (confirmed.length) items.push({ key: 'confirmed', label: `Confirm a first Knowledge entry on ${confirmed.length} ${confirmed.length === 1 ? 'initiative' : 'initiatives'}`, detail: 'A person-confirmed entry is what makes a record reviewable.', href: confirmed.length === 1 ? `/initiatives/${confirmed[0]!.initiative.slug}/knowledge` : '/initiatives?setup=incomplete' });
  if (writer && review.status === 'NONE' && review.started && active.length) items.push({ key: 'review', label: `Prepare the ${shortWeek(review.week)} weekly review`, detail: 'Freezes a first baseline so later weeks can show what changed.', href: `/weekly-review?week=${review.week}` });
  return items.slice(0, limit);
}

