"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { getRepository } from "@/lib/data";
import {
  EvidenceAccessError,
  resolveOwnedEvidence,
} from "@/lib/data/access";
import { WriteDisabledError } from "@/lib/env";
import {
  EVIDENCE_RELATIONS,
  EVIDENCE_SOURCE_TYPES,
  type EvidenceRelation,
  type EvidenceSourceType,
} from "@/lib/domain/types";

export interface EvidenceFormState {
  error: string | null;
}

function readBoundary(v: FormDataEntryValue | null): EvidenceRelation | null {
  const s = String(v ?? "");
  return (EVIDENCE_RELATIONS as readonly string[]).includes(s)
    ? (s as EvidenceRelation)
    : null;
}

function readSourceType(v: FormDataEntryValue | null): EvidenceSourceType | null {
  const s = String(v ?? "");
  return (EVIDENCE_SOURCE_TYPES as readonly string[]).includes(s)
    ? (s as EvidenceSourceType)
    : null;
}

function readDate(v: FormDataEntryValue | null): string | null {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const d = new Date(`${s}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export async function updateEvidenceAction(
  _prev: EvidenceFormState,
  formData: FormData,
): Promise<EvidenceFormState> {
  const slug = String(formData.get("slug") ?? "");
  const evidenceId = String(formData.get("evidenceId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const sourceType = readSourceType(formData.get("sourceType"));
  const boundary = readBoundary(formData.get("boundary"));

  if (!evidenceId) return { error: "That evidence could not be identified." };
  if (title.length === 0) return { error: "Evidence title is required." };
  if (title.length > 200)
    return { error: "Evidence title must be 200 characters or fewer." };
  if (!sourceType) return { error: "Select a source type." };
  if (!boundary) return { error: "Select a boundary classification." };

  try {
    // `evidenceId` and `slug` are client-controlled hidden fields, so ownership
    // is proven at this mutation boundary rather than trusted from the page
    // guard. Nothing is written and no activity is logged if they do not match.
    await resolveOwnedEvidence(slug, evidenceId);

    // The repository writes an activity entry itself when the boundary moves,
    // so a reclassification made here is audited exactly like one made inline.
    await getRepository().updateEvidence(evidenceId, {
      title,
      sourceType,
      boundary,
      sourceReference: String(formData.get("sourceReference") ?? ""),
      sourceUrl: String(formData.get("sourceUrl") ?? ""),
      contentSummary: String(formData.get("contentSummary") ?? ""),
      occurredAt: readDate(formData.get("occurredAt")),
    });
  } catch (error) {
    if (error instanceof EvidenceAccessError) return { error: error.message };
    if (error instanceof WriteDisabledError) return { error: error.message };
    return {
      error:
        error instanceof Error ? error.message : "Could not save the evidence.",
    };
  }

  revalidatePath(`/initiatives/${slug}/evidence`);
  redirect(`/initiatives/${slug}/evidence`);
}
