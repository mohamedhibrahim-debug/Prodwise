import { ButtonLink } from "@/components/primitives/Button";
import styles from "@/app/not-found.module.css";

/**
 * Deliberately does not say whether an initiative exists elsewhere: an initiative
 * in another organization and a mistyped link look exactly the same.
 */
export default function InitiativeNotFound() {
  return <div className={styles.page}>
    <p className={styles.label}>Not available</p>
    <h1 className={styles.title}>This initiative isn’t available in your current organization.</h1>
    <p className={styles.body}>The link may be incorrect, or it may belong to another organization — switch organization from the menu if you have access there. Archived initiatives stay available from Initiatives → Archived.</p>
    <div className={styles.actions}><ButtonLink href="/initiatives" variant="primary">Back to Initiatives</ButtonLink></div>
  </div>;
}
