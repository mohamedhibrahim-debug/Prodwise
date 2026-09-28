import { ButtonLink } from "@/components/primitives/Button";
import styles from "./not-found.module.css";

export default function NotFound() {
  return (
    <div className={styles.page}>
      <p className={styles.label}>Not found</p>
      <h1 className={styles.title}>This page could not be found.</h1>
      <p className={styles.body}>
        The link may be incorrect or out of date. Nothing was changed.
      </p>
      <div className={styles.actions}>
        <ButtonLink href="/" variant="primary">
          Go to Home
        </ButtonLink>
        <ButtonLink href="/initiatives" variant="secondary">
          Initiatives
        </ButtonLink>
      </div>
    </div>
  );
}
