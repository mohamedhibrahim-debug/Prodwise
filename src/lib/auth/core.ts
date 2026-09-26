import { randomBytes, randomUUID, scryptSync, timingSafeEqual, createHash, createHmac } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync, rmSync } from 'node:fs';
import { dirname } from 'node:path';
import { normalizeLegacyRole, hasOrganizationAdminAuthority, hasOrganizationOwnerAuthority, canBusinessWrite, isPlatformOwner, type Role, type PlatformRole } from './roles';
import { emailAllowed, validateEmailPolicy, normalizeEmail, type EmailPolicy } from './email-policy';
export type { Role, PlatformRole } from './roles';
export { normalizeEmail } from './email-policy';
export interface WorkspaceAccess {
    workspaceId: string;
    organizationId: string;
    memberId: string | null;
    actor: {
        id: string;
        label: string;
    };
    platformRole: PlatformRole;
    role: Role | null;
    isProductLead: boolean;
}
export interface Identity {
    id: string;
    email: string;
    displayName: string;
    active: boolean;
    platformRole: PlatformRole;
    passwordHash?: string;
    authUserId?: string | null;
}
export interface Organization {
    id: string;
    name: string;
    status: 'BOOTSTRAPPING' | 'ACTIVE';
    emailPolicy: EmailPolicy;
}
export interface Workspace {
    id: string;
    organizationId: string;
    name: string;
    status: 'BOOTSTRAPPING' | 'ACTIVE';
}
export interface OrganizationMembership {
    id: string;
    organizationId: string;
    userId: string;
    role: Role;
    isProductLead: boolean;
    active: boolean;
    policyOverride: boolean;
    policyOverrideReason: string | null;
}
export interface Member extends OrganizationMembership {
    workspaceId: string;
    email: string;
    displayName: string;
    platformRole: PlatformRole;
    authUserId?: string | null;
}
export interface Invitation {
    id: string;
    workspaceId: string;
    organizationId: string;
    email: string;
    role: Role;
    tokenHash: string;
    expiresAt: string;
    revokedAt: string | null;
    usedAt: string | null;
    invitedBy: string;
    provisionedByPlatform: boolean;
    policyOverride: boolean;
    policyOverrideReason: string | null;
}
export interface Session {
    tokenHash: string;
    userId: string;
    workspaceId: string;
    organizationId: string;
    expiresAt: string;
    accessToken?: string;
    refreshToken?: string;
}
export interface AuthEvent {
    id: string;
    workspaceId: string | null;
    organizationId: string | null;
    actorId: string;
    actorLabel: string;
    targetId: string;
    action: string;
    at: string;
    before?: unknown;
    after?: unknown;
    reason?: string;
    policyOverridden?: boolean;
}
export interface AuthState {
    schema: 2;
    workspaces: Workspace[];
    organizations: Organization[];
    identities: Identity[];
    memberships: OrganizationMembership[];
    invitations: Invitation[];
    sessions: Session[];
    events: AuthEvent[];
}
export interface AuthProjection extends AuthState {
    workspace: Workspace;
    organization: Organization;
    members: Member[];
}
export class AccessError extends Error {
    code: string;
    constructor(code: string, message: string) { super(message); this.name = 'AccessError'; this.code = code; }
}
export const hash = (value: string) => createHash('sha256').update(value).digest('hex');
export const opaqueToken = () => randomBytes(32).toString('base64url');
export function assertAllowedEmail(email: string, policy: EmailPolicy) { if (!emailAllowed(email, policy))
    throw new AccessError('EMAIL_NOT_ALLOWED', 'This email is not allowed by this organization.'); }
export function validatePassword(password: string) { if (password.length < 12 || password.length > 256)
    throw new AccessError('PASSWORD_INVALID', 'Use a password between 12 and 256 characters.'); }
