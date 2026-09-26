import { AccessError } from './core';
const messages:Record<string,string>={
  LAST_ADMIN:'The last active Admin cannot be demoted or deactivated.',
  VIEWER_CANNOT_LEAD:'A Viewer cannot receive Product Lead capability. Choose Admin or Member first.',
  INVITE_INVALID:'This invitation is expired, revoked or already used. Ask your Admin for a new link.',
  ACCOUNT_ALREADY_EXISTS:'This person already has an account. Update their existing access instead.',
  ACCESS_DENIED:'That item is unavailable in your workspace.',
  ADMIN_REQUIRED:'Only an Admin can manage workspace access.',
  INVALID_INVITATION:'Enter a valid email and role.',
  INVALID_MEMBERSHIP:'Choose a valid role and access setting.',
  INVITATION_IDENTITY_MISMATCH:'Account setup could not complete. Contact your Admin.',
};
export function authErrorMessage(error:unknown,fallback:string){
  if(error instanceof AccessError)return error.message;
  if(error instanceof Error){
    const translated=messages[error.message];if(translated)return translated;
    if(error.message.includes('one_pending_workspace_invite'))return 'This email already has a pending invitation. Resend or revoke its existing link.';
    if(/constraint|permission denied|relation |column |function |duplicate key/.test(error.message))return fallback;
    return error.message;
  }
  return fallback;
}
