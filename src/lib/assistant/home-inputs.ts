import type { WeeklyReview } from '../delivery/types.ts';
import type { Proposal, Submission } from '../evidence/types.ts';
import { isoWeek, nextReviewWeek } from '../delivery/model.ts';
import type { RecommendInput } from './recommend.ts';

/**
 * Pure reductions that turn stored records into the inputs `recommend()` and
 * the Home setup queue take. Kept out of the page so the wiring is testable
 * and Home, the Brief and Ask Prodwise cannot describe the same review or
 * proposal differently.
 */

/** The weekly-review state for one workspace and week. `now` is the real clock, `asOf` the page's frame (the scenario day in the Demo). */
export function reviewStateFor(input: { reviews: WeeklyReview[]; workspaceId: string; week: string; now: string }): RecommendInput['review'] {
  const review = input.reviews.find(r => r.workspaceId === input.workspaceId && r.week === input.week);
  const current = isoWeek(input.now);
  const pending = review ? review.sections.filter(s => s.needsRecheck || !(s.editedByMemberId || s.editedByUserId)).length : 0;
  const next = review?.status === 'FINAL' ? nextReviewWeek(review.week) : null;
  return {
    week: input.week,
    status: review?.status ?? 'NONE',
    pending, total: review?.sections.length ?? 0,
    started: input.week <= current,
    next: next ? { week: next.week, started: next.week <= current, exists: input.reviews.some(r => r.workspaceId === input.workspaceId && r.week === next.week) } : null,
  };
}

/** Pending proposals on one initiative, with the source that contributes most of them (never a scored ranking, just where most of the waiting work is). */
export function proposalSummary(initiativeId: string, evidence: { proposals: Pick<Proposal, 'initiativeId' | 'status' | 'submissionId'>[]; submissions: Pick<Submission, 'id' | 'title'>[] }): NonNullable<RecommendInput['proposals']>[number] {
  const pending = evidence.proposals.filter(p => p.initiativeId === initiativeId && p.status === 'PENDING');
  const bySource = new Map<string, number>();
  for (const p of pending) bySource.set(p.submissionId, (bySource.get(p.submissionId) ?? 0) + 1);
  const top = [...bySource.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
  return { initiativeId, pending: pending.length, sourceTitle: top ? evidence.submissions.find(s => s.id === top[0])?.title ?? null : null };
}

/** How many metric definitions each initiative has, for the "live with nothing measured" recommendation. */
export function metricSummary(metrics: { initiativeId: string }[], initiativeIds: string[]): NonNullable<RecommendInput['metrics']> {
  return initiativeIds.map(id => ({ initiativeId: id, configured: metrics.filter(m => m.initiativeId === id).length }));
}
