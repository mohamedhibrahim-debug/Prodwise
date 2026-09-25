import styles from "./EmptyState.module.css";

/**
 * Empty states carry the product's honesty. The wording distinguishes what the
 * system does not know from what does not exist — absence of evidence is never
 * reported as evidence of absence. Never "everything is perfect".
 *
 * The canonical strings live in EMPTY below so the language stays consistent.
 */
export const EMPTY = {
  evidence: "No Sources have been recorded yet.",
  /**
   * Overview only. Review has its own strings below, because Review findings
   * are now derived from Product Memory rather than read from evidence, and
   * only two of the five finding types are detected at all.
   */
  findings:
    "No mismatches were raised from the current Knowledge entries.",
  /** Review, when the initiative has no claims to reason over. */
  reviewNoClaims:
    "No Knowledge entries have been recorded yet, so there is nothing to compare.",
  /** Review, when claims exist and neither rule matched. */
  reviewFindings:
    "No mismatches or replaced Knowledge entries were found.",
  /* Not "none has ever been resolved": a finding resolved earlier and reopened
     when its claims changed is not counted here, and the row itself says so. */
  reviewResolved: "No finding is currently marked resolved.",
  /** Review, when findings exist but none is waiting on anyone. */
  reviewNothingOpen: "Nothing in this initiative is waiting on you.",
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
