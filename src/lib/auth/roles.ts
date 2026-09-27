export const ROLES = ['ORG_OWNER', 'ADMIN', 'MEMBER', 'VIEWER'] as const;
export type Role = typeof ROLES[number];
export type PlatformRole = 'PLATFORM_OWNER' | null;
interface Authority {
    platformRole: PlatformRole;
    role: Role | null;
}
export function isPlatformOwner(ctx: {
    platformRole: PlatformRole;
}) { return ctx.platformRole === 'PLATFORM_OWNER'; }
export function hasOrganizationAdminAuthority(ctx: Authority) { return isPlatformOwner(ctx) || ctx.role === 'ORG_OWNER' || ctx.role === 'ADMIN'; }
export function hasOrganizationOwnerAuthority(ctx: Authority) { return isPlatformOwner(ctx) || ctx.role === 'ORG_OWNER'; }
export function canBusinessWrite(ctx: Authority) { return isPlatformOwner(ctx) || ['ORG_OWNER', 'ADMIN', 'MEMBER'].includes(ctx.role ?? ''); }
/** Compatibility changes spelling only. It never chooses or elevates an Owner. */
export function normalizeLegacyRole(role: string): Role {
    const normalized = role.trim().toUpperCase() === 'OWNER' ? 'ORG_OWNER' : role.trim().toUpperCase();
    if (!(ROLES as readonly string[]).includes(normalized))
        throw new Error('INVALID_ROLE');
    return normalized as Role;
}
export function isWorkspaceAdministrator(role: string | null): boolean {
    try {
        return ['ORG_OWNER', 'ADMIN'].includes(normalizeLegacyRole(role ?? ''));
    }
    catch {
        return false;
    }
}
export function isWorkspaceOwner(role: string | null): boolean {
    try {
        return normalizeLegacyRole(role ?? '') === 'ORG_OWNER';
    }
    catch {
        return false;
    }
}

/**
 * A Platform Owner acting in an organization where they hold no membership is named as such on
 * every record they create, so product history never presents platform authority as a member's.
 */
export function platformActorLabel(displayName: string, platformRole: string | null, isMember: boolean): string {
    return platformRole === 'PLATFORM_OWNER' && !isMember ? `${displayName} (Platform Owner, not a member)` : displayName;
}
