export const DECISION_LANES = [
  { key: "needs-decision", title: "Needs a decision", description: "Mismatches where current values differ." },
  { key: "reviewed", title: "Reviewed", description: "Reviewed — note only. Knowledge was not changed." },
  { key: "resolved", title: "Resolved", description: "Decisions that changed Knowledge." },
  { key: "history", title: "History", description: "Replaced information kept for history. Nothing here is an open task." },
  { key: "not-checked", title: "Not checked yet", description: "Gaps, unknowns, and risks are not checked here yet." },
] as const;

export type DecisionLaneKey = (typeof DECISION_LANES)[number]["key"];
