import "server-only";

import type { EvidenceRecord, Initiative } from "@/lib/domain/types";
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
