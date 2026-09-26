import "server-only";
import type { DeliveryMember, WorkspaceAccess } from "./types";
import { requireWorkspaceAccess, requireBusinessWriteAccess, requireReviewFinalizeAccess } from "@/lib/auth/access";
import { listWorkspaceMembers } from "@/lib/auth/service";

/** Delivery shares the fresh signed-in identity and independent write guards. */
export async function requireDeliveryAccess(): Promise<WorkspaceAccess> {
  return requireWorkspaceAccess();
}
export async function requireDeliveryWriteAccess(): Promise<WorkspaceAccess> {
  return requireBusinessWriteAccess();
}
export async function requireDeliveryFinalizeAccess(): Promise<WorkspaceAccess> {
  return requireReviewFinalizeAccess();
}
export async function deliveryWorkspaceMembers(): Promise<DeliveryMember[]> {
  return (await listWorkspaceMembers()).map(({id,workspaceId,displayName,role,active,isProductLead}) =>
    ({id,workspaceId,displayName,role,active,isProductLead}));
}
