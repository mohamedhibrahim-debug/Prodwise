import type { ClaimRecord } from "@/lib/domain/types";

/**
 * Seeded Product Memory, migrated from the Phase 1 synthetic fixture into
 * persisted claims.
 *
 * This is CURATED DEMO KNOWLEDGE. Phase 3 performs no inference and no
 * extraction: nothing here was produced from the evidence records it links to.
 * The links record which evidence a human would cite for each claim, and
 * nothing more.
 *
 * Claims are deliberately left unlinked where no seeded evidence genuinely
 * corresponds (c-1b, c-1c, c-8). Inventing provenance so every row looks
 * sourced is exactly the dishonesty this phase exists to prevent.
 */

const MFF = "11111111-1111-4111-8111-111111111111";
const DEMO_USER = "00000000-0000-4000-8000-000000000001";

export const SEED_CLAIMS: ClaimRecord[] = [
  /* ── Decisions (3) ─────────────────────────────────────────────────────── */
  {
    id: "c-1",
    initiativeId: MFF,
    type: "DECISION",
    status: "ACTIVE",
    subject: "Financing Model",
    attribute: "Offered Products",
    value: "Islamic Financing Only",
    domain: "PRODUCT",
    phase: "Phase 1",
    confidence: "HIGH",
    supersededByClaimId: null,
    createdBy: DEMO_USER,
    createdAt: "2026-08-18T10:05:00.000Z",
    updatedAt: "2026-08-18T10:05:00.000Z",
  },
  {
    id: "c-1b",
    initiativeId: MFF,
    type: "DECISION",
    status: "ACTIVE",
    subject: "Repayment Collection",
    attribute: "Collection Frequency",
    value:
      "Repayment is deducted daily from settlement activity rather than invoiced monthly",
    domain: "FINANCE",
    phase: "Phase 1",
    confidence: "HIGH",
    supersededByClaimId: null,
    createdBy: DEMO_USER,
    createdAt: "2026-05-11T00:00:00.000Z",
    updatedAt: "2026-05-11T00:00:00.000Z",
  },
  {
    id: "c-1c",
    initiativeId: MFF,
    type: "DECISION",
    status: "ACTIVE",
    subject: "Disbursement",
    attribute: "Phase 1 Approach",
    value:
      "Financing is disbursed manually in Phase 1; automation is deferred to a later phase",
    domain: "OPERATIONS",
    phase: "Phase 1",
    confidence: "HIGH",
    supersededByClaimId: null,
    createdBy: DEMO_USER,
    createdAt: "2026-08-05T00:00:00.000Z",
    updatedAt: "2026-08-05T00:00:00.000Z",
  },

  /* ── Requirements: REQUIREMENT + BUSINESS_RULE (5) ─────────────────────── */
  {
    // Retained as history, replaced by c-1. Never deleted.
    id: "c-2",
    initiativeId: MFF,
    type: "REQUIREMENT",
    status: "SUPERSEDED",
    subject: "Financing Model",
    attribute: "Offered Products",
    value: "Traditional + Islamic Financing",
    domain: "PRODUCT",
    phase: "Phase 1",
    confidence: "HIGH",
    supersededByClaimId: "c-1",
    createdBy: DEMO_USER,
    createdAt: "2026-04-18T00:00:00.000Z",
    updatedAt: "2026-08-18T10:05:00.000Z",
  },
  {
    id: "c-3",
    initiativeId: MFF,
    type: "REQUIREMENT",
    status: "ACTIVE",
    subject: "Daily Repayment",
    attribute: "Calculation Divisor",
    value: "27",
    domain: "FINANCE",
    phase: "Phase 1",
    confidence: "HIGH",
    supersededByClaimId: null,
    createdBy: DEMO_USER,
    createdAt: "2026-06-02T00:00:00.000Z",
    updatedAt: "2026-06-02T00:00:00.000Z",
  },
  {
    id: "c-4",
    initiativeId: MFF,
    type: "REQUIREMENT",
    status: "ACTIVE",
    subject: "Daily Repayment",
    attribute: "Calculation Divisor",
    value: "30",
    domain: "FINANCE",
    phase: "Phase 1",
    confidence: "HIGH",
    supersededByClaimId: null,
    createdBy: DEMO_USER,
    createdAt: "2026-08-21T00:00:00.000Z",
    updatedAt: "2026-08-21T00:00:00.000Z",
  },
  {
    id: "c-5",
    initiativeId: MFF,
    type: "BUSINESS_RULE",
    status: "ACTIVE",
    subject: "Repayment Source",
    attribute: "Deduction Mechanism",
    value: "Deducted from merchant settlement activity",
    domain: "FINANCE",
    phase: "Phase 1",
    confidence: "HIGH",
    supersededByClaimId: null,
    createdBy: DEMO_USER,
    createdAt: "2026-05-11T00:00:00.000Z",
    updatedAt: "2026-05-11T00:00:00.000Z",
  },
  {
    id: "c-6",
    initiativeId: MFF,
    type: "BUSINESS_RULE",
    status: "ACTIVE",
    subject: "Merchant Eligibility",
    attribute: "Minimum Trading History",
    value: "6 months of continuous settlement activity",
    domain: "PRODUCT",
    phase: "Phase 1",
    confidence: "MEDIUM",
    supersededByClaimId: null,
    createdBy: DEMO_USER,
    createdAt: "2026-07-09T00:00:00.000Z",
    updatedAt: "2026-07-09T00:00:00.000Z",
  },

  /* ── Risks (2) ─────────────────────────────────────────────────────────── */
  {
    id: "c-7",
    initiativeId: MFF,
    type: "RISK",
    status: "ACTIVE",
    subject: "Repayment Reconciliation",
    attribute: "Exposure",
    value:
      "An incorrect divisor would misstate daily repayment across all active contracts",
    domain: "FINANCE",
    phase: "Phase 1",
    confidence: "HIGH",
    supersededByClaimId: null,
    createdBy: DEMO_USER,
    createdAt: "2026-09-03T00:00:00.000Z",
    updatedAt: "2026-09-03T00:00:00.000Z",
  },
  {
    id: "c-8",
    initiativeId: MFF,
    type: "RISK",
    status: "UNVERIFIED",
    subject: "Merchant Concentration",
    attribute: "Portfolio Exposure",
    value: "Concentration limits per merchant segment are not stated",
    domain: "RISK",
    phase: "Phase 1",
    confidence: "LOW",
    supersededByClaimId: null,
    createdBy: DEMO_USER,
    createdAt: "2026-08-02T00:00:00.000Z",
    updatedAt: "2026-08-02T00:00:00.000Z",
  },

  /* ── Dependencies (2) ──────────────────────────────────────────────────── */
  {
    id: "c-9",
    initiativeId: MFF,
    type: "DEPENDENCY",
    status: "ACTIVE",
    subject: "Settlement Service",
    attribute: "Required Capability",
    value: "Per-merchant daily settlement totals exposed to the finance ledger",
    domain: "TECHNICAL",
    phase: "Phase 1",
    confidence: "HIGH",
    supersededByClaimId: null,
    createdBy: DEMO_USER,
    createdAt: "2026-07-30T00:00:00.000Z",
    updatedAt: "2026-07-30T00:00:00.000Z",
  },
  {
    id: "c-10",
    initiativeId: MFF,
    type: "DEPENDENCY",
    status: "DEFERRED",
    subject: "Disbursement Engine",
    attribute: "Required Capability",
    value: "Automated disbursement to merchant accounts",
    domain: "TECHNICAL",
    phase: "Phase 2",
    confidence: "MEDIUM",
    supersededByClaimId: null,
    createdBy: DEMO_USER,
    createdAt: "2026-08-05T00:00:00.000Z",
    updatedAt: "2026-08-05T00:00:00.000Z",
  },

  /* ── Assumptions — visible under Claims (2) ────────────────────────────── */
  {
    id: "c-11",
    initiativeId: MFF,
    type: "ASSUMPTION",
    status: "UNVERIFIED",
    subject: "Settlement Frequency",
    attribute: "Assumed Cadence",
    value: "Merchants settle on at least 20 days per calendar month",
    domain: "FINANCE",
    phase: "Phase 1",
    confidence: "LOW",
    supersededByClaimId: null,
    createdBy: DEMO_USER,
    createdAt: "2026-07-09T00:00:00.000Z",
    updatedAt: "2026-07-09T00:00:00.000Z",
  },
  {
    id: "c-12",
    initiativeId: MFF,
    type: "ASSUMPTION",
    status: "ACTIVE",
    subject: "Contract Term",
    attribute: "Default Duration",
    value: "6 monthly installments",
    domain: "PRODUCT",
    phase: "Phase 1",
    confidence: "MEDIUM",
    supersededByClaimId: null,
    createdBy: DEMO_USER,
    createdAt: "2026-07-09T00:00:00.000Z",
    updatedAt: "2026-07-09T00:00:00.000Z",
  },
];

