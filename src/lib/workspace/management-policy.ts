import { canBusinessWrite, hasOrganizationAdminAuthority } from '../auth/roles.ts';
import type { WorkspaceAccess } from '../auth/core.ts';
import type { DeliveryMember } from '../delivery/types.ts';

export type InitiativeWrite = 'CREATE' | 'BASICS' | 'CONTEXT' | 'OWNER' | 'DELIVERY' | 'SOURCE_LINK' | 'SOURCE_UNLINK' | 'ARCHIVE' | 'RESTORE';
export interface ManagedIdentity { workspaceId?: string; archivedAt?: string | null; updatedAt: string; }

/** Product Lead is a capability, never an implicit administrator. */
export function canManageInitiative(ctx: WorkspaceAccess, operation: InitiativeWrite, ownerMemberId: string | null, linkedByUserId?: string | null): boolean {
  if (!canBusinessWrite(ctx)) return false;
  if (hasOrganizationAdminAuthority(ctx)) return true;
  const owns = ctx.memberId !== null && ctx.memberId === ownerMemberId;
  switch (operation) {
    case 'CREATE': case 'SOURCE_LINK': return true;
    case 'OWNER': return ctx.isProductLead;
    case 'ARCHIVE': case 'RESTORE': return false;
    case 'SOURCE_UNLINK': return owns || linkedByUserId === ctx.actor.id;
    default: return owns;
  }
}

export function assertManagementWrite(ctx: WorkspaceAccess, operation: InitiativeWrite, initiative: ManagedIdentity, ownerMemberId: string | null, expectedUpdatedAt?: string, linkedByUserId?: string | null): void {
  if (initiative.workspaceId !== ctx.workspaceId) throw new Error('This initiative is unavailable in your organization.');
  if (!canManageInitiative(ctx, operation, ownerMemberId, linkedByUserId)) throw new Error('Your organization role does not allow this change. Nothing was changed.');
  if (initiative.archivedAt && operation !== 'RESTORE') throw new Error('Archived — restore to edit. Nothing was changed.');
  if (expectedUpdatedAt !== undefined && expectedUpdatedAt !== initiative.updatedAt) throw new Error('This initiative changed while you were editing. Your changes were not saved. Reload and review the latest values.');
}

/** Initial self-assignment is allowed only inside atomic creation. */
export function validateInitialOwner(ctx: WorkspaceAccess, ownerMemberId: string, members: readonly DeliveryMember[]): void {
  if (!canManageInitiative(ctx, 'CREATE', null)) throw new Error('Viewers cannot create initiatives.');
  const member = members.find(m => m.id === ownerMemberId && m.workspaceId === ctx.workspaceId && m.active && m.role !== 'VIEWER');
  if (!member) throw new Error('Choose an active owner from this organization.');
  if (!hasOrganizationAdminAuthority(ctx) && !ctx.isProductLead && ctx.memberId !== ownerMemberId) throw new Error('You may assign yourself when creating an initiative. An admin or Product Lead assigns another owner.');
}
