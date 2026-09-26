import "server-only";
import type { DeliveryMember, WorkspaceAccess } from "./types";

/** Integration seam. Replace these bodies with the Auth exports after 0010 is merged.
 * Fail closed: there is no demo signed-in actor, public fallback or environment bypass. */
export async function requireDeliveryAccess(): Promise<WorkspaceAccess> {
  throw new Error("Sign-in integration is required before delivery data can be opened.");
}
export async function requireDeliveryWriteAccess(): Promise<WorkspaceAccess> {
  throw new Error("Sign-in integration is required before delivery changes can be saved.");
}
export async function requireDeliveryFinalizeAccess(): Promise<WorkspaceAccess> {
  throw new Error("Sign-in integration is required before a review can be finalized.");
}
export async function deliveryWorkspaceMembers(): Promise<DeliveryMember[]> {
  throw new Error("Sign-in integration is required before owners can be assigned.");
}
