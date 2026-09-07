"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { getRepository } from "@/lib/data";
import {
  ClaimAccessError,
  EvidenceAccessError,
  resolveClaimEvidenceLinks,
  resolveOwnedClaim,
} from "@/lib/data/access";
import { WriteDisabledError } from "@/lib/env";
import {
  readClaimStatus,
  readClaimType,
  readDomain,
  readText,
  type ClaimFormState,
} from "../../shared";

export type { ClaimFormState };

export async function updateClaimAction(
  _prev: ClaimFormState,
  formData: FormData,
): Promise<ClaimFormState> {
  const slug = readText(formData.get("slug"));
  const claimId = readText(formData.get("claimId"));
  const type = readClaimType(formData.get("type"));
  const status = readClaimStatus(formData.get("status"));
  const subject = readText(formData.get("subject"));
  const attribute = readText(formData.get("attribute"));
  const value = readText(formData.get("value"));
  const domain = readDomain(formData.get("domain"));
  const phase = readText(formData.get("phase"));
  const supersededBy = readText(formData.get("supersededByClaimId"));
  const evidenceIds = formData.getAll("evidenceIds").map(String);

  if (!claimId) return { error: "That claim could not be identified." };
  if (!type) return { error: "Select a claim type." };
  if (!status) return { error: "Select a status." };
  if (!subject) return { error: "Subject is required." };
  if (!attribute) return { error: "Attribute is required." };
  if (!value) return { error: "Value is required." };
  if (!domain) return { error: "Select a domain." };

  try {
    // Ownership is proven at the mutation boundary — claimId, slug and every
    // evidenceId arrive from client-controlled input and none is trusted.
    const { initiative, claim } = await resolveOwnedClaim(slug, claimId);

    // ── Supersession invariants ──────────────────────────────────────────
    let replacement: string | null = supersededBy || null;

    if (status !== "SUPERSEDED") {
      // A replacement only means anything while the claim is superseded.
      replacement = null;
    }
    if (replacement === claimId) {
      return { error: "A claim cannot supersede itself." };
    }
    if (replacement) {
      // The replacement must be a claim on this same initiative.
      const target = await getRepository().getClaim(replacement);
      if (!target || target.initiativeId !== initiative.id) {
        return { error: "That replacement claim is not on this initiative." };
      }
    }
    // SUPERSEDED with no known replacement stays valid — nothing is invented.

    // ── Evidence links ───────────────────────────────────────────────────
    // Diffed against what is already linked: a newly added record may not be
    // EXCLUDED, but one linked before it was excluded is retained, and removal
    // is a deliberate human unlink.
    const links = await resolveClaimEvidenceLinks(
      initiative.id,
      claim.evidence.map((e) => e.id),
      evidenceIds,
    );

    await getRepository().updateClaim(claimId, {
      type,
      status,
      subject,
      attribute,
      value,
      domain,
      phase: phase || null,
      supersededByClaimId: replacement,
    });
    await getRepository().setClaimEvidence(claimId, links);
  } catch (error) {
    if (error instanceof ClaimAccessError) return { error: error.message };
    if (error instanceof EvidenceAccessError) return { error: error.message };
    if (error instanceof WriteDisabledError) return { error: error.message };
    return {
      error: error instanceof Error ? error.message : "Could not save the claim.",
    };
  }

  revalidatePath(`/initiatives/${slug}/memory`);
  redirect(`/initiatives/${slug}/memory?view=claims`);
}
