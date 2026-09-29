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
/**
 * The actor label on records names a Platform Owner acting outside their
 * memberships ("Name (Platform Owner, not a member)"); that annotation is part
 * of product history and stays there. In the shell the name and the note are
 * shown separately, so initials and the display name never absorb it (m9).
 */
export const PLATFORM_ACTOR_NOTE=' (Platform Owner, not a member)';
export function splitActorLabel(label:string):{name:string;note:string|null} {
  return label.endsWith(PLATFORM_ACTOR_NOTE)?{name:label.slice(0,-PLATFORM_ACTOR_NOTE.length),note:'Platform Owner · not a member here'}:{name:label,note:null};
}
/** Up to two initials from a name, for avatars. */
export function initials(name:string) {
  const words=name.trim().split(/\s+/).filter(Boolean);
  return ((words[0]?.[0]??'')+(words.length>1?words[words.length-1]![0]:words[0]?.[1]??'')).toUpperCase()||'?';
}
