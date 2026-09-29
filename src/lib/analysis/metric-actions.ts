"use server";
import { listProjectMetrics } from "./metrics";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireFreshWorkspaceAccess } from "@/lib/auth/access";
import { adminClient, isDemoGuestSession, isLocalAuth } from "@/lib/auth/service";
import { assertFormWorkspace } from "@/lib/auth/scope";
import { withRepositoryContext } from "@/lib/auth/repository-context";
import { writeStoreAtomic } from "@/lib/data/store";
import { readDeliveryFresh } from "@/lib/delivery/repository";
import { cairoDay, ownerFor } from "@/lib/delivery/model";
import { isDemoWriteEnabled } from "@/lib/env";
import { safeMessage } from "@/lib/errors/safe-message";
import type { ActivityEntry } from "@/lib/domain/types";
import { definitionRecord, parseDefinitionInput, parseObservationInput, type FieldErrors } from "./metric-input";
import { metricSetupDecision } from "./metric-authorization";
import { appendLocalMetric, appendLocalObservation, localMetricsPath } from "./metric-local-store";
import { formatMetricValue } from "./metric-view";

/* Metric setup actions. Authorization (decision D2) and validation run here, on the
   server, before anything is stored; the form only mirrors the same rules. Local auth
   persists to `.data/metrics-<workspaceId>.json` plus an activity entry in the local
   store; hosted auth calls the record_metric_* functions of migration 0045, which do
   both in one transaction. */

export interface MetricActionState { error: string | null; message: string | null; errors?: FieldErrors; recordedId?: string }
const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim();
const raw = (form: FormData, keys: string[]) => Object.fromEntries(keys.map(k => [k, text(form, k)]));
const DEFINITION_KEYS = ["initiativeId", "name", "definition", "unit", "formula", "sourceLabel", "sourceEvidenceId", "periodGrain", "periodGrainCustom", "timezone", "hasTarget", "targetValue", "targetComparator", "targetOwnerLabel", "targetApprovedAt", "targetNote"];
const OBSERVATION_KEYS = ["metricId", "periodStart", "periodEnd", "value", "notRecorded", "note", "capturedAt", "sourceEvidenceId"];

function refresh(slug: string) { revalidatePath("/analysis", "layout"); revalidatePath(`/initiatives/${slug}`, "layout"); revalidatePath("/"); }
/** Refusals raised by the database functions, as sentences a person can act on. */
const HOSTED_REFUSALS: [RegExp, string][] = [
  [/METRIC_PERMISSION/, "Only this initiative's owner, an Org Owner, an Admin or a Product Lead can define its metrics."],
  [/VIEW_ONLY/, "Viewers can read metrics but cannot define them."],
  [/INITIATIVE_ARCHIVED/, "This initiative is archived; no metric can be added."],
  [/METRIC_CONFIRMATION_REQUIRED/, "Review the summary and confirm before the definition is recorded."],
  [/METRIC_READ_ONLY/, "Synthetic demo metrics are read-only. Define a metric of your own to record observations."],
  [/OBSERVATION_PERIOD_RECORDED/, "This period is already recorded. Choose a different period; recorded values are never overwritten."],
  [/OBSERVATION_NOTE_REQUIRED/, "Say why this period was not recorded; the gap is shown, never a zero."],
  [/METRIC_SOURCE_SCOPE/, "Choose evidence that belongs to this initiative."],
];
function hostedMessage(message: string, fallback: string) { return HOSTED_REFUSALS.find(([re]) => re.test(message))?.[1] ?? fallback; }

async function authorize(form: FormData, initiativeId: string) {
  const ctx = await requireFreshWorkspaceAccess();
  assertFormWorkspace(form, ctx);
  const read = await readDeliveryFresh();
  const snapshot = read.source.snapshots.find(s => s.initiative.id === initiativeId);
  if (!snapshot) throw new Error("This initiative is no longer available. Reload and try again.");
  const decision = metricSetupDecision(ctx, { ownerMemberId: ownerFor(read.state.facts, initiativeId), archived: Boolean(snapshot.initiative.archivedAt) }, { writesEnabled: isDemoWriteEnabled, demoGuest: await isDemoGuestSession() });
  if (!decision.allowed) throw new Error(decision.message);
  return { ctx, snapshot, read };
}
function activity(ctx: { workspaceId: string; actor: { id: string; label: string } }, entry: Omit<ActivityEntry, "id" | "workspaceId" | "occurredAt" | "actorLabel"> & { occurredAt: string }): ActivityEntry {
  return { id: randomUUID(), workspaceId: ctx.workspaceId, actorLabel: ctx.actor.label, ...entry, payload: { ...entry.payload, actor: ctx.actor } };
}

