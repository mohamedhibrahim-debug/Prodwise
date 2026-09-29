import type { ProjectMetric } from "./metric-types.ts";

/* Pure validation of what a person types when defining a metric or recording an
   observation. It mirrors the storage constraints of migration 0017 (lengths,
   the all-or-nothing target, "a value or a note") so the same refusal appears in
   the form before anything is sent and on the server before anything is stored. */

export const METRIC_COMPARATORS = ["AT_LEAST", "AT_MOST", "EQUAL"] as const;
export type MetricComparator = typeof METRIC_COMPARATORS[number];
export const COMPARATOR_LABEL: Record<MetricComparator, string> = { AT_LEAST: "At least (≥)", AT_MOST: "At most (≤)", EQUAL: "Exactly (=)" };
/** Common reporting grains; a free-text grain is also accepted. */
export const PERIOD_GRAINS = ["Daily · calendar day", "Weekly · Monday–Sunday", "Calendar month", "Calendar quarter"] as const;
export const DEFAULT_TIMEZONE = "Africa/Cairo";

/**
 * A datetime-local value ("2026-09-29T21:54") is a wall-clock time on the
 * organization's clock, not on the server's: read it in that timezone. A value
 * that already carries an offset or Z is taken as given (Devil R2-M4).
 */
export function wallClockToUtc(value: string, timeZone: string): number {
  if (/(Z|[+-]\d{2}:?\d{2})$/.test(value)) return Date.parse(value);
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value);
  if (!m) return Number.NaN;
  const asUtc = Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!, +m[4]!, +m[5]!, +(m[6] ?? 0));
  const offsetAt = (ms: number) => {
    const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(new Date(ms)).map(p => [p.type, p.value]));
    return Date.UTC(+parts.year!, +parts.month! - 1, +parts.day!, +parts.hour!, +parts.minute!, +parts.second!) - ms;
  };
  const first = asUtc - offsetAt(asUtc);
  return asUtc - offsetAt(first);
}
const LIMITS = { name: 160, definition: 2000, unit: 40, formula: 2000, sourceLabel: 160, periodGrain: 80, timezone: 64, targetOwnerLabel: 160, targetNote: 1000, note: 2000 } as const;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export interface MetricTargetInput { value: number; comparator: MetricComparator; ownerLabel: string; approvedAt: string; note: string | null }
export interface MetricDefinitionInput {
  initiativeId: string; name: string; definition: string; unit: string; formula: string;
  sourceLabel: string; sourceEvidenceId: string | null; periodGrain: string; timezone: string;
  /** Present only with all four approval fields; an unapproved target is never stored. */
  target: MetricTargetInput | null;
}
export interface MetricObservationInput { metricId: string; periodStart: string; periodEnd: string; value: number | null; note: string; capturedAt: string; sourceEvidenceId: string | null }
export type FieldErrors = Record<string, string>;
export type Parsed<T> = { ok: true; input: T } | { ok: false; errors: FieldErrors };
type Raw = Record<string, string | undefined>;

