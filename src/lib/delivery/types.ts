import type { InitiativeSnapshot } from "../domain/types.ts";
import type { Role } from "../auth/roles.ts";

export const FACT_KINDS = ["SCOPE", "OWNER", "SOLUTION_DEFINED", "DEV_STARTED", "TARGET_LIVE", "ACTUAL_LIVE", "NEXT_MILESTONE", "BLOCKER", "NEXT_STEP"] as const;
export type FactKind = typeof FACT_KINDS[number];
export type { WorkspaceAccess } from "../auth/core.ts";
import type { WorkspaceAccess } from "../auth/core.ts";
export interface DeliveryMember {
  id: string; workspaceId: string; displayName: string; role: Role; active: boolean; isProductLead: boolean;
}
export interface FactValue { date: string | null; text: string | null; memberId: string | null; extent: "PARTIAL" | "FULL" | null; }
export interface DeliveryFact {
  id: string; workspaceId: string; initiativeId: string; kind: FactKind; revision: number;
  value: FactValue; state: "SET" | "RETRACTED";
  basis: "EVIDENCE" | "DIRECT_KNOWLEDGE"; note: string; evidenceId: string | null; locator: string | null;
  supportDigest: string | null; confirmedByMemberId: string | null; confirmedByUserId?: string; confirmedByLabel: string; updatedAt: string;
}
export interface DeliveryEvent { id: string; workspaceId: string; initiativeId: string; occurredAt: string; actor: WorkspaceAccess["actor"]; before: DeliveryFact | null; after: DeliveryFact; }
export interface PortfolioSource { snapshots: InitiativeSnapshot[]; members: DeliveryMember[]; }
export interface PortfolioInput extends PortfolioSource { workspaceId: string; facts: DeliveryFact[]; events: DeliveryEvent[]; asOf: string; digest: string; }
export interface NarrativeLine { referenceId: string; text: string; }
export interface ReviewSection {
  initiativeId: string; ownerMemberId: string | null; revision: number;
  headline: string; updates: string; attention: string; decisionNeeded: string; nextMilestone: string; nextStep: string;
  sourceDigest: string; needsRecheck: boolean; editedByMemberId: string | null; editedByUserId?: string; editedByLabel?: string; editedAt: string | null;
  aiOriginal: NarrativeLine[] | null;
}
export interface AiDraft {
  mode: "CLAUDE" | "TEMPLATE"; model: string | null; promptVersion: string; generatedAt: string; inputDigest: string;
  original: { initiativeId: string; lines: NarrativeLine[] }[]; reason: string | null;
}
export interface WeeklyReview {
  id: string; workspaceId: string; week: string; status: "DRAFT" | "FINAL"; revision: number;
  baselineReviewId: string | null; input: PortfolioInput; sections: ReviewSection[]; aiDrafts: AiDraft[];
  createdAt: string; createdByMemberId: string | null; createdByUserId?: string; finalizedAt: string | null; finalizedByMemberId: string | null; finalizedByUserId?: string; finalizedByLabel: string | null;
}
export interface DeliveryState { schema: 1; facts: DeliveryFact[]; events: DeliveryEvent[]; reviews: WeeklyReview[]; }
export interface Change { id: string; initiativeId: string; kind: FactKind | "KNOWLEDGE" | "DECISION" | "STAGE" | "SUPPORT"; label: string; eventIds: string[]; days: number | null; lateRecorded: boolean; }
export interface Reference { id: string; initiativeId: string; texts: [string, string]; }
export interface SectionEdit { headline: string; updates: string; attention: string; decisionNeeded: string; nextMilestone: string; nextStep: string; }
export const EMPTY_STATE: DeliveryState = { schema: 1, facts: [], events: [], reviews: [] };
