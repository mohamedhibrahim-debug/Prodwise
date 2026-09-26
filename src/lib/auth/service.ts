import 'server-only';
import { cookies } from 'next/headers';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { supabaseUrl, supabaseServiceRoleKey } from '@/lib/env';
import { LocalAuthStore, AccessError, contextForMember, hash, opaqueToken, signToken, unsignedToken,
  normalizeEmail, validatePassword, authorizeManagement, type Member, type Role, type Session, type WorkspaceAccess } from './core';

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
export function localAuthStore() { return new LocalAuthStore(join(process.cwd(), '.data', 'auth.json'), configuredWorkspaceId()); }
export function adminClient() {
  if (!supabaseUrl || !supabaseServiceRoleKey) throw new Error('Supabase must be configured for server authentication. No local fallback is allowed.');
  return createClient(supabaseUrl, supabaseServiceRoleKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}
function authClient() {
  const key = process.env.SUPABASE_ANON_KEY?.trim();
  if (!supabaseUrl || !key) throw new Error('SUPABASE_ANON_KEY must be configured for authentication.');
  return createClient(supabaseUrl, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}
interface MemberRow { id: string; workspace_id: string; user_id: string; role: Role; active: boolean; is_product_lead: boolean;
  users: { email: string; display_name: string; auth_user_id: string | null } | { email: string; display_name: string; auth_user_id: string | null }[] }
function memberFromRow(row: MemberRow): Member {
  const user = Array.isArray(row.users) ? row.users[0]! : row.users;
  return { id: row.id, workspaceId: row.workspace_id, userId: row.user_id, email: user.email,
    displayName: user.display_name, authUserId: user.auth_user_id, role: row.role, active: row.active, isProductLead: row.is_product_lead };
}
async function cookieToken() { return unsignedToken((await cookies()).get(SESSION_COOKIE)?.value, secret()); }
async function setSessionCookie(token: string) {
  (await cookies()).set(SESSION_COOKIE, signToken(token, secret()), {
    httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 8 * 3600,
  });
}
export async function contextForRequest(): Promise<WorkspaceAccess> {
  return contextForCookie((await cookies()).get(SESSION_COOKIE)?.value);
}
export async function contextForCookie(cookieValue: string | undefined): Promise<WorkspaceAccess> {
  const token = unsignedToken(cookieValue, secret());
  if (!token) throw new AccessError('UNAUTHENTICATED', 'Sign in to continue.');
  if (isLocalAuth()) return localAuthStore().session(token);
  const db = adminClient();
  const { data: session, error } = await db.from('workspace_sessions').select('*')
    .eq('token_hash', hash(token)).eq('workspace_id', configuredWorkspaceId()).gt('expires_at', new Date().toISOString()).maybeSingle();
  if (error) throw new Error('Could not verify your session.');
  if (!session) throw new AccessError('UNAUTHENTICATED', 'Sign in to continue.');
  // Stored opaque cookie is not an identity claim. Provider verifies the live user.
  let accessToken = session.access_token as string;
  let identity = await authClient().auth.getUser(accessToken);
  if (identity.error && session.refresh_token) {
    const refreshed = await authClient().auth.refreshSession({ refresh_token: session.refresh_token });
    if (!refreshed.error && refreshed.data.session) {
      accessToken = refreshed.data.session.access_token;
      await db.from('workspace_sessions').update({ access_token: accessToken, refresh_token: refreshed.data.session.refresh_token })
        .eq('token_hash', hash(token)).eq('workspace_id', configuredWorkspaceId());
      identity = await authClient().auth.getUser(accessToken);
    }
  }
  if (identity.error || !identity.data.user || identity.data.user.id !== session.auth_user_id) throw new AccessError('UNAUTHENTICATED', 'Your session expired. Sign in again.');
  const { data, error: memberError } = await db.from('memberships')
    .select('*,users!inner(email,display_name,auth_user_id)').eq('workspace_id', configuredWorkspaceId())
    .eq('user_id', session.user_id).eq('users.auth_user_id', identity.data.user.id).maybeSingle();
  if (memberError) throw new Error('Could not verify workspace membership.');
  return contextForMember(data ? memberFromRow(data as MemberRow) : undefined, configuredWorkspaceId());
}
export async function signIn(email: string, password: string) {
  let token: string;
  if (isLocalAuth()) token = await localAuthStore().login(email, password);
  else {
    const result = await authClient().auth.signInWithPassword({ email: normalizeEmail(email), password });
    if (result.error || !result.data.session) throw new AccessError('INVALID_CREDENTIALS', 'Email or password is incorrect.');
    const db = adminClient();
    const { data, error } = await db.from('memberships').select('*,users!inner(email,display_name,auth_user_id)')
      .eq('workspace_id', configuredWorkspaceId()).eq('users.auth_user_id', result.data.user.id).maybeSingle();
    if (error) throw new Error('Could not verify workspace membership.');
    const ctx = contextForMember(data ? memberFromRow(data as MemberRow) : undefined, configuredWorkspaceId());
    token = opaqueToken();
    const { error: sessionError } = await db.from('workspace_sessions').insert({ token_hash: hash(token), workspace_id: ctx.workspaceId,
      user_id: ctx.actor.id, auth_user_id: result.data.user.id, access_token: result.data.session.access_token,
      refresh_token: result.data.session.refresh_token, expires_at: new Date(Date.now() + 8 * 3600000).toISOString() });
    if (sessionError) throw new Error('Could not start a session.');
  }
  await setSessionCookie(token);
}
export async function signOut() {
  const token = await cookieToken();
  if (token) {
    if (isLocalAuth()) await localAuthStore().logout(token);
    else {
      const db = adminClient();
      const { data } = await db.from('workspace_sessions').select('access_token').eq('token_hash', hash(token)).eq('workspace_id', configuredWorkspaceId()).maybeSingle();
      if (data?.access_token) await db.auth.admin.signOut(data.access_token, 'local');
      await db.from('workspace_sessions').delete().eq('token_hash', hash(token)).eq('workspace_id', configuredWorkspaceId());
    }
  }
  (await cookies()).delete(SESSION_COOKIE);
}
/** Credential lifecycle is available to every active role and independent of
 * business/management write flags. Never reset another person's password. */
export async function changeOwnPassword(currentPassword: string, nextPassword: string) {
  const ctx=await contextForRequest();validatePassword(nextPassword);
  const members=await listWorkspaceMembers();const member=members.find(item=>item.id===ctx.memberId)!;
  if(isLocalAuth()) await localAuthStore().changePassword(ctx,currentPassword,nextPassword);
  else {
    const provider=authClient();
    const verified=await provider.auth.signInWithPassword({email:member.email,password:currentPassword});
    if(verified.error||verified.data.user?.id!==member.authUserId) throw new AccessError('INVALID_CREDENTIALS','Current password is incorrect.');
    const updated=await provider.auth.updateUser({password:nextPassword});
    if(updated.error) throw new Error('Could not update your password.');
    const removed=await adminClient().from('workspace_sessions').delete().eq('workspace_id',ctx.workspaceId).eq('user_id',ctx.actor.id);
    if(removed.error) throw new Error('Password changed. Sign out and sign in again.');
  }
  await signIn(member.email,nextPassword);
}
export async function listWorkspaceMembers(): Promise<Member[]> {
  const ctx = await contextForRequest();
  if (isLocalAuth()) return localAuthStore().read().members.map(({ passwordHash: password, ...member }) => { void password; return member; });
  const { data, error } = await adminClient().from('memberships').select('*,users(email,display_name,auth_user_id)').eq('workspace_id', ctx.workspaceId).order('created_at');
  if (error) throw new Error('Could not load workspace members.');
  return (data as MemberRow[]).map(memberFromRow);
}
export function requireManagementWrites(ctx: WorkspaceAccess) {
  return authorizeManagement(ctx, process.env.MANAGEMENT_WRITE_ENABLED === 'true' && process.env.VERCEL_ENV !== 'preview');
}
export async function userManagementSnapshot() {
  const ctx = await contextForRequest();
  if (ctx.role !== 'Admin') throw new AccessError('ADMIN_REQUIRED', 'Only an Admin can manage workspace access.');
  const members = await listWorkspaceMembers();
  if (isLocalAuth()) {
    const state = localAuthStore().read();
    return { members, invitations: state.invitations.map(({ tokenHash: token, ...invite }) => { void token; return invite; }), events: state.events, workspaceName: state.workspace.name, capturedAt: Date.now() };
  }
  const db = adminClient();
  const [invites, events, workspace] = await Promise.all([
    db.from('workspace_invitations').select('id,workspace_id,email,role,expires_at,revoked_at,used_at,invited_by').eq('workspace_id', ctx.workspaceId),
    db.from('membership_events').select('*').eq('workspace_id', ctx.workspaceId).order('occurred_at', { ascending: false }).limit(50),
    db.from('workspaces').select('name').eq('id', ctx.workspaceId).single(),
  ]);
  if (invites.error || events.error || workspace.error) throw new Error('Could not load user management.');
  return { members, invitations: invites.data.map(item => ({ id: item.id as string, workspaceId: item.workspace_id as string,
    email: item.email as string, role: item.role as Role, expiresAt: item.expires_at as string,
    revokedAt: item.revoked_at as string | null, usedAt: item.used_at as string | null, invitedBy: item.invited_by as string })),
    events: events.data.map(item => ({ id: item.id as string, workspaceId: item.workspace_id as string, actorId: item.actor_id as string, actorLabel: item.actor_label as string,
      targetId: item.target_id as string, action: item.action as string, at: item.occurred_at as string })), workspaceName: workspace.data.name as string, capturedAt: Date.now() };
}
export async function inviteUser(email: string, role: Role) {
  const ctx = requireManagementWrites(await contextForRequest());
  if (isLocalAuth()) return localAuthStore().invite(ctx, email, role);
  const token = opaqueToken();
  const { error } = await adminClient().rpc('manage_workspace_invitation', { p_workspace_id: ctx.workspaceId, p_member_id: ctx.memberId,
    p_action: 'INVITE', p_invitation_id: null, p_email: normalizeEmail(email), p_role: role, p_token_hash: hash(token) });
  if (error) throw new Error(error.message);
  return token;
}
export async function rotateInvitation(id: string, revoke: boolean) {
  const ctx = requireManagementWrites(await contextForRequest());
  if (isLocalAuth()) return localAuthStore().rotate(ctx, id, revoke);
  const token = opaqueToken();
  const { error } = await adminClient().rpc('manage_workspace_invitation', { p_workspace_id: ctx.workspaceId, p_member_id: ctx.memberId,
    p_action: revoke ? 'REVOKE' : 'RESEND', p_invitation_id: id, p_email: null, p_role: null, p_token_hash: hash(token) });
  if (error) throw new Error(error.message);
  return revoke ? null : token;
}
export async function changeMembership(id: string, role: Role, active: boolean, isProductLead: boolean) {
  const ctx = requireManagementWrites(await contextForRequest());
  if (isLocalAuth()) return localAuthStore().change(ctx, id, role, active, isProductLead);
  const { error } = await adminClient().rpc('change_workspace_membership', { p_workspace_id: ctx.workspaceId, p_member_id: ctx.memberId,
    p_target_id: id, p_role: role, p_active: active, p_is_product_lead: isProductLead });
  if (error) throw new Error(error.message);
}
export async function inspectInvitation(token: string) {
  if (isLocalAuth()) return localAuthStore().invitation(token);
  const { data, error } = await adminClient().from('workspace_invitations').select('email,role,expires_at')
    .eq('workspace_id', configuredWorkspaceId()).eq('token_hash', hash(token)).is('used_at', null).is('revoked_at', null)
    .gt('expires_at', new Date().toISOString()).maybeSingle();
  if (error || !data) throw new AccessError('INVITE_INVALID', 'This invitation is expired, revoked or already used.');
  return { email: data.email as string, role: data.role as Role, expiresAt: data.expires_at as string };
}
export async function acceptInvitation(token: string, name: string, password: string) {
  if (process.env.MANAGEMENT_WRITE_ENABLED !== 'true' || process.env.VERCEL_ENV === 'preview') throw new AccessError('MANAGEMENT_DISABLED', 'Account setup is disabled in this environment.');
  validatePassword(password);
  if (!name.trim() || name.trim().length > 120) throw new Error('Enter your name (up to 120 characters).');
  const invite = await inspectInvitation(token);
  if (isLocalAuth()) await localAuthStore().accept(token, name, password);
  else {
    const db = adminClient();
    // Bearer invitation possession is sufficient under the explicitly approved
    // contract. No extra email step; never delete a provider identity on failure.
    const created = await db.auth.admin.createUser({ email: invite.email, password, email_confirm: true });
    let authUserId = created.data.user?.id;
    if (!authUserId) {
      const existing = await authClient().auth.signInWithPassword({ email: invite.email, password });
      if (existing.error || !existing.data.user) throw new Error('Account setup could not complete. The invitation is still available; try again or contact your Admin.');
      authUserId = existing.data.user.id;
    }
    const { error } = await db.rpc('accept_workspace_invitation', { p_workspace_id: configuredWorkspaceId(), p_token_hash: hash(token), p_auth_user_id: authUserId, p_display_name: name.trim() });
    if (error) throw new Error(error.message);
  }
  await signIn(invite.email, password);
}

export type { WorkspaceAccess, Role, Member, Session };
