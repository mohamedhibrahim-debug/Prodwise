import type {
  ClaimStatus,
  ClaimTrust,
  EvidenceRecord,
  MemoryClaim,
  VerificationBasis,
} from "./types";

export const FUTURE_PHASE_ERROR =
  "This claim relies on future-phase evidence only. Record the phase it applies to before verifying it.";

export interface VerificationCandidate {
  status: ClaimStatus;
  phase: string | null;
  updatedAt: string;
  evidence: Pick<EvidenceRecord, "boundary">[];
}

export function validateVerification(
  claim: VerificationCandidate,
  input: { basis: VerificationBasis; note: string | null; expectedUpdatedAt: string },
): string | null {
  if (claim.status !== "UNVERIFIED" && claim.status !== "DRAFT") {
    return "Only unverified or draft claims can be verified.";
  }
  if (claim.updatedAt !== input.expectedUpdatedAt) {
    return "This claim changed while you were reviewing it. Reload and try again.";
  }
  if (input.basis === "DIRECT_KNOWLEDGE") {
    return input.note?.trim()
      ? null
      : "Record what direct knowledge supports this verification.";
  }
  const current = claim.evidence.some((e) => e.boundary === "CURRENT_SCOPE");
  if (current) return null;
  const future = claim.evidence.some((e) => e.boundary === "FUTURE_PHASE");
  if (future && !claim.phase?.trim()) return FUTURE_PHASE_ERROR;
  if (future) return null;
  return "Link current-scope evidence before verifying this claim.";
}

export function canOrdinaryUpdateStatus(from: ClaimStatus, to: ClaimStatus): boolean {
  return to !== "ACTIVE" || from === "ACTIVE";
}

export function trustLine(claim: Pick<MemoryClaim, "status" | keyof ClaimTrust>): string | null {
  if (claim.status !== "ACTIVE") return null;
  if (claim.verifiedAt) {
    const date = new Intl.DateTimeFormat("en", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(claim.verifiedAt));
    return claim.verifiedActorId === null
      ? `Verified in demo mode · ${date}`
      : `Verified by ${claim.verifiedActorLabel ?? "Recorded actor"} · ${date}`;
  }
  return claim.origin === "LEGACY" ? "Verification history not recorded." : null;
}
