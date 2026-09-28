import { AccessError } from './core';
import { safeMessage } from '../errors/safe-message.ts';
const messages: Record<string, string> = {
    LAST_ORG_OWNER: 'An active organization must retain at least one active Organization Owner.',
    LAST_PLATFORM_OWNER: 'The platform must retain at least one active Platform Owner.',
    PLATFORM_OWNER_REQUIRED: 'Platform Owner access is required.',
    PLATFORM_IDENTITY_PROTECTED: 'Use dedicated platform administration for platform identities.',
    AUDIT_REASON_REQUIRED: 'Enter a reason for this platform change.',
    MEMBERSHIP_ALREADY_EXISTS: 'This person already has organization access.',
    LAST_ADMIN: 'The last active Admin cannot be demoted or deactivated.',
    OWNER_REQUIRED: 'Organization Owner authority is required.',
    OWNER_RESERVED: 'Owner cannot be assigned through invitations or standard user management.',
    OWNER_PROTECTED: 'Organization owners are managed through dedicated platform administration.',
    OWNER_BOOTSTRAP_REQUIRED: 'This organization requires owner recovery.',
    OWNER_INVARIANT: 'An active organization must retain at least one active Organization Owner.',
    EMAIL_NOT_ALLOWED: 'This email is not allowed by the organization policy.',
    VIEWER_CANNOT_LEAD: 'A Viewer cannot receive Product Lead capability. Choose Admin or Member first.',
    INVITE_INVALID: 'This invitation is expired, revoked or already used. Ask your Admin for a new link.',
    ACCOUNT_ALREADY_EXISTS: 'This person already has an account. Update their existing access instead.',
    ACCESS_DENIED: 'That item is unavailable in your workspace.',
    ADMIN_REQUIRED: 'Only an Admin can manage workspace access.',
    INVALID_INVITATION: 'Enter a valid email and role.',
    INVALID_MEMBERSHIP: 'Choose a valid role and access setting.',
    REASON_REQUIRED: 'Add a reason for this change. It is recorded in history.',
    INVITATION_IDENTITY_MISMATCH: 'Account setup could not complete. Contact your Admin.',
};
export function authErrorMessage(error: unknown, fallback: string) {
    if (error instanceof AccessError)
        return error.message;
    if (error instanceof Error) {
        const translated = messages[error.message];
        if (translated)
            return translated;
        if ((error.message.includes('one_pending_workspace_invite') || error.message.includes('one_pending_organization_invite')))
            return 'This email already has a pending invitation. Resend or revoke its existing link.';
        return safeMessage(error, fallback);
    }
    return fallback;
}
