import type { ActivityEntry, Initiative } from "@/lib/domain/types";

/**
 * Seeded synthetic initiatives.
 *
 * Every row here is demo data (`isDemo: true`) and is labelled as such in the
 * UI. Nothing in this file was produced by a reasoning engine — Phase 1 has no
 * reasoning engine. See CLAUDE.md §20.
 *
 * Four initiatives are seeded rather than one so the Initiatives list can
 * actually demonstrate its specified default priority: one initiative per
 * assessment state (BLOCKED → critical AT_RISK → UNKNOWN → READY).
 */

export const DEMO_SLUG = "merchant-flex-finance";

export const SEED_INITIATIVES: Initiative[] = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    slug: DEMO_SLUG,
    name: "Merchant Flex Finance",
    description:
      "A merchant working-capital financing initiative allowing eligible merchants to request financing and repay installments from settlement activity.",
    knownReferences: "MFF-104, MFF-118, MFF-133\nProduct Requirements v2.3",
    businessLine: "MF",
    stage: "DELIVERY",
    overallState: "AT_RISK",
    stateSummary:
      "Core implementation is progressing, but release readiness is at risk due to unresolved financial-rule validation.",
    isDemo: true,
    createdAt: "2026-04-14T09:20:00.000Z",
    updatedAt: "2026-09-03T14:05:00.000Z",
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    slug: "instant-settlement-payout",
    name: "Instant Settlement Payout",
    description:
      "Same-day settlement payouts to merchant accounts, replacing the T+2 batch cycle for eligible segments.",
    knownReferences: "ISP-42, ISP-77",
    businessLine: "FS",
    stage: "RELEASE_PREPARATION",
    overallState: "BLOCKED",
    stateSummary:
      "Implementation is complete, but release is blocked pending an unresolved partner-bank cut-off dependency.",
    isDemo: true,
    createdAt: "2026-02-02T10:00:00.000Z",
    updatedAt: "2026-09-04T08:41:00.000Z",
  },
  {
    id: "33333333-3333-4333-8333-333333333333",
    slug: "merchant-kyc-refresh",
    name: "Merchant KYC Refresh",
    description:
      "Periodic re-verification of merchant identity and beneficial ownership records across the active merchant base.",
    knownReferences: "KYC-11",
    businessLine: "ACCEPTANCE",
    stage: "ALIGNMENT",
    overallState: "UNKNOWN",
    stateSummary:
      "Too little evidence has been connected to determine where this initiative currently stands.",
    isDemo: true,
    createdAt: "2026-07-22T13:30:00.000Z",
    updatedAt: "2026-08-28T16:12:00.000Z",
  },
  {
    id: "44444444-4444-4444-8444-444444444444",
    slug: "collections-reporting-rebuild",
    name: "Collections Reporting Rebuild",
    description:
      "Rebuild of the daily collections and arrears reporting pack on the current data platform.",
    knownReferences: "CRR-9, CRR-15",
    businessLine: "BP",
    stage: "DEFINITION",
    overallState: "READY",
    stateSummary:
      "Definition is complete and agreed; no material issues were detected in the connected evidence.",
    isDemo: true,
    createdAt: "2026-08-11T11:15:00.000Z",
    updatedAt: "2026-09-01T09:02:00.000Z",
  },
];

export const SEED_ACTIVITY: ActivityEntry[] = [
  {
    id: "a1111111-1111-4111-8111-111111111101",
    initiativeId: "11111111-1111-4111-8111-111111111111",
    eventType: "FINDING_DETECTED",
    summary: "Finance calculation conflict detected",
    occurredAt: "2026-09-03T14:05:00.000Z",
  },
  {
    id: "a1111111-1111-4111-8111-111111111102",
    initiativeId: "11111111-1111-4111-8111-111111111111",
    eventType: "DELIVERY_UPDATE",
    summary: "One implementation story completed",
    occurredAt: "2026-08-29T11:40:00.000Z",
  },
  {
    id: "a1111111-1111-4111-8111-111111111103",
    initiativeId: "11111111-1111-4111-8111-111111111111",
    eventType: "DECISION_RECORDED",
    summary: "Islamic-only financing decision added",
    occurredAt: "2026-08-18T10:05:00.000Z",
  },
  {
    id: "a2222222-2222-4222-8222-222222222201",
    initiativeId: "22222222-2222-4222-8222-222222222222",
    eventType: "DEPENDENCY_FLAGGED",
    summary: "Partner-bank cut-off dependency raised as blocking",
    occurredAt: "2026-09-04T08:41:00.000Z",
  },
  {
    id: "a2222222-2222-4222-8222-222222222202",
    initiativeId: "22222222-2222-4222-8222-222222222222",
    eventType: "DELIVERY_UPDATE",
    summary: "Final implementation story closed",
    occurredAt: "2026-08-26T15:20:00.000Z",
  },
  {
    id: "a3333333-3333-4333-8333-333333333301",
    initiativeId: "33333333-3333-4333-8333-333333333333",
    eventType: "EVIDENCE_ADDED",
    summary: "Initial scoping note connected",
    occurredAt: "2026-08-28T16:12:00.000Z",
  },
  {
    id: "a4444444-4444-4444-8444-444444444401",
    initiativeId: "44444444-4444-4444-8444-444444444444",
    eventType: "DEFINITION_AGREED",
    summary: "Reporting scope agreed with Finance",
    occurredAt: "2026-09-01T09:02:00.000Z",
  },
];
