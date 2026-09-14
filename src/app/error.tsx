"use client";

import { useEffect } from "react";
import styles from "./error.module.css";

/**
 * Segment error boundary.
 *
 * Without one, a single failed read takes the whole page to Next.js's raw
 * "A server error occurred" screen — which tells a visitor nothing, and tells
 * a Product Manager nothing either.
 *
 * Every repository method throws when its backend call fails, and those calls
 * cross a network: a slow or saturated database is an ordinary, temporary
 * condition, not a bug in the page. So it is caught here and reported as what
 * it is — Prodwise could not reach its data — with a way to try again.
 *
 * Deliberately honest about the limits of what is known: this says the data
 * could not be loaded, never that the data does not exist. An initiative whose
 * evidence could not be fetched is not an initiative without evidence
 * (CLAUDE.md Rule 4).
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surfaced in the server/browser log so a real failure is diagnosable
    // rather than reduced to an opaque digest.
    console.error("[prodwise] render failed:", error);
  }, [error]);

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>This page could not be loaded</h1>
      <p className={styles.body}>
        Prodwise could not reach its data just now. Nothing has been changed,
        and nothing shown elsewhere in the product is affected.
      </p>
      <p className={styles.body}>
        This is a problem loading the page, not a statement about the
        initiative: it does not mean there is no evidence, no product memory or
        nothing to review.
      </p>

      <button type="button" onClick={reset} className={styles.retry}>
        Try again
      </button>

      {error.digest ? (
        <p className={styles.digest}>Reference {error.digest}</p>
      ) : null}
    </div>
  );
}
