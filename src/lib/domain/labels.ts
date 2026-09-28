import type {
  AssessmentState,
  BusinessLine,
  ClaimStatus,
  ClaimType,
  ConnectionState,
  Domain,
  EvidenceRelation,
  EvidenceSourceType,
  FindingType,
  Severity,
  Stage,
} from "./types";

export const STAGE_LABEL: Record<Stage, string> = {
  DISCOVERY: "Discovery",
  DEFINITION: "Definition",
  ALIGNMENT: "Alignment",
  DELIVERY: "Delivery",
  VALIDATION: "Validation",
  RELEASE_PREPARATION: "Release Preparation",
  LIVE_VALIDATION: "Live Validation",
  MONITORING: "Monitoring",
};

/** Display names for the controlled Business Line list. */
export const BUSINESS_LINE_LABEL: Record<BusinessLine, string> = {
  ACCEPTANCE: "Acceptance",
  BP: "BP",
  FS: "FS",
  MF: "MF",
  DIGITAL_TRANSFORMATION: "Digital Transformation",
};

/**
 * Official full names for business-line codes. BP, FS and MF are official
 * identifiers in their own right: add a name here ONLY when the organization has
 * confirmed it. Never guess. Until then the code alone is shown, unexpanded.
 */
export const BUSINESS_LINE_OFFICIAL_NAME: Partial<Record<BusinessLine, string>> = {};

/** Plain-text form (select options, search hints): "MF" or, once confirmed, "MF — <official name>". */
export function businessLineText(code: BusinessLine): string {
  const full = BUSINESS_LINE_OFFICIAL_NAME[code];
  return full ? `${BUSINESS_LINE_LABEL[code]} — ${full}` : BUSINESS_LINE_LABEL[code];
}

export const STATE_LABEL: Record<AssessmentState, string> = {
  READY: "Ready",
  AT_RISK: "At Risk",
  BLOCKED: "Blocked",
  UNKNOWN: "Unknown",
};

export const DOMAIN_LABEL: Record<Domain, string> = {
  PRODUCT: "Product",
  TECHNICAL: "Technical",
  DELIVERY: "Delivery",
  QA: "QA",
  FINANCE: "Finance",
  SECURITY: "Security",
  COMPLIANCE: "Compliance",
  RISK: "Risk",
  OPERATIONS: "Operations",
  DATA: "Data",
  EXTERNAL_PARTNER: "External Partner",
  RELEASE: "Release",
};

export const FINDING_LABEL: Record<FindingType, string> = {
  CONFLICT: "Mismatch",
  GAP: "Gap",
  UNKNOWN: "Unknown",
  SUPERSEDED: "Replaced",
  RISK: "Risk",
};

export const SEVERITY_LABEL: Record<Severity, string> = {
  CRITICAL: "Critical",
  HIGH: "High",
  MEDIUM: "Medium",
  LOW: "Low",
};

export const CLAIM_TYPE_LABEL: Record<ClaimType, string> = {
  REQUIREMENT: "Requirement",
  DECISION: "Decision",
  BUSINESS_RULE: "Business Rule",
  RISK: "Risk",
  DEPENDENCY: "Dependency",
  ASSUMPTION: "Assumption",
};

export const CLAIM_STATUS_LABEL: Record<ClaimStatus, string> = {
  ACTIVE: "Confirmed",
  SUPERSEDED: "Replaced",
  DRAFT: "Draft",
  REJECTED: "Rejected",
  DEFERRED: "Deferred",
  UNKNOWN: "Unknown",
  UNVERIFIED: "Not confirmed",
};

export const EVIDENCE_RELATION_LABEL: Record<EvidenceRelation, string> = {
  CURRENT_SCOPE: "Current Scope",
  FUTURE_PHASE: "Future Phase",
  HISTORICAL: "Historical",
  RELATED: "Related",
  EXCLUDED: "Excluded",
};

export const EVIDENCE_SOURCE_TYPE_LABEL: Record<EvidenceSourceType, string> = {
  DOCUMENT: "Document",
  MEETING: "Meeting",
  EMAIL: "Email",
  DESIGN: "Design",
  JIRA: "Jira",
  DECISION_NOTE: "Decision Note",
  OTHER: "Other",
};

export const CONNECTION_STATE_LABEL: Record<ConnectionState, string> = {
  MANUAL: "Manual",
  CONNECTED: "Connected",
  ERROR: "Error",
  DISCONNECTED: "Disconnected",
};

/** What each boundary bucket means, so the classification decision is legible. */
export const EVIDENCE_RELATION_NOTE: Record<EvidenceRelation, string> = {
  CURRENT_SCOPE:
    "Sources directly relevant to this initiative now.",
  FUTURE_PHASE:
    "Belongs to a later phase or release, but is still related to the initiative.",
  HISTORICAL:
    "Old evidence, useful for context and history but not current truth.",
  RELATED:
    "Connected context, but not part of the initiative's current scope.",
  EXCLUDED: "Explicitly excluded by a user.",
};

/** The organization day and clock used for every timestamp shown. */
export const ORG_TIME_ZONE = "Africa/Cairo";

/** Formats a timestamp for display. Deterministic, so SSR and client agree. */
export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  // A plain date is a calendar day; a timestamp is shown on the organization's day (Cairo).
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: iso.length === 10 ? "UTC" : ORG_TIME_ZONE,
  }).format(d);
}

/**
 * Freshness, stated factually.
 *
 * Reports elapsed time and nothing more. It never calls evidence "outdated" or
 * "stale" - Prodwise has no basis for that claim, only for how long it has been
 * since a human last verified the record. A null date is "unknown", which is a
 * valid answer and not a failure (truth rules 3 and 4).
 *
 * Server-rendered only, so "now" is evaluated once and cannot desync a client.
 */
export function formatVerified(iso: string | null): string {
  if (!iso) return "Verification date unknown";

  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return "Verification date unknown";

  const days = Math.floor((Date.now() - then.getTime()) / 86_400_000);
  if (days < 0) return `Last verified ${formatDate(iso)}`;
  if (days === 0) return "Last verified today";
  if (days === 1) return "Last verified yesterday";
  if (days < 30) return `Last verified ${days} days ago`;
  return `Last verified ${formatDate(iso)}`;
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: ORG_TIME_ZONE,
  }).format(d);
}

const UUID_REFERENCE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/**
 * A source reference as a person should read it. Internal keys (a saved-text id,
 * a meeting-notes key) are never shown: meeting keys read as "Meeting · 25 Sept 2026",
 * bare ids read as null so the caller shows its own "not recorded" wording.
 */
export function displaySourceReference(reference: string | null | undefined): string | null {
  if (!reference) return null;
  const meeting = /^meeting:(\d{4}-\d{2}-\d{2}):/.exec(reference);
  if (meeting) return `Meeting · ${formatDate(`${meeting[1]}T00:00:00Z`)}`;
  if (UUID_REFERENCE.test(reference)) return null;
  return reference;
}
