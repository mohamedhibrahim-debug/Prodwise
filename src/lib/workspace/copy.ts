import type { ActivityEntry, ReviewFinding } from "../domain/types.ts";
import { normalise } from "../review/normalise.ts";

const field = (payload: ActivityEntry["payload"], key: string) =>
  typeof payload?.[key] === "string" ? payload[key] as string : null;

const STRUCTURED_ACTIVITY_TYPES = new Set([
  "FINDING_CONFIRMER_ASSIGNED", "FINDING_DECIDED", "FINDING_RESOLVED",
  "FINDING_REOPENED", "CLAIM_VERIFIED",
]);

export const MISMATCH_WHY_RAISED =
  "Two confirmed entries record different values for the same subject, attribute and phase. Prodwise checks that the recorded values differ — not whether they contradict.";

export const isStructuredActivity = (entry: ActivityEntry) =>
  STRUCTURED_ACTIVITY_TYPES.has(entry.eventType);

/** Only typed system events get new display copy. Stored human text is never edited. */
export function activitySummary(entry: ActivityEntry): string {
  const subject = field(entry.payload, "subject");
  switch (entry.eventType) {
    case "FINDING_CONFIRMER_ASSIGNED": {
      const label = field(entry.payload, "label");
      return label ? `Confirmer assigned: ${label}` : "Confirmer cleared";
    }
    case "FINDING_DECIDED": {
      const attribute = field(entry.payload, "attribute");
      return subject && attribute ? `Decision recorded: ${subject} — ${attribute}` : "Decision recorded";
    }
    case "FINDING_RESOLVED":
      return subject ? `Reviewed — note only: ${subject}` : "Reviewed — note only";
    case "FINDING_REOPENED":
      return "Reviewed item reopened";
    case "CLAIM_VERIFIED":
      return subject ? `${subject} confirmed` : "Knowledge entry confirmed";
    default:
      return entry.summary;
  }
}

const compact = (value: string) => value.length > 40 ? `${value.slice(0, 39).trimEnd()}…` : value;

export function attentionSentence(finding: ReviewFinding): string {
  const values = [...new Map(finding.claims.filter((claim) => claim.status === "ACTIVE")
    .map((claim) => [normalise(claim.value), compact(claim.value)])).values()];
  const attribute = finding.claims[0]?.attribute ?? "Value";
  const count = values.length;
  if (count === 2) return `${finding.subject} — ${attribute} has two confirmed values: ${values[0]} and ${values[1]}.`;
  if (count > 2) return `${finding.subject} — ${attribute} has ${count} confirmed values: ${values.slice(0, 2).join(", ")} and ${count - 2} more.`;
  return finding.title;
}