/** Step two of Define a metric: the person has reviewed the summary and confirmed it. */
export async function recordMetricDefinitionAction(_previous: MetricActionState, form: FormData): Promise<MetricActionState> {
  try {
    const initiativeId = text(form, "initiativeId");
    const { ctx, snapshot } = await authorize(form, initiativeId);
    const now = new Date().toISOString();
    const parsed = parseDefinitionInput(raw(form, DEFINITION_KEYS), cairoDay(now));
    if (!parsed.ok) return { error: "Some fields need attention before the definition can be recorded.", message: null, errors: parsed.errors };
    if (text(form, "confirmed") !== "yes") return { error: "Review the summary and confirm before the definition is recorded.", message: null };
    const input = parsed.input;
    if (input.sourceEvidenceId && !snapshot.evidence.some(e => e.id === input.sourceEvidenceId && e.boundary !== "EXCLUDED")) return { error: "Choose evidence that belongs to this initiative.", message: null, errors: { sourceEvidenceId: "Choose evidence that belongs to this initiative." } };
    const target = input.target ? `${input.target.comparator === "AT_LEAST" ? "≥" : input.target.comparator === "AT_MOST" ? "≤" : "="} ${formatMetricValue(input.target.value, input.unit, true)} · approved by ${input.target.ownerLabel}` : "no approved target";
    let recordedId: string;
    if (isLocalAuth()) {
      const metric = definitionRecord(input, { id: randomUUID(), workspaceId: ctx.workspaceId }, now);
      await appendLocalMetric(localMetricsPath(process.cwd(), ctx.workspaceId), metric);
      withRepositoryContext(ctx, () => writeStoreAtomic(s => { s.activity.push(activity(ctx, { initiativeId, eventType: "METRIC_DEFINED", summary: `Metric defined: ${metric.name}`, occurredAt: now, entityType: "METRIC", entityId: metric.id, payload: { metricId: metric.id, name: metric.name, unit: metric.unit, periodGrain: metric.periodGrain, sourceLabel: metric.sourceLabel, sourceEvidenceId: metric.sourceEvidenceId, target: input.target } })); }));
      recordedId = metric.id;
    } else {
      const { data, error } = await adminClient().rpc("record_metric_definition", { p_workspace_id: ctx.workspaceId, p_member_id: ctx.memberId ?? ctx.actor.id, p_initiative_id: initiativeId, p_input: { ...input, confirmed: "yes" } });
      if (error) return { error: hostedMessage(error.message, "The metric could not be recorded. Reload and try again."), message: null };
      recordedId = String(data);
    }
    refresh(snapshot.initiative.slug);
    return { error: null, message: `Metric recorded: ${input.name} (${input.unit}, ${input.periodGrain}; ${target}). It appears in Analysis now; record its first period whenever a value is available.`, recordedId };
  } catch (error) {
    return { error: safeMessage(error, "The metric could not be recorded. Reload and try again."), message: null };
  }
}

/** Record one period for a metric defined in Prodwise: a value, or "Not recorded" with the reason. */
export async function recordMetricObservationAction(_previous: MetricActionState, form: FormData): Promise<MetricActionState> {
  try {
    const initiativeId = text(form, "initiativeId");
    const { ctx, snapshot } = await authorize(form, initiativeId);
    const parsed = parseObservationInput(raw(form, OBSERVATION_KEYS));
    if (!parsed.ok) return { error: "Some fields need attention before the observation can be recorded.", message: null, errors: parsed.errors };
    const input = parsed.input, now = new Date().toISOString();
    if (input.sourceEvidenceId && !snapshot.evidence.some(e => e.id === input.sourceEvidenceId && e.boundary !== "EXCLUDED")) return { error: "Choose evidence that belongs to this initiative.", message: null, errors: { sourceEvidenceId: "Choose evidence that belongs to this initiative." } };
    let recordedId: string; const metricName = text(form, "metricName") || "metric";
    // The metric must belong to the initiative that was authorized, not merely to the workspace (Devil R2 minor).
    if (!(await listProjectMetrics(initiativeId)).some(m => m.id === input.metricId)) return { error: "This metric is not part of this initiative. Reload and try again.", message: null, errors: {} };
    if (isLocalAuth()) {
      const path = localMetricsPath(process.cwd(), ctx.workspaceId);
      const observation = { id: randomUUID(), periodStart: input.periodStart, periodEnd: input.periodEnd, value: input.value, capturedAt: input.capturedAt, sourceEvidenceId: input.sourceEvidenceId, note: input.note, origin: "HUMAN_ENTRY" as const };
      await appendLocalObservation(path, input.metricId, ctx.workspaceId, observation, now);
      withRepositoryContext(ctx, () => writeStoreAtomic(s => { s.activity.push(activity(ctx, { initiativeId, eventType: "METRIC_OBSERVED", summary: `Observation recorded: ${metricName} · ${input.periodStart} to ${input.periodEnd}${input.value === null ? " · not recorded" : ""}`, occurredAt: now, entityType: "METRIC", entityId: input.metricId, payload: { metricId: input.metricId, observationId: observation.id, periodStart: input.periodStart, periodEnd: input.periodEnd, value: input.value, capturedAt: input.capturedAt, sourceEvidenceId: input.sourceEvidenceId } })); }));
      recordedId = observation.id;
    } else {
      const { data, error } = await adminClient().rpc("record_metric_observation", { p_workspace_id: ctx.workspaceId, p_member_id: ctx.memberId ?? ctx.actor.id, p_metric_id: input.metricId, p_input: input });
      if (error) return { error: hostedMessage(error.message, "The observation could not be recorded. Reload and try again."), message: null };
      recordedId = String(data);
    }
    refresh(snapshot.initiative.slug);
    return { error: null, message: input.value === null ? "Period recorded as not recorded, with your note. It is shown as a gap, never as zero." : "Observation recorded. The latest period, its status and the trend are updated.", recordedId };
  } catch (error) {
    return { error: safeMessage(error, "The observation could not be recorded. Reload and try again."), message: null };
  }
}
