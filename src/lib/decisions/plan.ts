import type {
  ResolveConflictInput, ResolveConflictPlan, ReviewFinding,
} from "../domain/types.ts";
import { normalise } from "../review/normalise.ts";

export function planResolution(
  finding: ReviewFinding,
  input: ResolveConflictInput,
  updatedAtById: ReadonlyMap<string, string>,
): ResolveConflictPlan {
  if (finding.type !== "CONFLICT" || finding.ruleId !== "CONFLICT_SAME_ATTRIBUTE_V1"
      || !finding.actionable || finding.initiativeId !== input.initiativeId
      || finding.fingerprint !== input.fingerprint) throw new Error("FINDING_STALE");
  if (finding.contentDigest !== input.contentDigest) throw new Error("FINDING_STALE");
  if (!input.actor.label.trim()) throw new Error("ACTOR_REQUIRED");
  if (!input.rationale.trim()) throw new Error("RATIONALE_REQUIRED");

  const values = new Set(finding.claims.map((claim) => normalise(claim.value)));
  if (input.outcome === "CHOSE_EXISTING") {
    if (!input.chosenClaimId || input.correctedValue !== null || input.decisionDomain !== null)
      throw new Error("INVALID_DECISION_SHAPE");
    if (!finding.claims.some((claim) => claim.claimId === input.chosenClaimId))
      throw new Error("CHOSEN_CLAIM_NOT_MEMBER");
  } else if (input.outcome === "CORRECTED_VALUE") {
    if (input.chosenClaimId !== null || !input.correctedValue?.trim())
      throw new Error("INVALID_DECISION_SHAPE");
    if (values.has(normalise(input.correctedValue))) throw new Error("CHOOSE_EXISTING_VALUE");
    const domains = new Set(finding.claims.map((claim) => claim.domain));
    if ((domains.size === 1 && input.decisionDomain !== null && !domains.has(input.decisionDomain))
      || (domains.size > 1 && !input.decisionDomain)
      || (input.decisionDomain !== null && !domains.has(input.decisionDomain)))
      throw new Error("DECISION_DOMAIN_REQUIRED");
  } else throw new Error("INVALID_DECISION_SHAPE");

  const chosen = finding.claims.find((claim) => claim.claimId === input.chosenClaimId);
  return {
    ...input,
    rationale: input.rationale.trim(),
    correctedValue: input.correctedValue?.trim() ?? null,
    ruleId: "CONFLICT_SAME_ATTRIBUTE_V1",
    subject: finding.claims[0]!.subject,
    attribute: finding.claims[0]!.attribute,
    phase: finding.phase,
    valuesRecorded: finding.claims.map((claim) => claim.value).join(" | "),
    members: finding.claims.map((claim) => {
      const stamp = updatedAtById.get(claim.claimId);
      if (!stamp) throw new Error("CLAIM_STALE");
      return {
        id: claim.claimId,
        expectedUpdatedAt: stamp,
        keep: Boolean(chosen && normalise(claim.value) === normalise(chosen.value)),
      };
    }),
  };
}
