import type { ClaimWithEvidence, ReviewFinding } from "../../domain/types.ts";
import { normalise } from "../normalise.ts";
import { fingerprint } from "../fingerprint.ts";
import {
  contentDigestOf,
  latestTimestamp,
  orderedDomains,
  toClaimRef,
} from "../shared.ts";

const RULE_ID = "SUPERSEDED_CLAIM_V1" as const;

export const SUPERSEDED_REASON =
  "Raised because a claim's status is SUPERSEDED. " +
  `Rule ${RULE_ID}. This is a record of history, not an open issue, so it does ` +
  "not appear under Open.";

/**
 * SUPERSEDED_CLAIM_V1 — read directly out of recorded state.
 *
 * The whole rule is `status === "SUPERSEDED"`. Supersession is NEVER inferred
 * from chronology: that two claims exist and one is older is not evidence that
 * one replaced the other, and guessing it would manufacture product truth.
 *
 * A replacement is reported only when one is recorded, and its absence is
 * stated plainly rather than filled in. Prodwise never invents a successor.
 *
 * These findings are history, so `actionable` is false and they never enter the
 * Open queue — but they stay fully visible under All, keep their evidence, and
 * are never auto-resolved or reclassified as conflicts.
 */
export function detectSuperseded(
  initiativeId: string,
  claims: readonly ClaimWithEvidence[],
): ReviewFinding[] {
  const byId = new Map(claims.map((c) => [c.id, c]));

  return claims
    .filter((c) => c.status === "SUPERSEDED")
    .map((claim) => {
      const pointer = claim.supersededByClaimId;
      const replacement = pointer ? byId.get(pointer) : undefined;
      const members = replacement ? [claim, replacement] : [claim];

      // Hashes CONTENT, not just ids. Identity by id alone would let a claim
      // be rewritten end to end while quietly keeping an earlier resolution
      // attached to it — the same trap the conflict fingerprint avoids.
      const fp = fingerprint([
        RULE_ID,
        initiativeId,
        claim.id,
        normalise(claim.subject),
        normalise(claim.attribute),
        normalise(claim.value),
        pointer,
        replacement ? normalise(replacement.value) : null,
      ]);

      return {
        fingerprint: fp,
        contentDigest: contentDigestOf(fp, members),
        initiativeId,
        type: "SUPERSEDED" as const,
        ruleId: RULE_ID,
        status: "OPEN" as const,
        actionable: false,
        title: `${claim.subject} — ${claim.attribute}`,
        explanation: explain(claim, pointer, replacement),
        reason: SUPERSEDED_REASON,
        subject: claim.subject,
        domains: orderedDomains(members),
        phase: claim.phase,
        claims: members.map(toClaimRef),
        detectedOn: latestTimestamp(members.map((c) => c.updatedAt)),
        resolution: null,
        resolvedAt: null,
        confidence: null,
        severity: null,
      };
    });
}

/**
 * Three cases, not two.
 *
 * `superseded_by_claim_id` has no same-initiative constraint in the database —
 * only the claim-edit action enforces it, and the seed and direct SQL bypass
 * that. So a pointer can pass through here unresolvable. Reporting it as "no
 * replacement recorded" would be false: one IS recorded, it just is not visible
 * from this initiative.
 */
function explain(
  claim: ClaimWithEvidence,
  pointer: string | null,
  replacement: ClaimWithEvidence | undefined,
): string {
  if (replacement) {
    return (
      `This claim was marked superseded and a replacement is recorded: ` +
      `${replacement.subject} — ${replacement.attribute}: "${replacement.value}". ` +
      `The earlier value is kept as history rather than deleted. Prodwise did ` +
      `not decide the supersession — a person recorded it.`
    );
  }
  if (pointer) {
    return (
      `This claim was marked superseded and a replacement is recorded, but that ` +
      `claim is not on this initiative, so it cannot be shown here. Prodwise ` +
      `does not follow the reference outside the initiative boundary.`
    );
  }
  return (
    `This claim was marked superseded. No replacement has been recorded. ` +
    `Prodwise does not infer a successor from dates or ordering, so nothing ` +
    `here identifies what replaced it.`
  );
}
