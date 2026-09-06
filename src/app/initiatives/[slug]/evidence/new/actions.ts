"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { getRepository } from "@/lib/data";
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

function readBoundary(value: FormDataEntryValue | null): EvidenceRelation | null {
  const v = String(value ?? "");
  return (EVIDENCE_RELATIONS as readonly string[]).includes(v)
    ? (v as EvidenceRelation)
    : null;
}

function readSourceType(
  value: FormDataEntryValue | null,
): EvidenceSourceType | null {
  const v = String(value ?? "");
  return (EVIDENCE_SOURCE_TYPES as readonly string[]).includes(v)
    ? (v as EvidenceSourceType)
    : null;
}

/** Optional date input arrives as YYYY-MM-DD; store it as an instant. */
function readDate(value: FormDataEntryValue | null): string | null {
  const v = String(value ?? "").trim();
  if (!v) return null;
  const d = new Date(`${v}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export async function createEvidenceAction(
  _prev: EvidenceFormState,
  formData: FormData,
): Promise<EvidenceFormState> {
  const slug = String(formData.get("slug") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const sourceType = readSourceType(formData.get("sourceType"));
  const boundary = readBoundary(formData.get("boundary"));

  if (title.length === 0) return { error: "Evidence title is required." };
  if (title.length > 200)
    return { error: "Evidence title must be 200 characters or fewer." };
  if (!sourceType) return { error: "Select a source type." };
  if (!boundary) return { error: "Select a boundary classification." };

  try {
    const repo = getRepository();
    const initiative = await repo.getInitiativeBySlug(slug);
    if (!initiative) return { error: "That initiative no longer exists." };

    await repo.createEvidence({
      initiativeId: initiative.id,
      title,
      sourceType,
      boundary,
      sourceReference: String(formData.get("sourceReference") ?? ""),
      sourceUrl: String(formData.get("sourceUrl") ?? ""),
      contentSummary: String(formData.get("contentSummary") ?? ""),
      occurredAt: readDate(formData.get("occurredAt")),
    });
  } catch (error) {
    if (error instanceof WriteDisabledError) return { error: error.message };
    return {
      error:
        error instanceof Error ? error.message : "Could not add the evidence.",
    };
  }

  revalidatePath(`/initiatives/${slug}/evidence`);
  redirect(`/initiatives/${slug}/evidence`);
}
