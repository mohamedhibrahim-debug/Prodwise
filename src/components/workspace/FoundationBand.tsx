import Link from "next/link";

import { Timestamp } from "@/components/primitives/Meta";
import type { SetupFacts } from "@/lib/workspace/setup";
import styles from "./FoundationBand.module.css";

/**
 * The foundation band: what the initiative's picture currently rests on.
 *
 * Four real quantities, left to right in the order trust is built — artifacts,
 * memory, decisions, readiness. Every figure is a count of persisted records;
 * none is a score. Readiness is shown as not assessed because nothing assesses
 * it yet, and a blank would read as "fine".
 */
export function FoundationBand({
  facts,
  slug,
}: {
  facts: SetupFacts;
  slug: string;
}) {
  const base = `/initiatives/${slug}`;

  return (
    <section className={styles.band} aria-label="Foundation">
      <Link href={`${base}/sources`} className={styles.cell}>
        <span className={styles.label}>Artifacts</span>
        <span className={styles.figure}>{facts.evidenceTotal}</span>
        <span className={styles.caption}>
          {facts.evidenceInScope} in scope
        </span>
        <span className={styles.meta}>
          {facts.evidenceLastAddedAt ? (
            <Timestamp iso={facts.evidenceLastAddedAt} prefix="Last added" />
          ) : (
            "No evidence recorded"
          )}
        </span>
      </Link>

      <Link href={`${base}/memory`} className={styles.cell}>
        <span className={styles.label}>Memory</span>
        <span className={styles.figure}>{facts.claimsActive}</span>
        <span className={styles.caption}>active claims</span>
        <span className={styles.meta}>
          {facts.claimsUnverified} unverified · {facts.claimsSuperseded}{" "}
          superseded
        </span>
      </Link>

      <Link
        href={`${base}/decisions#lane-open`}
        className={styles.cell}
        data-attention={facts.decisionsOpen > 0 || undefined}
      >
        <span className={styles.label}>Decisions</span>
        <span className={styles.figure}>{facts.decisionsOpen}</span>
        <span className={styles.caption}>waiting on you</span>
        <span className={styles.meta}>
          Conflicts and supersessions only
        </span>
      </Link>

      <Link
        href={`${base}/readiness`}
        className={styles.cell}
        data-unassessed
      >
        <span className={styles.label}>Readiness</span>
        <span className={styles.notAssessed}>Not assessed</span>
        <span className={styles.meta}>Readiness criteria are not available yet</span>
      </Link>
    </section>
  );
}
