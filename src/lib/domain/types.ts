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

/**
 * The initiative boundary. Getting this wrong poisons every later intelligence
 * layer, so it is always explicit and always human-correctable. Phase 2 has no
 * auto-classification: a person decides, and can change the decision.
 */
export type EvidenceRelation = (typeof EVIDENCE_RELATIONS)[number];

/**
 * Where a piece of evidence came from. Deliberately small.
 *
 * JIRA is a source *type* only. It implies no integration: a record may carry a
 * reference like "MFF-118" without Prodwise ever contacting Jira.
 */
export const EVIDENCE_SOURCE_TYPES = [
  "DOCUMENT",
  "MEETING",
  "EMAIL",
  "JIRA",
  "DECISION_NOTE",
  "OTHER",
] as const;

export type EvidenceSourceType = (typeof EVIDENCE_SOURCE_TYPES)[number];

/**
 * How a source is wired up. Phase 2 has no connectors, so every seeded source
 * is MANUAL. The other states exist so the model does not need reshaping when
 * real connectors arrive - they are never fabricated for demo purposes.
 */
export const CONNECTION_STATES = [
  "MANUAL",
  "CONNECTED",
  "ERROR",
  "DISCONNECTED",
] as const;

export type ConnectionState = (typeof CONNECTION_STATES)[number];

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

/**
 * A source of evidence, distinct from the individual records that come from it.
 *
 * It exists so an initiative can say where its evidence conceptually comes from
 * before any integration exists - "Merchant Flex Finance BRD", "Lending Weekly
 * Meeting". In Phase 2 every source is MANUAL.
 */
export interface InitiativeSource {
  id: string;
  initiativeId: string;
  name: string;
  sourceType: EvidenceSourceType;
  connectionState: ConnectionState;
  lastSyncedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * A piece of source material attached to an initiative.
 *
 * Evidence is raw input, never a conclusion: it holds no claims, findings,
 * scores or AI output. Interpretation belongs to later phases and to other
 * entities. Every record carries exactly one boundary classification, set by a
 * human and changeable by a human.
 */
export interface EvidenceRecord {
  id: string;
  initiativeId: string;
  /** Optional link to an InitiativeSource. */
  sourceId: string | null;
  title: string;
  sourceType: EvidenceSourceType;
  /** e.g. "MFF-118", "PR v2.3". Free text; no system dereferences it. */
  sourceReference: string | null;
  sourceUrl: string | null;
  contentSummary: string | null;
  boundary: EvidenceRelation;
  /** When the underlying artifact happened, if known. */
  occurredAt: string | null;
  /** When it was recorded in Prodwise. Always known. */
  capturedAt: string;
  /** When a human last confirmed it still holds. Null means unknown, not stale. */
  lastVerifiedAt: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NewEvidenceInput {
  initiativeId: string;
  title: string;
  sourceType: EvidenceSourceType;
  boundary: EvidenceRelation;
  sourceReference?: string | null;
  sourceUrl?: string | null;
  contentSummary?: string | null;
  occurredAt?: string | null;
}

/** Fields an editor may change. Identity and capture time are not editable. */
export interface EvidencePatch {
  title?: string;
  sourceType?: EvidenceSourceType;
  boundary?: EvidenceRelation;
  sourceReference?: string | null;
  sourceUrl?: string | null;
  contentSummary?: string | null;
  occurredAt?: string | null;
  lastVerifiedAt?: string | null;
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
 * The synthetic *interpretation* of an initiative. Absent for any initiative
 * without fixtures — which is every initiative a user creates, and which is why
 * the empty states are exercised by real code paths rather than mocked.
 *
 * Evidence is deliberately NOT part of this. From Phase 2 evidence is real,
 * persisted and human-owned, and it is read through the repository. Keeping it
 * here would imply the findings below were derived from it; they were not.
 */
export interface InitiativeIntelligence {
  attention: AttentionItem[];
  domains: DomainAssessment[];
  nextBestAction: NextBestAction | null;
  findings: ReviewFinding[];
  claims: MemoryClaim[];
  readiness: ReadinessAssessment[];
  lastEvaluatedAt: string;
}
