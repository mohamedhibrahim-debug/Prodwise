"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { getRepository } from "@/lib/data";
import { EvidenceAccessError, resolveClaimEvidenceLinks } from "@/lib/data/access";
import { WriteDisabledError } from "@/lib/env";
import {
  readClaimType,
  readDomain,
  readText,
  type ClaimFormState,
} from "../shared";

export type { ClaimFormState };

export async function createClaimAction(
  _prev: ClaimFormState,
  formData: FormData,
): Promise<ClaimFormState> {
  const slug = readText(formData.get("slug"));
  const type = readClaimType(formData.get("type"));
  const subject = readText(formData.get("subject"));
  const attribute = readText(formData.get("attribute"));
  const value = readText(formData.get("value"));
  const domain = readDomain(formData.get("domain"));
  const phase = readText(formData.get("phase"));
  const evidenceIds = formData.getAll("evidenceIds").map(String);

  if (!type) return { error: "Select a claim type." };
  if (!subject) return { error: "Subject is required." };
  if (!attribute) return { error: "Attribute is required." };
  if (!value) return { error: "Value is required." };
  if (!domain) return { error: "Select a domain." };

  let createdId: string;
  try {
    const repo = getRepository();
    const initiative = await repo.getInitiativeBySlug(slug);
    if (!initiative) return { error: "That initiative no longer exists." };

    // Validate links against this initiative before creating anything. A new
    // claim has no existing links, so every requested id counts as new and
    // therefore may not be EXCLUDED.
    const links = await resolveClaimEvidenceLinks(
      initiative.id,
      [],
      evidenceIds,
    );

    const created = await repo.createClaim({
      initiativeId: initiative.id,
      type,
      subject,
      attribute,
      value,
      domain,
      phase: phase || null,
    });
    createdId = created.id;

    if (links.length > 0) {
      await repo.setClaimEvidence(created.id, links);
    }
  } catch (error) {
    if (error instanceof EvidenceAccessError) return { error: error.message };
    if (error instanceof WriteDisabledError) return { error: error.message };
    return {
      error: error instanceof Error ? error.message : "Could not add the claim.",
    };
  }

  revalidatePath(`/initiatives/${slug}/memory`);
  redirect(`/initiatives/${slug}/memory?view=claims#${createdId}`);
}