/**
 * Claim → evidence provenance.
 *
 * Only links a human would genuinely cite. c-1b (DR-04), c-1c (DR-06) and c-8
 * (a draft risk note) have no corresponding seeded evidence and are left
 * unlinked, so the UI shows "No evidence linked" honestly.
 *
 * c-7 is linked to both repayment evidence records as curated demo knowledge —
 * it was authored that way, not inferred from them.
 */
export const SEED_CLAIM_EVIDENCE: { claimId: string; evidenceId: string }[] = [
  { claimId: "c-1", evidenceId: "e-5" }, // Islamic Financing Only · DR-07
  { claimId: "c-2", evidenceId: "e-7" }, // Original Financing Model · PR v1.0
  { claimId: "c-3", evidenceId: "e-2" }, // MFF-118
  { claimId: "c-4", evidenceId: "e-4" }, // MFF-133
  { claimId: "c-5", evidenceId: "e-1" }, // MFF-104 core epic
  { claimId: "c-6", evidenceId: "e-3" }, // PR v2.3
  { claimId: "c-7", evidenceId: "e-2" }, // many-to-many: one claim, two records
  { claimId: "c-7", evidenceId: "e-4" },
  { claimId: "c-9", evidenceId: "e-1" }, // one record, several claims
  { claimId: "c-10", evidenceId: "e-6" }, // Automated Disbursement · future phase
  { claimId: "c-11", evidenceId: "e-3" },
  { claimId: "c-12", evidenceId: "e-3" },
];
