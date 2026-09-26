import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LocalAuthStore, AccessError, authorizePlatform, hash } from './core.ts';
import { boundLocalSession, localContextForToken, loginWorkspaceCandidates, selectLoginWorkspace, startLocalLogin } from './login-scope.ts';

const password = 'Fictional-scope-test-password-42';
async function fixture() {
  const directory = mkdtempSync(join(tmpdir(), 'prodwise-login-scope-'));
  const configured = new LocalAuthStore(join(directory, 'auth.json'), 'workspace-aman');
  const owner = configured.bootstrap('owner@aman.eg', 'Fixture platform owner', password, { id: 'org-aman', name: 'AMAN', emailPolicy: { domains: ['aman.eg', 'rayacorp.com'], exactEmails: [] } });
  await configured.bootstrapPlatformOwner(owner.userId);
  const actor = configured.session(await configured.login(owner.email, password));
  const demo = await configured.platformCreateOrganization(actor, 'Prodwise Demo', { domains: ['demo.example'], exactEmails: [] });
  const invitation = await configured.platformProvisionMembership(actor, demo.organizationId, 'reviewer@demo.example', 'ORG_OWNER', false, 'Synthetic fixture reviewer');
  const demoStore = new LocalAuthStore(configured.path, demo.workspaceId);
  await demoStore.accept(invitation.invitationToken!, 'Synthetic Reviewer', password);
  return { configured, actor, demoStore, demo, cleanup() { rmSync(directory, { recursive: true, force: true }); } };
}

test('reviewer signs straight into its own Demo organization despite AMAN deployment default', async () => {
  const f = await fixture();
  try {
    const login = await startLocalLogin(f.configured, 'reviewer@demo.example', password);
    assert.equal(login.workspaceId, f.demo.workspaceId);
    const context = localContextForToken(f.configured, login.token);
    assert.equal(context.organizationId, f.demo.organizationId);
    assert.equal(context.role, 'ORG_OWNER');
    assert.equal(context.platformRole, null);
    assert.throws(() => authorizePlatform(context), { code: 'PLATFORM_OWNER_REQUIRED' });
    assert.throws(() => f.configured.session(login.token), { code: 'UNAUTHENTICATED' });
    await assert.rejects(() => f.configured.login('reviewer@demo.example', password), { code: 'ACCESS_DENIED' });
    await assert.rejects(() => f.configured.invite(context, 'outsider@aman.eg', 'MEMBER'), { code: 'ACCESS_DENIED' });
    assert.equal(f.configured.read(true).members.some(member => member.userId === context.actor.id), false);
  } finally { f.cleanup(); }
});

test('platform authority prefers configured workspace without requiring membership and remains persisted', async () => {
  const f = await fixture();
  try {
    const login = await startLocalLogin(f.configured, 'owner@aman.eg', password);
    assert.equal(login.workspaceId, f.configured.workspaceId);
    const demoLogin = await startLocalLogin(f.demoStore, 'owner@aman.eg', password);
    assert.equal(demoLogin.workspaceId, f.demo.workspaceId);
    const context = localContextForToken(f.configured, demoLogin.token);
    assert.equal(context.platformRole, 'PLATFORM_OWNER');
    assert.equal(context.memberId, null);
    assert.equal(context.role, null);
    assert.equal(authorizePlatform(context).actor.id, f.actor.actor.id);
  } finally { f.cleanup(); }
});

test('candidate scope is deterministic and excludes foreign/inactive memberships', async () => {
  const identity = { id: 'reviewer', active: true, platformRole: null } as const;
  const workspaces = [{ id: 'workspace-z', organizationId: 'org-z' }, { id: 'workspace-aman', organizationId: 'org-aman' }, { id: 'workspace-a', organizationId: 'org-a' }, { id: 'workspace-off', organizationId: 'org-off' }];
  const memberships = [{ userId: 'reviewer', organizationId: 'org-z', active: true }, { userId: 'reviewer', organizationId: 'org-a', active: true }, { userId: 'someone-else', organizationId: 'org-aman', active: true }, { userId: 'reviewer', organizationId: 'org-off', active: false }];
  assert.deepEqual(loginWorkspaceCandidates(identity, 'workspace-aman', workspaces, memberships), ['workspace-a', 'workspace-z']);
  assert.deepEqual(loginWorkspaceCandidates(identity, 'workspace-z', workspaces, memberships), ['workspace-z', 'workspace-a']);
  const checked: string[] = [];
  const selected = await selectLoginWorkspace(identity, 'workspace-aman', workspaces, memberships, async workspaceId => {
    checked.push(workspaceId);
    if (workspaceId === 'workspace-a') throw new AccessError('EMAIL_NOT_ALLOWED', 'Policy changed.');
    return workspaceId;
  });
  assert.equal(selected, 'workspace-z');
  assert.deepEqual(checked, ['workspace-a', 'workspace-z']);
  await assert.rejects(() => selectLoginWorkspace(identity, 'workspace-a', workspaces, memberships, async () => { throw new Error('Database unavailable'); }), /Database unavailable/);
  assert.throws(() => loginWorkspaceCandidates({ ...identity, active: false }, 'workspace-a', workspaces, memberships), { code: 'DEACTIVATED' });
});

