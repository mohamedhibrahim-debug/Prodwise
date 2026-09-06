import type { InitiativeIntelligence } from "@/lib/domain/types";

/**
 * Supporting synthetic initiatives.
 *
 * Deliberately smaller than the Merchant Flex Finance narrative. They exist so
 * the Initiatives list can demonstrate its default priority across all four
 * assessment states, and so the workspace is seen with more than one shape of
 * data. All of it is static demo content.
 */

/** BLOCKED — implementation done, release held by an external dependency. */
export const instantSettlementPayout: InitiativeIntelligence = {
  lastEvaluatedAt: "2026-09-04T08:41:00.000Z",
  attention: [
    {
      id: "isp-att-1",
      severity: "CRITICAL",
      title: "Partner-bank cut-off dependency unresolved",
      detail:
        "The payout window depends on a partner cut-off time that has not been confirmed in writing.",
    },
    {
      id: "isp-att-2",
      severity: "MEDIUM",
      title: "Reconciliation ownership not stated",
      detail:
        "No connected evidence names the team responsible for same-day reconciliation breaks.",
    },
  ],
  domains: [
    {
      domain: "PRODUCT",
      state: "READY",
      note: "Scope and eligible segments are agreed.",
    },
    {
      domain: "TECHNICAL",
      state: "READY",
      note: "Payout service implementation is complete and deployed to staging.",
    },
    {
      domain: "QA",
      state: "READY",
      note: "Regression and payout scenarios executed and passed.",
    },
    {
      domain: "FINANCE",
      state: "AT_RISK",
      note: "Same-day reconciliation break handling is not fully described.",
    },
    {
      domain: "EXTERNAL_PARTNER",
      state: "BLOCKED",
      note: "Partner-bank cut-off time is unconfirmed.",
    },
    {
      domain: "RELEASE",
      state: "BLOCKED",
      note: "Release is held pending the partner dependency.",
    },
  ],
  nextBestAction: {
    action: "Obtain written confirmation of the partner-bank cut-off time",
    whyNow:
      "Everything else for this release is complete; this single unconfirmed dependency is the only thing holding the release.",
    evidence: [
      "ISP-77 — Payout window assumes a 14:00 partner cut-off (unconfirmed)",
      "No partner correspondence confirming the cut-off was found in connected sources.",
    ],
    impactIfIgnored:
      "Payouts submitted after an incorrect cut-off would settle a day late, breaking the core promise of the product.",
    suggestedOwner: "Partnerships / Treasury Operations",
    confidence: "HIGH",
  },
  findings: [
    {
      id: "isp-f-1",
      type: "RISK",
      severity: "CRITICAL",
      status: "OPEN",
      title: "Payout window rests on an unconfirmed partner cut-off",
      subject: "Partner Cut-off",
      domain: "EXTERNAL_PARTNER",
      explanation:
        "The implemented payout window assumes a specific partner cut-off time. No connected evidence confirms that time with the partner.",
      claims: [
        {
          label: "Assumed",
          value: "Partner cut-off at 14:00 local",
          source: "ISP-77 · Implementation Note",
          sourceDate: "2026-07-30T00:00:00.000Z",
        },
      ],
      detectedOn: "2026-09-04T08:41:00.000Z",
    },
    {
      id: "isp-f-2",
      type: "GAP",
      severity: "MEDIUM",
      status: "OPEN",
      title: "Same-day reconciliation break handling is not defined",
      subject: "Reconciliation",
      domain: "FINANCE",
      explanation:
        "Connected evidence describes the successful payout path but not what happens when a same-day break is detected.",
      claims: [],
      detectedOn: "2026-08-21T10:15:00.000Z",
    },
  ],
  claims: [
    {
      id: "isp-c-1",
      type: "REQUIREMENT",
      status: "ACTIVE",
      subject: "Payout Timing",
      attribute: "Settlement Cycle",
      value: "Same-day payout for eligible segments",
      domain: "PRODUCT",
      phase: "Phase 1",
      source: "ISP-42 · Core Epic",
      sourceDate: "2026-02-10T00:00:00.000Z",
      confidence: "HIGH",
    },
    {
      id: "isp-c-2",
      type: "ASSUMPTION",
      status: "UNVERIFIED",
      subject: "Partner Cut-off",
      attribute: "Cut-off Time",
      value: "14:00 local",
      domain: "EXTERNAL_PARTNER",
      phase: "Phase 1",
      source: "ISP-77 · Implementation Note",
      sourceDate: "2026-07-30T00:00:00.000Z",
      confidence: "LOW",
      flag: "Linked to open risk",
    },
    {
      id: "isp-c-3",
      type: "DEPENDENCY",
      status: "ACTIVE",
      subject: "Partner Bank",
      attribute: "Required Capability",
      value: "Intraday payment instruction acceptance",
      domain: "EXTERNAL_PARTNER",
      phase: "Phase 1",
      source: "ISP-42 · Core Epic",
      sourceDate: "2026-02-10T00:00:00.000Z",
      confidence: "HIGH",
    },
  ],
  readiness: [
    {
      domain: "TECHNICAL",
      state: "READY",
      evidenceSatisfied: [
        "Payout service implemented",
        "Deployed and verified in staging",
      ],
      openIssues: [],
      unknowns: [],
      whatWouldMakeThisReady: "Technical implementation is complete.",
    },
    {
      domain: "QA",
      state: "READY",
      evidenceSatisfied: ["Payout scenarios executed", "Regression pack passed"],
      openIssues: [],
      unknowns: [],
      whatWouldMakeThisReady: "Test coverage is complete for the current scope.",
    },
    {
      domain: "FINANCE",
      state: "AT_RISK",
      evidenceSatisfied: ["Payout ledger postings defined"],
      openIssues: ["Same-day reconciliation break handling is not defined"],
      unknowns: ["Break ownership"],
      whatWouldMakeThisReady:
        "Define same-day reconciliation break handling and name the owning team.",
    },
    {
      domain: "EXTERNAL_PARTNER",
      state: "BLOCKED",
      evidenceSatisfied: ["Partner integration implemented"],
      openIssues: ["Partner cut-off time is unconfirmed"],
      unknowns: ["Partner acknowledgement of the payout schedule"],
      whatWouldMakeThisReady:
        "Obtain written partner confirmation of the cut-off time and payout schedule.",
    },
    {
      domain: "RELEASE",
      state: "BLOCKED",
      evidenceSatisfied: ["Release scope frozen", "Rollback plan recorded"],
      openIssues: ["Partner dependency unresolved"],
      unknowns: [],
      whatWouldMakeThisReady:
        "Close the partner cut-off dependency; no other release gate is outstanding.",
    },
  ],
};

