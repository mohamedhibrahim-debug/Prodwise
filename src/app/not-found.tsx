import { ButtonLink } from "@/components/primitives/Button";
import styles from "./not-found.module.css";

export default function NotFound() {
  return (
    <div className={styles.page}>
      <p className={styles.label}>Not found</p>
      <h1 className={styles.title}>This initiative could not be found.</h1>
      <p className={styles.body}>
        It may have been removed, or the link may be incorrect.
      </p>
      <div className={styles.actions}>
        <ButtonLink href="/initiatives" variant="primary">
          Back to Initiatives
        </ButtonLink>
      </div>
    </div>
  );
}
