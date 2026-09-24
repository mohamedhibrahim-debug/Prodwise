import type {
  AssignConfirmerInput, ResolveConflictInput, ResolveConflictResult,
} from "../domain/types.ts";
import type { Repository } from "../data/repository.ts";
import { runReview } from "../review/engine.ts";
import { planResolution } from "./plan.ts";
import { isStandingDecision } from "./standing.ts";

export async function decideConflict(
  repo: Repository,
  input: ResolveConflictInput,
): Promise<ResolveConflictResult> {
  const [claims, states] = await Promise.all([
    repo.listClaims(input.initiativeId), repo.listFindingStates(input.initiativeId),
  ]);
  const finding = runReview(input.initiativeId, claims).find(
    (candidate) => candidate.fingerprint === input.fingerprint && candidate.type === "CONFLICT",
  );
  const state = states.find((candidate) => candidate.fingerprint === input.fingerprint);
  if (isStandingDecision(finding ?? null, state ?? null)) throw new Error("DECISION_STANDING");
  if (!finding) throw new Error("FINDING_STALE");
  const plan = planResolution(
    finding, input, new Map(claims.map((claim) => [claim.id, claim.updatedAt])),
  );
  return repo.resolveConflict(plan);
}

export async function assignConfirmer(
  repo: Repository,
  input: AssignConfirmerInput,
): Promise<void> {
  if (!input.actor.label.trim()) throw new Error("ACTOR_REQUIRED");
  if (input.label !== null && (input.label.trim().length < 1 || input.label.trim().length > 120))
    throw new Error("INVALID_CONFIRMER");
  const [claims, states] = await Promise.all([
    repo.listClaims(input.initiativeId), repo.listFindingStates(input.initiativeId),
  ]);
  const finding = runReview(input.initiativeId, claims).find(
    (candidate) => candidate.fingerprint === input.fingerprint && candidate.type === "CONFLICT",
  );
  const state = states.find((candidate) => candidate.fingerprint === input.fingerprint);
  if (isStandingDecision(finding ?? null, state ?? null)) throw new Error("DECISION_STANDING");
  if (!finding) throw new Error("FINDING_STALE");
  await repo.assignFindingConfirmer({ ...input, label: input.label?.trim() ?? null,
    cycle: state?.outcome ? "REEMERGED" : "FIRST",
    subject: finding.subject, attribute: finding.claims[0]!.attribute,
    phase: finding.phase, contentDigest: finding.contentDigest });
}
