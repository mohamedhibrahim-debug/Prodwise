import { randomBytes, randomUUID, scryptSync, timingSafeEqual, createHash, createHmac } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync, rmSync } from 'node:fs';
import { dirname } from 'node:path';

export type Role = 'Admin' | 'Member' | 'Viewer';
export interface WorkspaceAccess {
  workspaceId: string; memberId: string; actor: { id: string; label: string };
  role: Role; isProductLead: boolean;
}
export interface Member {
  id: string; workspaceId: string; userId: string; email: string; displayName: string;
  role: Role; isProductLead: boolean; active: boolean; passwordHash?: string; authUserId?: string | null;
}
export interface Invitation {
  id: string; workspaceId: string; email: string; role: Role; tokenHash: string;
  expiresAt: string; revokedAt: string | null; usedAt: string | null; invitedBy: string;
}
export interface Session {
  tokenHash: string; userId: string; expiresAt: string; accessToken?: string; refreshToken?: string;
}
export interface AuthState {
  workspace: { id: string; name: string; status: 'BOOTSTRAPPING' | 'ACTIVE' };
  members: Member[]; invitations: Invitation[]; sessions: Session[];
  events: { id: string; workspaceId: string; actorId: string; actorLabel: string; targetId: string; action: string; at: string; before?: unknown; after?: unknown }[];
}
export class AccessError extends Error {
  code: string;
  constructor(code: string, message: string) { super(message); this.name = 'AccessError'; this.code=code; }
}
export const hash = (value: string) => createHash('sha256').update(value).digest('hex');
export const opaqueToken = () => randomBytes(32).toString('base64url');
export const normalizeEmail = (email: string) => email.trim().toLowerCase();
export function validatePassword(password: string) {
  if (password.length < 12 || password.length > 256) throw new AccessError('PASSWORD_INVALID', 'Use a password between 12 and 256 characters.');
}
export function passwordHash(password: string) {
  validatePassword(password);
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
}
export function passwordMatches(password: string, saved: string) {
  const [salt, digest] = saved.split(':');
  if (!salt || !digest) return false;
  const expected = Buffer.from(digest, 'hex');
  const actual = scryptSync(password, salt, 64);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
export function signToken(token: string, secret: string) {
  if (secret.length < 32) throw new Error('AUTH_SESSION_SECRET must contain at least 32 characters.');
  return `${token}.${createHmac('sha256', secret).update(token).digest('base64url')}`;
}
export function unsignedToken(cookie: string | undefined, secret: string): string | null {
  if (!cookie || secret.length < 32) return null;
  const [token, signature, extra] = cookie.split('.');
  if (!token || !signature || extra) return null;
  const expected = Buffer.from(signToken(token, secret).split('.')[1]!);
  const supplied = Buffer.from(signature);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected) ? token : null;
}
export function safeReturnPath(value: string | undefined) {
  if (!value?.startsWith('/') || value.startsWith('//') || /[\\\u0000-\u0020]/.test(value)) return '/';
  const target = new URL(value, 'https://prodwise.invalid');
  if (target.origin !== 'https://prodwise.invalid' || /^\/(login|invite|auth)(\/|$)/.test(target.pathname)) return '/';
  return target.pathname + target.search + target.hash;
}
export function contextForMember(member: Member | undefined, workspaceId: string): WorkspaceAccess {
  if (!member || member.workspaceId !== workspaceId) throw new AccessError('ACCESS_DENIED', 'Workspace access is unavailable.');
  if (!member.active) throw new AccessError('DEACTIVATED', 'Your workspace access has been deactivated.');
  if (!(['Admin', 'Member', 'Viewer'] as string[]).includes(member.role)) throw new AccessError('ACCESS_DENIED', 'Workspace access is unavailable.');
  return { workspaceId, memberId: member.id, actor: { id: member.userId, label: member.displayName }, role: member.role, isProductLead: member.isProductLead };
}
export function authorizeBusiness(ctx: WorkspaceAccess, enabled: boolean) {
  if (ctx.role === 'Viewer') throw new AccessError('VIEW_ONLY', 'You have view-only access.');
  if (!enabled) throw new AccessError('WRITE_DISABLED', 'Changes are disabled in this environment.');
  return ctx;
}
export function authorizeFinalize(ctx: WorkspaceAccess, enabled: boolean) {
  if (ctx.role !== 'Admin' && !ctx.isProductLead) throw new AccessError('REVIEW_FINALIZE_DENIED', 'Only an Admin or designated Product Lead can finalize a review.');
  return authorizeBusiness(ctx, enabled);
}
export function authorizeManagement(ctx: WorkspaceAccess, enabled: boolean) {
  if (ctx.role !== 'Admin') throw new AccessError('ADMIN_REQUIRED', 'Only an Admin can manage workspace access.');
  if (!enabled) throw new AccessError('MANAGEMENT_DISABLED', 'User management changes are disabled in this environment.');
  return ctx;
}

