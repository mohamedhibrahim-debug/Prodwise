import type {
  AssessmentState,
  ClaimStatus,
  ClaimType,
  Domain,
  EvidenceRelation,
  EvidenceSourceKind,
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

export const EVIDENCE_KIND_LABEL: Record<EvidenceSourceKind, string> = {
  JIRA: "Jira",
  DOCUMENT: "Document",
  MEETING_NOTE: "Meeting Note",
  DECISION_RECORD: "Decision",
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
