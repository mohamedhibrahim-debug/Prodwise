import Link from "next/link";

import { Reference, Timestamp } from "@/components/primitives/Meta";
import {
  CLAIM_STATUS_LABEL,
  CLAIM_TYPE_LABEL,
  DOMAIN_LABEL,
  EVIDENCE_RELATION_LABEL,
  FINDING_LABEL,
} from "@/lib/domain/labels";
import type { FindingClaimRef, ReviewFinding } from "@/lib/domain/types";
import { ResolveFindingForm } from "./ResolveFindingForm";
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
}: {
  finding: ReviewFinding;
  slug: string;
  canResolve: boolean;
}) {
  return finding.type === "SUPERSEDED" ? (
    <SupersededRow finding={finding} slug={slug} />
  ) : (
    <ConflictRow finding={finding} slug={slug} canResolve={canResolve} />
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
        Why this was raised
      </summary>
      <div className={styles.whyBody}>
        <p>{finding.explanation}</p>
        <p className={styles.rule}>{finding.reason}</p>
      </div>
    </details>
  );
}

/* ── Conflict ─────────────────────────────────────────────────────────────── */

function ConflictRow({
  finding,
  slug,
  canResolve,
}: {
  finding: ReviewFinding;
  slug: string;
  canResolve: boolean;
}) {
  const resolved = finding.status === "RESOLVED";

  return (
    <li className={`${styles.conflict} ${resolved ? styles.settled : ""}`}>
      <div className={styles.head}>
        <span className={styles.kindLabel}>{FINDING_LABEL[finding.type]}</span>
        {resolved ? (
          <span className={styles.resolvedTag}>Resolved</span>
        ) : (
          <span className={styles.needsDecision}>Needs a decision</span>
        )}
        <span className={styles.headMeta}>
          <Timestamp iso={finding.detectedOn} prefix="claims changed" />
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
            <ClaimColumn claim={claim} slug={slug} />
          </div>
        ))}
      </div>

      <p className={styles.caption}>
        Prodwise has not determined which value is correct.
      </p>

      {/* Proof and decision on one row: the two things a reader can do with a
          finding, together, rather than at opposite ends of a long column. */}
      <div className={styles.actions}>
        <WhyRaised finding={finding} />
        {finding.actionable && canResolve ? (
          <ResolveFindingForm
            slug={slug}
            fingerprint={finding.fingerprint}
            contentDigest={finding.contentDigest}
            resolved={resolved}
          />
        ) : null}
      </div>

      <ResolutionNote finding={finding} />
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
function ClaimColumn({ claim, slug }: { claim: FindingClaimRef; slug: string }) {
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
            <Reference>{primaryRef}</Reference>
          ) : hasExcludedRef ? (
            <span className={styles.noRef}>No included reference</span>
          ) : (
            /* Never a non-identifier: two unreferenced claims would otherwise
               render identical columns with no way to tell them apart. */
            <span className={styles.claimId}>
              Claim {claim.claimId.slice(0, 8)}
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
            No evidence linked
            <span className={styles.noEvidenceHint}>
              {" "}
              — not checked, and not proof that none exists
            </span>
          </p>
        ) : (
          <ul className={styles.evidence}>
            {claim.evidence.map((e) => (
              <li key={e.evidenceId} className={styles.evidenceItem}>
                <span className={styles.evidenceTitle}>{e.title}</span>
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
          href={`/initiatives/${slug}/memory?view=claims#claim-${claim.claimId}`}
          className={styles.claimLink}
        >
          Open {primaryRef ?? "this claim"} in Product Memory →
        </Link>
      </div>
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
    <li className={styles.lineage}>
      <div className={styles.lineageHead}>
        <span className={styles.lineageKind}>Superseded</span>
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
          href={`/initiatives/${slug}/memory?view=claims#claim-${replaced.claimId}`}
          className={styles.claimLink}
        >
          Open in Product Memory →
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
          Marked resolved by a person
          {finding.resolvedAt ? (
            <>
              {" "}
              on <Timestamp iso={finding.resolvedAt} />
            </>
          ) : null}
          . The claims still record what they record.
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
        This was marked resolved earlier, but the claims behind it have changed
        since, so it is open again. The earlier note was:
      </p>
      <p className={styles.resolutionText}>{finding.resolution}</p>
    </div>
  );
}
