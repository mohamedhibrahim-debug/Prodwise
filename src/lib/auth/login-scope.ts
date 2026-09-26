import { AccessError, LocalAuthStore, hash, normalizeEmail, passwordMatches, type Identity, type OrganizationMembership, type Session, type Workspace, type WorkspaceAccess } from './core.ts';

/** Candidate selection uses persisted identity/membership records only. A candidate
 * is never an access grant: the existing core/RPC re-authorizes it before use. */
export function loginWorkspaceCandidates(
  identity: Pick<Identity, 'id' | 'active' | 'platformRole'>,
  preferredWorkspaceId: string,
  workspaces: Pick<Workspace, 'id' | 'organizationId'>[],
  memberships: Pick<OrganizationMembership, 'organizationId' | 'userId' | 'active'>[],
): string[] {
  if (!identity.active) throw new AccessError('DEACTIVATED', 'Your account has been deactivated.');
  const organizations = new Set(memberships.filter(member => member.userId === identity.id && member.active).map(member => member.organizationId));
  const eligible = [...new Set(workspaces.filter(workspace => identity.platformRole === 'PLATFORM_OWNER' || organizations.has(workspace.organizationId)).map(workspace => workspace.id))].sort();
  return eligible.includes(preferredWorkspaceId) ? [preferredWorkspaceId, ...eligible.filter(id => id !== preferredWorkspaceId)] : eligible;
}

export async function selectLoginWorkspace<T>(
  identity: Pick<Identity, 'id' | 'active' | 'platformRole'>,
  preferredWorkspaceId: string,
  workspaces: Pick<Workspace, 'id' | 'organizationId'>[],
  memberships: Pick<OrganizationMembership, 'organizationId' | 'userId' | 'active'>[],
  authorize: (workspaceId: string) => Promise<T>,
): Promise<T> {
  let denial = new AccessError('ACCESS_DENIED', 'You do not have access to an active organization.');
  for (const workspaceId of loginWorkspaceCandidates(identity, preferredWorkspaceId, workspaces, memberships)) {
    try { return await authorize(workspaceId); }
    catch (error) {
      if (!(error instanceof AccessError) || !['ACCESS_DENIED', 'DEACTIVATED', 'EMAIL_NOT_ALLOWED', 'OWNER_BOOTSTRAP_REQUIRED'].includes(error.code)) throw error;
      denial = error;
    }
  }
  throw denial;
}

/** Verify the global password before consulting access candidates. The existing
 * store verifies again atomically before creating the organization-bound session. */
export async function startLocalLogin(store: LocalAuthStore, email: string, password: string) {
  const state = store.read(true);
  const identity = state.identities.find(user => user.email === normalizeEmail(email));
  const storedHash = identity?.passwordHash ?? `00000000000000000000000000000000:${'00'.repeat(64)}`;
  if (!passwordMatches(password, storedHash) || !identity) throw new AccessError('INVALID_CREDENTIALS', 'Email or password is incorrect.');
  return selectLoginWorkspace(identity, store.workspaceId, state.workspaces, state.memberships, async workspaceId => ({
    token: await new LocalAuthStore(store.path, workspaceId).login(email, password), workspaceId,
  }));
}

/** A signed opaque token selects exactly its persisted session, not an org in a
 * header, URL, form, preference or current deployment default. */
export function boundLocalSession(store: LocalAuthStore, token: string, now = Date.now()): Session {
  const matching = store.read(true).sessions.filter(session => session.tokenHash === hash(token));
  if (matching.length !== 1 || !(Date.parse(matching[0]!.expiresAt) > now)) throw new AccessError('UNAUTHENTICATED', 'Sign in to continue.');
  return matching[0]!;
}
export function localContextForToken(store: LocalAuthStore, token: string): WorkspaceAccess {
  const session = boundLocalSession(store, token);
  const context = new LocalAuthStore(store.path, session.workspaceId).session(token);
  if (context.actor.id !== session.userId || context.organizationId !== session.organizationId || context.workspaceId !== session.workspaceId) throw new AccessError('ACCESS_DENIED', 'Session organization mismatch.');
  return context;
}
