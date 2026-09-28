import { ButtonLink } from "@/components/primitives/Button";
import styles from "@/app/not-found.module.css";

/**
 * Deliberately does not say whether something exists elsewhere: a record in another
 * organization and a mistyped link look exactly the same.
 */
export function NotAvailable({ kind }: { kind: "initiative" | "record" | "page" }) {
  if (kind === "page") return <div className={styles.page}>
    <p className={styles.label}>Not found</p>
    <h1 className={styles.title}>This page could not be found.</h1>
    <p className={styles.body}>The link may be incorrect or out of date. Nothing was changed.</p>
    <div className={styles.actions}><ButtonLink href="/" variant="primary">Go to Home</ButtonLink><ButtonLink href="/initiatives" variant="secondary">Initiatives</ButtonLink></div>
  </div>;
  const initiative = kind === "initiative";
  return <div className={styles.page}>
    <p className={styles.label}>Not available</p>
    <h1 className={styles.title}>{initiative ? "This initiative isn’t available in your current organization." : "This record isn’t available in your current organization."}</h1>
    <p className={styles.body}>{initiative
      ? "The link may be incorrect, or it may belong to another organization — switch organization from the menu if you have access there. Archived initiatives stay available from Initiatives → Archived."
      : "The link may be incorrect, the record may belong to another organization, or it is not part of this initiative. Nothing was changed."}</p>
    <div className={styles.actions}><ButtonLink href="/initiatives" variant="primary">Back to Initiatives</ButtonLink></div>
  </div>;
}
