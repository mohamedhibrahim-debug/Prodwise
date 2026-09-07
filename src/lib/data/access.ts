import "server-only";

import type {
  ClaimWithEvidence,
  EvidenceRecord,
  Initiative,
} from "@/lib/domain/types";
import { getRepository } from "./index";

/**
 * Initiative-boundary integrity for evidence mutations.
 *
 * Every evidence mutation is reached with an `evidenceId` and an initiative
 * `slug` that both originate from client-controlled input. A page-level guard
 * cannot protect a server action: the action is its own entry point and can be
 * invoked directly, without the page that rendered it ever being loaded.
 *
 * So ownership is proven at the mutation boundary itself — resolve both records
 * server-side and require that the evidence actually belongs to that initiative
 * before anything is written.
 *
 * This is data integrity, not authorisation. There is still no authentication
 * in this phase; the check stops evidence on one initiative being altered
 * through another initiative's route, which would silently corrupt the very
 * boundary the product exists to get right.
 */

/** Deliberately generic: the same message whether the record is missing or
 *  simply belongs elsewhere, so a caller cannot probe for ids that exist on
 *  other initiatives. */
export const EVIDENCE_ACCESS_MESSAGE =
  "That evidence could not be found on this initiative.";

export class EvidenceAccessError extends Error {
  readonly code = "EVIDENCE_ACCESS_DENIED";

  constructor(message: string = EVIDENCE_ACCESS_MESSAGE) {
    super(message);
    this.name = "EvidenceAccessError";
  }
}

export interface OwnedEvidence {
  initiative: Initiative;
  evidence: EvidenceRecord;
}

/**
 * Resolves an initiative by slug and an evidence record by id, and proves the
 * evidence belongs to that initiative. Throws EvidenceAccessError otherwise.
 *
 * Call this before any evidence mutation. Nothing is written and no activity is
 * logged when it throws, because it runs ahead of the repository call.
 */
export async function resolveOwnedEvidence(
  slug: string,
  evidenceId: string,
): Promise<OwnedEvidence> {
  if (!slug || !evidenceId) throw new EvidenceAccessError();

  const repo = getRepository();
  const [initiative, evidence] = await Promise.all([
    repo.getInitiativeBySlug(slug),
    repo.getEvidence(evidenceId),
  ]);

  if (!initiative || !evidence || evidence.initiativeId !== initiative.id) {
    throw new EvidenceAccessError();
  }

  return { initiative, evidence };
}

/* ── Product Memory ───────────────────────────────────────────────────────── */

export const CLAIM_ACCESS_MESSAGE =
  "That claim could not be found on this initiative.";

export class ClaimAccessError extends Error {
  readonly code = "CLAIM_ACCESS_DENIED";

  constructor(message: string = CLAIM_ACCESS_MESSAGE) {
    super(message);
    this.name = "ClaimAccessError";
  }
}

export interface OwnedClaim {
  initiative: Initiative;
  claim: ClaimWithEvidence;
}

/**
 * Resolves an initiative by slug and a claim by id, and proves the claim
 * belongs to that initiative. Same reasoning as resolveOwnedEvidence: the
 * server action is its own entry point, so ownership is established here rather
 * than trusted from whichever page rendered the control.
 */
export async function resolveOwnedClaim(
  slug: string,
  claimId: string,
): Promise<OwnedClaim> {
  if (!slug || !claimId) throw new ClaimAccessError();

  const repo = getRepository();
  const [initiative, claim] = await Promise.all([
    repo.getInitiativeBySlug(slug),
    repo.getClaim(claimId),
  ]);

  if (!initiative || !claim || claim.initiativeId !== initiative.id) {
    throw new ClaimAccessError();
  }

  return { initiative, claim };
}

/**
 * Validates a requested evidence-link set for a claim and returns the ids to
 * persist.
 *
 * Three rules, all enforced server-side:
 *
 *  - every id must belong to the same initiative — no cross-initiative links;
 *  - a NEWLY added link may not target EXCLUDED evidence, which sits outside
 *    the trusted initiative boundary;
 *  - an EXISTING link is kept whatever the evidence's boundary is now. Evidence
 *    that was legitimately linked and later excluded stays linked, because
 *    silently dropping provenance would rewrite history. Removing it is allowed
 *    only as a deliberate human unlink, which is why removals are permitted
 *    here without restriction.
 */
export async function resolveClaimEvidenceLinks(
  initiativeId: string,
  currentlyLinkedIds: string[],
  requestedIds: string[],
): Promise<string[]> {
  const requested = [...new Set(requestedIds.filter(Boolean))];
  if (requested.length === 0) return [];

  const available = await getRepository().listEvidence(initiativeId);
  const byId = new Map(available.map((e) => [e.id, e]));
  const existing = new Set(currentlyLinkedIds);

  for (const id of requested) {
    const record = byId.get(id);
    // Not on this initiative (or does not exist at all).
    if (!record) throw new EvidenceAccessError();

    const isNewLink = !existing.has(id);
    if (isNewLink && record.boundary === "EXCLUDED") {
      throw new EvidenceAccessError(
        "Excluded evidence cannot be linked as supporting evidence.",
      );
    }
  }

  return requested;
}

/** Evidence a user may pick as a NEW link: same initiative, not excluded. */
export function isLinkableEvidence(evidence: EvidenceRecord): boolean {
  return evidence.boundary !== "EXCLUDED";
}
