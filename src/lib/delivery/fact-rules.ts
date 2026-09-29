import type { FactKind, FactValue } from "./types.ts";

/**
 * The value rules for a delivery fact, shared by the server (recordFact) and the editors,
 * so the browser checks exactly what the server enforces. Pure and browser-safe.
 */
export const TEXT_REQUIRED_KINDS: readonly FactKind[] = ["SCOPE", "NEXT_MILESTONE", "BLOCKER", "NEXT_STEP"];
export const DATE_REQUIRED_KINDS: readonly FactKind[] = ["SOLUTION_DEFINED", "DEV_STARTED", "TARGET_LIVE", "ACTUAL_LIVE"];
export const UNKNOWN_ALLOWED_KINDS: readonly FactKind[] = ["TARGET_LIVE", "NEXT_MILESTONE", "DEV_STARTED"];
const ACTUAL_KINDS: readonly FactKind[] = ["SOLUTION_DEFINED", "DEV_STARTED", "ACTUAL_LIVE"];

export type FactField = "date" | "text" | "extent" | "unknown";
export interface FactProblem { code: string; field: FactField; message: string }

export function dateValid(value: string): boolean { return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value; }

/** Whether the Description field must be filled for this kind and value (explicit unknown exempts it). */
export const textRequired = (kind: FactKind, v: Pick<FactValue, "unknown">) => TEXT_REQUIRED_KINDS.includes(kind) && !v.unknown;

/** The first problem with a fact's value, or null. `today` is the Cairo calendar day (YYYY-MM-DD). */
export function factValueProblem(kind: FactKind, v: FactValue, today: string): FactProblem | null {
  if (v.unknown && (!UNKNOWN_ALLOWED_KINDS.includes(kind) || v.date || v.text || v.memberId || v.extent || v.dateUnknown)) return { code: "UNKNOWN_SHAPE", field: "unknown", message: "Unknown must be recorded separately from a known value. Clear the date and description, or untick Explicitly unknown." };
  if (v.dateUnknown && (kind !== "NEXT_MILESTONE" || v.date || !v.text?.trim() || v.unknown)) return { code: "UNKNOWN_DATE", field: "text", message: "An unknown milestone date requires the milestone name in Description and no date." };
  if (v.date && !dateValid(v.date)) return { code: "DATE", field: "date", message: "Enter a valid calendar date." };
  if (v.text && v.text.length > 2000) return { code: "TEXT", field: "text", message: "Keep the description under 2,000 characters." };
  if (DATE_REQUIRED_KINDS.includes(kind) && !v.date && !v.unknown) return { code: "DATE_REQUIRED", field: "date", message: UNKNOWN_ALLOWED_KINDS.includes(kind) ? "Record the date or mark this fact explicitly unknown." : "Record the date." };
  // The confirmation reason is recorded separately; it never stands in for the value itself.
  if (textRequired(kind, v) && !v.text?.trim()) return { code: "TEXT_REQUIRED", field: "text", message: `Describe it in Description${kind === "NEXT_MILESTONE" ? ", or mark the milestone explicitly unknown" : ""}. The confirmation reason is recorded separately.` };
  if (ACTUAL_KINDS.includes(kind) && v.date && v.date > today) return { code: "FUTURE_ACTUAL", field: "date", message: "An actual milestone cannot be in the future." };
  if (kind === "ACTUAL_LIVE" && (!v.extent || (v.extent === "PARTIAL" && !v.text?.trim()))) return { code: "ROLLOUT_SCOPE", field: v.extent ? "text" : "extent", message: "State full or partial launch and describe partial rollout scope." };
  return null;
}

/** Today's calendar day in Cairo, the product's delivery clock. */
export function cairoToday(now = new Date()): string { return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo", year: "numeric", month: "2-digit", day: "2-digit" }).format(now); }

/** Reads a fact value from editor form fields named date/text/extent/unknown/dateUnknown (optionally prefixed). */
export function factValueFromForm(data: FormData, prefix = ""): FactValue {
  const get = (name: string) => String(data.get(prefix + name) ?? "").trim();
  const extent = get("extent");
  return { date: get("date") || null, text: get("text") || null, memberId: get("memberId") || null, extent: extent === "FULL" || extent === "PARTIAL" ? extent : null,
    ...(data.get(prefix + "unknown") === "yes" ? { unknown: true as const } : {}), ...(data.get(prefix + "dateUnknown") === "yes" ? { dateUnknown: true as const } : {}) };
}

/** Delivery facts other than Scope and Owner need a confirmed Scope first (the server's SCOPE_REQUIRED rule). */
export const SCOPE_PREREQUISITE = "Confirm the delivery phase or scope before recording delivery facts.";
export const needsScopeFirst = (kind: FactKind, scopeConfirmed: boolean) => kind !== "SCOPE" && kind !== "OWNER" && !scopeConfirmed;

/** The confirmation / change reason is optional. A blank one is stored as this literal, never an invented reason. */
export const NO_REASON_NOTE = "No change reason recorded.";
export const confirmationNote = (note: string) => note.trim() || NO_REASON_NOTE;
