"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getRepository } from "@/lib/data";
import { resolveOwnedClaim, ClaimAccessError } from "@/lib/data/access";
import { currentActor } from "@/lib/domain/actor";
import { WriteDisabledError } from "@/lib/env";
import type { VerificationBasis } from "@/lib/domain/types";

interface State { error: string | null }
const text = (value: FormDataEntryValue | null) => String(value ?? "").trim();

export async function verifyClaimAction(_state: State, data: FormData): Promise<State> {
  const slug = text(data.get("slug"));
  const claimId = text(data.get("claimId"));
  const expectedUpdatedAt = String(data.get("expectedUpdatedAt") ?? "");
  const rawBasis = text(data.get("basis"));
  const basis: VerificationBasis | null =
    rawBasis === "EVIDENCE" || rawBasis === "DIRECT_KNOWLEDGE" ? rawBasis : null;
  const note = text(data.get("note")) || null;
  if (!basis) return { error: "Select a verification basis." };
  try {
    await resolveOwnedClaim(slug, claimId);
    await getRepository().verifyClaim(claimId, {
      expectedUpdatedAt,
      basis,
      note,
      actor: currentActor(),
    });
  } catch (error) {
    if (error instanceof ClaimAccessError || error instanceof WriteDisabledError)
      return { error: error.message };
    return { error: error instanceof Error ? error.message : "Could not verify the claim." };
  }
  revalidatePath(`/initiatives/${slug}/memory`);
  redirect(`/initiatives/${slug}/memory?view=claims#claim-${claimId}`);
}
