import { dayDifference, factFor } from "./model.ts";
import type { DeliveryEvent, DeliveryFact } from "./types.ts";

export function displayDate(date: string | null | undefined): string {
  return date ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`)) : "Unknown";
}

// A passed commitment with no recorded actual is an update request, not proof of a failed launch.
export function deliveryTiming(facts: DeliveryFact[], initiativeId: string, cutoff: string) {
  const target = factFor(facts, initiativeId, "TARGET_LIVE")?.value.date ?? null;
  const actualFact = factFor(facts, initiativeId, "ACTUAL_LIVE");
  const actual = actualFact?.value.date ?? null;
  if (actual && actual>cutoff) return { kind: "AFTER_CUTOFF" as const, label: "Live recorded after cutoff", detail: `First production live recorded ${displayDate(actual)}. This date falls after the selected cutoff.`, overdueDays:null };
  const partial=actualFact?.value.extent==="PARTIAL";
  if (actual && !partial) return { kind: "RECORDED" as const, label: "Live date recorded", detail: `First production live: ${displayDate(actual)}.`, overdueDays: null };
  if(actual && partial && (!target || target>=cutoff)) return {kind:"PARTIAL" as const,label:"Partial live recorded",detail:`${displayDate(actual)} · ${actualFact?.value.text ?? "Partial rollout"}. Confirm the remaining scope against the recorded target.`,overdueDays:null};
  if (!target) return { kind: "UNSCHEDULED" as const, label: "Unscheduled", detail: "Target Live is unknown. Launch status is not inferred.", overdueDays: null };
  const days = dayDifference(cutoff, target);
  if (days < 0) return { kind: "NEEDS_UPDATE" as const, label: partial ? "Past target · partial live" : "Past target · update needed", detail: partial ? `Partial live recorded ${displayDate(actual)}. Confirm the remaining scope and current target; completion is not inferred.` : `${Math.abs(days)} days past the recorded target. Actual Live is not recorded; confirm the current position.`, overdueDays: Math.abs(days) };
  return { kind: "PLANNED" as const, label: days === 0 ? "Target today" : "Planned", detail: days === 0 ? "Recorded target falls on the review cutoff." : `${days} days until the recorded target.`, overdueDays: null };
}

export function targetHistory(events: DeliveryEvent[], workspaceId: string, initiativeId: string) {
  return events.filter(event => event.workspaceId === workspaceId && event.initiativeId === initiativeId && event.after.kind === "TARGET_LIVE")
    .sort((a,b) => a.occurredAt.localeCompare(b.occurredAt) || a.after.revision-b.after.revision);
}

export function targetMovements(events: DeliveryEvent[], workspaceId: string, initiativeId: string) {
  const latestScope=events.filter(event=>event.workspaceId===workspaceId&&event.initiativeId===initiativeId&&event.after.kind==="SCOPE"&&event.before?.value.text!==event.after.value.text).sort((a,b)=>a.occurredAt.localeCompare(b.occurredAt)).at(-1);
  return targetHistory(events,workspaceId,initiativeId).filter(event => (!latestScope || event.occurredAt>=latestScope.occurredAt) && event.before?.state==="SET" && event.after.state==="SET" && event.before.value.date && event.after.value.date && event.before.value.date !== event.after.value.date);
}

export function timelinePosition(date: string, start: string, end: string): number {
  return Math.max(0,Math.min(100,dayDifference(start,date)/Math.max(1,dayDifference(start,end))*100));
}
