import type { ReactNode } from "react";
import styles from "./Section.module.css";

interface SectionProps {
  title: string;
  /** Two-digit marker, e.g. "01". Borrowed from the deck's section numbering. */
  numeral?: string;
  description?: string;
  aside?: ReactNode;
  children: ReactNode;
}

/**
 * A page section separated by a hairline rule rather than wrapped in a card.
 * This is the mechanism that keeps the workspace free of nested cards.
 */
export function Section({
  title,
  numeral,
  description,
  aside,
  children,
}: SectionProps) {
  return (
    <section className={styles.section}>
      <header className={styles.head}>
        <div className={styles.titleGroup}>
          {numeral ? (
            <span className={styles.numeral} aria-hidden="true">
              {numeral}
            </span>
          ) : null}
          <div>
            <h2 className={styles.title}>{title}</h2>
            {description ? (
              <p className={styles.description}>{description}</p>
            ) : null}
          </div>
        </div>
        {aside ? <div className={styles.aside}>{aside}</div> : null}
      </header>
      {children}
    </section>
  );
}
