import Link from "next/link";
import type { FindingState } from "@/lib/domain/types";
import { formatDateTime } from "@/lib/domain/labels";
import styles from "./FindingRow.module.css";

/** Read-only persisted decision; no assignment or legacy note controls. */
export function DecisionRecord({ state, slug }: { state: FindingState; slug: string }) {
  const claimId = state.chosenClaimId ?? state.decisionClaimId;
  return <li className={styles.conflict} id={`decision-${state.fingerprint}`}>
    <span className={styles.resolvedTag}>Decision record · Confirmed</span>
    <h3 className={styles.title}>{state.subject} · {state.attribute}</h3>
    {state.phase ? <p className={styles.facts}>{state.phase}</p> : null}
    <p className={styles.value}>{state.decidedValue}</p>
    <p className={styles.caption}>{state.outcome === "CHOSE_EXISTING" ? "Chose an existing value" : "Entered a corrected value"}</p>
    <p className={styles.resolutionText}>{state.resolution}</p>
    <p className={styles.facts}>Confirmed with: {state.confirmedWith ?? "Not recorded"}</p>
    <p className={styles.facts}>Recorded by {state.actorLabel ?? "Not recorded"}
      {state.resolvedAt ? ` · ${formatDateTime(state.resolvedAt)} UTC` : ""}</p>
    {claimId ? <Link className={styles.claimLink} href={`/initiatives/${slug}/memory?view=claims#claim-${claimId}`}>Open value in Knowledge →</Link> : null}
  </li>;
}