test('wrong global credentials cannot create a session or consult another organization', async () => {
  const f = await fixture();
  try {
    const before = f.configured.read(true).sessions.length;
    await assert.rejects(() => startLocalLogin(f.configured, 'reviewer@demo.example', 'incorrect password'), { code: 'INVALID_CREDENTIALS' });
    await assert.rejects(() => startLocalLogin(f.configured, 'nonexistent@aman.eg', password), { code: 'INVALID_CREDENTIALS' });
    assert.equal(f.configured.read(true).sessions.length, before);
  } finally { f.cleanup(); }
});

test('stored session scope ignores deployment default changes and rejects token/workspace forgery', async () => {
  const f = await fixture();
  try {
    const login = await startLocalLogin(f.configured, 'reviewer@demo.example', password);
    assert.equal(localContextForToken(f.configured, login.token).workspaceId, f.demo.workspaceId);
    assert.equal(localContextForToken(f.demoStore, login.token).workspaceId, f.demo.workspaceId);
    assert.throws(() => localContextForToken(f.configured, `${login.token}.workspace-aman`), { code: 'UNAUTHENTICATED' });
    await f.configured.mutate(state => { const session = state.sessions.find(item => item.tokenHash === hash(login.token))!; session.workspaceId = f.configured.workspaceId; session.organizationId = 'org-aman'; });
    assert.throws(() => localContextForToken(f.configured, login.token), { code: 'ACCESS_DENIED' });
  } finally { f.cleanup(); }
});

test('fresh membership, identity and organization policy are rechecked for stored sessions', async () => {
  const f = await fixture();
  try {
    await f.configured.platformProvisionMembership(f.actor, f.demo.organizationId, 'owner@aman.eg', 'ORG_OWNER', true, 'Fixture owner permits safe reviewer deactivation test');
    const login = await startLocalLogin(f.configured, 'reviewer@demo.example', password);
    const reviewer = localContextForToken(f.configured, login.token);
    await f.demoStore.mutate(state => { state.memberships.find(member => member.id === reviewer.memberId)!.active = false; });
    assert.throws(() => localContextForToken(f.configured, login.token), { code: 'DEACTIVATED' });
    await assert.rejects(() => startLocalLogin(f.configured, 'reviewer@demo.example', password), { code: 'ACCESS_DENIED' });
    await f.demoStore.mutate(state => { state.memberships.find(member => member.id === reviewer.memberId)!.active = true; state.identities.find(identity => identity.id === reviewer.actor.id)!.active = false; });
    assert.throws(() => localContextForToken(f.configured, login.token), { code: 'ACCESS_DENIED' });
    await assert.rejects(() => startLocalLogin(f.configured, 'reviewer@demo.example', password), { code: 'DEACTIVATED' });
    await f.demoStore.mutate(state => { state.identities.find(identity => identity.id === reviewer.actor.id)!.active = true; });
    await f.configured.platformConfigurePolicy(f.actor, f.demo.organizationId, { domains: ['other.example'], exactEmails: [] });
    assert.throws(() => localContextForToken(f.configured, login.token), { code: 'EMAIL_NOT_ALLOWED' });
    await assert.rejects(() => startLocalLogin(f.configured, 'reviewer@demo.example', password), { code: 'EMAIL_NOT_ALLOWED' });
  } finally { f.cleanup(); }
});

test('expired and malformed persisted sessions are refused before choosing a workspace', async () => {
  const f = await fixture();
  try {
    const login = await startLocalLogin(f.configured, 'reviewer@demo.example', password);
    await f.demoStore.mutate(state => { state.sessions.find(item => item.tokenHash === hash(login.token))!.expiresAt = 'invalid'; });
    assert.throws(() => boundLocalSession(f.configured, login.token), { code: 'UNAUTHENTICATED' });
    await f.demoStore.mutate(state => { state.sessions.find(item => item.tokenHash === hash(login.token))!.expiresAt = '2000-01-01T00:00:00Z'; });
    assert.throws(() => localContextForToken(f.configured, login.token), { code: 'UNAUTHENTICATED' });
  } finally { f.cleanup(); }
});
