import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { registerHooks } from 'node:module';
import { LocalAuthStore } from '../auth/core.ts';
import { applyConnectorSnapshot } from './local-import.ts';
import { fixtureCall, FIXTURE_SITE, FIXTURE_ISSUES } from './local-fixtures.ts';
import { issueSnapshot } from './jira.ts';
import { pauseJob, type JiraSyncJob } from './auto-sync-model.ts';
import type { StoreShape } from '../data/store.ts';
import type { Connection } from './types.ts';

test('background worker persists changed children without a browser; revocation, pause and failure keep history', async () => {
  // A worker must never consult browser headers/cookies or issue a page redirect.
  const hooks = registerHooks({ resolve(specifier, context, nextResolve) {
    if (specifier === 'next/headers' || specifier === 'next/navigation') return { shortCircuit: true, url: `data:text/javascript,${encodeURIComponent('export function cookies(){throw new Error("BROWSER_SESSION_USED")} export const headers=cookies; export const redirect=cookies;')}` };
    return nextResolve(specifier, context);
  } });
  const cwd = process.cwd(), directory = mkdtempSync(join(tmpdir(), 'prodwise-sync-'));
  const oldEnv = { ...process.env };
  try {
    process.chdir(directory);
    Object.assign(process.env, { AUTH_MODE: 'local', NODE_ENV: 'test', DEMO_WRITE_ENABLED: 'true', JIRA_AUTO_SYNC_ENABLED: 'true', JIRA_SYNC_SECRET: 'test-only-secret-'.repeat(4), CONNECTOR_LOCAL_FIXTURES: '1', PRODWISE_WORKSPACE_ID: 'a0000000-0000-4000-8000-000000000002' });
    delete process.env.VERCEL_ENV;
    mkdirSync('.data', { recursive: true });
    const auth = new LocalAuthStore(join(directory, '.data', 'auth.json'), process.env.PRODWISE_WORKSPACE_ID!);
    const member = auth.bootstrap('owner@synthetic.example', 'Synthetic sync owner', 'Synthetic-test-password-42', { id: 'a0000000-0000-4000-8000-000000000001', name: 'Worker test', emailPolicy: { domains: ['synthetic.example'], exactEmails: [] } });
    const ctx = auth.contextForBackground(member.userId), id = randomUUID(), now = new Date().toISOString();
    const connection: Connection = { id: randomUUID(), organizationId: ctx.organizationId, userId: ctx.actor.id, provider: 'JIRA', status: 'CONNECTED', accountLabel: 'Synthetic test', externalAccountId: 'fixture', sites: [FIXTURE_SITE], scopes: '', sealedTokens: null, connectedAt: now, updatedAt: now, disconnectedAt: null, lastErrorCode: null };
    const saveConnection = () => writeFileSync('.data/connections.json', JSON.stringify({ connections: [connection] })); saveConnection();
    const store: StoreShape = { initiatives: [{ id, workspaceId: ctx.workspaceId, slug: 'sync-test', name: 'Synthetic sync test', description: null, knownReferences: [], businessLine: null, stage: 'DELIVERY', overallState: 'UNKNOWN', stateSummary: null, isDemo: false, createdBy: ctx.actor.id, createdAt: now, updatedAt: now, archivedAt: null } as unknown as StoreShape['initiatives'][number]], activity: [], evidence: [], sources: [], claims: [], claimEvidence: [], findingStates: [] };
    const snap = await issueSnapshot(fixtureCall('JIRA', 0), FIXTURE_SITE, 'PAY-20');
    applyConnectorSnapshot(store, ctx, { initiativeId: id, mode: 'IMPORT', requestId: randomUUID(), role: 'DELIVERY', snapshot: snap }, now);
    const job: JiraSyncJob = { id: randomUUID(), workspaceId: ctx.workspaceId, organizationId: ctx.organizationId, initiativeId: id, itemId: store.sourceItemSyncs![0]!.itemId, userId: ctx.actor.id, ownerLabel: ctx.actor.label, connectionId: connection.id, connectionGrantedAt: now, status: 'ACTIVE', nextRunAt: now, lastAttemptAt: null, lastSuccessAt: null, lastError: null, failures: 0, leaseToken: null, leaseUntil: null, revision: 1 };
    store.jiraSyncJobs = [job]; writeFileSync('.data/prodwise.json', JSON.stringify(store));
    const { runAutoSync } = await import('./auto-sync.ts');
    const { updateConnectionTokens } = await import('./connections.ts');
    connection.sealedTokens = 'synthetic-old'; saveConnection();
    const oldGrant = structuredClone(connection);
    assert.equal(await updateConnectionTokens(oldGrant, 'synthetic-old', 'synthetic-new'), true);
    assert.equal(await updateConnectionTokens(oldGrant, 'synthetic-old', 'synthetic-stale'), false);
    connection.status = 'DISCONNECTED'; connection.sealedTokens = null; saveConnection();
    assert.equal(await updateConnectionTokens(oldGrant, 'synthetic-new', 'synthetic-resurrected'), false);
    connection.status = 'CONNECTED'; connection.sealedTokens = 'synthetic-new'; connection.connectedAt = new Date(Date.parse(now) + 1).toISOString(); saveConnection();
    assert.equal(await updateConnectionTokens(oldGrant, 'synthetic-new', null), false);
    connection.connectedAt = now; connection.sealedTokens = null; saveConnection();
    const read = () => JSON.parse(readFileSync('.data/prodwise.json', 'utf8')) as StoreShape;
    const change = (fn: (s: StoreShape) => void) => { const s = read(); fn(s); writeFileSync('.data/prodwise.json', JSON.stringify(s)); };
    const due = () => change(s => { Object.assign(s.jiraSyncJobs![0]!, { nextRunAt: now, status: 'ACTIVE', leaseToken: null, leaseUntil: null }); });
    assert.equal((await runAutoSync()).outcome, 'UNCHANGED'); assert.equal(read().evidence.length, 1);
    const child = FIXTURE_ISSUES.find(x => x.key === 'PAY-21')!, originalDue = child.due;
    try {
      child.due = '2027-02-28'; due();
      assert.equal((await runAutoSync()).outcome, 'SAVED');
      assert.equal(read().evidence.length, 2); assert.match(read().evidenceSubmissions!.at(-1)!.text, /2027-02-28/);
      assert.equal(read().claims.length, 0); assert.equal(read().initiatives[0]!.stage, 'DELIVERY');
      due(); const running = runAutoSync(); change(s => pauseJob(s.jiraSyncJobs![0]!));
      assert.equal((await running).outcome, 'STALE'); assert.equal(read().evidence.length, 2);
      due(); const revoked = runAutoSync(); connection.status = 'DISCONNECTED'; saveConnection();
      assert.equal((await revoked).outcome, 'FAILED'); assert.equal(read().jiraSyncJobs![0]!.status, 'ATTENTION'); assert.equal(read().evidence.length, 2);
      connection.status = 'CONNECTED'; saveConnection(); due();
      change(s => { s.sourceMappings![0]!.unlinkedAt = now; });
      assert.equal((await runAutoSync()).outcome, 'FAILED'); assert.equal(read().evidence.length, 2);
      change(s => { s.sourceMappings![0]!.unlinkedAt = null; }); due();
      await auth.mutate(s => {
        const owner = s.identities.find(x => x.id === ctx.actor.id)!, replacementId = randomUUID();
        s.identities.push({ ...owner, id: replacementId, email: 'backup@synthetic.example' });
        s.memberships.push({ ...s.memberships.find(x => x.userId === owner.id)!, id: randomUUID(), userId: replacementId });
        owner.active = false;
      });
      assert.equal((await runAutoSync()).outcome, 'FAILED'); assert.equal(read().jiraSyncJobs![0]!.lastError, 'ACCESS_REVOKED'); assert.equal(read().evidence.length, 2);
    } finally { child.due = originalDue; }
  } finally {
    hooks.deregister();
    process.chdir(cwd);
    for (const key of Object.keys(process.env)) if (!(key in oldEnv)) delete process.env[key];
    Object.assign(process.env, oldEnv);
    rmSync(directory, { recursive: true, force: true });
  }
});
