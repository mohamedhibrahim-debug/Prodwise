import "server-only";

import {
  CLAIM_STATUSES,
  CLAIM_TYPES,
  DOMAINS,
  type ClaimStatus,
  type ClaimType,
  type Domain,
} from "@/lib/domain/types";

/** Form parsing shared by the create and edit claim actions. */

export interface ClaimFormState {
  error: string | null;
}

export function readClaimType(v: FormDataEntryValue | null): ClaimType | null {
  const s = String(v ?? "");
  return (CLAIM_TYPES as readonly string[]).includes(s) ? (s as ClaimType) : null;
}

export function readClaimStatus(
  v: FormDataEntryValue | null,
): ClaimStatus | null {
  const s = String(v ?? "");
  return (CLAIM_STATUSES as readonly string[]).includes(s)
    ? (s as ClaimStatus)
    : null;
}

export function readDomain(v: FormDataEntryValue | null): Domain | null {
  const s = String(v ?? "");
  return (DOMAINS as readonly string[]).includes(s) ? (s as Domain) : null;
}

export function readText(v: FormDataEntryValue | null): string {
  return String(v ?? "").trim();
}
