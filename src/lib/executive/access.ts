import { hasOrganizationAdminAuthority } from '../auth/roles.ts';
import type { WorkspaceAccess } from '../auth/core.ts';
export function canApprovePerformance(ctx: Pick<WorkspaceAccess,'role'|'platformRole'|'isProductLead'>): boolean {
  return hasOrganizationAdminAuthority(ctx) || (ctx.role === 'MEMBER' && ctx.isProductLead);
}
export function assertPerformanceApproval(ctx: Pick<WorkspaceAccess,'role'|'platformRole'|'isProductLead'>) {
  if (!canApprovePerformance(ctx)) throw Error('An organization owner, administrator or product lead must approve business reporting.');
}
