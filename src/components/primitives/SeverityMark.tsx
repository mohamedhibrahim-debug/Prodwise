import type { Severity } from "@/lib/domain/types";
import { SEVERITY_LABEL } from "@/lib/domain/labels";
import styles from "./SeverityMark.module.css";

/**
 * Finding severity. Uses its own ramp, deliberately free of the brand orange
 * so severity can never be read as branding — or as assessment status.
 */
export function SeverityMark({ severity }: { severity: Severity }) {
  return (
    <span className={`${styles.mark} ${styles[severity]}`}>
      <span className={styles.bar} aria-hidden="true" />
      {SEVERITY_LABEL[severity]}
    </span>
  );
}