/** UNKNOWN — barely any evidence connected. Demonstrates honest uncertainty. */
export const merchantKycRefresh: InitiativeIntelligence = {
  lastEvaluatedAt: "2026-08-28T16:12:00.000Z",
  attention: [
    {
      id: "kyc-att-1",
      severity: "HIGH",
      title: "Initiative boundary has not been confirmed",
      detail:
        "Only one artifact is connected. There is not enough evidence to reconstruct what this initiative covers.",
    },
  ],
  domains: [
    {
      domain: "PRODUCT",
      state: "UNKNOWN",
      note: "No product definition evidence was found in the connected sources.",
    },
    {
      domain: "COMPLIANCE",
      state: "UNKNOWN",
      note: "No Compliance evidence was found in the connected sources.",
    },
    {
      domain: "DELIVERY",
      state: "UNKNOWN",
      note: "No delivery items are connected to this initiative.",
    },
  ],
  nextBestAction: {
    action: "Confirm the initiative boundary",
    whyNow:
      "A single connected artifact is not enough to reconstruct product context, so no domain can currently be assessed.",
    evidence: [
      "KYC-11 — Merchant KYC Refresh scoping note (only connected artifact)",
    ],
    impactIfIgnored:
      "The initiative cannot be assessed at all, and any reporting on it would be unfounded.",
    suggestedOwner: "Product Owner",
    confidence: "MEDIUM",
  },
  findings: [
    {
      id: "kyc-f-1",
      type: "UNKNOWN",
      severity: "HIGH",
      status: "OPEN",
      title: "Insufficient evidence to determine initiative state",
      subject: "Initiative Boundary",
      domain: "PRODUCT",
      explanation:
        "One scoping note is connected. No requirements, decisions or delivery items were found in the connected sources.",
      claims: [],
      detectedOn: "2026-08-28T16:12:00.000Z",
    },
  ],
  claims: [
    {
      id: "kyc-c-1",
      type: "REQUIREMENT",
      status: "DRAFT",
      subject: "KYC Refresh",
      attribute: "Refresh Cycle",
      value: "Re-verify merchant records on a periodic cycle (cadence unstated)",
      domain: "COMPLIANCE",
      phase: "Unassigned",
      source: "KYC-11 · Scoping Note",
      sourceDate: "2026-07-22T00:00:00.000Z",
      confidence: "LOW",
    },
  ],
  readiness: [
    {
      domain: "PRODUCT",
      state: "UNKNOWN",
      evidenceSatisfied: [],
      openIssues: [],
      unknowns: ["No product definition evidence was found"],
      whatWouldMakeThisReady:
        "Connect the requirement set for this initiative so the domain can be evaluated.",
    },
    {
      domain: "COMPLIANCE",
      state: "UNKNOWN",
      evidenceSatisfied: [],
      openIssues: [],
      unknowns: ["No Compliance evidence was found"],
      whatWouldMakeThisReady:
        "Connect the Compliance requirement or review record for this initiative.",
    },
  ],
};