export function passwordHash(password: string) { validatePassword(password); const salt = randomBytes(16).toString('hex'); return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`; }
export function passwordMatches(password: string, saved: string) { const [salt, digest] = saved.split(':'); if (!salt || !digest)
    return false; const expected = Buffer.from(digest, 'hex'), actual = scryptSync(password, salt, 64); return expected.length === actual.length && timingSafeEqual(expected, actual); }
export function signToken(token: string, secret: string) { if (secret.length < 32)
    throw new Error('AUTH_SESSION_SECRET must contain at least 32 characters.'); return `${token}.${createHmac('sha256', secret).update(token).digest('base64url')}`; }
export function unsignedToken(cookie: string | undefined, secret: string): string | null { if (!cookie || secret.length < 32)
    return null; const [token, signature, extra] = cookie.split('.'); if (!token || !signature || extra)
    return null; const expected = Buffer.from(signToken(token, secret).split('.')[1]!), supplied = Buffer.from(signature); return supplied.length === expected.length && timingSafeEqual(supplied, expected) ? token : null; }
export function safeReturnPath(value: string | undefined) { if (!value?.startsWith('/') || value.startsWith('//') || /[\\\u0000-\u0020]/.test(value))
    return '/'; const target = new URL(value, 'https://prodwise.invalid'); if (target.origin !== 'https://prodwise.invalid' || /^\/(login|invite|auth)(\/|$)/.test(target.pathname))
    return '/'; return target.pathname + target.search + target.hash; }
export function contextForMember(member: Member | undefined, workspaceId: string): WorkspaceAccess { if (!member || member.workspaceId !== workspaceId)
    throw new AccessError('ACCESS_DENIED', 'Organization access is unavailable.'); if (!member.active)
    throw new AccessError('DEACTIVATED', 'Your organization access has been deactivated.'); return { workspaceId, organizationId: member.organizationId, memberId: member.id, actor: { id: member.userId, label: member.displayName }, platformRole: member.platformRole, role: normalizeLegacyRole(member.role), isProductLead: member.isProductLead }; }
export function authorizeBusiness(ctx: WorkspaceAccess, enabled: boolean) { if (!canBusinessWrite(ctx))
    throw new AccessError('VIEW_ONLY', 'You have view-only access.'); if (!enabled)
    throw new AccessError('WRITE_DISABLED', 'Changes are disabled in this environment.'); return ctx; }
export function authorizeFinalize(ctx: WorkspaceAccess, enabled: boolean) { if (!hasOrganizationAdminAuthority(ctx) && !ctx.isProductLead)
    throw new AccessError('REVIEW_FINALIZE_DENIED', 'Only an organization administrator or designated Product Lead can finalize a review.'); return authorizeBusiness(ctx, enabled); }
export function authorizeManagement(ctx: WorkspaceAccess, enabled: boolean) { if (!hasOrganizationAdminAuthority(ctx))
    throw new AccessError('ADMIN_REQUIRED', 'Organization administration is required.'); if (!enabled)
    throw new AccessError('MANAGEMENT_DISABLED', 'User management changes are disabled in this environment.'); return ctx; }
export function authorizeOwner(ctx: WorkspaceAccess, enabled = true) { if (!hasOrganizationOwnerAuthority(ctx))
    throw new AccessError('OWNER_REQUIRED', 'Organization owner authority is required.'); if (!enabled)
    throw new AccessError('MANAGEMENT_DISABLED', 'Management changes are disabled in this environment.'); return ctx; }
export function authorizePlatform(ctx: WorkspaceAccess) { if (!isPlatformOwner(ctx))
    throw new AccessError('PLATFORM_OWNER_REQUIRED', 'Platform owner authority is required.'); return ctx; }
export function authorizeInvitationRole(ctx: WorkspaceAccess, role: Role) { if (role === 'ORG_OWNER')
    throw new AccessError('OWNER_RESERVED', 'Organization owners are assigned through platform administration.'); if (!['ADMIN', 'MEMBER', 'VIEWER'].includes(role))
    throw new AccessError('INVALID_MEMBERSHIP', 'Choose a valid role.'); if (role === 'ADMIN')
    authorizeOwner(ctx); }
export function authorizeMembershipChange(ctx: WorkspaceAccess, target: Member, role: Role, active: boolean, isProductLead: boolean) { authorizeInvitationRole(ctx, role); if (target.platformRole === 'PLATFORM_OWNER')
    throw new AccessError('PLATFORM_IDENTITY_PROTECTED', 'Platform identities can only be managed through platform administration.'); if (target.role === 'ORG_OWNER')
    throw new AccessError('OWNER_PROTECTED', 'Use dedicated platform administration to change organization owners.'); if (target.role === 'ADMIN')
    authorizeOwner(ctx); if (role === 'VIEWER' && isProductLead)
    throw new AccessError('VIEWER_CANNOT_LEAD', 'A Viewer cannot receive Product Lead capability.'); if (typeof active !== 'boolean' || typeof isProductLead !== 'boolean')
    throw new AccessError('INVALID_MEMBERSHIP', 'Choose valid access settings.'); }
function reasonRequired(reason: string) { if (!reason.trim() || reason.trim().length > 500)
    throw new AccessError('AUDIT_REASON_REQUIRED', 'Enter a reason up to 500 characters.'); return reason.trim(); }
/** Durable private fixture store. Global identities and organization authority are separate. */
export class LocalAuthStore {
    constructor(public path: string, public workspaceId: string) { }
    private raw(): AuthState { if (!existsSync(this.path))
        throw new AccessError('AUTH_NOT_BOOTSTRAPPED', 'This local installation needs an operator bootstrap.'); const state = JSON.parse(readFileSync(this.path, 'utf8')) as AuthState; if (state.schema !== 2)
        throw new AccessError('OWNER_BOOTSTRAP_REQUIRED', 'An explicit operator migration is required.'); return state; }
    read(bootstrapOnly = false): AuthProjection { const state = this.raw(); const workspace = state.workspaces.find(x => x.id === this.workspaceId), organization = state.organizations.find(x => x.id === workspace?.organizationId); if (!workspace || !organization)
        throw new AccessError('ACCESS_DENIED', 'Workspace configuration does not match.'); if (!bootstrapOnly)
        this.ready(state, organization.id); return { ...state, workspace, organization, members: this.members(state, workspace) }; }
    private members(state: AuthState, workspace: Workspace): Member[] { return state.memberships.filter(x => x.organizationId === workspace.organizationId).map(x => { const identity = state.identities.find(i => i.id === x.userId); if (!identity)
        throw new Error('INVALID_IDENTITY_REFERENCE'); return { ...x, active:x.active&&identity.active, role: normalizeLegacyRole(x.role), workspaceId: workspace.id, email: identity.email, displayName: identity.displayName, platformRole: identity.platformRole, authUserId: identity.authUserId }; }); }
    private ready(state: AuthState, orgId: string) { const org = state.organizations.find(x => x.id === orgId); if (!org || org.status !== 'ACTIVE' || !state.memberships.some(x => x.organizationId === orgId && x.active && x.role === 'ORG_OWNER' && state.identities.some(i => i.id === x.userId && i.active)))
        throw new AccessError('OWNER_BOOTSTRAP_REQUIRED', 'This organization needs owner recovery.'); }
    private context(state: AuthState, userId: string, workspaceId = this.workspaceId, allowRecovery = false): WorkspaceAccess { const identity = state.identities.find(x => x.id === userId && x.active), workspace = state.workspaces.find(x => x.id === workspaceId), org = state.organizations.find(x => x.id === workspace?.organizationId); if (!identity || !workspace || !org)
        throw new AccessError('ACCESS_DENIED', 'Organization access is unavailable.'); if (!allowRecovery || identity.platformRole !== 'PLATFORM_OWNER')
        this.ready(state, org.id); const member = this.members(state, workspace).find(x => x.userId === userId); if (identity.platformRole === 'PLATFORM_OWNER')
        return { workspaceId, organizationId: org.id, memberId: member?.active ? member.id : null, actor: { id: userId, label: identity.displayName }, platformRole: 'PLATFORM_OWNER', role: member?.active ? member.role : null, isProductLead: member?.active ? member.isProductLead : false }; if (!member)
        throw new AccessError('ACCESS_DENIED', 'Organization access is unavailable.'); if (!member.policyOverride)
        assertAllowedEmail(identity.email, org.emailPolicy); return contextForMember(member, workspaceId); }
    private fresh(state: AuthState, ctx: WorkspaceAccess, recovery = false) { if (ctx.workspaceId !== this.workspaceId)
        throw new AccessError('ACCESS_DENIED', 'Workspace configuration does not match.'); return this.context(state, ctx.actor.id, this.workspaceId, recovery); }
    async mutate<T>(fn: (state: AuthState) => T, bootstrapOnly = false): Promise<T> { const lock = `${this.path}.lock`; mkdirSync(dirname(this.path), { recursive: true }); let acquired = false; for (let retry = 0; retry < 100; retry++) {
        try {
            mkdirSync(lock);
            acquired = true;
            break;
        }
        catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'EEXIST')
                throw error;
            await new Promise(r => setTimeout(r, 10));
        }
    } if (!acquired)
        throw new Error('Authentication store is busy.'); try {
        const state = this.raw();
        if (!bootstrapOnly)
            this.ready(state, state.workspaces.find(x => x.id === this.workspaceId)?.organizationId ?? '');
        const result = fn(state);
        for (const org of state.organizations) {
            if (org.status === 'ACTIVE' && !state.memberships.some(x => x.organizationId === org.id && x.active && x.role === 'ORG_OWNER' && state.identities.some(i => i.id === x.userId && i.active)))
                throw new AccessError('LAST_ORG_OWNER', 'An active organization must retain an active owner.');
        }
        if (state.identities.some(x => x.platformRole === 'PLATFORM_OWNER') && !state.identities.some(x => x.active && x.platformRole === 'PLATFORM_OWNER'))
            throw new AccessError('LAST_PLATFORM_OWNER', 'An active platform owner must remain.');
        for (const member of state.memberships) {
            if (member.policyOverride && !member.policyOverrideReason?.trim())
                throw new Error('AUDIT_REASON_REQUIRED');
        }
        const temporary = `${this.path}.${randomUUID()}.tmp`;
        try {
            writeFileSync(temporary, JSON.stringify(state, null, 2), { mode: 0o600 });
            renameSync(temporary, this.path);
        }
        finally {
            if (existsSync(temporary))
                rmSync(temporary);
        }
        return result;
    }
    finally {
        rmSync(lock, { recursive: true });
    } }
    /** Trusted operator only. Explicit org policy; no company or owner email defaults. */
    bootstrap(email: string, displayName: string, password: string, organization: {
        id: string;
        name: string;
        emailPolicy: EmailPolicy;
    }) { if (existsSync(this.path))
        throw new Error('Installation already bootstrapped.'); const policy = validateEmailPolicy(organization.emailPolicy); assertAllowedEmail(email, policy); const identity: Identity = { id: randomUUID(), email: normalizeEmail(email), displayName, active: true, platformRole: null, passwordHash: passwordHash(password) }; const member: OrganizationMembership = { id: randomUUID(), organizationId: organization.id, userId: identity.id, role: 'ORG_OWNER', active: true, isProductLead: false, policyOverride: false, policyOverrideReason: null }; const state: AuthState = { schema: 2, workspaces: [{ id: this.workspaceId, organizationId: organization.id, name: organization.name, status: 'ACTIVE' }], organizations: [{ ...organization, emailPolicy: policy, status: 'ACTIVE' }], identities: [identity], memberships: [member], invitations: [], sessions: [], events: [] }; mkdirSync(dirname(this.path), { recursive: true }); writeFileSync(this.path, JSON.stringify(state, null, 2), { flag: 'wx', mode: 0o600 }); return this.read().members[0]!; }
    /** Trusted operator, explicit global identity id; never exposed by application actions. */
    async bootstrapPlatformOwner(userId: string) { await this.mutate(state => { if (state.identities.some(x => x.platformRole === 'PLATFORM_OWNER'))
        throw new Error('PLATFORM_BOOTSTRAP_ALREADY_COMPLETE'); const identity = state.identities.find(x => x.id === userId && x.active); if (!identity)
        throw new Error('ACCESS_DENIED'); identity.platformRole = 'PLATFORM_OWNER'; this.event(state, { workspaceId: this.workspaceId, organizationId: state.workspaces.find(x => x.id === this.workspaceId)!.organizationId, memberId: null, actor: { id: identity.id, label: identity.displayName }, platformRole: 'PLATFORM_OWNER', role: null, isProductLead: false }, userId, 'PLATFORM_BOOTSTRAPPED', null, { platformRole: 'PLATFORM_OWNER' }, 'Trusted operator bootstrap', false); }, true); }
    async login(email: string, password: string) { const state = this.raw(), identity = state.identities.find(x => x.email === normalizeEmail(email)); const saved = identity?.passwordHash ?? `00000000000000000000000000000000:${'00'.repeat(64)}`; if (!passwordMatches(password, saved) || !identity)
        throw new AccessError('INVALID_CREDENTIALS', 'Email or password is incorrect.'); const token = opaqueToken(); await this.mutate(current => { const ctx = this.context(current, identity.id, this.workspaceId, true); current.sessions.push({ tokenHash: hash(token), userId: identity.id, workspaceId: this.workspaceId, organizationId: ctx.organizationId, expiresAt: new Date(Date.now() + 8 * 3600000).toISOString() }); }, true); return token; }
    session(token: string) { const state = this.raw(), session = state.sessions.find(x => x.tokenHash === hash(token) && x.workspaceId === this.workspaceId && Date.parse(x.expiresAt) > Date.now()); if (!session)
        throw new AccessError('UNAUTHENTICATED', 'Sign in to continue.'); const ctx = this.context(state, session.userId, this.workspaceId, true); if (ctx.organizationId !== session.organizationId)
        throw new AccessError('ACCESS_DENIED', 'Session organization mismatch.'); return ctx; }
    async logout(token: string) { await this.mutate(state => { state.sessions = state.sessions.filter(x => x.tokenHash !== hash(token) || x.workspaceId !== this.workspaceId); }, true); }
    async changePassword(ctx: WorkspaceAccess, currentPassword: string, nextPassword: string) { const saved = passwordHash(nextPassword); await this.mutate(state => { const actor = this.fresh(state, ctx, true), identity = state.identities.find(x => x.id === actor.actor.id)!; if (!identity.passwordHash || !passwordMatches(currentPassword, identity.passwordHash))
        throw new AccessError('INVALID_CREDENTIALS', 'Current password is incorrect.'); identity.passwordHash = saved; state.sessions = state.sessions.filter(x => x.userId !== identity.id); this.event(state, actor, identity.id, 'PASSWORD_CHANGED', null, null); }, true); }
    private currentOrg(state: AuthState) { return state.organizations.find(x => x.id === state.workspaces.find(w => w.id === this.workspaceId)?.organizationId)!; }
    async invite(ctx: WorkspaceAccess, email: string, role: Role) { const token = opaqueToken(); await this.mutate(state => { const actor = authorizeManagement(this.fresh(state, ctx), true), org = this.currentOrg(state); authorizeInvitationRole(actor, role); assertAllowedEmail(email, org.emailPolicy); if (state.identities.some(x => x.email === normalizeEmail(email) && x.platformRole === 'PLATFORM_OWNER'))
        throw new AccessError('PLATFORM_IDENTITY_PROTECTED', 'Use dedicated platform administration for platform identities.'); this.addInvitation(state, actor, this.workspaceId, normalizeEmail(email), role, token, false, null); }); return token; }
    private addInvitation(state: AuthState, ctx: WorkspaceAccess, wid: string, email: string, role: Role, token: string, override: boolean, reason: string | null, provisionedByPlatform=false) { const orgId = state.workspaces.find(x => x.id === wid)!.organizationId; const identity = state.identities.find(x => x.email === email); if (state.memberships.some(x => x.organizationId === orgId && x.userId === identity?.id) || state.invitations.some(x => x.organizationId === orgId && x.email === email && !x.usedAt && !x.revokedAt && Date.parse(x.expiresAt) > Date.now()))
        throw new Error('This email already has organization access or a pending invitation.'); const item: Invitation = { id: randomUUID(), workspaceId: wid, organizationId: orgId, email, role, tokenHash: hash(token), expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(), revokedAt: null, usedAt: null, invitedBy: ctx.actor.id, provisionedByPlatform, policyOverride: override, policyOverrideReason: reason }; state.invitations.push(item); this.event(state, { ...ctx, workspaceId: wid, organizationId: orgId }, item.id, 'INVITED', null, { email, role }, reason ?? undefined, override); }
    invitation(token: string) { const state = this.raw(), item = state.invitations.find(x => x.tokenHash === hash(token)); this.validInvitation(state, item); return { email: item!.email, role: item!.role, expiresAt: item!.expiresAt, workspaceId: item!.workspaceId, organizationId: item!.organizationId }; }
    private validInvitation(state: AuthState, item: Invitation | undefined) { if (!item || item.workspaceId !== this.workspaceId || item.organizationId !== this.currentOrg(state).id || item.revokedAt || item.usedAt || Date.parse(item.expiresAt) <= Date.now())
        throw new AccessError('INVITE_INVALID', 'This invitation is expired, revoked or already used.'); if (item.provisionedByPlatform) {
        const inviter = state.identities.find(x => x.id === item.invitedBy && x.active && x.platformRole === 'PLATFORM_OWNER');
        if (!inviter)
            throw new AccessError('INVITE_INVALID', 'Platform grant is no longer available.');
    } if (!item.policyOverride)
        assertAllowedEmail(item.email, this.currentOrg(state).emailPolicy); if (!item.provisionedByPlatform) {
        if(state.identities.some(x=>x.email===item.email&&x.platformRole==='PLATFORM_OWNER'))throw new AccessError('PLATFORM_IDENTITY_PROTECTED','Use dedicated platform administration for platform identities.'); const inviter = this.context(state, item.invitedBy);
        authorizeManagement(inviter, true);
        authorizeInvitationRole(inviter, item.role);
        if (item.role === 'ORG_OWNER')
            throw new AccessError('OWNER_RESERVED', 'Owner invitations require dedicated platform provisioning.');
    } }
    async accept(token: string, displayName: string, password: string) { validatePassword(password); if (!displayName.trim() || displayName.trim().length > 120)
        throw new Error('Enter a name up to 120 characters.'); await this.mutate(state => { const item = state.invitations.find(x => x.tokenHash === hash(token)); this.validInvitation(state, item); let identity = state.identities.find(x => x.email === item!.email); if (identity) {
        if (!identity.active || !identity.passwordHash || !passwordMatches(password, identity.passwordHash))
            throw new AccessError('INVALID_CREDENTIALS', 'Use your existing account password to join this organization.');
    }
    else {
        identity = { id: randomUUID(), email: item!.email, displayName: displayName.trim(), active: true, platformRole: null, passwordHash: passwordHash(password) };
        state.identities.push(identity);
    } if (state.memberships.some(x => x.organizationId === item!.organizationId && x.userId === identity.id))
        throw new Error('Organization membership already exists.'); const membership: OrganizationMembership = { id: randomUUID(), organizationId: item!.organizationId, userId: identity.id, role: item!.role, active: true, isProductLead: false, policyOverride: item!.policyOverride, policyOverrideReason: item!.policyOverrideReason }; state.memberships.push(membership); if (membership.role === 'ORG_OWNER') {
        this.currentOrg(state).status = 'ACTIVE';
        for (const w of state.workspaces.filter(x => x.organizationId === membership.organizationId))
            w.status = 'ACTIVE';
    } item!.usedAt = new Date().toISOString(); this.event(state, { workspaceId: this.workspaceId, organizationId: item!.organizationId, memberId: membership.id, actor: { id: identity.id, label: identity.displayName }, platformRole: identity.platformRole, role: membership.role, isProductLead: false }, membership.id, 'INVITATION_ACCEPTED', null, { role: membership.role }, membership.policyOverrideReason ?? undefined, membership.policyOverride); }, true); }
    async change(ctx: WorkspaceAccess, targetId: string, role: Role, active: boolean, isProductLead: boolean) { await this.mutate(state => { const actor = authorizeManagement(this.fresh(state, ctx), true), target = this.members(state, state.workspaces.find(x => x.id === this.workspaceId)!).find(x => x.id === targetId); if (!target)
        throw new AccessError('ACCESS_DENIED', 'That membership is unavailable.'); authorizeMembershipChange(actor, target, role, active, isProductLead); const stored = state.memberships.find(x => x.id === targetId)!, before = { ...stored }; Object.assign(stored, { role, active, isProductLead }); if (!active)
        state.sessions = state.sessions.filter(x => x.userId !== target.userId || x.organizationId !== target.organizationId); this.event(state, actor, targetId, 'MEMBERSHIP_CHANGED', before, { role, active, isProductLead }); }); }
    async rotate(ctx: WorkspaceAccess, id: string, revoke: boolean) { const token = opaqueToken(); await this.mutate(state => { const actor = authorizeManagement(this.fresh(state, ctx), true), item = state.invitations.find(x => x.id === id && x.workspaceId === this.workspaceId); if (!item || item.usedAt || item.revokedAt || item.provisionedByPlatform)
        throw new AccessError('INVITE_INVALID', 'Use the originating platform workflow for this invitation.'); authorizeInvitationRole(actor, item.role); if (!revoke)
        assertAllowedEmail(item.email, this.currentOrg(state).emailPolicy); if (revoke)
        item.revokedAt = new Date().toISOString();
    else {
        item.tokenHash = hash(token);
        item.expiresAt = new Date(Date.now() + 7 * 86400000).toISOString();
    } this.event(state, actor, id, revoke ? 'INVITATION_REVOKED' : 'INVITATION_RESENT', null, null); }); return revoke ? null : token; }
    async renameWorkspace(ctx: WorkspaceAccess, name: string) { if (!name.trim() || name.trim().length > 120)
        throw new Error('Enter a workspace name up to 120 characters.'); await this.mutate(state => { const actor = authorizeOwner(this.fresh(state, ctx)), workspace = state.workspaces.find(x => x.id === this.workspaceId)!, previous = workspace.name; workspace.name = name.trim(); this.event(state, actor, workspace.id, 'WORKSPACE_RENAMED', { name: previous }, { name: workspace.name }); }); }
    platformSnapshot(ctx: WorkspaceAccess) { authorizePlatform(this.fresh(this.raw(), ctx, true)); const state = this.raw(); return { organizations: state.organizations, workspaces: state.workspaces, identities: state.identities.map(({ passwordHash: removed, ...identity }) => { void removed; return identity; }), memberships: state.memberships, invitations:state.invitations.filter(x=>x.provisionedByPlatform).map(({tokenHash:removed,...invite})=>{void removed;return invite;}), events: state.events }; }
    async grantPlatformOwner(ctx: WorkspaceAccess, userId: string, reason: string) { reason = reasonRequired(reason); await this.mutate(state => { const actor = authorizePlatform(this.fresh(state, ctx, true)), target = state.identities.find(x => x.id === userId && x.active); if (!target)
        throw new AccessError('ACCESS_DENIED', 'Identity is unavailable.'); const previous = target.platformRole; target.platformRole = 'PLATFORM_OWNER'; this.event(state, actor, userId, 'PLATFORM_ROLE_GRANTED', { platformRole: previous }, { platformRole: 'PLATFORM_OWNER' }, reason, false); }, true); }
    async platformCreateOrganization(ctx: WorkspaceAccess, name: string, policy: EmailPolicy) { policy = validateEmailPolicy(policy); if (!name.trim() || name.trim().length > 120)
        throw new Error('Enter an organization name up to 120 characters.'); return this.mutate(state => { const actor = authorizePlatform(this.fresh(state, ctx, true)), id = randomUUID(), workspaceId = randomUUID(); state.organizations.push({ id, name: name.trim(), status: 'BOOTSTRAPPING', emailPolicy: policy }); state.workspaces.push({ id: workspaceId, organizationId: id, name: name.trim(), status: 'BOOTSTRAPPING' }); this.event(state, { ...actor, workspaceId, organizationId: id }, id, 'ORGANIZATION_CREATED', null, { name, policy }, 'Platform organization creation', false); return { organizationId: id, workspaceId }; }, true); }
    async platformConfigurePolicy(ctx: WorkspaceAccess, orgId: string, policy: EmailPolicy) { policy = validateEmailPolicy(policy); await this.mutate(state => { const actor = authorizePlatform(this.fresh(state, ctx, true)), org = state.organizations.find(x => x.id === orgId); if (!org)
        throw new AccessError('ACCESS_DENIED', 'Organization is unavailable.'); const before = org.emailPolicy; org.emailPolicy = policy; this.event(state, { ...actor, workspaceId: state.workspaces.find(x => x.organizationId === orgId)!.id, organizationId: orgId }, orgId, 'ORGANIZATION_POLICY_CHANGED', before, policy, 'Platform policy update', false); }, true); }
    async platformProvisionMembership(ctx: WorkspaceAccess, orgId: string, email: string, role: Role, override: boolean, reason: string) { reason = reasonRequired(reason); if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(email)))
        throw new Error('INVALID_EMAIL'); if (!['ORG_OWNER', 'ADMIN', 'MEMBER', 'VIEWER'].includes(role) || typeof override !== 'boolean')
        throw new Error('INVALID_MEMBERSHIP'); const token = opaqueToken(); return this.mutate(state => { const actor = authorizePlatform(this.fresh(state, ctx, true)), org = state.organizations.find(x => x.id === orgId), workspace = state.workspaces.find(x => x.organizationId === orgId); if (!org || !workspace)
        throw new AccessError('ACCESS_DENIED', 'Organization is unavailable.'); if (!override)
        assertAllowedEmail(email, org.emailPolicy); const identity = state.identities.find(x => x.email === normalizeEmail(email)); if (!identity) {
        for(const pending of state.invitations.filter(x=>x.organizationId===orgId&&x.email===normalizeEmail(email)&&!x.usedAt&&!x.revokedAt))pending.revokedAt=new Date().toISOString();this.addInvitation(state, { ...actor, organizationId: orgId }, workspace.id, normalizeEmail(email), role, token, override, reason,true);
        return { invitationToken: token, userId: null, memberId: null };
    } if (!identity.active)
        throw new AccessError('ACCESS_DENIED', 'Identity is unavailable.'); let member = state.memberships.find(x => x.organizationId === orgId && x.userId === identity.id); const before = member ? { ...member } : null; if (!member) {
        member = { id: randomUUID(), organizationId: orgId, userId: identity.id, role, active: true, isProductLead: false, policyOverride: override, policyOverrideReason: override ? reason : null };
        state.memberships.push(member);
    }
    else
        Object.assign(member, { role, active: true, isProductLead: role === 'VIEWER' ? false : member.isProductLead, policyOverride: override, policyOverrideReason: override ? reason : null }); if (role === 'ORG_OWNER') {
        org.status = 'ACTIVE';
        for (const w of state.workspaces.filter(x => x.organizationId === orgId))
            w.status = 'ACTIVE';
    } this.event(state, { ...actor, workspaceId: workspace.id, organizationId: orgId }, identity.id, 'PLATFORM_MEMBERSHIP_GRANTED', before, { memberId: member.id, role }, reason, override); return { invitationToken: null, userId: identity.id, memberId: member.id }; }, true); }
    async platformReplaceOrgOwner(ctx: WorkspaceAccess, orgId: string, targetUserId: string, reason: string) { reason = reasonRequired(reason); await this.mutate(state => { const actor = authorizePlatform(this.fresh(state, ctx, true)), org = state.organizations.find(x => x.id === orgId), target = state.memberships.find(x => x.organizationId === orgId && x.userId === targetUserId && x.active); if (!org || !target || !state.identities.some(x => x.id === targetUserId && x.active))
        throw new AccessError('ACCESS_DENIED', 'Choose an active organization member.'); if (!target.policyOverride)
        assertAllowedEmail(state.identities.find(x => x.id === targetUserId)!.email, org.emailPolicy); const before = state.memberships.filter(x => x.organizationId === orgId && x.role === 'ORG_OWNER').map(x => ({ ...x })); for (const member of state.memberships.filter(x => x.organizationId === orgId && x.role === 'ORG_OWNER'))
        member.role = 'ADMIN'; target.role = 'ORG_OWNER'; org.status = 'ACTIVE'; for (const w of state.workspaces.filter(x => x.organizationId === orgId))
        w.status = 'ACTIVE'; this.event(state, { ...actor, workspaceId: state.workspaces.find(x => x.organizationId === orgId)!.id, organizationId: orgId }, targetUserId, 'ORGANIZATION_OWNERS_REPLACED', before, { ownerUserId: targetUserId }, reason, target.policyOverride); }, true); }
    async platformRotateInvitation(ctx:WorkspaceAccess,id:string,revoke:boolean,reason:string){
        reason=reasonRequired(reason); const token=opaqueToken();
        await this.mutate(state=>{
            const actor=authorizePlatform(this.fresh(state,ctx,true));
            const item=state.invitations.find(x=>x.id===id&&x.provisionedByPlatform);
            if(!item||item.revokedAt||item.usedAt)throw new AccessError('INVITE_INVALID','This invitation is no longer pending.');
            const org=state.organizations.find(x=>x.id===item.organizationId)!;
            if(!revoke&&!item.policyOverride)assertAllowedEmail(item.email,org.emailPolicy);
            if(revoke)item.revokedAt=new Date().toISOString();
            else{item.tokenHash=hash(token);item.expiresAt=new Date(Date.now()+7*86400000).toISOString();item.invitedBy=actor.actor.id;}
            this.event(state,{...actor,workspaceId:item.workspaceId,organizationId:item.organizationId},item.id,revoke?'PLATFORM_INVITATION_REVOKED':'PLATFORM_INVITATION_RESENT',null,{email:item.email,role:item.role},reason,item.policyOverride);
        },true);
        return revoke?null:token;
    }
    private event(state: AuthState, ctx: WorkspaceAccess, targetId: string, action: string, before: unknown, after: unknown, reason?: string, policyOverridden = false) { state.events.push({ id: randomUUID(), workspaceId: action.startsWith('PLATFORM_ROLE') || action === 'PLATFORM_BOOTSTRAPPED' ? null : ctx.workspaceId, organizationId: action.startsWith('PLATFORM_ROLE') || action === 'PLATFORM_BOOTSTRAPPED' ? null : ctx.organizationId, actorId: ctx.actor.id, actorLabel: ctx.actor.label, targetId, action, at: new Date().toISOString(), before, after, reason, policyOverridden }); }
}