/** Private single-machine fixture persistence. Lock + atomic replacement protect
 * auth lifecycle transitions across concurrent requests/processes. Not hosted storage. */
export class LocalAuthStore {
  path: string;
  workspaceId: string;
  constructor(path: string, workspaceId: string) { this.path=path; this.workspaceId=workspaceId; }
  read(): AuthState {
    if (!existsSync(this.path)) throw new AccessError('AUTH_NOT_BOOTSTRAPPED', 'This local workspace needs an operator bootstrap.');
    const state = JSON.parse(readFileSync(this.path, 'utf8')) as AuthState;
    if (state.workspace.id !== this.workspaceId) throw new AccessError('ACCESS_DENIED', 'Workspace configuration does not match.');
    return state;
  }
  async mutate<T>(fn: (state: AuthState) => T): Promise<T> {
    const lock = `${this.path}.lock`;
    mkdirSync(dirname(this.path), { recursive: true });
    let acquired = false;
    for (let retry = 0; retry < 100; retry++) {
      try { mkdirSync(lock); acquired = true; break; }
      catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    }
    if (!acquired) throw new Error('Workspace is busy. Try again.');
    try {
      const state = this.read();
      const result = fn(state);
      const temporary = `${this.path}.${randomUUID()}.tmp`;
      try { writeFileSync(temporary, JSON.stringify(state, null, 2), { mode: 0o600 }); renameSync(temporary, this.path); }
      finally { if (existsSync(temporary)) rmSync(temporary); }
      return result;
    } finally { rmSync(lock, { recursive: true }); }
  }
  bootstrap(email: string, displayName: string, password: string) {
    if (existsSync(this.path)) throw new Error('Workspace already bootstrapped.');
    const userId = randomUUID();
    const member: Member = { id: randomUUID(), workspaceId: this.workspaceId, userId,
      email: normalizeEmail(email), displayName, role: 'Admin', isProductLead: false, active: true, passwordHash: passwordHash(password) };
    const state: AuthState = { workspace: { id: this.workspaceId, name: 'Prodwise local workspace', status: 'ACTIVE' },
      members: [member], invitations: [], sessions: [], events: [] };
    mkdirSync(dirname(this.path), { recursive: true });
    writeFileSync(this.path, JSON.stringify(state, null, 2), { flag: 'wx', mode: 0o600 });
    return member;
  }
  async login(email: string, password: string) {
    const member = this.read().members.find(item => item.email === normalizeEmail(email));
    // Perform the same expensive operation even for an unknown account.
    const saved = member?.passwordHash ?? `00000000000000000000000000000000:${'00'.repeat(64)}`;
    if (!passwordMatches(password, saved) || !member) throw new AccessError('INVALID_CREDENTIALS', 'Email or password is incorrect.');
    contextForMember(member, this.workspaceId);
    const token = opaqueToken();
    await this.mutate(state => {
      contextForMember(state.members.find(item=>item.id===member.id),this.workspaceId);
      state.sessions.push({ tokenHash: hash(token), userId: member.userId, expiresAt: new Date(Date.now() + 8 * 3600000).toISOString() });
    });
    return token;
  }
  session(token: string) {
    const state = this.read();
    const session = state.sessions.find(item => item.tokenHash === hash(token) && Date.parse(item.expiresAt) > Date.now());
    if (!session) throw new AccessError('UNAUTHENTICATED', 'Sign in to continue.');
    return contextForMember(state.members.find(item => item.userId === session.userId), this.workspaceId);
  }
  async logout(token: string) { await this.mutate(state => { state.sessions = state.sessions.filter(item => item.tokenHash !== hash(token)); }); }
  async changePassword(ctx: WorkspaceAccess, currentPassword: string, nextPassword: string) {
    validatePassword(nextPassword);
    const saved=passwordHash(nextPassword);
    await this.mutate(state=>{
      const member=state.members.find(item=>item.id===ctx.memberId);
      contextForMember(member,this.workspaceId);
      if(!member?.passwordHash||!passwordMatches(currentPassword,member.passwordHash)) throw new AccessError('INVALID_CREDENTIALS','Current password is incorrect.');
      member.passwordHash=saved;
      state.sessions=state.sessions.filter(item=>item.userId!==member.userId);
      this.event(state,ctx,member.id,'PASSWORD_CHANGED',null,null);
    });
  }
  async invite(ctx: WorkspaceAccess, email: string, role: Role) {
    const token = opaqueToken();
    await this.mutate(state => {
      const actor = state.members.find(item => item.id === ctx.memberId);
      authorizeManagement(contextForMember(actor, this.workspaceId), true);
      const normalized = normalizeEmail(email);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) || !(['Admin', 'Member', 'Viewer'] as string[]).includes(role)) throw new Error('Enter a valid email and role.');
      if (state.members.some(item => item.email === normalized) || state.invitations.some(item => item.email === normalized && !item.usedAt && !item.revokedAt && Date.parse(item.expiresAt) > Date.now())) throw new Error('This email already has an account or pending invitation.');
      const invitation: Invitation = { id: randomUUID(), workspaceId: this.workspaceId, email: normalized, role, tokenHash: hash(token), expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(), revokedAt: null, usedAt: null, invitedBy: ctx.actor.id };
      state.invitations.push(invitation); this.event(state, ctx, invitation.id, 'INVITED', null, { email: normalized, role });
    });
    return token;
  }
  invitation(token: string) {
    const item = this.read().invitations.find(item => item.tokenHash === hash(token));
    if (!item || item.workspaceId !== this.workspaceId || item.revokedAt || item.usedAt || Date.parse(item.expiresAt) <= Date.now()) throw new AccessError('INVITE_INVALID', 'This invitation is expired, revoked or already used. Ask your Admin for a new link.');
    return { email: item.email, role: item.role, expiresAt: item.expiresAt };
  }
  async accept(token: string, displayName: string, password: string) {
    validatePassword(password);
    if (!displayName.trim() || displayName.trim().length > 120) throw new Error('Enter your name (up to 120 characters).');
    const savedPassword = passwordHash(password);
    await this.mutate(state => {
      const item = state.invitations.find(item => item.tokenHash === hash(token));
      if (!item || item.usedAt || item.revokedAt || Date.parse(item.expiresAt) <= Date.now() || item.workspaceId !== this.workspaceId) throw new AccessError('INVITE_INVALID', 'This invitation is expired, revoked or already used.');
      if (state.members.some(member => member.email === item.email)) throw new Error('This account already exists. Sign in instead.');
      const userId = randomUUID();
      state.members.push({ id: randomUUID(), workspaceId: this.workspaceId, userId, email: item.email,
        displayName: displayName.trim(), passwordHash: savedPassword, role: item.role, isProductLead: false, active: true });
      item.usedAt = new Date().toISOString();
      this.event(state, { workspaceId: this.workspaceId, memberId: '', actor: { id: userId, label: displayName.trim() }, role: item.role, isProductLead: false }, item.id, 'INVITATION_ACCEPTED', null, { userId, role: item.role });
    });
  }
  async change(ctx: WorkspaceAccess, targetId: string, role: Role, active: boolean, isProductLead: boolean) {
    await this.mutate(state => {
      authorizeManagement(contextForMember(state.members.find(item => item.id === ctx.memberId), this.workspaceId), true);
      const target = state.members.find(item => item.id === targetId && item.workspaceId === ctx.workspaceId);
      if (!target || !(['Admin', 'Member', 'Viewer'] as string[]).includes(role) || (role === 'Viewer' && isProductLead)) throw new Error('Invalid membership change.');
      if (target.role === 'Admin' && target.active && (role !== 'Admin' || !active) && state.members.filter(item => item.active && item.role === 'Admin').length <= 1) throw new AccessError('LAST_ADMIN', 'The last active Admin cannot be demoted or deactivated.');
      const before = { role: target.role, active: target.active, isProductLead: target.isProductLead };
      Object.assign(target, { role, active, isProductLead });
      if (!active) state.sessions = state.sessions.filter(item => item.userId !== target.userId);
      this.event(state, ctx, targetId, 'MEMBERSHIP_CHANGED', before, { role, active, isProductLead });
    });
  }
  async rotate(ctx: WorkspaceAccess, id: string, revoke: boolean) {
    const token = opaqueToken();
    await this.mutate(state => {
      authorizeManagement(contextForMember(state.members.find(item => item.id === ctx.memberId), this.workspaceId), true);
      const invitation = state.invitations.find(item => item.id === id && item.workspaceId === ctx.workspaceId);
      if (!invitation || invitation.usedAt || invitation.revokedAt) throw new Error('This invitation is no longer pending.');
      if (revoke) invitation.revokedAt = new Date().toISOString();
      else { invitation.tokenHash = hash(token); invitation.expiresAt = new Date(Date.now() + 7 * 86400000).toISOString(); }
      this.event(state, ctx, id, revoke ? 'INVITATION_REVOKED' : 'INVITATION_RESENT', null, null);
    });
    return revoke ? null : token;
  }
  private event(state: AuthState, ctx: WorkspaceAccess, targetId: string, action: string, before: unknown, after: unknown) {
    state.events.push({ id: randomUUID(), workspaceId: ctx.workspaceId, actorId: ctx.actor.id, actorLabel: ctx.actor.label, targetId, action, at: new Date().toISOString(), before, after });
  }
}
