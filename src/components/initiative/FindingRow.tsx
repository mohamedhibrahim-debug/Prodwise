import Link from "next/link";

import { Reference, Timestamp } from "@/components/primitives/Meta";
import {
  CLAIM_STATUS_LABEL,
  CLAIM_TYPE_LABEL,
  DOMAIN_LABEL,
  EVIDENCE_RELATION_LABEL,
  FINDING_LABEL,
  formatDateTime,
} from "@/lib/domain/labels";
import type { FindingClaimRef, ReviewFinding, ClaimWithEvidence } from "@/lib/domain/types";
import { trustLine } from "@/lib/domain/trust";
import { MISMATCH_WHY_RAISED } from "@/lib/workspace/copy";
import { ResolveFindingForm } from "./ResolveFindingForm";
import { DecideConflictForm, ConfirmerForm } from "./DecideConflictForm";
import styles from "./FindingRow.module.css";

/**
 * A finding renders as one of two shapes, because a conflict and a supersession
 * are not the same kind of thing and should never look alike.
 *
 * A conflict is an open question — two recorded values, neither endorsed — and
 * it is the loudest thing in the content area. A supersession is settled
 * history, and it reads as one quiet line.
 *
 * Neither shape invents severity. A conflict earns its prominence from the
 * values themselves being set at scale, not from a colour ramp or a rank the
 * engine never produced.
 */
export function FindingRow({
  finding,
  slug,
  canResolve,
  previousConfirmedWith,
  records,
}: {
  finding: ReviewFinding;
  slug: string;
  canResolve: boolean;
  previousConfirmedWith?: string | null;
  records?: ClaimWithEvidence[];
}) {
  return finding.type === "SUPERSEDED" ? (
    <SupersededRow finding={finding} slug={slug} />
  ) : (
    <ConflictRow finding={finding} slug={slug} canResolve={canResolve} previousConfirmedWith={previousConfirmedWith} records={records} />
  );
}

/** Shared disclosure. Proof stays one interaction away, never in the path. */
function WhyRaised({
  finding,
  className,
}: {
  finding: ReviewFinding;
  className?: string;
}) {
  const explanation = finding.type === "CONFLICT" ? MISMATCH_WHY_RAISED : finding.explanation
    .replace(/\bclaims\b/gi, "Knowledge entries")
    .replace(/\bclaim\b/gi, "Knowledge entry")
    .replace(/\bsuperseded\b/gi, "replaced")
    .replace(/\bactive\b/gi, "Confirmed")
    .replace(/\bevidence\b/gi, "sources");
  return (
    <details className={`${styles.why} ${className ?? ""}`}>
      <summary className={styles.whySummary}>
        <span className={styles.whyChevron} aria-hidden="true">
          <svg viewBox="0 0 12 12" width="9" height="9">
            <path
              d="M4 2l4 4-4 4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        Why raised
      </summary>
      <div className={styles.whyBody}>
        <p>{explanation}</p>
      </div>
    </details>
  );
}

/* ── Conflict ─────────────────────────────────────────────────────────────── */