/** READY — nothing material outstanding, stated without overclaiming. */
export const collectionsReportingRebuild: InitiativeIntelligence = {
  lastEvaluatedAt: "2026-09-01T09:02:00.000Z",
  attention: [],
  domains: [
    {
      domain: "PRODUCT",
      state: "READY",
      note: "Reporting scope is defined and agreed with Finance.",
    },
    {
      domain: "DATA",
      state: "READY",
      note: "Source tables and refresh cadence are identified.",
    },
    {
      domain: "QA",
      state: "READY",
      note: "Validation approach agreed against the existing pack.",
    },
    {
      domain: "FINANCE",
      state: "READY",
      note: "Finance confirmed the report definitions match current usage.",
    },
  ],
  nextBestAction: {
    action: "Proceed to delivery planning",
    whyNow:
      "Definition is agreed across Product, Data and Finance, and no material issues were detected in the connected evidence.",
    evidence: [
      "CRR-9 — Reporting scope agreed (01 Sep 2026)",
      "CRR-15 — Source table mapping confirmed",
    ],
    impactIfIgnored:
      "Delay only; there is no unresolved definition risk recorded against this initiative.",
    suggestedOwner: "Delivery Lead",
    confidence: "MEDIUM",
  },
  findings: [],
  claims: [
    {
      id: "crr-c-1",
      type: "DECISION",
      status: "ACTIVE",
      subject: "Reporting Pack",
      attribute: "Delivery Platform",
      value: "Rebuild on the current data platform rather than extend the legacy pack",
      domain: "DATA",
      phase: "Phase 1",
      source: "CRR-9 · Decision",
      sourceDate: "2026-09-01T00:00:00.000Z",
      confidence: "HIGH",
    },
    {
      id: "crr-c-2",
      type: "REQUIREMENT",
      status: "ACTIVE",
      subject: "Arrears Report",
      attribute: "Refresh Cadence",
      value: "Daily, by 07:00 local",
      domain: "DATA",
      phase: "Phase 1",
      source: "CRR-15 · Requirement",
      sourceDate: "2026-08-25T00:00:00.000Z",
      confidence: "HIGH",
    },
  ],
  readiness: [
    {
      domain: "PRODUCT",
      state: "READY",
      evidenceSatisfied: ["Reporting scope agreed", "Field list confirmed"],
      openIssues: [],
      unknowns: [],
      whatWouldMakeThisReady: "Definition is complete for the current scope.",
    },
    {
      domain: "DATA",
      state: "READY",
      evidenceSatisfied: [
        "Source tables identified",
        "Refresh cadence defined",
      ],
      openIssues: [],
      unknowns: [],
      whatWouldMakeThisReady: "Data definition is complete for the current scope.",
    },
    {
      domain: "FINANCE",
      state: "READY",
      evidenceSatisfied: ["Finance confirmed report definitions match usage"],
      openIssues: [],
      unknowns: [],
      whatWouldMakeThisReady:
        "Finance definition is confirmed for the current scope.",
    },
  ],
};
