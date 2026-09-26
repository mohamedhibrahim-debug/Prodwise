import 'server-only';
import { cookies } from 'next/headers';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { supabaseUrl, supabaseServiceRoleKey } from '@/lib/env';
import { LocalAuthStore, AccessError, hash, opaqueToken, signToken, unsignedToken, normalizeEmail, validatePassword, authorizeManagement, authorizeOwner, authorizePlatform, authorizeInvitationRole, type Member, type Role, type Session, type WorkspaceAccess } from './core';
import { normalizeLegacyRole, hasOrganizationAdminAuthority, type PlatformRole } from './roles';
import { validateEmailPolicy } from './email-policy';
import { localContextForToken, selectLoginWorkspace, startLocalLogin } from './login-scope';
export const SESSION_COOKIE = 'prodwise_session';
export function configuredWorkspaceId() {
    const id = process.env.PRODWISE_WORKSPACE_ID?.trim();
    if (!id || !/^[0-9a-f-]{36}$/i.test(id)) throw new Error('PRODWISE_WORKSPACE_ID must be configured.');
    return id;
}
function secret() {
    const value = process.env.AUTH_SESSION_SECRET ?? '';
    if (value.length < 32) throw new Error('AUTH_SESSION_SECRET must contain at least 32 characters.');
    return value;
}
export function isLocalAuth() {
    if (process.env.AUTH_MODE !== 'local') return false;
    if (process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV) throw new Error('Local fixture authentication is disabled in hosted and production builds.');
    return true;
}
/** workspaceId must come from a verified stored session or a verified invitation. */
export function localAuthStore(workspaceId = configuredWorkspaceId()) {
    return new LocalAuthStore(join(process.cwd(), '.data', 'auth.json'), workspaceId);
}
export function adminClient() {
    if (!supabaseUrl || !supabaseServiceRoleKey) throw new Error('Supabase must be configured for server authentication. No local fallback is allowed.');
    return createClient(supabaseUrl, supabaseServiceRoleKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}
function authClient() {
    const key = process.env.SUPABASE_ANON_KEY?.trim();
    if (!supabaseUrl || !key) throw new Error('SUPABASE_ANON_KEY must be configured for authentication.');
    return createClient(supabaseUrl, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}
interface UserRow {
    id: string; email: string; display_name: string; auth_user_id: string | null;
    platform_role: PlatformRole; active: boolean;
}
interface MemberRow {
    id: string; organization_id: string; user_id: string; role: string; active: boolean;
    is_product_lead: boolean; policy_override: boolean; policy_override_reason: string | null;
    users: UserRow | UserRow[];
}
function memberFromRow(row: MemberRow, workspaceId: string): Member {
    const user = Array.isArray(row.users) ? row.users[0]! : row.users;
    return { id: row.id, workspaceId, organizationId: row.organization_id, userId: row.user_id, email: user.email, displayName: user.display_name, authUserId: user.auth_user_id, platformRole: user.platform_role, role: normalizeLegacyRole(row.role), active: row.active && user.active, isProductLead: row.is_product_lead, policyOverride: row.policy_override, policyOverrideReason: row.policy_override_reason };
}
async function verifiedHostedUser(authUserId: string, providerEmail: string | undefined): Promise<UserRow> {
    const result = await adminClient().from('users').select('id,email,display_name,auth_user_id,platform_role,active').eq('auth_user_id', authUserId).maybeSingle();
    if (result.error) throw new Error('Could not verify organization access.');
    const user = result.data as UserRow | null;
    if (!user || !user.active || normalizeEmail(providerEmail ?? '') !== normalizeEmail(user.email)) throw new AccessError('ACCESS_DENIED', 'Your global identity requires verification.');
    return user;
}
/** Scope is supplied only by a persisted session or server-side login selection. */
async function hostedContext(authUserId: string, providerEmail: string | undefined, workspaceId: string): Promise<WorkspaceAccess> {
    const db = adminClient();
    const [workspace, user] = await Promise.all([db.from('workspaces').select('id,organization_id').eq('id', workspaceId).maybeSingle(), verifiedHostedUser(authUserId, providerEmail)]);
    if (workspace.error) throw new Error('Could not verify organization access.');
    if (!workspace.data) throw new AccessError('ACCESS_DENIED', 'Organization access is unavailable.');
    const orgId = workspace.data.organization_id as string;
    const member = await db.from('organization_memberships').select('*').eq('organization_id', orgId).eq('user_id', user.id).maybeSingle();
    if (member.error) throw new Error('Could not verify membership.');
    const mid = member.data?.active ? member.data.id as string : null;
    const { error } = await db.rpc('require_workspace_member', { p_workspace_id: workspaceId, p_member_id: mid ?? user.id, p_admin: false, p_write: false });
    if (error) throw new AccessError('ACCESS_DENIED', 'Organization access is unavailable.');
    return { workspaceId, organizationId: orgId, memberId: mid, actor: { id: user.id, label: user.display_name }, platformRole: user.platform_role ?? null, role: mid ? normalizeLegacyRole(member.data!.role as string) : null, isProductLead: mid ? member.data!.is_product_lead as boolean : false };
}
async function selectHostedContext(authUserId: string, providerEmail: string | undefined, preferredWorkspaceId: string): Promise<WorkspaceAccess> {
    const user = await verifiedHostedUser(authUserId, providerEmail), db = adminClient();
    const [workspaces, memberships] = await Promise.all([db.from('workspaces').select('id,organization_id'), db.from('organization_memberships').select('organization_id,user_id,active').eq('user_id', user.id)]);
    if (workspaces.error || memberships.error) throw new Error('Could not load organization access.');
    return selectLoginWorkspace({ id: user.id, active: user.active, platformRole: user.platform_role }, preferredWorkspaceId,
        workspaces.data.map(row => ({ id: row.id as string, organizationId: row.organization_id as string })),
        memberships.data.map(row => ({ organizationId: row.organization_id as string, userId: row.user_id as string, active: row.active as boolean })),
        workspaceId => hostedContext(authUserId, providerEmail, workspaceId));
}
async function cookieToken() { return unsignedToken((await cookies()).get(SESSION_COOKIE)?.value, secret()); }
async function setSessionCookie(token: string) {
    (await cookies()).set(SESSION_COOKIE, signToken(token, secret()), { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 8 * 3600 });
}
export async function contextForRequest(): Promise<WorkspaceAccess> { return contextForCookie((await cookies()).get(SESSION_COOKIE)?.value); }
export async function contextForCookie(cookieValue: string | undefined): Promise<WorkspaceAccess> {
    const token = unsignedToken(cookieValue, secret());
    if (!token) throw new AccessError('UNAUTHENTICATED', 'Sign in to continue.');
    if (isLocalAuth()) return localContextForToken(localAuthStore(), token);
    const db = adminClient();
    const { data: session, error } = await db.from('workspace_sessions').select('*').eq('token_hash', hash(token)).gt('expires_at', new Date().toISOString()).maybeSingle();
    if (error) throw new Error('Could not verify your session.');
    if (!session) throw new AccessError('UNAUTHENTICATED', 'Sign in to continue.');
    let accessToken = session.access_token as string, identity = await authClient().auth.getUser(accessToken);
    if (identity.error && session.refresh_token) {
        const refreshed = await authClient().auth.refreshSession({ refresh_token: session.refresh_token });
        if (!refreshed.error && refreshed.data.session) {
            accessToken = refreshed.data.session.access_token;
            const saved = await db.from('workspace_sessions').update({ access_token: accessToken, refresh_token: refreshed.data.session.refresh_token }).eq('token_hash', hash(token)).eq('workspace_id', session.workspace_id).eq('user_id', session.user_id);
            if (saved.error) throw new Error('Could not refresh your session.');
            identity = await authClient().auth.getUser(accessToken);
        }
    }
    if (identity.error || !identity.data.user || identity.data.user.id !== session.auth_user_id) throw new AccessError('UNAUTHENTICATED', 'Your session expired.');
    const ctx = await hostedContext(identity.data.user.id, identity.data.user.email, session.workspace_id as string);
    if (ctx.actor.id !== session.user_id || ctx.organizationId !== session.organization_id || ctx.workspaceId !== session.workspace_id) throw new AccessError('ACCESS_DENIED', 'Session organization mismatch.');
    return ctx;
}
async function startSession(email: string, password: string, preferredWorkspaceId: string) {
    let token: string;
    if (isLocalAuth()) token = (await startLocalLogin(localAuthStore(preferredWorkspaceId), email, password)).token;
    else {
        const result = await authClient().auth.signInWithPassword({ email: normalizeEmail(email), password });
        if (result.error || !result.data.session || !result.data.user) throw new AccessError('INVALID_CREDENTIALS', 'Email or password is incorrect.');
        const ctx = await selectHostedContext(result.data.user.id, result.data.user.email, preferredWorkspaceId);
        token = opaqueToken();
        const { error } = await adminClient().from('workspace_sessions').insert({ token_hash: hash(token), workspace_id: ctx.workspaceId, organization_id: ctx.organizationId, user_id: ctx.actor.id, auth_user_id: result.data.user.id, access_token: result.data.session.access_token, refresh_token: result.data.session.refresh_token, expires_at: new Date(Date.now() + 8 * 3600000).toISOString() });
        if (error) throw new Error('Could not start a session.');
    }
    await setSessionCookie(token);
}
export async function signIn(email: string, password: string) { await startSession(email, password, configuredWorkspaceId()); }
export async function signOut() {
    const token = await cookieToken();
    if (token) {
        if (isLocalAuth()) {
            const store = localAuthStore();
            // Expired or deactivated access must not prevent signing out.
            const session = store.read(true).sessions.find(item => item.tokenHash === hash(token));
            if (session) await localAuthStore(session.workspaceId).logout(token);
        } else {
            const db = adminClient(), { data } = await db.from('workspace_sessions').select('access_token').eq('token_hash', hash(token)).maybeSingle();
            if (data?.access_token) await db.auth.admin.signOut(data.access_token, 'local');
            await db.from('workspace_sessions').delete().eq('token_hash', hash(token));
        }
    }
    (await cookies()).delete(SESSION_COOKIE);
}
export async function changeOwnPassword(currentPassword: string, nextPassword: string) {
    const ctx = await contextForRequest(); validatePassword(nextPassword); let email: string;
    if (isLocalAuth()) {
        const store = localAuthStore(ctx.workspaceId);
        email = store.read(true).identities.find(identity => identity.id === ctx.actor.id)!.email;
        await store.changePassword(ctx, currentPassword, nextPassword);
    } else {
        const user = await adminClient().from('users').select('email,auth_user_id').eq('id', ctx.actor.id).single();
        if (user.error) throw new Error('Identity unavailable.');
        email = user.data.email as string;
        const provider = authClient(), verified = await provider.auth.signInWithPassword({ email, password: currentPassword });
        if (verified.error || verified.data.user?.id !== user.data.auth_user_id) throw new AccessError('INVALID_CREDENTIALS', 'Current password is incorrect.');
        const updated = await provider.auth.updateUser({ password: nextPassword });
        if (updated.error) throw new Error('Could not update your password.');
        const removed = await adminClient().from('workspace_sessions').delete().eq('user_id', ctx.actor.id);
        if (removed.error) throw new Error('Password changed. Sign out and sign in again.');
    }
    await startSession(email, nextPassword, ctx.workspaceId);
}
export async function listWorkspaceMembers(): Promise<Member[]> { const ctx = await contextForRequest(); if (isLocalAuth())
    return localAuthStore(ctx.workspaceId).read(true).members; const { data, error } = await adminClient().from('organization_memberships').select('*,users!inner(id,email,display_name,auth_user_id,platform_role,active)').eq('organization_id', ctx.organizationId).order('created_at'); if (error)
    throw new Error('Could not load organization members.'); return (data as MemberRow[]).map(x => memberFromRow(x, ctx.workspaceId)); }
export function requireManagementWrites(ctx: WorkspaceAccess) { return authorizeManagement(ctx, process.env.MANAGEMENT_WRITE_ENABLED === 'true' && process.env.VERCEL_ENV !== 'preview'); }
function platformWrites(ctx: WorkspaceAccess) { authorizePlatform(ctx); if (process.env.MANAGEMENT_WRITE_ENABLED !== 'true' || process.env.VERCEL_ENV === 'preview')
    throw new AccessError('MANAGEMENT_DISABLED', 'Platform management changes are disabled in this environment.'); return ctx; }
export async function userManagementSnapshot() { const ctx = await contextForRequest(); if (!hasOrganizationAdminAuthority(ctx))
    throw new AccessError('ADMIN_REQUIRED', 'Organization administration is required.'); const members = await listWorkspaceMembers(); if (isLocalAuth()) {
    const state = localAuthStore(ctx.workspaceId).read(true);
    return { members, invitations: state.invitations.filter(x => x.workspaceId === ctx.workspaceId).map(({ tokenHash: removed, ...invite }) => { void removed; return invite; }), events: state.events.filter(x => x.organizationId === ctx.organizationId), workspaceName: state.workspace.name, organizationName: state.organization.name, organizationId: ctx.organizationId, capturedAt: Date.now() };
} const db = adminClient(), [invites, events, workspace, org] = await Promise.all([db.from('workspace_invitations').select('id,workspace_id,organization_id,email,role,expires_at,revoked_at,used_at,invited_by,provisioned_by_platform,policy_override').eq('workspace_id', ctx.workspaceId), db.from('membership_events').select('*').eq('organization_id', ctx.organizationId).order('occurred_at', { ascending: false }).limit(50), db.from('workspaces').select('name').eq('id', ctx.workspaceId).single(), db.from('organizations').select('name').eq('id', ctx.organizationId).single()]); if (invites.error || events.error || workspace.error || org.error)
    throw new Error('Could not load user management.'); return { members, invitations: invites.data.map(x => ({ id: x.id as string, workspaceId: x.workspace_id as string, organizationId: x.organization_id as string, email: x.email as string, role: normalizeLegacyRole(x.role as string), expiresAt: x.expires_at as string, revokedAt: x.revoked_at as string | null, usedAt: x.used_at as string | null, invitedBy: x.invited_by as string, provisionedByPlatform:x.provisioned_by_platform as boolean, policyOverride:x.policy_override as boolean })), events: events.data.map(x => ({ id: x.id as string, workspaceId: x.workspace_id as string, organizationId: x.organization_id as string, actorId: x.actor_id as string, actorLabel: x.actor_label as string, targetId: x.target_id as string, action: x.action as string, at: x.occurred_at as string })), workspaceName: workspace.data.name as string, organizationName: org.data.name as string, organizationId: ctx.organizationId, capturedAt: Date.now() }; }
export async function inviteUser(email: string, role: Role) { const ctx = requireManagementWrites(await contextForRequest()); authorizeInvitationRole(ctx, role); if (isLocalAuth())
    return localAuthStore(ctx.workspaceId).invite(ctx, email, role); const token = opaqueToken(), { error } = await adminClient().rpc('manage_workspace_invitation', { p_workspace_id: ctx.workspaceId, p_member_id: ctx.memberId ?? ctx.actor.id, p_action: 'INVITE', p_invitation_id: null, p_email: normalizeEmail(email), p_role: role, p_token_hash: hash(token) }); if (error)
    throw new Error(error.message); return token; }
export async function rotateInvitation(id: string, revoke: boolean) { const ctx = requireManagementWrites(await contextForRequest()); if (isLocalAuth())
    return localAuthStore(ctx.workspaceId).rotate(ctx, id, revoke); const token = opaqueToken(), { error } = await adminClient().rpc('manage_workspace_invitation', { p_workspace_id: ctx.workspaceId, p_member_id: ctx.memberId ?? ctx.actor.id, p_action: revoke ? 'REVOKE' : 'RESEND', p_invitation_id: id, p_email: null, p_role: null, p_token_hash: hash(token) }); if (error)
    throw new Error(error.message); return revoke ? null : token; }
export async function changeMembership(id: string, role: Role, active: boolean, isProductLead: boolean) { const ctx = requireManagementWrites(await contextForRequest()); if (isLocalAuth())
    return localAuthStore(ctx.workspaceId).change(ctx, id, role, active, isProductLead); const { error } = await adminClient().rpc('change_workspace_membership', { p_workspace_id: ctx.workspaceId, p_member_id: ctx.memberId ?? ctx.actor.id, p_target_id: id, p_role: role, p_active: active, p_is_product_lead: isProductLead }); if (error)
    throw new Error(error.message); }
export async function inspectInvitation(token: string) { if (isLocalAuth()) {
    const current = localAuthStore(), item = current.read(true).invitations.find(x => x.tokenHash === hash(token));
    if (!item)
        throw new AccessError('INVITE_INVALID', 'Invitation unavailable.');
    return new LocalAuthStore(current.path, item.workspaceId).invitation(token);
} const { data, error } = await adminClient().rpc('inspect_workspace_invitation', { p_workspace_id: null, p_token_hash: hash(token) }); if (error || !data)
    throw new AccessError('INVITE_INVALID', 'This invitation is expired, revoked or already used.'); return { email: data.email as string, role: normalizeLegacyRole(data.role as string), expiresAt: data.expiresAt as string, workspaceId: data.workspaceId as string, organizationId: data.organizationId as string }; }
export async function acceptInvitation(token: string, name: string, password: string) { if (process.env.MANAGEMENT_WRITE_ENABLED !== 'true' || process.env.VERCEL_ENV === 'preview')
    throw new AccessError('MANAGEMENT_DISABLED', 'Account setup is disabled in this environment.'); validatePassword(password); if (!name.trim() || name.trim().length > 120)
    throw new Error('Enter your name up to 120 characters.'); const invite = await inspectInvitation(token); if (isLocalAuth())
    await new LocalAuthStore(localAuthStore().path, invite.workspaceId).accept(token, name, password);
else {
    const db = adminClient(), created = await db.auth.admin.createUser({ email: invite.email, password, email_confirm: true });
    let authUserId = created.data.user?.id;
    if (!authUserId) {
        const existing = await authClient().auth.signInWithPassword({ email: invite.email, password });
        if (existing.error || !existing.data.user)
            throw new AccessError('INVALID_CREDENTIALS', 'Use the existing global account password or ask your administrator for help.');
        authUserId = existing.data.user.id;
    }
    const { error } = await db.rpc('accept_workspace_invitation', { p_workspace_id: invite.workspaceId, p_token_hash: hash(token), p_auth_user_id: authUserId, p_display_name: name.trim() });
    if (error)
        throw new Error(error.message);
} if (invite.workspaceId === configuredWorkspaceId())
    await signIn(invite.email, password); return { workspaceId: invite.workspaceId, organizationId: invite.organizationId, signedIn: invite.workspaceId === configuredWorkspaceId() }; }
export async function renameWorkspace(name: string) { const ctx = authorizeOwner(await contextForRequest(), process.env.MANAGEMENT_WRITE_ENABLED === 'true' && process.env.VERCEL_ENV !== 'preview'); if (!name.trim() || name.trim().length > 120)
    throw new Error('Enter a workspace name up to 120 characters.'); if (isLocalAuth())
    return localAuthStore(ctx.workspaceId).renameWorkspace(ctx, name); const { error } = await adminClient().rpc('rename_workspace', { p_workspace_id: ctx.workspaceId, p_member_id: ctx.memberId ?? ctx.actor.id, p_name: name.trim() }); if (error)
    throw new Error(error.message); }
export async function platformSnapshot() { const ctx = authorizePlatform(await contextForRequest()); if (isLocalAuth())
    return {...localAuthStore(ctx.workspaceId).platformSnapshot(ctx),capturedAt:Date.now()}; const db = adminClient(), [organizations, workspaces, identities, memberships, invitations, events] = await Promise.all([db.from('organizations').select('*'), db.from('workspaces').select('*'), db.from('users').select('id,email,display_name,platform_role,active'), db.from('organization_memberships').select('*'), db.from('workspace_invitations').select('id,workspace_id,organization_id,email,role,expires_at,revoked_at,used_at,invited_by,provisioned_by_platform,policy_override,policy_override_reason').eq('provisioned_by_platform',true), db.from('platform_events').select('*').order('occurred_at', { ascending: false }).limit(100)]); if (organizations.error || workspaces.error || identities.error || memberships.error || invitations.error || events.error)
    throw new Error('Platform management is unavailable.'); return { capturedAt:Date.now(), organizations: organizations.data.map(x => ({ id: x.id as string, name: x.name as string, status: x.status as 'ACTIVE' | 'BOOTSTRAPPING', emailPolicy: { domains: x.allowed_email_domains as string[], exactEmails: x.allowed_exact_emails as string[] } })), workspaces: workspaces.data.map(x => ({ id: x.id as string, organizationId: x.organization_id as string, name: x.name as string, status: x.status as 'ACTIVE' | 'BOOTSTRAPPING' })), identities: identities.data.map(x => ({ id: x.id as string, email: x.email as string, displayName: x.display_name as string, platformRole: x.platform_role as PlatformRole, active: x.active as boolean })), memberships: memberships.data.map(x => ({ id: x.id as string, organizationId: x.organization_id as string, userId: x.user_id as string, role: normalizeLegacyRole(x.role as string), active: x.active as boolean, isProductLead: x.is_product_lead as boolean, policyOverride: x.policy_override as boolean, policyOverrideReason: x.policy_override_reason as string | null })), invitations:invitations.data.map(x=>({id:x.id as string,workspaceId:x.workspace_id as string,organizationId:x.organization_id as string,email:x.email as string,role:normalizeLegacyRole(x.role as string),expiresAt:x.expires_at as string,revokedAt:x.revoked_at as string|null,usedAt:x.used_at as string|null,invitedBy:x.invited_by as string,provisionedByPlatform:x.provisioned_by_platform as boolean,policyOverride:x.policy_override as boolean,policyOverrideReason:x.policy_override_reason as string|null})), events: events.data.map(x => ({ id: x.id as string, workspaceId: x.workspace_id as string | null, organizationId: x.organization_id as string | null, actorId: x.actor_id as string, actorLabel: x.actor_label as string, targetId: x.target_id as string, action: x.action as string, at: x.occurred_at as string, before:x.before_state as unknown,after:x.after_state as unknown,reason: x.reason as string, policyOverridden: x.policy_overridden as boolean })) }; }
export async function platformCreateOrganization(name: string, domains: string[], exactEmails: string[]) { const ctx = platformWrites(await contextForRequest()), policy = validateEmailPolicy({ domains, exactEmails }); if (isLocalAuth())
    return localAuthStore(ctx.workspaceId).platformCreateOrganization(ctx, name, policy); const { data, error } = await adminClient().rpc('platform_create_organization', { p_actor_id: ctx.actor.id, p_name: name, p_domains: policy.domains, p_exact_emails: policy.exactEmails }); if (error)
    throw new Error(error.message); return data as {
    organizationId: string;
    workspaceId: string;
}; }
export async function platformConfigurePolicy(orgId: string, domains: string[], exactEmails: string[]) { const ctx = platformWrites(await contextForRequest()), policy = validateEmailPolicy({ domains, exactEmails }); if (isLocalAuth())
    return localAuthStore(ctx.workspaceId).platformConfigurePolicy(ctx, orgId, policy); const { error } = await adminClient().rpc('platform_configure_policy', { p_actor_id: ctx.actor.id, p_organization_id: orgId, p_domains: policy.domains, p_exact_emails: policy.exactEmails }); if (error)
    throw new Error(error.message); }
export async function platformProvisionMembership(orgId: string, email: string, role: Role, override: boolean, reason: string) { const ctx = platformWrites(await contextForRequest()); if (isLocalAuth())
    return localAuthStore(ctx.workspaceId).platformProvisionMembership(ctx, orgId, email, role, override, reason); const token = opaqueToken(), { data, error } = await adminClient().rpc('platform_provision_membership', { p_actor_id: ctx.actor.id, p_organization_id: orgId, p_email: normalizeEmail(email), p_role: role, p_policy_override: override, p_reason: reason, p_token_hash: hash(token) }); if (error)
    throw new Error(error.message); return { invitationToken: data?.invitationId ? token : null, memberId: data?.memberId as string | null, userId: data?.userId as string | null, workspaceId: data?.workspaceId as string | undefined }; }
export async function platformReplaceOrgOwner(orgId: string, userId: string, reason: string) { const ctx = platformWrites(await contextForRequest()); if (isLocalAuth())
    return localAuthStore(ctx.workspaceId).platformReplaceOrgOwner(ctx, orgId, userId, reason); const { error } = await adminClient().rpc('platform_replace_org_owner', { p_actor_id: ctx.actor.id, p_organization_id: orgId, p_target_user_id: userId, p_reason: reason }); if (error)
    throw new Error(error.message); }
export async function grantPlatformOwner(userId: string, reason: string) { const ctx = platformWrites(await contextForRequest()); if (isLocalAuth())
    return localAuthStore(ctx.workspaceId).grantPlatformOwner(ctx, userId, reason); const { error } = await adminClient().rpc('grant_platform_owner', { p_actor_id: ctx.actor.id, p_target_user_id: userId, p_reason: reason }); if (error)
    throw new Error(error.message); }
export type { WorkspaceAccess, Role, Member, Session };



export async function platformRotateInvitation(id:string,revoke:boolean,reason:string){const ctx=platformWrites(await contextForRequest());if(isLocalAuth())return localAuthStore(ctx.workspaceId).platformRotateInvitation(ctx,id,revoke,reason);const token=opaqueToken(),{error}=await adminClient().rpc('platform_rotate_invitation',{p_actor_id:ctx.actor.id,p_invitation_id:id,p_revoke:revoke,p_token_hash:hash(token),p_reason:reason});if(error)throw new Error(error.message);return revoke?null:token;}
