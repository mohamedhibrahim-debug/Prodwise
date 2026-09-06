import type { InitiativeIntelligence } from "@/lib/domain/types";

/**
 * MERCHANT FLEX FINANCE — the golden demo narrative.
 *
 * Static synthetic data. No reasoning engine produced any of this; Phase 1 has
 * none. The scenario is specified in CLAUDE.md §20 and exercises the three
 * behaviours that distinguish Prodwise from a status board:
 *
 *  1. A genuine CONFLICT (divisor 27 vs 30) — same subject, same attribute,
 *     same phase, both active, incompatible values.
 *  2. A SUPERSESSION that is deliberately NOT reported as a conflict
 *     (Traditional + Islamic → Islamic only), per truth rule 7.
 *  3. An UNKNOWN phrased as absence of evidence, never as absence of the
 *     thing itself, per truth rule 4.
 */
export const merchantFlexFinance: InitiativeIntelligence = {
  lastEvaluatedAt: "2026-09-03T14:05:00.000Z",

  /* ── Needs your attention · maximum three on the Overview ─────────────── */
  attention: [
    {
      id: "att-1",
      severity: "CRITICAL",
      title: "Repayment Calculation Conflict",
      detail:
        "Two currently active requirements define different daily repayment divisors for the same phase.",
    },
    {
      id: "att-2",
      severity: "HIGH",
      title: "Final Finance Confirmation Not Found",
      detail:
        "No evidence confirming the authoritative repayment calculation was found in the connected sources.",
    },
    {
      id: "att-3",
      severity: "MEDIUM",
      title: "One related delivery item requires phase classification",
      detail:
        "MFF-141 references this initiative but has not been confirmed as current scope or future phase.",
    },
  ],

  /* ── Current state by relevant domain · Lending activation set ─────────── */
  domains: [
    {
      domain: "PRODUCT",
      state: "READY",
      note: "Product definition is agreed and the financing model decision is recorded.",
    },
    {
      domain: "DELIVERY",
      state: "AT_RISK",
      note: "Epic in development; several stories complete, some work remains open.",
    },
    {
      domain: "QA",
      state: "AT_RISK",
      note: "Test coverage is partial; repayment scenarios are not yet executed.",
    },
    {
      domain: "FINANCE",
      state: "AT_RISK",
      note: "Settlement and repayment source are defined, but the calculation rule is contested.",
    },
    {
      domain: "RISK",
      state: "UNKNOWN",
      note: "No risk assessment evidence was found in the connected sources.",
    },
    {
      domain: "COMPLIANCE",
      state: "UNKNOWN",
      note: "No Compliance approval evidence was found in the connected sources.",
    },
    {
      // Operations belongs to the Lending activation set and is AT_RISK in
      // Readiness, so Overview must not omit it. State and substance mirror the
      // Operations readiness entry below - nothing new is asserted here.
      domain: "OPERATIONS",
      state: "AT_RISK",
      note: "Merchant support model is described, but repayment failure handling is not defined.",
    },
    {
      domain: "RELEASE",
      state: "BLOCKED",
      note: "Release cannot proceed while the repayment calculation remains unresolved.",
    },
  ],

  /* ── The one primary recommendation ────────────────────────────────────── */
  nextBestAction: {
    action: "Resolve the daily repayment calculation",
    whyNow:
      "Two currently active requirements define different repayment calculation rules for the same phase, and implementation is already building against one of them.",
    evidence: [
      "MFF-118 — Daily repayment = Monthly installment / 27 (Finance requirement, 02 Jun 2026)",
      "MFF-133 — Daily repayment = Monthly installment / 30 (Implementation requirement, 21 Aug 2026)",
      "No later evidence supersedes either requirement.",
    ],
    impactIfIgnored:
      "Continuing implementation without confirmation may create repayment and reconciliation inconsistency.",
    suggestedOwner: "Finance / Lending Product",
    confidence: "HIGH",
  },

  /* ── Review findings ───────────────────────────────────────────────────── */
  findings: [
    {
      id: "f-1",
      type: "CONFLICT",
      severity: "CRITICAL",
      status: "OPEN",
      title: "Daily Repayment Calculation",
      subject: "Daily Repayment",
      domain: "FINANCE",
      explanation:
        "Both claims are active, describe the same subject and attribute, and apply to the same phase and channel. Neither supersedes the other, so this is treated as a true contradiction rather than a version difference.",
      claims: [
        {
          label: "Claim A",
          value: "Daily repayment = Monthly Installment / 27",
          source: "MFF-118 · Finance Requirement",
          sourceDate: "2026-06-02T00:00:00.000Z",
        },
        {
          label: "Claim B",
          value: "Daily repayment = Monthly Installment / 30",
          source: "MFF-133 · Implementation Requirement",
          sourceDate: "2026-08-21T00:00:00.000Z",
        },
      ],
      detectedOn: "2026-09-03T14:05:00.000Z",
    },
    {
      id: "f-2",
      type: "UNKNOWN",
      severity: "HIGH",
      status: "OPEN",
      title: "Compliance approval state cannot be determined",
      subject: "Compliance Approval",
      domain: "COMPLIANCE",
      explanation:
        "No Compliance approval evidence was found in the connected sources. This is an absence of evidence, not evidence that approval was refused or skipped.",
      claims: [],
      detectedOn: "2026-08-30T09:10:00.000Z",
    },
    {
      id: "f-3",
      type: "SUPERSEDED",
      severity: "LOW",
      status: "OPEN",
      title: "Financing model requirement replaced",
      subject: "Financing Model",
      domain: "PRODUCT",
      explanation:
        "A later decision replaced the original requirement. The earlier requirement is retained as history and is not reported as a conflict.",
      claims: [
        {
          label: "Superseded",
          value: "Traditional + Islamic Financing",
          source: "Product Requirements v1.0",
          sourceDate: "2026-04-18T00:00:00.000Z",
        },
        {
          label: "Supersedes",
          value: "Islamic Financing Only",
          source: "Decision Record DR-07",
          sourceDate: "2026-08-18T00:00:00.000Z",
        },
      ],
      detectedOn: "2026-08-18T10:05:00.000Z",
    },
    {
      id: "f-4",
      type: "GAP",
      severity: "MEDIUM",
      status: "OPEN",
      title: "Repayment failure handling is not defined",
      subject: "Repayment Exception Handling",
      domain: "OPERATIONS",
      explanation:
        "Requirements describe the successful repayment path. No connected evidence describes behaviour when a settlement-based deduction fails or is partial.",
      claims: [],
      detectedOn: "2026-08-25T12:00:00.000Z",
    },
    {
      id: "f-5",
      type: "RISK",
      severity: "MEDIUM",
      status: "OPEN",
      title: "Eligibility rule depends on an unconfirmed data source",
      subject: "Merchant Eligibility",
      domain: "DATA",
      explanation:
        "Eligibility references a rolling settlement-volume figure whose owning system is named inconsistently across two documents.",
      claims: [
        {
          label: "Reference A",
          value: "Rolling 90-day settlement volume — Settlement Service",
          source: "Product Requirements v2.3",
          sourceDate: "2026-07-09T00:00:00.000Z",
        },
        {
          label: "Reference B",
          value: "Rolling 90-day settlement volume — Merchant Data Platform",
          source: "MFF-104 · Technical Note",
          sourceDate: "2026-07-30T00:00:00.000Z",
        },
      ],
      detectedOn: "2026-08-12T15:45:00.000Z",
    },
    {
      id: "f-6",
      type: "GAP",
      severity: "LOW",
      status: "RESOLVED",
      title: "Settlement account mapping was undefined",
      subject: "Settlement Mapping",
      domain: "FINANCE",
      explanation:
        "The mapping between merchant settlement accounts and financing repayment records was not described in the connected evidence.",
      claims: [],
      detectedOn: "2026-06-20T08:30:00.000Z",
      resolution:
        "Resolved by Product Requirements v2.3, which defines the settlement account mapping explicitly.",
    },
    {
      id: "f-7",
      type: "UNKNOWN",
      severity: "LOW",
      status: "RESOLVED",
      title: "Repayment source could not be determined",
      subject: "Repayment Source",
      domain: "FINANCE",
      explanation:
        "Earlier evidence did not state where repayment funds are drawn from.",
      claims: [],
      detectedOn: "2026-05-11T10:00:00.000Z",
      resolution:
        "Resolved by MFF-104, which confirms repayment is deducted from merchant settlement activity.",
    },
  ],

  /* ── Product memory ────────────────────────────────────────────────────── */
  claims: [
    {
      id: "c-1",
      type: "DECISION",
      status: "ACTIVE",
      subject: "Financing Model",
      attribute: "Offered Products",
      value: "Islamic Financing Only",
      domain: "PRODUCT",
      phase: "Phase 1",
      source: "Decision Record DR-07",
      sourceDate: "2026-08-18T00:00:00.000Z",
      confidence: "HIGH",
      relationship: "Supersedes: Traditional + Islamic Financing",
    },
    {
      id: "c-1b",
      type: "DECISION",
      status: "ACTIVE",
      subject: "Repayment Collection",
      attribute: "Collection Frequency",
      value:
        "Repayment is deducted daily from settlement activity rather than invoiced monthly",
      domain: "FINANCE",
      phase: "Phase 1",
      source: "Decision Record DR-04",
      sourceDate: "2026-05-11T00:00:00.000Z",
      confidence: "HIGH",
    },
    {
      id: "c-1c",
      type: "DECISION",
      status: "ACTIVE",
      subject: "Disbursement",
      attribute: "Phase 1 Approach",
      value:
        "Financing is disbursed manually in Phase 1; automation is deferred to a later phase",
      domain: "OPERATIONS",
      phase: "Phase 1",
      source: "Decision Record DR-06",
      sourceDate: "2026-08-05T00:00:00.000Z",
      confidence: "HIGH",
      relationship: "Defers: Automated Disbursement to Phase 2",
    },
    {
      id: "c-2",
      type: "REQUIREMENT",
      status: "SUPERSEDED",
      subject: "Financing Model",
      attribute: "Offered Products",
      value: "Traditional + Islamic Financing",
      domain: "PRODUCT",
      phase: "Phase 1",
      source: "Product Requirements v1.0",
      sourceDate: "2026-04-18T00:00:00.000Z",
      confidence: "HIGH",
      relationship: "Superseded by: Decision Record DR-07",
    },
    {
      id: "c-3",
      type: "REQUIREMENT",
      status: "ACTIVE",
      subject: "Daily Repayment",
      attribute: "Calculation Divisor",
      value: "27",
      domain: "FINANCE",
      phase: "Phase 1",
      source: "MFF-118 · Finance Requirement",
      sourceDate: "2026-06-02T00:00:00.000Z",
      confidence: "HIGH",
      flag: "Conflict detected",
    },
    {
      id: "c-4",
      type: "REQUIREMENT",
      status: "ACTIVE",
      subject: "Daily Repayment",
      attribute: "Calculation Divisor",
      value: "30",
      domain: "FINANCE",
      phase: "Phase 1",
      source: "MFF-133 · Implementation Requirement",
      sourceDate: "2026-08-21T00:00:00.000Z",
      confidence: "HIGH",
      flag: "Conflict detected",
    },
    {
      id: "c-5",
      type: "BUSINESS_RULE",
      status: "ACTIVE",
      subject: "Repayment Source",
      attribute: "Deduction Mechanism",
      value: "Deducted from merchant settlement activity",
      domain: "FINANCE",
      phase: "Phase 1",
      source: "MFF-104 · Core Epic",
      sourceDate: "2026-05-11T00:00:00.000Z",
      confidence: "HIGH",
    },
    {
      id: "c-6",
      type: "BUSINESS_RULE",
      status: "ACTIVE",
      subject: "Merchant Eligibility",
      attribute: "Minimum Trading History",
      value: "6 months of continuous settlement activity",
      domain: "PRODUCT",
      phase: "Phase 1",
      source: "Product Requirements v2.3",
      sourceDate: "2026-07-09T00:00:00.000Z",
      confidence: "MEDIUM",
    },
    {
      id: "c-7",
      type: "RISK",
      status: "ACTIVE",
      subject: "Repayment Reconciliation",
      attribute: "Exposure",
      value:
        "An incorrect divisor would misstate daily repayment across all active contracts",
      domain: "FINANCE",
      phase: "Phase 1",
      source: "Derived from MFF-118 / MFF-133",
      sourceDate: "2026-09-03T00:00:00.000Z",
      confidence: "HIGH",
      flag: "Linked to open conflict",
    },
    {
      id: "c-8",
      type: "RISK",
      status: "UNVERIFIED",
      subject: "Merchant Concentration",
      attribute: "Portfolio Exposure",
      value: "Concentration limits per merchant segment are not stated",
      domain: "RISK",
      phase: "Phase 1",
      source: "Risk Review Note (draft)",
      sourceDate: "2026-08-02T00:00:00.000Z",
      confidence: "LOW",
    },
    {
      id: "c-9",
      type: "DEPENDENCY",
      status: "ACTIVE",
      subject: "Settlement Service",
      attribute: "Required Capability",
      value: "Per-merchant daily settlement totals exposed to the finance ledger",
      domain: "TECHNICAL",
      phase: "Phase 1",
      source: "MFF-104 · Technical Note",
      sourceDate: "2026-07-30T00:00:00.000Z",
      confidence: "HIGH",
    },
    {
      id: "c-10",
      type: "DEPENDENCY",
      status: "DEFERRED",
      subject: "Disbursement Engine",
      attribute: "Required Capability",
      value: "Automated disbursement to merchant accounts",
      domain: "TECHNICAL",
      phase: "Phase 2",
      source: "Roadmap Note · Automated Disbursement",
      sourceDate: "2026-08-05T00:00:00.000Z",
      confidence: "MEDIUM",
      relationship: "Belongs to: Future Phase",
    },
    {
      id: "c-11",
      type: "ASSUMPTION",
      status: "UNVERIFIED",
      subject: "Settlement Frequency",
      attribute: "Assumed Cadence",
      value: "Merchants settle on at least 20 days per calendar month",
      domain: "FINANCE",
      phase: "Phase 1",
      source: "Product Requirements v2.3",
      sourceDate: "2026-07-09T00:00:00.000Z",
      confidence: "LOW",
    },
    {
      id: "c-12",
      type: "ASSUMPTION",
      status: "ACTIVE",
      subject: "Contract Term",
      attribute: "Default Duration",
      value: "6 monthly installments",
      domain: "PRODUCT",
      phase: "Phase 1",
      source: "Product Requirements v2.3",
      sourceDate: "2026-07-09T00:00:00.000Z",
      confidence: "MEDIUM",
    },
  ],

  /* ── Evidence ──────────────────────────────────────────────────────────── */
  evidence: [
    {
      id: "e-1",
      relation: "CURRENT_SCOPE",
      kind: "JIRA",
      reference: "MFF-104",
      title: "Merchant Flex Finance Core Epic",
      summary:
        "Parent epic covering eligibility, offer, contract and repayment for the initial release.",
      lastSeenAt: "2026-09-02T07:30:00.000Z",
      classificationReason: "Directly referenced by the initiative boundary.",
    },
    {
      id: "e-2",
      relation: "CURRENT_SCOPE",
      kind: "DOCUMENT",
      reference: "MFF-118",
      title: "Daily Repayment Requirement",
      summary:
        "Finance requirement defining the daily repayment calculation as monthly installment divided by 27.",
      lastSeenAt: "2026-09-02T07:30:00.000Z",
      classificationReason: "Linked to the core epic and active in this phase.",
    },
    {
      id: "e-3",
      relation: "CURRENT_SCOPE",
      kind: "DOCUMENT",
      reference: "PR v2.3",
      title: "Product Requirements v2.3",
      summary:
        "Current product requirement set covering eligibility, contract terms and settlement mapping.",
      lastSeenAt: "2026-09-02T07:30:00.000Z",
      classificationReason: "Latest active version of the product requirement.",
    },
    {
      id: "e-4",
      relation: "CURRENT_SCOPE",
      kind: "JIRA",
      reference: "MFF-133",
      title: "Repayment Schedule Implementation",
      summary:
        "Implementation story building the repayment schedule using a divisor of 30.",
      lastSeenAt: "2026-09-03T13:55:00.000Z",
      classificationReason: "Child of the core epic in the active release scope.",
    },
    {
      id: "e-5",
      relation: "CURRENT_SCOPE",
      kind: "DECISION_RECORD",
      reference: "DR-07",
      title: "Islamic Financing Only",
      summary:
        "Decision restricting the offering to Islamic financing products for this initiative.",
      lastSeenAt: "2026-08-18T10:05:00.000Z",
      classificationReason: "Decision recorded against this initiative.",
    },
    {
      id: "e-6",
      relation: "FUTURE_PHASE",
      kind: "JIRA",
      reference: "MFF-190",
      title: "Automated Disbursement",
      summary:
        "Automated disbursement of approved financing to merchant accounts.",
      lastSeenAt: "2026-08-05T09:00:00.000Z",
      classificationReason:
        "Marked as a later phase; not part of the active release scope.",
    },
    {
      id: "e-7",
      relation: "HISTORICAL",
      kind: "DOCUMENT",
      reference: "PR v1.0",
      title: "Original Financing Model",
      summary:
        "Initial requirement describing both traditional and Islamic financing products.",
      lastSeenAt: "2026-04-18T00:00:00.000Z",
      classificationReason:
        "Superseded by a later decision; retained as history.",
    },
    {
      id: "e-8",
      relation: "RELATED",
      kind: "JIRA",
      reference: "MFF-141",
      title: "Merchant Statement Redesign",
      summary:
        "Statement changes that reference financing repayment lines but sit in a separate delivery stream.",
      lastSeenAt: "2026-08-27T11:20:00.000Z",
      classificationReason:
        "References this initiative but has not been confirmed as current scope.",
    },
    {
      id: "e-9",
      relation: "RELATED",
      kind: "MEETING_NOTE",
      reference: "MN-2026-08-12",
      title: "Lending Portfolio Review",
      summary:
        "Portfolio review touching several lending initiatives, including this one.",
      lastSeenAt: "2026-08-12T15:45:00.000Z",
      classificationReason:
        "Mentions the initiative among others; not a defining artifact.",
    },
    {
      id: "e-10",
      relation: "EXCLUDED",
      kind: "JIRA",
      reference: "CFX-88",
      title: "Consumer Flex Financing",
      summary:
        "A separate consumer financing initiative with overlapping terminology.",
      lastSeenAt: "2026-07-15T10:00:00.000Z",
      classificationReason:
        "Name similarity only; confirmed as a different initiative.",
    },
  ],

  /* ── Readiness ─────────────────────────────────────────────────────────── */
  readiness: [
    {
      domain: "PRODUCT",
      state: "READY",
      evidenceSatisfied: [
        "Financing model decided and recorded",
        "Eligibility criteria defined",
        "Contract term defined",
      ],
      openIssues: [],
      unknowns: [],
      whatWouldMakeThisReady:
        "Product definition is complete for the current scope.",
    },
    {
      domain: "DELIVERY",
      state: "AT_RISK",
      evidenceSatisfied: [
        "Core epic in development",
        "Several implementation stories completed",
      ],
      openIssues: [
        "Repayment schedule implementation is building against a contested rule",
        "One related delivery item is not yet classified",
      ],
      unknowns: [],
      whatWouldMakeThisReady:
        "Confirm the authoritative repayment rule and classify the outstanding related item.",
    },
    {
      domain: "QA",
      state: "AT_RISK",
      evidenceSatisfied: ["Test approach agreed for eligibility and offer flows"],
      openIssues: ["Repayment scenarios cannot be finalised while the rule is contested"],
      unknowns: ["End-to-end settlement test coverage"],
      whatWouldMakeThisReady:
        "Execute repayment scenarios against a confirmed calculation rule and record end-to-end coverage.",
    },
    {
      domain: "FINANCE",
      state: "AT_RISK",
      evidenceSatisfied: [
        "Settlement mechanism defined",
        "Repayment source defined",
      ],
      openIssues: ["Daily repayment calculation conflict"],
      unknowns: ["Final Finance confirmation"],
      whatWouldMakeThisReady:
        "Resolve the calculation conflict and confirm the authoritative final rule.",
    },
    {
      domain: "RISK",
      state: "UNKNOWN",
      evidenceSatisfied: [],
      openIssues: [],
      unknowns: [
        "No risk assessment evidence was found in the connected sources",
        "Merchant concentration limits are not stated",
      ],
      whatWouldMakeThisReady:
        "Connect the risk assessment for this initiative so the domain can be evaluated.",
    },
    {
      domain: "COMPLIANCE",
      state: "UNKNOWN",
      evidenceSatisfied: [],
      openIssues: [],
      unknowns: [
        "No Compliance approval evidence was found in the connected sources",
      ],
      whatWouldMakeThisReady:
        "Connect the Compliance review or approval record so the domain can be evaluated.",
    },
    {
      domain: "OPERATIONS",
      state: "AT_RISK",
      evidenceSatisfied: ["Merchant support model described"],
      openIssues: ["Repayment failure handling is not defined"],
      unknowns: ["Exception queue ownership"],
      whatWouldMakeThisReady:
        "Define behaviour for failed or partial settlement deductions and name the owning operations team.",
    },
    {
      domain: "RELEASE",
      state: "BLOCKED",
      evidenceSatisfied: ["Release scope identified for the current phase"],
      openIssues: [
        "Critical finance rule conflict remains open",
        "Compliance approval state cannot be determined",
      ],
      unknowns: ["Release date has not been confirmed in connected evidence"],
      whatWouldMakeThisReady:
        "Close the critical finance conflict and establish the Compliance approval position.",
    },
  ],
};
