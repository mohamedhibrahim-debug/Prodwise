import "server-only";
import {readQueue} from "@/lib/review/dispositions-service";
import {projectQueue} from "@/lib/review/dispositions";

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
  queue: ReturnType<typeof projectQueue>;
}> {
  const repo = getRepository();
  const asOf=new Date().toISOString();
  const [claims, states,queueData] = await Promise.all([
    repo.listClaims(initiativeId),
    repo.listFindingStates(initiativeId),
    readQueue(initiativeId,asOf),
  ]);

  const findings=applyFindingStates(runReview(initiativeId,claims),states);
  return {
    claims,
    states,
    findings,
    queue:projectQueue(findings,queueData.dispositions,queueData.finalizations,asOf,states),
  };
}
