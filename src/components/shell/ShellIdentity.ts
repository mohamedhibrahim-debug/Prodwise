import type { WorkspaceAccess } from '@/lib/auth/core';
import type { WorkspacePresentation } from '@/lib/workspace/context';
export interface ShellIdentity { access:WorkspaceAccess; presentation:WorkspacePresentation; guest:boolean; }
export function organizationRoleLabel(identity:ShellIdentity) {
  const role=identity.access.role;
  return (role==='ORG_OWNER'?'Org Owner':role==='ADMIN'?'Admin':role==='MEMBER'?'Member':role==='VIEWER'?'Viewer · read-only':'Platform access · not a member · your changes are labelled Platform Owner')+(identity.access.isProductLead?' · Product Lead':'');
}
