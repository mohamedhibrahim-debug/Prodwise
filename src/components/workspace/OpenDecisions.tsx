import Link from "next/link";

import { EmptyState } from "@/components/primitives/EmptyState";
import { DOMAIN_LABEL, FINDING_LABEL } from "@/lib/domain/labels";
import type { ReviewFinding } from "@/lib/domain/types";
import styles from "./OpenDecisions.module.css";

/**
 * A preview of the decision queue on Status: the open findings, each reduced
 * to its question and its recorded values. No ranking — the engine assigns
 * none — so the order is the engine's own deterministic order.
 */
export function OpenDecisions({
  findings,
  slug,
  limit = 3,
}: {
  findings: ReviewFinding[];
  slug: string;
  limit?: number;
}) {
  const href = `/initiatives/${slug}/decisions#lane-needs-decision`;

  if (findings.length === 0) {
    return (
      <EmptyState
        message="Nothing is waiting on you."
        hint="Only conflicts and supersessions are checked. Gaps, unknowns and risks are not detected yet, so this is not an all-clear."
        inset
      />
    );
  }

  return (
    <>
      <ol className={styles.queue}>
        {findings.slice(0, limit).map((f) => (
          <li key={f.fingerprint} className={styles.item}>
            <Link href={href} className={styles.link}>
              <span className={styles.kind}>{FINDING_LABEL[f.type]}</span>
              <span className={styles.title}>{f.title}</span>
              <span className={styles.values} aria-label={f.claims.map(c => c.value).join(" compared with ")}>
                {f.claims.map(c => <span key={c.claimId} className={styles.value}>{c.value}</span>).reduce<React.ReactNode[]>((all, node, index) => index ? [...all, <span key={`delta-${index}`} className={styles.vs} aria-hidden="true">≠</span>, node] : [node], [])}
              </span>
              <span className={styles.facts}>
                {f.domains.map((d) => DOMAIN_LABEL[d] ?? d).join(" · ")}
                {f.phase ? ` · ${f.phase}` : ""}
              </span>
            </Link>
          </li>
        ))}
      </ol>
      <p className={styles.quiet}>No additional items are waiting under the current rules.</p>
      {findings.length > limit ? (
        <Link href={href} className={styles.more}>
          {findings.length - limit} more in Decisions →
        </Link>
      ) : null}
    </>
  );
}