const text = (raw: Raw, key: string) => (raw[key] ?? "").trim();
function validDate(value: string): boolean { return ISO_DATE.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value; }
function validTimezone(value: string): boolean { try { new Intl.DateTimeFormat("en-GB", { timeZone: value }); return true; } catch { return false; } }
function required(errors: FieldErrors, key: keyof typeof LIMITS, value: string, label: string) {
  if (!value) errors[key] = `Enter the ${label}.`;
  else if (value.length > LIMITS[key]) errors[key] = `Keep the ${label} under ${LIMITS[key].toLocaleString("en-GB")} characters.`;
}
/** Numbers as people type them: "4,380,000", "96.6", "−3". Anything else is refused, never coerced to zero. */
export function parseNumber(value: string): number | null {
  const cleaned = value.trim().replace(/,/g, "").replace(/^−/, "-");
  if (!cleaned || !/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/** `today` is the organization's calendar day (Cairo); an approval date after it is refused. */
export function parseDefinitionInput(raw: Raw, today: string): Parsed<MetricDefinitionInput> {
  const errors: FieldErrors = {};
  const name = text(raw, "name"), definition = text(raw, "definition"), unit = text(raw, "unit"), formula = text(raw, "formula");
  const sourceLabel = text(raw, "sourceLabel"), periodGrain = text(raw, "periodGrain") === "custom" ? text(raw, "periodGrainCustom") : text(raw, "periodGrain"), timezone = text(raw, "timezone") || DEFAULT_TIMEZONE;
  const initiativeId = text(raw, "initiativeId"), sourceEvidenceId = text(raw, "sourceEvidenceId") || null;
  if (!initiativeId) errors.initiativeId = "Reload the page before defining a metric.";
  required(errors, "name", name, "metric name");
  required(errors, "definition", definition, "definition");
  required(errors, "unit", unit, "unit");
  required(errors, "formula", formula, "formula");
  required(errors, "sourceLabel", sourceLabel, "source");
  required(errors, "periodGrain", periodGrain, "reporting period");
  if (timezone.length > LIMITS.timezone || !validTimezone(timezone)) errors.timezone = "Enter a timezone name such as Africa/Cairo.";
  let target: MetricTargetInput | null = null;
  if (raw.hasTarget === "yes") {
    const value = parseNumber(text(raw, "targetValue")), comparator = text(raw, "targetComparator") as MetricComparator, ownerLabel = text(raw, "targetOwnerLabel"), approvedAt = text(raw, "targetApprovedAt"), note = text(raw, "targetNote") || null;
    if (value === null) errors.targetValue = "Enter the target as a number.";
    if (!METRIC_COMPARATORS.includes(comparator)) errors.targetComparator = "Choose how the value is compared with the target.";
    required(errors, "targetOwnerLabel", ownerLabel, "approver");
    if (!validDate(approvedAt)) errors.targetApprovedAt = "Enter the approval date.";
    else if (approvedAt > today) errors.targetApprovedAt = "The approval date cannot be in the future.";
    if (note && note.length > LIMITS.targetNote) errors.targetNote = `Keep the target note under ${LIMITS.targetNote.toLocaleString("en-GB")} characters.`;
    if (value !== null && METRIC_COMPARATORS.includes(comparator) && ownerLabel && validDate(approvedAt) && approvedAt <= today && !errors.targetNote) target = { value, comparator, ownerLabel, approvedAt, note };
  }
  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, input: { initiativeId, name, definition, unit, formula, sourceLabel, sourceEvidenceId, periodGrain, timezone, target } };
}

export function parseObservationInput(raw: Raw): Parsed<MetricObservationInput> {
  const errors: FieldErrors = {};
  const metricId = text(raw, "metricId"), periodStart = text(raw, "periodStart"), periodEnd = text(raw, "periodEnd"), note = text(raw, "note"), capturedRaw = text(raw, "capturedAt"), sourceEvidenceId = text(raw, "sourceEvidenceId") || null;
  if (!metricId) errors.metricId = "Reload the page before recording an observation.";
  if (!validDate(periodStart)) errors.periodStart = "Enter the first day of the period.";
  if (!validDate(periodEnd)) errors.periodEnd = "Enter the last day of the period.";
  if (validDate(periodStart) && validDate(periodEnd) && periodEnd < periodStart) errors.periodEnd = "The period cannot end before it starts.";
  let value: number | null = null;
  if (raw.notRecorded === "yes") {
    if (!note) errors.note = "Say why this period was not recorded; the gap is shown, never a zero.";
  } else {
    value = parseNumber(text(raw, "value"));
    if (value === null) errors.value = "Enter the observed value as a number, or mark the period as not recorded.";
  }
  if (note.length > LIMITS.note) errors.note = `Keep the note under ${LIMITS.note.toLocaleString("en-GB")} characters.`;
  const capturedMs = capturedRaw ? wallClockToUtc(capturedRaw, DEFAULT_TIMEZONE) : Number.NaN;
  if (Number.isNaN(capturedMs)) errors.capturedAt = "Enter when the value was captured.";
  else if (validDate(periodStart) && capturedMs < Date.parse(`${periodStart}T00:00:00Z`)) errors.capturedAt = "A value cannot be captured before its period starts.";
  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, input: { metricId, periodStart, periodEnd, value, note, capturedAt: new Date(capturedMs).toISOString(), sourceEvidenceId } };
}

/** The stored definition a confirmed input becomes: origin HUMAN_ENTRY, revision 1, no observations yet. */
export function definitionRecord(input: MetricDefinitionInput, ids: { id: string; workspaceId: string }, at: string): ProjectMetric {
  return {
    id: ids.id, workspaceId: ids.workspaceId, initiativeId: input.initiativeId, name: input.name, definition: input.definition, unit: input.unit, formula: input.formula,
    sourceLabel: input.sourceLabel, sourceEvidenceId: input.sourceEvidenceId, periodGrain: input.periodGrain, timezone: input.timezone,
    targetValue: input.target?.value ?? null, targetComparator: input.target?.comparator ?? null, targetOwnerLabel: input.target?.ownerLabel ?? null,
    targetApprovedAt: input.target ? `${input.target.approvedAt}T00:00:00.000Z` : null, targetNote: input.target?.note ?? null,
    origin: "HUMAN_ENTRY", revision: 1, updatedAt: at, observations: [],
  };
}
