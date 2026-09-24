import type { StoreShape } from "./store";

/** Idempotent upgrade for local JSON written before Stage 2.1. */
export function upgradeStoreShape(store: StoreShape): StoreShape {
  return {
    ...store,
    activity: store.activity.map((entry) => ({
      ...entry,
      entityType: entry.entityType ?? null,
      entityId: entry.entityId ?? null,
      payload: entry.payload ?? null,
      actorLabel: entry.actorLabel ?? null,
    })),
    claims: store.claims.map((claim) => ({
      ...claim,
      origin: claim.origin ?? "LEGACY",
      verifiedAt: claim.verifiedAt ?? null,
      verifiedActorId: claim.verifiedActorId ?? null,
      verifiedActorLabel: claim.verifiedActorLabel ?? null,
      verificationBasis: claim.verificationBasis ?? null,
      verificationNote: claim.verificationNote ?? null,
    })),
    claimEvidence: store.claimEvidence.map((link) => ({
      ...link,
      locator: link.locator ?? null,
      excerpt: link.excerpt ?? null,
    })),
    findingStates: store.findingStates.map((state) => ({
      ...state,
      outcome: state.outcome ?? null,
      chosenClaimId: state.chosenClaimId ?? null,
      decisionClaimId: state.decisionClaimId ?? null,
      decidedValue: state.decidedValue ?? null,
      confirmedWith: state.confirmedWith ?? null,
      actorId: state.actorId ?? null,
      actorLabel: state.actorLabel ?? null,
      confirmerLabel: state.confirmerLabel ?? null,
      confirmerSetAt: state.confirmerSetAt ?? null,
      confirmerSetByLabel: state.confirmerSetByLabel ?? null,
    })),
  };
}
