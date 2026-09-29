import type { FindingState } from '../domain/types.ts';

/** The latest recorded decision on one initiative: a resolved finding state that carries a decision outcome. */
export function latestDecisionAt(states: readonly Pick<FindingState, 'status' | 'outcome' | 'resolvedAt'>[]): string | null {
  let latest: string | null = null;
  for (const s of states) {
    if (s.status !== 'RESOLVED' || !s.outcome || !s.resolvedAt || Number.isNaN(Date.parse(s.resolvedAt))) continue;
    if (!latest || Date.parse(s.resolvedAt) > Date.parse(latest)) latest = s.resolvedAt;
  }
  return latest;
}

/**
 * A recorded delivery fact (Next step, Blocker) written before the initiative's
 * latest decision. The fact is a person's statement and is never changed or
 * hidden here; this only lets the page ask whether it still holds.
 * Returns the decision time to cite, or null when no prompt is due.
 */
export function recordedBeforeDecision(fact: { updatedAt: string } | null | undefined, decisionAt: string | null): string | null {
  if (!fact || !decisionAt) return null;
  const recorded = Date.parse(fact.updatedAt), decided = Date.parse(decisionAt);
  if (Number.isNaN(recorded) || Number.isNaN(decided)) return null;
  return decided > recorded ? decisionAt : null;
}
