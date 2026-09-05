import type { AssessmentState } from "@/lib/domain/types";
import { STATE_LABEL } from "@/lib/domain/labels";
import styles from "./StatePill.module.css";

interface StatePillProps {
  state: AssessmentState;
  size?: "sm" | "lg";
}

/**
 * The semantic status badge. Colour is always paired with the text label, so
 * meaning survives without colour and stays legible independently of branding.
 */
export function StatePill({ state, size = "sm" }: StatePillProps) {
  return (
    <span
      className={`${styles.pill} ${styles[state]} ${size === "lg" ? styles.lg : ""}`}
    >
      <span className={styles.dot} aria-hidden="true" />
      {STATE_LABEL[state]}
    </span>
  );
}
