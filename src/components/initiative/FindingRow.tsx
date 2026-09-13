import Link from "next/link";

import { CategoryTag, Reference, Timestamp } from "@/components/primitives/Meta";
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
 * One derived review finding.
 *
 * The type chip leads, because with no severity it is what tells a reader what
 * kind of thing this is. There is deliberately no severity mark: Slice 1
 * findings carry none, and an empty or "unrated" chip would still occupy the
 * severity slot and be read as the bottom of a scale.
 *
 * A conflict is presented as a comparison of the recorded claims, with neither
 * side emphasised and no positional language — no "current" or "original",
 * because the engine knows nothing about chronology. Claims are ordered by id,
 * the same order the fingerprint uses, so position never implies precedence.
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
  const isSuperseded = finding.type === "SUPERSEDED";
  const resolved = finding.status === "RESOLVED";

  return (
    <li className={`${styles.row} ${isSuperseded ? styles.history : ""}`}>
      <details className={styles.disclosure} open={!isSuperseded && !resolved}>
        <summary className={styles.summary}>
          <span className={styles.chevron} aria-hidden="true">
            <svg viewBox="0 0 12 12" width="10" height="10">
              <path
                d="M4 2l4 4-4 4"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>

          <span className={styles.main}>
            <span className={styles.head}>
              <CategoryTag>{FINDING_LABEL[finding.type]}</CategoryTag>
              <h3 className={styles.title}>{finding.title}</h3>
              {resolved ? (
                <span className={styles.resolvedTag}>Resolved</span>
              ) : null}
            </span>

            {/* Domains are quiet metadata, not chips: the row already carries a
                neutral chip, and a reader cannot tell "Conflict" from "Finance"
                when both render the same way. Order is canonical and carries no
                meaning — no domain here is the primary one. */}
            <span className={styles.facts}>
              {finding.domains.length > 0 ? (
                <span className={styles.fact}>
                  Domain{" "}
                  {finding.domains.map((d, i) => (
                    <span key={d}>
                      {i > 0 ? <span className={styles.sep}> · </span> : null}
                      <b>{DOMAIN_LABEL[d] ?? d}</b>
                    </span>
                  ))}
                </span>
              ) : null}
              {finding.phase ? (
                <span className={styles.fact}>
                  Phase <b>{finding.phase}</b>
                </span>
              ) : null}
              <span className={styles.fact}>
                {/* Not "Detected": nothing detects anything at a moment in
                    time. Findings are derived on every read, so the only real
                    date here is when the underlying claims last changed. */}
                <Timestamp iso={finding.detectedOn} prefix="Claims last changed" />
              </span>
            </span>
          </span>
        </summary>

        <div className={styles.body}>
          <p className={styles.explanation}>{finding.explanation}</p>

          <div className={styles.compare}>
            {finding.claims.map((claim, i) => (
              <ClaimSide
                key={claim.claimId}
                claim={claim}
                slug={slug}
                /* Only supersession has a direction to show. Its members are
                   built as [replaced, replacement], so the order is meaningful
                   — unlike a conflict, where neither claim outranks the other
                   and labelling a side would invent a winner. */
                eyebrow={
                  isSuperseded
                    ? i === 0
                      ? "Replaced value"
                      : "Replacement"
                    : undefined
                }
              />
            ))}
          </div>

          {finding.type === "CONFLICT" ? (
            <p className={styles.caption}>
              Prodwise has not determined which value is correct.
            </p>
          ) : null}

          <p className={styles.reason}>
            <span className={styles.reasonLabel}>Why this was raised</span>
            {finding.reason}
          </p>

          {resolved ? (
            <div className={styles.resolution}>
              <p className={styles.resolutionNote}>
                {/* A resolution is a person's decision about the finding, not a
                    change to the data. Saying so stops "Resolved" being read as
                    "the claims were fixed". */}
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
          ) : finding.resolution ? (
            <div className={styles.resolution}>
              <p className={styles.resolutionNote}>
                {/* The C4 case: this was resolved, then a source claim changed,
                    so the decision no longer describes what is on screen. It
                    reopens rather than standing — and the note is kept. */}
                This was marked resolved earlier, but the claims behind it have
                changed since, so it is open again. The earlier note was:
              </p>
              <p className={styles.resolutionText}>{finding.resolution}</p>
            </div>
          ) : null}

          {finding.actionable && canResolve ? (
            <ResolveFindingForm
              slug={slug}
              fingerprint={finding.fingerprint}
              contentDigest={finding.contentDigest}
              resolved={resolved}
            />
          ) : null}
        </div>
      </details>
    </li>
  );
}

/**
 * One claim in the comparison.
 *
 * Led by the evidence reference rather than the subject or attribute — those
 * are identical across every claim in a conflict by construction, so repeating
 * them says nothing. The reference is what answers "where did this value come
 * from", and it keeps each block self-identifying when they stack on mobile.
 */
function ClaimSide({
  claim,
  slug,
  eyebrow,
}: {
  claim: FindingClaimRef;
  slug: string;
  eyebrow?: string;
}) {
  /* EXCLUDED evidence is not cited as the reference behind a value. The link is
     kept and shown in the list below, tagged — but a record a person removed
     from the boundary must not head the column as if it still backed this. */
  const included = claim.evidence.filter((e) => e.boundary !== "EXCLUDED");
  const primaryRef = included.find((e) => e.sourceReference)?.sourceReference;
  const hasExcludedRef =
    !primaryRef && claim.evidence.some((e) => e.sourceReference);

  return (
    <div className={styles.side}>
      {eyebrow ? <div className={styles.eyebrow}>{eyebrow}</div> : null}
      <div className={styles.sideLabel}>
        {primaryRef ? (
          <Reference>{primaryRef}</Reference>
        ) : hasExcludedRef ? (
          "No included reference"
        ) : (
          /* Never a non-identifier: two unreferenced claims would otherwise
             render identical columns with no way to tell them apart. */
          <span className={styles.claimIdLabel}>
            Claim {claim.claimId.slice(0, 8)}
          </span>
        )}
      </div>

      <p className={styles.sideValue}>{claim.value}</p>

      <div className={styles.sideFacts}>
        <span>{CLAIM_STATUS_LABEL[claim.status]}</span>
        <span className={styles.sep}>·</span>
        <span>{CLAIM_TYPE_LABEL[claim.type]}</span>
        <span className={styles.sep}>·</span>
        <span>{DOMAIN_LABEL[claim.domain] ?? claim.domain}</span>
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
        <ul className={styles.evidenceList}>
          {claim.evidence.map((e) => (
            <li key={e.evidenceId} className={styles.evidenceItem}>
              <span className={styles.evidenceTitle}>{e.title}</span>
              <span className={styles.evidenceMeta}>
                {e.sourceReference ? (
                  <>
                    <Reference>{e.sourceReference}</Reference>
                    <span className={styles.sep}>·</span>
                  </>
                ) : null}
                <span
                  className={
                    e.boundary === "EXCLUDED"
                      ? styles.excludedTag
                      : styles.boundaryTag
                  }
                >
                  {EVIDENCE_RELATION_LABEL[e.boundary]}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}

      {/* Anchored to the claim itself. Landing on a 14-row list and hunting by
          eye would break the traceability this whole page exists for — and two
          columns emitting an identical link give a screen reader no way to
          choose between them, so the label carries the reference too. */}
      <Link
        href={`/initiatives/${slug}/memory?view=claims#claim-${claim.claimId}`}
        className={styles.claimLink}
      >
        Open {primaryRef ?? "this claim"} in Product Memory →
      </Link>
    </div>
  );
}
