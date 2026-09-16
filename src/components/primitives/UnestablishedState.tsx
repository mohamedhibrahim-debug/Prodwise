import styles from "./UnestablishedState.module.css";

/** Readiness and derived Current State are not implemented in this slice. */
export function UnestablishedState() {
  return <span className={styles.state}>Status not established</span>;
}
