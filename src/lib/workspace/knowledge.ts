import { normalise } from "../review/normalise.ts";
import type { FindingState, MemoryClaim } from "../domain/types.ts";

export interface KnowledgeValueGroup {
  subject: string;
  attribute: string;
  phase: string | null;
  value: string;
  entries: MemoryClaim[];
}

/** Keep phase in the address; identical values in different phases are distinct facts. */
export function groupKnowledge(claims: MemoryClaim[]): KnowledgeValueGroup[] {
  const groups = new Map<string, KnowledgeValueGroup>();
  for (const entry of claims) {
    const key = JSON.stringify([entry.subject, entry.attribute, entry.phase, normalise(entry.value)]);
    const group = groups.get(key);
    if (group) group.entries.push(entry);
    else groups.set(key, { subject: entry.subject, attribute: entry.attribute,
      phase: entry.phase, value: entry.value, entries: [entry] });
  }
  return [...groups.values()];
}

export function decisionMarkers(entry: MemoryClaim, states: FindingState[]) {
  const markers = states.filter((state) => state.outcome &&
    (state.chosenClaimId === entry.id || state.decisionClaimId === entry.id))
    .map((state) => ({
      fingerprint: state.fingerprint as string | null,
      label: state.outcome === "CHOSE_EXISTING" ? "Chosen in a decision" :
        "Set by decision · Entered as a corrected value",
      resolvedAt: state.resolvedAt,
    }));
  if (entry.origin === "HUMAN_DECISION" && !markers.some((marker) => marker.label.startsWith("Set by decision")))
    markers.push({ fingerprint: null, label: "Set by decision · Entered as a corrected value",
      resolvedAt: entry.createdAt });
  return markers;
}

export function replacementLineage(entry: MemoryClaim, all: MemoryClaim[]) {
  return {
    replacedBy: all.find((candidate) => candidate.id === entry.supersededByClaimId) ?? null,
    replaces: all.filter((candidate) => candidate.supersededByClaimId === entry.id),
  };
}
