import type { ReactNode } from "react";
import styles from "./Section.module.css";

interface SectionProps {
  title: string;
  /** Two-digit marker, e.g. "01". Borrowed from the deck's section numbering. */
  numeral?: string;
  /**
   * Marker to show below 780px, where a section may be reordered. Supplied
   * only when the visual order differs from the desktop order, so the numerals
   * always count down the page as rendered.
   */
  mobileNumeral?: string;
  description?: string;
  aside?: ReactNode;
  /** Used to set a CSS `order` for responsive reordering. */
  className?: string;
  children: ReactNode;
}

/**
 * A page section separated by a hairline rule rather than wrapped in a card.
 * This is the mechanism that keeps the workspace free of nested cards.
 */
export function Section({
  title,
  numeral,
  mobileNumeral,
  description,
  aside,
  className,
  children,
}: SectionProps) {
  return (
    <section className={`${styles.section} ${className ?? ""}`}>
      <header className={styles.head}>
        <div className={styles.titleGroup}>
          {numeral ? (
            <span className={styles.numeral} aria-hidden="true">
              <span className={mobileNumeral ? styles.numDesktop : ""}>
                {numeral}
              </span>
              {mobileNumeral ? (
                <span className={styles.numMobile}>{mobileNumeral}</span>
              ) : null}
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
