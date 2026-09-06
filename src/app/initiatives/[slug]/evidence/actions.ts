"use server";

import { revalidatePath } from "next/cache";

import { getRepository } from "@/lib/data";
import { WriteDisabledError } from "@/lib/env";
import {
  EVIDENCE_RELATIONS,
  type EvidenceRelation,
} from "@/lib/domain/types";

export interface EvidenceActionResult {
  error: string | null;
}

function isBoundary(value: unknown): value is EvidenceRelation {
  return (
    typeof value === "string" &&
    (EVIDENCE_RELATIONS as readonly string[]).includes(value)
  );
}

function toMessage(error: unknown): string {
  if (error instanceof WriteDisabledError) return error.message;
  return error instanceof Error ? error.message : "Could not update evidence.";
}

/**
 * Reclassify one evidence item.
 *
 * The target boundary is always explicit — there is no inferred destination.
 * The repository records the change in the activity log.
 */
export async function reclassifyEvidenceAction(
  evidenceId: string,
  slug: string,
  boundary: string,
): Promise<EvidenceActionResult> {
  if (!isBoundary(boundary)) {
    return { error: "That is not a valid boundary classification." };
  }

  try {
    await getRepository().updateEvidence(evidenceId, { boundary });
  } catch (error) {
    return { error: toMessage(error) };
  }

  revalidatePath(`/initiatives/${slug}/evidence`);
  revalidatePath(`/initiatives/${slug}`);
  return { error: null };
}

/**
 * Move one evidence item to EXCLUDED.
 *
 * Excluding is a single deliberate action, so it gets a one-click affordance.
 * There is deliberately no matching one-click "include": returning evidence to
 * scope requires choosing *which* boundary it belongs to, and Phase 2 stores no
 * previous-boundary field. Assuming CURRENT_SCOPE would be a guess, and a wrong
 * boundary poisons every later intelligence layer. The user picks the target
 * from the classification control instead.
 */
export async function excludeEvidenceAction(
  evidenceId: string,
  slug: string,
): Promise<EvidenceActionResult> {
  return reclassifyEvidenceAction(evidenceId, slug, "EXCLUDED");
}
