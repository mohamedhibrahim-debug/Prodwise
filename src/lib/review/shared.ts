import { DOMAINS } from "../domain/types.ts";
import { fingerprint } from "./fingerprint.ts";
import type {
  ClaimWithEvidence,
  Domain,
  FindingClaimRef,
  FindingEvidenceRef,
} from "../domain/types.ts";

/** Ordering used everywhere a set of claims is rendered or hashed. */
export function byClaimId(a: ClaimWithEvidence, b: ClaimWithEvidence): number {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * Evidence is sorted by id rather than taken in adapter order.
 *
 * The Supabase adapter reads `claim_evidence` unordered while the local adapter
 * sorts by captured date, so adapter order would leak into the finding — and
 * into the explanation text, which names evidence references. Sorting here
 * makes provenance identical whichever repository is serving.
 */
export function toEvidenceRefs(claim: ClaimWithEvidence): FindingEvidenceRef[] {
  return [...claim.evidence]
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .map((e) => ({
      evidenceId: e.id,
      title: e.title,
      sourceType: e.sourceType,
      sourceReference: e.sourceReference ?? null,
      boundary: e.boundary,
    }));
}

export function toClaimRef(claim: ClaimWithEvidence): FindingClaimRef {
  return {
    claimId: claim.id,
    subject: claim.subject,
    attribute: claim.attribute,
    value: claim.value,
    type: claim.type,
    status: claim.status,
    domain: claim.domain,
    phase: claim.phase,
    evidence: toEvidenceRefs(claim),
  };
}

/**
 * Every domain present, deduplicated, in canonical declaration order.
 *
 * The order carries no meaning and no domain is "primary": picking one would
 * invent product truth the claims do not support. `claims.domain` is TEXT in
 * Postgres rather than an enum, so an unrecognised value is appended rather
 * than silently dropped — losing it would understate what the finding spans.
 */
export function orderedDomains(claims: readonly ClaimWithEvidence[]): Domain[] {
  const present = new Set(claims.map((c) => c.domain));
  const known = DOMAINS.filter((d) => present.has(d));
  const unknown = [...present]
    .filter((d) => !(DOMAINS as readonly string[]).includes(d))
    .sort();
  return [...known, ...unknown] as Domain[];
}

/**
 * The most recent `updatedAt` across the source claims — never the clock, so
 * repeated runs over unchanged data produce identical output.
 *
 * Returns the stored string as-is rather than re-serialising it: a hand-edited
 * local store can hold an unparseable timestamp, and `new Date(NaN)
 * .toISOString()` throws, which would turn a data defect into a 500.
 */
export function latestTimestamp(values: readonly string[]): string {
  let best: string | null = null;
  let bestMs = Number.NEGATIVE_INFINITY;

  for (const value of values) {
    const ms = Date.parse(value);
    if (Number.isNaN(ms)) continue;
    if (ms > bestMs) {
      bestMs = ms;
      best = value;
    }
  }
  if (best !== null) return best;

  // Nothing parsed. Fall back to a stable choice instead of throwing.
  const sorted = [...values].sort();
  return sorted[sorted.length - 1] ?? "";
}

/**
 * Hashes everything a finding actually presents.
 *
 * Deliberately membership-sensitive, unlike the fingerprint: the claim ids are
 * included, so a claim joining or leaving the group changes it even when the
 * set of distinct values does not. Evidence ids and boundaries are included
 * too, because provenance changes never touch `claims.updated_at` and would
 * otherwise be invisible to every other signal.
 */
export function contentDigestOf(
  fingerprintValue: string,
  claims: readonly ClaimWithEvidence[],
): string {
  const parts: (string | null)[] = [fingerprintValue];

  for (const claim of [...claims].sort(byClaimId)) {
    parts.push(claim.id, claim.value, claim.status, claim.phase);
    for (const e of toEvidenceRefs(claim)) {
      parts.push(e.evidenceId, e.boundary, e.sourceReference);
    }
    // Closes the per-claim run so evidence cannot drift between claims.
    parts.push(null);
  }

  return fingerprint(parts);
}

const COUNT_WORD: Record<number, string> = {
  2: "Two",
  3: "Three",
  4: "Four",
  5: "Five",
  6: "Six",
};

export function countWord(n: number): string {
  return COUNT_WORD[n] ?? String(n);
}
