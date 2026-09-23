"use server";

import { revalidatePath } from "next/cache";
import { getRepository } from "@/lib/data";
import { ClaimAccessError, resolveOwnedClaim } from "@/lib/data/access";
import { currentActor } from "@/lib/domain/actor";
import { WriteDisabledError } from "@/lib/env";

export interface AnchorFormState { error: string | null; saved?: boolean }
const text = (v: FormDataEntryValue | null) => String(v ?? "").trim();

export async function updateEvidenceAnchorAction(
  _state: AnchorFormState,
  data: FormData,
): Promise<AnchorFormState> {
  const slug = text(data.get("slug"));
  const claimId = text(data.get("claimId"));
  const evidenceId = text(data.get("evidenceId"));
  const locator = text(data.get("locator")) || null;
  const excerpt = text(data.get("excerpt")) || null;
  try {
    const { claim } = await resolveOwnedClaim(slug, claimId);
    if (!claim.evidence.some((e) => e.id === evidenceId))
      return { error: "That evidence is no longer linked to this claim." };
    await getRepository().setEvidenceAnchor(claimId, evidenceId, {
      locator,
      excerpt,
      actor: currentActor(),
    });
  } catch (error) {
    if (error instanceof ClaimAccessError || error instanceof WriteDisabledError)
      return { error: error.message };
    return { error: error instanceof Error ? error.message : "Could not save the evidence anchor." };
  }
  revalidatePath(`/initiatives/${slug}/memory`);
  return { error: null, saved: true };
}
