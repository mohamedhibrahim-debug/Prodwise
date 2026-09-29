import type { WorkspaceAccess } from '@/lib/auth/core';
import type { AuthorizedContext } from '@/lib/auth/context-types';
import type { WorkspacePresentation } from '@/lib/workspace/context';
export interface ShellIdentity {
  access:WorkspaceAccess; presentation:WorkspacePresentation; guest:boolean;
  /** Signed-in email, when it could be read. */
  email?:string|null;
  /** Organizations this person may switch to, read by the root layout. Null when not switchable (Demo guest) or unavailable. */
  contexts?:AuthorizedContext[]|null;
  /** User-facing Demo dataset label (never the internal registry key). */
  datasetLabel?:string|null;
}
export function organizationRoleLabel(identity:ShellIdentity) {
  const role=identity.access.role;
  return (role==='ORG_OWNER'?'Org Owner':role==='ADMIN'?'Admin':role==='MEMBER'?'Member':role==='VIEWER'?'Viewer · read-only':'Platform access · not a member · your changes are labelled Platform Owner')+(identity.access.isProductLead?' · Product Lead':'');
}
/** Compact role for chrome: one or two words. */
export function roleShortLabel(role:string|null|undefined, platformRole?:string|null) {
  return role==='ORG_OWNER'?'Org Owner':role==='ADMIN'?'Admin':role==='MEMBER'?'Member':role==='VIEWER'?'Viewer':platformRole==='PLATFORM_OWNER'?'Platform access':'No membership';
}
/** Up to two initials from a name, for avatars. */
export function initials(name:string) {
  const words=name.trim().split(/\s+/).filter(Boolean);
  return ((words[0]?.[0]??'')+(words.length>1?words[words.length-1]![0]:words[0]?.[1]??'')).toUpperCase()||'?';
}
