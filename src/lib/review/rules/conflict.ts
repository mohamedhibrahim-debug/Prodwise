import type { ClaimWithEvidence, ReviewFinding } from "../../domain/types.ts";
import { contextKey, isBlank, normalise } from "../normalise.ts";
import { fingerprint, sortStable } from "../fingerprint.ts";
import {
  byClaimId,
  contentDigestOf,
  countWord,
  latestTimestamp,
  orderedDomains,
  toClaimRef,
  toEvidenceRefs,
} from "../shared.ts";

const RULE_ID = "CONFLICT_SAME_ATTRIBUTE_V1" as const;

export const CONFLICT_REASON =
  "Raised because two or more active claims share the same subject and " +
  "attribute, either record the same phase or record none at all, hold " +
  "different values, and are not linked by supersession. " +
  `Rule ${RULE_ID}.`;

/**
 * CONFLICT_SAME_ATTRIBUTE_V1 — deliberately conservative.
 *
 * A conflict is only raised where the structured data PROVES the claims are
 * comparable. Every gate below must hold:
 *
 *   1. same initiative           (guaranteed: input is one initiative's claims)
 *   2. same normalised subject
 *   3. same normalised attribute
 *   4. same context              (see the phase table below)
 *   5. every claim ACTIVE        (UNVERIFIED means unchecked, not false)
 *   6. two or more distinct normalised values
 *   7. no supersession link between any pair in the group
 *
 * Context, and the deliberate asymmetry in it:
 *
 *   "Phase 1" vs "Phase 1"  -> comparable
 *   "Phase 1" vs "Phase 2"  -> NOT comparable, different phases
 *   null      vs null       -> comparable, neither asserts a phase
 *   "Phase 1" vs null       -> NOT comparable
 *
 * The last row suppresses some genuine conflicts. That is the correct direction
 * of error: Prodwise cannot prove the two claims describe the same context, and
 * a false conflict costs more trust than a missed one is worth.
 *
 * DOMAIN IS NOT A GATE, and must not become one. Domain records who owns a
 * piece of knowledge, not the situation its value applies to — and a Finance
 * claim disagreeing with a Technical one is the most valuable conflict there
 * is, not one to suppress.
 */
export function detectConflicts(
  initiativeId: string,
  claims: readonly ClaimWithEvidence[],
): ReviewFinding[] {
  // Gate 5, plus the blank guard: a claim missing subject, attribute or value
  // cannot support a finding, and would render as an empty comparison.
  const eligible = claims.filter(
    (c) =>
      c.status === "ACTIVE" &&
      !isBlank(c.subject) &&
      !isBlank(c.attribute) &&
      !isBlank(c.value),
  );

  // Gates 2-4: group by subject, attribute and context.
  const groups = new Map<string, ClaimWithEvidence[]>();
  for (const claim of eligible) {
    const context = contextKey(claim.phase);
    const key = fingerprint([
      normalise(claim.subject),
      normalise(claim.attribute),
      context,
    ]);
    const bucket = groups.get(key);
    if (bucket) bucket.push(claim);
    else groups.set(key, [claim]);
  }

  const findings: ReviewFinding[] = [];

  for (const bucket of groups.values()) {
    if (bucket.length < 2) continue;

    const members = [...bucket].sort(byClaimId);
    const ids = new Set(members.map((c) => c.id));

    // Gate 7. Redundant with gate 5 while the database invariant holds
    // (a replacement is only permitted while status is SUPERSEDED), and kept
    // anyway: this is the gate that encodes the intent, and it must survive if
    // that invariant is ever relaxed. A linked pair is supersession, which is
    // history, not a contradiction.
    const linked = members.some(
      (c) => c.supersededByClaimId !== null && ids.has(c.supersededByClaimId),
    );
    if (linked) continue;

    // Gate 6.
    const distinct = sortStable([
      ...new Set(members.map((c) => normalise(c.value))),
    ]);
    if (distinct.length < 2) continue;

    const context = contextKey(members[0]!.phase);
    const display = members[0]!;

    const fp = fingerprint([
      RULE_ID,
      initiativeId,
      normalise(display.subject),
      normalise(display.attribute),
      context,
      ...distinct,
    ]);

    findings.push({
      fingerprint: fp,
      contentDigest: contentDigestOf(fp, members),
      initiativeId,
      type: "CONFLICT",
      ruleId: RULE_ID,
      status: "OPEN",
      actionable: true,
      title: `${display.subject} — ${display.attribute}`,
      explanation: explain(members),
      reason: CONFLICT_REASON,
      subject: display.subject,
      domains: orderedDomains(members),
      phase: display.phase,
      claims: members.map(toClaimRef),
      detectedOn: latestTimestamp(members.map((c) => c.updatedAt)),
      resolution: null,
      resolvedAt: null,
      confirmerLabel: null,
      confidence: null,
      severity: null,
    });
  }

  return findings;
}

/**
 * Factual, and carefully not accusatory.
 *
 * Prodwise compares recorded strings. It has not established that the values
 * contradict each other — one may simply elaborate another — so the copy states
 * what was compared and hands the judgement back to the reader. "Contradicts",
 * "incorrect" and "the correct value" are all off limits here.
 */
function explain(members: readonly ClaimWithEvidence[]): string {
  const listed = members
    .map((c) => {
      const ref = leadingReference(c);
      return ref ? `${c.value} (${ref})` : c.value;
    })
    .join(", ");

  // Phrased against the claims, not against a distinct-value count: with three
  // claims holding two values, "three claims record different values" would be
  // wrong about its own list.
  return (
    `These ${countWord(members.length).toLowerCase()} active claims do not ` +
    `record the same value for this attribute: ${listed}. Prodwise compares ` +
    `recorded values only. It has not determined which value is correct, ` +
    `whether either is correct, or whether the difference is a genuine ` +
    `contradiction — that judgement is yours.`
  );
}

/**
 * The reference to cite for a claim's value.
 *
 * Sorted refs, never the raw array: adapter ordering must not reach the
 * explanation text, or identical data renders differently per repository.
 *
 * EXCLUDED evidence is skipped. A link made before the evidence left the
 * boundary is deliberately kept (Phase 3), but citing it here as the source
 * behind a value would present evidence a person removed from scope as if it
 * still backed the claim. It stays visible in the list below, tagged.
 */
export function leadingReference(claim: ClaimWithEvidence): string | null {
  return (
    toEvidenceRefs(claim)
      .filter((e) => e.boundary !== "EXCLUDED")
      .map((e) => e.sourceReference)
      .find((r): r is string => Boolean(r)) ?? null
  );
}
