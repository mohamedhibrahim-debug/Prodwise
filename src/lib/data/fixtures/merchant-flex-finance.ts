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

  /* ── Product memory ────────────────────────────────────────────────────── */

  /* ── Evidence ──────────────────────────────────────────────────────────── */

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
