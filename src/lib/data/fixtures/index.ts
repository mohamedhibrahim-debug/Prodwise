import type { InitiativeIntelligence } from "@/lib/domain/types";
import { merchantFlexFinance } from "./merchant-flex-finance";
import {
  collectionsReportingRebuild,
  instantSettlementPayout,
  merchantKycRefresh,
} from "./supporting";

export { DEMO_SLUG, SEED_ACTIVITY, SEED_INITIATIVES } from "./initiatives";
export { SEED_EVIDENCE, SEED_SOURCES } from "./evidence";

/**
 * Synthetic intelligence, keyed by initiative **slug** — never by a generated
 * database id, so the fixtures survive re-seeding and work identically against
 * Supabase and the local repository.
 */
const INTELLIGENCE_BY_SLUG: Record<string, InitiativeIntelligence> = {
  "merchant-flex-finance": merchantFlexFinance,
  "instant-settlement-payout": instantSettlementPayout,
  "merchant-kyc-refresh": merchantKycRefresh,
  "collections-reporting-rebuild": collectionsReportingRebuild,
};

/**
 * Returns the synthetic picture for a seeded initiative, or null.
 *
 * Null is the normal, expected answer for any initiative a user creates: there
 * is no reasoning engine in Phase 1, so a real initiative genuinely has nothing
 * to show. Every screen renders honest empty states in that case, which is how
 * those code paths get exercised rather than mocked.
 */
export function getIntelligence(slug: string): InitiativeIntelligence | null {
  return INTELLIGENCE_BY_SLUG[slug] ?? null;
}

export function hasIntelligence(slug: string): boolean {
  return slug in INTELLIGENCE_BY_SLUG;
}
export { SEED_CLAIMS, SEED_CLAIM_EVIDENCE } from "./claims";
