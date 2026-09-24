"use server";

import { revalidatePath } from "next/cache";

import { getRepository } from "@/lib/data";
import { FindingAccessError, resolveOwnedFinding } from "@/lib/data/access";
import { assertWriteAllowed, WriteDisabledError } from "@/lib/env";
import { currentActor } from "@/lib/domain/actor";
import { submitDecisionForm } from "@/lib/decisions/submit";
import { decisionError, STALE_DECISION_MESSAGE, type DecisionFormState } from "@/lib/decisions/ui";

function refreshDecisionPages(slug: string) {
  revalidatePath(`/initiatives/${slug}`, "layout");
}

export async function decideAction(_prev: DecisionFormState, form: FormData): Promise<DecisionFormState> {
  return submitDecisionForm(form, { repo: getRepository(), actor: currentActor(),
    assertWrite: assertWriteAllowed, refresh: refreshDecisionPages }, "decision");
}

export async function confirmerAction(_prev: DecisionFormState, form: FormData): Promise<DecisionFormState> {
  return submitDecisionForm(form, { repo: getRepository(), actor: currentActor(),
    assertWrite: assertWriteAllowed, refresh: refreshDecisionPages }, "confirmer");
}

export interface FindingFormState {
  error: string | null;
  /**
   * What the person typed, echoed back on failure.
   *
   * React resets an uncontrolled field once a form action settles, including
   * when it returns an error — so without this a rejected resolve silently
   * emptied the note. That is worst in the stale-digest case, where the message
   * says "your note was not saved" and the user then has to retype it from
   * memory to say the same thing again.
   */
  resolution?: string;
}

function readText(v: FormDataEntryValue | null): string {
  return String(v ?? "").trim();
}

/**
 * Marks a derived finding resolved.
 *
 * "Resolved" here means a person reviewed it and recorded why — it does NOT
 * mean the underlying claims changed. Product Memory is untouched, so the
 * claims still record whatever they recorded, and the UI must keep saying so.
 *
 * The fingerprint arrives from client-controlled input and is not trusted: it
 * is not looked up but re-derived, so a forged value, one from another
 * initiative, or one for a finding that no longer exists all fail before
 * anything is written. Every descriptive field stored alongside the decision is
 * taken from the derived finding rather than from the form.
 */
export async function resolveFindingAction(
  _prev: FindingFormState,
  formData: FormData,
): Promise<FindingFormState> {
  const slug = readText(formData.get("slug"));
  const fingerprint = readText(formData.get("fingerprint"));
  const resolution = readText(formData.get("resolution"));
  const seenDigest = readText(formData.get("contentDigest"));

  if (!resolution) {
    return { error: "Record why this is resolved before closing it." };
  }

  try {
    assertWriteAllowed();
    const { initiative, finding } = await resolveOwnedFinding(slug, fingerprint);

    /* The fingerprint ignores membership, so it cannot serve as a concurrency
       token: a claim can join or leave the group between rendering this form
       and submitting it without the fingerprint moving. Resolving then records
       a decision about something the person never saw. */
    if (seenDigest !== finding.contentDigest) {
      return {
        error:
          STALE_DECISION_MESSAGE,
        resolution,
      };
    }

    await getRepository().setFindingState(initiative.id, fingerprint, {
      // From the derived finding, never the request: otherwise the one audit
      // column in the table would be attacker-chosen.
      ruleId: finding.ruleId,
      contentDigest: finding.contentDigest,
      subject: finding.subject,
      attribute: finding.claims[0]?.attribute ?? null,
      phase: finding.phase,
      // JSON, not a " | " join: a value containing the separator would make the
      // audit record ambiguous — the same delimiter problem the fingerprint
      // framing exists to avoid, and it should not be reintroduced here.
      valuesRecorded:
        finding.claims.length > 0
          ? JSON.stringify(finding.claims.map((c) => c.value))
          : null,
      resolution,
    });
  } catch (error) {
    if (error instanceof FindingAccessError)
      return { error: STALE_DECISION_MESSAGE, resolution };
    if (error instanceof WriteDisabledError)
      return { error: error.message, resolution };
    return {
      error:
        decisionError(error),
      resolution,
    };
  }

  revalidatePath(`/initiatives/${slug}/decisions`);
  return { error: null };
}

/**
 * Reopens a finding while preserving its state row and audit history.
 *
 * The note is not lost with the row: both resolving and reopening are written
 * to activity_log, which is this product's audit trail (CLAUDE.md §19).
 */
export async function reopenFindingAction(
  _prev: FindingFormState,
  formData: FormData,
): Promise<FindingFormState> {
  const slug = readText(formData.get("slug"));
  const fingerprint = readText(formData.get("fingerprint"));

  try {
    assertWriteAllowed();
    const { initiative } = await resolveOwnedFinding(slug, fingerprint);
    await getRepository().reopenFindingState(
      initiative.id,
      fingerprint,
      currentActor(),
    );
  } catch (error) {
    if (error instanceof FindingAccessError) return { error: STALE_DECISION_MESSAGE };
    if (error instanceof WriteDisabledError) return { error: error.message };
    return {
      error:
        decisionError(error),
    };
  }

  revalidatePath(`/initiatives/${slug}/decisions`);
  return { error: null };
}
