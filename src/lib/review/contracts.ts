/**
 * PHASE 4 CONTRACTS — SHAPES ONLY. NOTHING IMPLEMENTS THESE.
 *
 * Product State, Readiness and Next Best Action are still demo intelligence:
 * the Overview, Readiness and Reporting screens read hand-authored fixtures and
 * will keep doing so until a later phase. No code in Prodwise produces any type
 * in this file, and none of them is wired to a screen.
 *
 * They live here, quarantined in one clearly-labelled module rather than beside
 * the live domain types, for two reasons. Defining contracts before there is
 * behaviour is speculative generality, which CLAUDE.md §17 warns against — so
 * it should be easy to see, easy to rewrite, and easy to delete. And keeping
 * them out of domain/types.ts stops anyone importing one by accident and
 * assuming a reasoning engine exists behind it.
 *
 * When a phase does implement one, that phase owns redesigning it. Nothing here
 * is a commitment.
 */

import type {
  AssessmentState,
  Confidence,
  Domain,
  FindingEvidenceRef,
  Stage,
} from "../domain/types.ts";

/**
 * What an assessment rests on.
 *
 * Every future conclusion must be traceable to the records that produced it —
 * "why does the system believe this?" has to be answerable (CLAUDE.md §17). An
 * empty basis is meaningful: it means UNKNOWN, never READY.
 */
export interface StateBasis {
  claimIds: string[];
  evidenceIds: string[];
  /**
   * Findings are identified by fingerprint, which is only unique WITHIN an
   * initiative — the finding_states primary key is composite for exactly that
   * reason. So the initiative has to travel with it.
   */
  findings: { initiativeId: string; fingerprint: string }[];
}

/* ── Product State ────────────────────────────────────────────────────────── */

/**
 * The current evidence-backed state of an initiative.
 *
 * Multi-dimensional by design: an initiative can be technically complete and
 * commercially blocked at the same time, and a single status would erase that.
 */
export interface ProductStateAssessment {
  initiativeId: string;
  /** Lifecycle position. May move backward; this is not a wizard step. */
  stage: Stage;
  overall: AssessmentState;
  /**
   * ONLY domains there is a basis to assess. Rendering every possible domain
   * for every initiative would manufacture twelve opinions from nothing.
   */
  domains: DomainStateAssessment[];
  basis: StateBasis;
  evaluatedAt: string;
}

export interface DomainStateAssessment {
  domain: Domain;
  state: AssessmentState;
  /**
   * What is not known, stated as a gap in what was found — never as a negative
   * fact about the world. "No compliance approval was found in the connected
   * evidence", never "compliance approval is missing" (CLAUDE.md Rule 4).
   */
  unknowns: string[];
  basis: StateBasis;
}

/* ── Readiness ────────────────────────────────────────────────────────────── */

/**
 * Readiness for one domain.
 *
 * Exactly four states, and no others: READY · AT_RISK · BLOCKED · UNKNOWN.
 * Never a percentage, never a score, never a completion ratio. Factual gate
 * counts are acceptable; "83% ready" is not (CLAUDE.md §12, §13).
 *
 * Approval and readiness are not the same thing, and this shape must never be
 * collapsed into a checklist that implies they are.
 */
export interface ReadinessContract {
  domain: Domain;
  state: AssessmentState;
  evidenceSatisfied: ReadinessItem[];
  openIssues: ReadinessItem[];
  unknowns: ReadinessItem[];
  /** Prose. What would change this domain's state, not a tick-list. */
  whatWouldMakeThisReady: string;
  basis: StateBasis;
}

export interface ReadinessItem {
  statement: string;
  claimIds: string[];
  evidenceIds: string[];
}

/* ── Next Best Action ─────────────────────────────────────────────────────── */

/**
 * ONE recommended action — never a ranked backlog of five.
 *
 * Ranking, when it is implemented, is over findings: critical blocker →
 * mandatory unresolved unknown → high material risk → blocking dependency →
 * improvement (CLAUDE.md §14). Generic advice such as "align with stakeholders"
 * is a failure of this contract, not an acceptable output.
 */
export interface NextBestActionProposal {
  action: string;
  whyNow: string;
  evidence: FindingEvidenceRef[];
  impactIfIgnored: string;
  suggestedDomain: Domain;
  /** Null when the recorded data does not name an owner. Never guessed. */
  suggestedOwner: string | null;
  /**
   * Unlike a deterministic review finding — which has no confidence, because it
   * either fires or does not — a recommendation is a judgement, so a future
   * implementation genuinely has something to be confident about.
   */
  confidence: Confidence;
  basis: StateBasis;
}