function ConflictRow({
  finding,
  slug,
  canResolve,
  previousConfirmedWith,
  records,
}: {
  finding: ReviewFinding;
  slug: string;
  canResolve: boolean;
  previousConfirmedWith?: string | null;
  records?: ClaimWithEvidence[];
}) {
  const resolved = finding.status === "RESOLVED";

  return (
    <li id={`item-${finding.fingerprint}`} tabIndex={-1} className={`${styles.conflict} ${resolved ? styles.settled : ""}`}>
      <div className={styles.comparisonPanel}>
      <div className={styles.head}>
        <span className={styles.kindLabel}>{FINDING_LABEL[finding.type]}</span>
        {resolved ? (
          <span className={styles.resolvedTag}>Reviewed — note only</span>
        ) : (
          <span className={styles.needsDecision}>Needs a decision</span>
        )}
        <span className={styles.headMeta}>
          <Timestamp iso={finding.detectedOn} prefix="entries changed" />
        </span>
      </div>

      <h3 className={styles.title}>{finding.title}</h3>

      <p className={styles.facts}>
        {finding.domains.map((d, i) => (
          <span key={d}>
            {i > 0 ? <span className={styles.sep}> · </span> : null}
            {DOMAIN_LABEL[d] ?? d}
          </span>
        ))}
        {finding.phase ? (
          <>
            <span className={styles.sep}> · </span>
            {finding.phase}
          </>
        ) : null}
      </p>

      {/* The comparison — two answers to one question, and the reason the
          finding exists, so the values carry the weight rather than the chrome. */}
      <div className={styles.compare}>
        {finding.claims.map((claim, i) => (
          <div key={claim.claimId} className={styles.side}>
            {i > 0 ? (
              <span className={styles.versus} aria-hidden="true">
                vs
              </span>
            ) : null}
            <ClaimColumn claim={claim} slug={slug} record={records?.find(record => record.id === claim.claimId)} />
          </div>
        ))}
      </div>

      <p className={styles.caption}>
        Values differ. Review the sources before making a decision.
      </p>

      {/* Proof and decision on one row: the two things a reader can do with a
          finding, together, rather than at opposite ends of a long column. */}
      <div className={styles.actions}>
        <WhyRaised finding={finding} />
      </div>

      {finding.previousDecision ? <details id={`decision-${finding.fingerprint}`} className={styles.decisionForm}>
        <summary className={styles.resolveTrigger}>Decided before</summary>
        <p className={styles.resolveCaption}>Values differ again. The previous decision remains part of the record.</p>
        <p>{finding.previousDecision.outcome === "CHOSE_EXISTING" ? "Chosen value" : "Corrected value"}: {finding.previousDecision.decidedValue}</p>
        <p>{finding.previousDecision.rationale}</p>
        <p>Confirmed with: {previousConfirmedWith ?? "Not recorded"}</p>
        <p>{formatDateTime(finding.previousDecision.decidedAt)} UTC</p>
      </details> : null}
      <ResolutionNote finding={finding} />
      </div>
      {finding.actionable ? <aside className={styles.decisionPanel} aria-label="Decision controls">
      <div className={styles.panelHeading}><span>Your decision</span><h3>{resolved ? "Review record" : "Record a decision"}</h3></div>
      {finding.actionable && !resolved ? <>
        {finding.confirmerLabel ? <p className={styles.facts}>Confirm with: {finding.confirmerLabel}</p> : null}
        {canResolve ? <>
          <ConfirmerForm key={finding.confirmerLabel ?? "unassigned"} finding={finding} slug={slug} />
          <DecideConflictForm finding={finding} slug={slug} />
        </> : <p className={styles.caption}>Changes are disabled in this environment. Review the values and their sources.</p>}
      </> : null}

      {finding.actionable && canResolve && !finding.previousDecision ? (
        <ResolveFindingForm slug={slug} fingerprint={finding.fingerprint}
          contentDigest={finding.contentDigest} resolved={resolved} />
      ) : null}

      </aside> : null}
    </li>
  );
}

/**
 * One side of the comparison.
 *
 * The value leads at scale, and its provenance hangs beneath it on a hairline —
 * traceability as adjacency rather than as a separate metadata block. Neither
 * side is emphasised and neither is labelled "current" or "original": the
 * engine knows nothing about chronology, so the layout must not imply it.
 */
function ClaimColumn({ claim, slug, record }: { claim: FindingClaimRef; slug: string; record?: ClaimWithEvidence }) {
  /* EXCLUDED evidence is not cited as the reference behind a value. The link is
     kept and listed below, tagged — but a record a person removed from the
     boundary must not head the column as if it still backed this. */
  const included = claim.evidence.filter((e) => e.boundary !== "EXCLUDED");
  const primaryRef = included.find((e) => e.sourceReference)?.sourceReference;
  const hasExcludedRef =
    !primaryRef && claim.evidence.some((e) => e.sourceReference);

  return (
    <div className={styles.column}>
      <p className={styles.value}>{claim.value}</p>

      <div className={styles.provenance}>
        <div className={styles.provenanceTop}>
          {primaryRef ? (
            <Reference>Source: {primaryRef}</Reference>
          ) : hasExcludedRef ? (
            <span className={styles.noRef}>No included reference</span>
          ) : (
            /* Never a non-identifier: two unreferenced claims would otherwise
               render identical columns with no way to tell them apart. */
            <span className={styles.claimId}>
              Knowledge entry
            </span>
          )}
          <span className={styles.claimFacts}>
            {CLAIM_STATUS_LABEL[claim.status]}
            <span className={styles.sep}> · </span>
            {CLAIM_TYPE_LABEL[claim.type]}
            <span className={styles.sep}> · </span>
            {DOMAIN_LABEL[claim.domain] ?? claim.domain}
          </span>
        </div>

        {/* Always rendered, never collapsed. A claim with nothing linked must
            visibly stay a claim with nothing linked: "not checked" is not the
            same as "there is none", and silence would imply support exists. */}
        {claim.evidence.length === 0 ? (
          <p className={styles.noEvidence}>
            No source linked
            <span className={styles.noEvidenceHint}>
              {" "}
              — not checked, and not proof that none exists
            </span>
          </p>
        ) : (
          <ul className={styles.evidence}>
            {claim.evidence.map((e) => (
              <li key={e.evidenceId} className={styles.evidenceItem}>
                <Link href={`/initiatives/${slug}/knowledge/sources#source-${e.evidenceId}`} className={styles.evidenceTitle}>{e.title} →</Link>
                {record?.evidence.find(source => source.id === e.evidenceId)?.contentSummary ? <p className={styles.sourceSummary}>{record.evidence.find(source => source.id === e.evidenceId)!.contentSummary}</p> : null}
                <span
                  className={
                    e.boundary === "EXCLUDED"
                      ? styles.excludedTag
                      : styles.boundaryTag
                  }
                >
                  {EVIDENCE_RELATION_LABEL[e.boundary]}
                </span>
              </li>
            ))}
          </ul>
        )}

        <Link
          href={`/initiatives/${slug}/knowledge?view=all#claim-${claim.claimId}`}
          className={styles.claimLink}
        >
          Open {primaryRef ?? "this entry"} in Knowledge →
        </Link>
      </div>
      {record && trustLine(record) ? <p className={styles.trust}>{trustLine(record)}</p> : null}
    </div>
  );
}

