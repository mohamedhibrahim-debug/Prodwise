/** Safe copy shared by server actions and client-side validation. */
export const STALE_DECISION_MESSAGE = "This changed while you were reviewing it. Reload and review the latest values.";
export const CHOOSE_EXISTING_MESSAGE = "This matches an existing value. Choose the existing value instead.";

export function decisionError(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  const messages: Record<string, string> = {
    FINDING_STALE: STALE_DECISION_MESSAGE,
    CLAIM_STALE: STALE_DECISION_MESSAGE,
    DECISION_STANDING: "This decision is already recorded. Reload to see the latest values.",
    DECISION_NOT_REOPENABLE: "A recorded decision cannot be reopened. New mismatches can be reviewed when values differ again.",
    CHOOSE_EXISTING_VALUE: CHOOSE_EXISTING_MESSAGE,
    INVALID_CONFIRMER: "Enter a name or team between 1 and 120 characters.",
    DECISION_IMMUTABLE: "A note cannot replace a recorded decision. Reload to see the decision record.",
    RATIONALE_REQUIRED: "Explain why you are making this decision.",
    DECISION_DOMAIN_REQUIRED: "Choose a domain for the corrected value.",
    INVALID_DECISION_SHAPE: "Select an existing value or enter a corrected value and a rationale.",
    CHOSEN_CLAIM_NOT_MEMBER: STALE_DECISION_MESSAGE,
    WRITE_DISABLED: "Demo mode — changes are disabled in the public version.",
  };
  for (const [code, copy] of Object.entries(messages)) {
    if (new RegExp(`\\b${code}\\b`).test(message)) return copy;
  }
  return "Could not save this change. Reload and try again.";
}

export interface DecisionFormState {
  error: string | null;
  saved?: boolean;
}
