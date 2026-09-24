import "server-only";

import { getRepository } from "@/lib/data";
import { runReview } from "@/lib/review/engine";
import { applyFindingStates } from "@/lib/review/merge";
import type { ClaimWithEvidence, ReviewFinding, FindingState } from "@/lib/domain/types";

/**
 * Claims plus the findings derived from them, with human decisions applied.
 *
 * The single derive-and-merge path shared by Status and Decisions, so the two
 * screens can never disagree about what is open. It adds nothing to the query
 * cost of either: claims (with provenance) and finding states, in parallel —
 * exactly what Review always issued.
 */
export async function loadDecisions(initiativeId: string): Promise<{
  claims: ClaimWithEvidence[];
  findings: ReviewFinding[];
  states: FindingState[];
}> {
  const repo = getRepository();
  const [claims, states] = await Promise.all([
    repo.listClaims(initiativeId),
    repo.listFindingStates(initiativeId),
  ]);

  return {
    claims,
    states,
    findings: applyFindingStates(runReview(initiativeId, claims), states),
  };
}