/* ── Supersession ─────────────────────────────────────────────────────────── */

/**
 * Settled history, rendered as lineage: the replaced value, an arrow, the
 * replacement. One line, no comparison grid, no alarm colour, no left spine —
 * because nothing here is waiting on anyone.
 */
function SupersededRow({
  finding,
  slug,
}: {
  finding: ReviewFinding;
  slug: string;
}) {
  const [replaced, replacement] = finding.claims;

  return (
    <li id={`item-${finding.fingerprint}`} tabIndex={-1} className={styles.lineage}>
      <div className={styles.lineageHead}>
        <span className={styles.lineageKind}>Replaced</span>
        <h3 className={styles.lineageTitle}>{finding.title}</h3>
        <span className={styles.lineageDate}>
          <Timestamp iso={finding.detectedOn} />
        </span>
      </div>

      <p className={styles.lineageValues}>
        <s className={styles.wasValue}>{replaced?.value}</s>
        {replacement ? (
          <>
            <span className={styles.arrow}>replaced by</span>
            <span className={styles.nowValue}>{replacement.value}</span>
          </>
        ) : (
          /* Not "no replacement recorded": a pointer can exist and resolve
             outside this initiative, and the engine deliberately refuses to
             report that as absence. This wording is true in both cases; the
             three-case detail stays in "Why this was raised". */
          <span className={styles.noReplacement}>
            no replacement recorded on this initiative
          </span>
        )}
      </p>

      <WhyRaised finding={finding} className={styles.lineageWhy} />

      {replaced ? (
        <Link
          href={`/initiatives/${slug}/knowledge?view=replaced#claim-${replaced.claimId}`}
          className={styles.claimLink}
        >
          Open in Knowledge →
        </Link>
      ) : null}
    </li>
  );
}

/* ── Shared ───────────────────────────────────────────────────────────────── */

function ResolutionNote({ finding }: { finding: ReviewFinding }) {
  if (finding.status === "RESOLVED") {
    return (
      <div className={styles.resolution}>
        <p className={styles.resolutionNote}>
          {/* A resolution is a person's decision about the finding, not a change
              to the data. Saying so stops "Resolved" reading as "fixed". */}
          Reviewed — note only
          {finding.resolvedAt ? (
            <>
              {" "}
              on <Timestamp iso={finding.resolvedAt} />
            </>
          ) : null}
          . Knowledge was not changed.
        </p>
        <p className={styles.resolutionText}>{finding.resolution}</p>
      </div>
    );
  }

  if (!finding.resolution) return null;

  return (
    <div className={styles.resolution}>
      <p className={styles.resolutionNote}>
        {/* Resolved earlier, then a source claim changed — so the decision no
            longer describes what is on screen. It reopens, and the note stays. */}
        This was marked resolved earlier, but the Knowledge entries behind it have changed
        since, so it is open again. The earlier note was:
      </p>
      <p className={styles.resolutionText}>{finding.resolution}</p>
    </div>
  );
}
