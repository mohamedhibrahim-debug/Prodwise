import styles from "./EmptyState.module.css";

/**
 * Empty states carry the product's honesty. The wording distinguishes what the
 * system does not know from what does not exist — absence of evidence is never
 * reported as evidence of absence. Never "everything is perfect".
 *
 * The canonical strings live in EMPTY below so the language stays consistent.
 */
export const EMPTY = {
  evidence: "No related evidence has been confirmed yet.",
  findings:
    "No material review issues were detected in the currently connected evidence.",
  readiness: "Not enough evidence is available to assess this domain.",
  memory: "No structured product memory has been extracted yet.",
  attention:
    "Nothing currently requires your attention in the connected evidence.",
  action:
    "No next best action can be recommended until evidence has been connected.",
  domains:
    "No domains can be assessed yet, because no evidence has been connected.",
  activity: "No activity has been recorded for this initiative yet.",
} as const;

interface EmptyStateProps {
  message: string;
  hint?: string;
  inset?: boolean;
}

export function EmptyState({ message, hint, inset }: EmptyStateProps) {
  return (
    <div className={`${styles.empty} ${inset ? styles.inset : ""}`}>
      <p className={styles.message}>{message}</p>
      {hint ? <p className={styles.hint}>{hint}</p> : null}
    </div>
  );
}
