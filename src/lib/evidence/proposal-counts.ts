import type { Proposal } from './types.ts';

/**
 * One set of proposal numbers for every place that talks about them (the
 * saved-evidence list, the proposal review summary line, the "Needs your
 * decision" heading and the read-again hint), so they can never disagree.
 *
 * - needsDecision: pending and not already recorded, plus outdated proposals
 *   (an outdated proposal still waits for a person to re-propose or reject it).
 * - alreadyRecorded: pending, but matching something already recorded; not
 *   counted as waiting.
 */
export interface ProposalCounts { total: number; accepted: number; rejected: number; needsDecision: number; outdated: number; alreadyRecorded: number }

export function proposalCounts(proposals: Pick<Proposal, 'id' | 'status'>[], recorded: Record<string, unknown>): ProposalCounts {
  const counts: ProposalCounts = { total: proposals.length, accepted: 0, rejected: 0, needsDecision: 0, outdated: 0, alreadyRecorded: 0 };
  for (const p of proposals) {
    if (p.status === 'CONFIRMED' || p.status === 'SUPERSEDED_BY_HUMAN_ENTRY') counts.accepted++;
    else if (p.status === 'REJECTED') counts.rejected++;
    else if (p.status === 'OUTDATED') { counts.outdated++; counts.needsDecision++; }
    else if (p.status === 'PENDING') { if (recorded[p.id]) counts.alreadyRecorded++; else counts.needsDecision++; }
  }
  return counts;
}

/** The one wording: "1 needs your decision" / "3 need your decision". */
export function needsDecisionText(n: number): string {
  return n === 0 ? 'Nothing needs your decision' : `${n} ${n === 1 ? 'needs' : 'need'} your decision`;
}
