import type {
  AssessmentState,
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
  CONFLICT: "Conflict",
  GAP: "Gap",
  UNKNOWN: "Unknown",
  SUPERSEDED: "Superseded",
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
  ACTIVE: "Active",
  SUPERSEDED: "Superseded",
  DRAFT: "Draft",
  REJECTED: "Rejected",
  DEFERRED: "Deferred",
  UNKNOWN: "Unknown",
  UNVERIFIED: "Unverified",
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
    "Evidence directly relevant to the initiative being assessed now.",
  FUTURE_PHASE:
    "Belongs to a later phase or release, but is still related to the initiative.",
  HISTORICAL:
    "Old evidence, useful for context and history but not current truth.",
  RELATED:
    "Connected context, but not part of the initiative's current scope.",
  EXCLUDED: "Explicitly excluded by a user.",
};

/** Formats a timestamp for display. Deterministic, so SSR and client agree. */
export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
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
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(d);
}
