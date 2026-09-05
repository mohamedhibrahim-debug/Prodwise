/**
 * PRODWISE — domain model.
 *
 * These types are the shared vocabulary of the product. Both the Supabase and
 * the local repository return exactly these shapes, so UI code can never tell
 * which one is active (CLAUDE.md §17).
 */

/* ── Lifecycle ──────────────────────────────────────────────────────────────
   Not a waterfall. An initiative may move backward, reopen, split into phases,
   or have implementation complete while release remains blocked. */
export const STAGES = [
  "DISCOVERY",
  "DEFINITION",
  "ALIGNMENT",
  "DELIVERY",
  "VALIDATION",
  "RELEASE_PREPARATION",
  "LIVE_VALIDATION",
  "MONITORING",
] as const;

export type Stage = (typeof STAGES)[number];

/* ── Assessment ─────────────────────────────────────────────────────────────
   UNKNOWN is a first-class, valid answer. Never manufacture certainty, and
   never invent a percentage readiness. */
export const ASSESSMENT_STATES = [
  "READY",
  "AT_RISK",
  "BLOCKED",
  "UNKNOWN",
] as const;

export type AssessmentState = (typeof ASSESSMENT_STATES)[number];

/* ── Domains ────────────────────────────────────────────────────────────────
   Only domains relevant to an initiative are ever shown. */
export const DOMAINS = [
  "PRODUCT",
  "TECHNICAL",
  "DELIVERY",
  "QA",
  "FINANCE",
  "SECURITY",
  "COMPLIANCE",
  "RISK",
  "OPERATIONS",
  "DATA",
  "EXTERNAL_PARTNER",
  "RELEASE",
] as const;

export type Domain = (typeof DOMAINS)[number];

/* ── Review engine ──────────────────────────────────────────────────────────
   Exactly five finding types. Do not grow this taxonomy. */
export const FINDING_TYPES = [
  "CONFLICT",
  "GAP",
  "UNKNOWN",
  "SUPERSEDED",
  "RISK",
] as const;

export type FindingType = (typeof FINDING_TYPES)[number];

export type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export type FindingStatus = "OPEN" | "RESOLVED";

/* ── Product Memory ─────────────────────────────────────────────────────── */
export const CLAIM_TYPES = [
  "REQUIREMENT",
  "DECISION",
  "BUSINESS_RULE",
  "RISK",
  "DEPENDENCY",
  "ASSUMPTION",
] as const;

export type ClaimType = (typeof CLAIM_TYPES)[number];

export const CLAIM_STATUSES = [
  "ACTIVE",
  "SUPERSEDED",
  "DRAFT",
  "REJECTED",
  "DEFERRED",
  "UNKNOWN",
  "UNVERIFIED",
] as const;

export type ClaimStatus = (typeof CLAIM_STATUSES)[number];

/* ── Evidence ───────────────────────────────────────────────────────────── */
export const EVIDENCE_RELATIONS = [
  "CURRENT_SCOPE",
  "FUTURE_PHASE",
  "HISTORICAL",
  "RELATED",
  "EXCLUDED",
] as const;

export type EvidenceRelation = (typeof EVIDENCE_RELATIONS)[number];

export type EvidenceSourceKind =
  | "JIRA"
  | "DOCUMENT"
  | "MEETING_NOTE"
  | "DECISION_RECORD";

export type Confidence = "HIGH" | "MEDIUM" | "LOW";

/* ── Entities ───────────────────────────────────────────────────────────── */

export interface Initiative {
  id: string;
  /** Stable public identifier. Routes and fixtures key off this, never the id. */
  slug: string;
  name: string;
  description: string | null;
  knownReferences: string | null;
  stage: Stage;
  overallState: AssessmentState;
  /** One sentence. The first thing a PM reads. */
  stateSummary: string | null;
  /** True for the seeded synthetic initiative, so the UI can label it honestly. */
  isDemo: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ActivityEntry {
  id: string;
  initiativeId: string;
  eventType: string;
  summary: string;
  occurredAt: string;
}

export interface NewInitiativeInput {
  name: string;
  description?: string | null;
  knownReferences?: string | null;
}

/* ── Synthetic intelligence shapes ──────────────────────────────────────────
   Phase 1 has no reasoning engine. These types describe what the engine will
   eventually produce; for now they are populated from static fixtures keyed by
   initiative slug, and are clearly labelled as demo data in the UI. */

export interface AttentionItem {
  id: string;
  severity: Severity;
  title: string;
  detail: string;
}

export interface DomainAssessment {
  domain: Domain;
  state: AssessmentState;
  note: string;
}

export interface NextBestAction {
  action: string;
  whyNow: string;
  evidence: string[];
  impactIfIgnored: string;
  suggestedOwner: string;
  confidence: Confidence;
}

export interface ClaimReference {
  label: string;
  value: string;
  source: string;
  sourceDate: string;
}

export interface ReviewFinding {
  id: string;
  type: FindingType;
  severity: Severity;
  status: FindingStatus;
  title: string;
  subject: string;
  domain: Domain;
  explanation: string;
  claims: ClaimReference[];
  detectedOn: string;
  /** Present on RESOLVED findings only. */
  resolution?: string;
}

export interface MemoryClaim {
  id: string;
  type: ClaimType;
  status: ClaimStatus;
  subject: string;
  attribute: string;
  value: string;
  domain: Domain;
  phase: string;
  source: string;
  sourceDate: string;
  confidence: Confidence;
  /** e.g. "Supersedes: Traditional + Islamic Financing" */
  relationship?: string;
  /** Set when this claim participates in an open finding. */
  flag?: string;
}

export interface EvidenceItem {
  id: string;
  relation: EvidenceRelation;
  kind: EvidenceSourceKind;
  reference: string;
  title: string;
  summary: string;
  lastSeenAt: string;
  /** Why the system placed this item in this relation bucket. */
  classificationReason: string;
}

export interface ReadinessAssessment {
  domain: Domain;
  state: AssessmentState;
  evidenceSatisfied: string[];
  openIssues: string[];
  unknowns: string[];
  /** Never a checkbox, never a percentage. */
  whatWouldMakeThisReady: string;
}

/**
 * The complete synthetic picture for one initiative. Absent for any initiative
 * without fixtures — which is every initiative a user creates, and which is
 * why the empty states are exercised by real code paths rather than mocked.
 */
export interface InitiativeIntelligence {
  attention: AttentionItem[];
  domains: DomainAssessment[];
  nextBestAction: NextBestAction | null;
  findings: ReviewFinding[];
  claims: MemoryClaim[];
  evidence: EvidenceItem[];
  readiness: ReadinessAssessment[];
  lastEvaluatedAt: string;
}
