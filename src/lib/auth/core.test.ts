import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LocalAuthStore, contextForMember, authorizeBusiness, authorizeManagement, authorizeFinalize, signToken, unsignedToken, safeReturnPath, hash, type WorkspaceAccess } from './core.ts';
import { emailAllowed } from './email-policy.ts';
import { normalizeLegacyRole, hasOrganizationAdminAuthority } from './roles.ts';
const pwd = 'Fictional-test-password-42';
const policy = { domains: ['aman.eg', 'rayacorp.com'], exactEmails: ['mohamedhassanpe@outlook.com'] };
async function fixture() { const dir = mkdtempSync(join(tmpdir(), 'prodwise-auth-')), store = new LocalAuthStore(join(dir, 'auth.json'), 'workspace-a'), owner = store.bootstrap('owner@aman.eg', 'Test Owner', pwd, { id: 'org-a', name: 'AMAN', emailPolicy: policy }), ctx = contextForMember(owner, 'workspace-a'); return { store, ctx, cleanup: () => rmSync(dir, { recursive: true, force: true }) }; }
async function platformFixture() { const f = await fixture(); await f.store.bootstrapPlatformOwner(f.ctx.actor.id); f.ctx = f.store.session(await f.store.login('owner@aman.eg', pwd)); return f; }
test('signed opaque sessions and safe redirects reject manipulation', () => { const secret = 's'.repeat(40), token = 'private-opaque-token'; assert.equal(unsignedToken(signToken(token, secret), secret), token); assert.equal(unsignedToken(signToken(token, secret) + 'x', secret), null); assert.equal(unsignedToken(signToken(token, secret), 't'.repeat(40)), null); for (const path of ['https://evil.test', '//evil.test', '/\\evil.test', '/login', '/invite/token'])
    assert.equal(safeReturnPath(path), '/'); assert.equal(safeReturnPath('/initiatives/a?view=brief'), '/initiatives/a?view=brief'); });
test('role denial precedes independent environment gate and platform has global authority', () => { const base: WorkspaceAccess = { workspaceId: 'w', organizationId: 'o', memberId: 'm', actor: { id: 'u', label: 'User' }, role: 'VIEWER', platformRole: null, isProductLead: false }; assert.throws(() => authorizeBusiness(base, false), { code: 'VIEW_ONLY' }); assert.throws(() => authorizeManagement(base, false), { code: 'ADMIN_REQUIRED' }); assert.throws(() => authorizeFinalize({ ...base, isProductLead: true }, true), { code: 'VIEW_ONLY' }); assert.throws(() => authorizeBusiness({ ...base, role: 'MEMBER' }, false), { code: 'WRITE_DISABLED' }); assert.throws(() => authorizeFinalize({ ...base, role: 'MEMBER' }, true), { code: 'REVIEW_FINALIZE_DENIED' }); assert.equal(authorizeFinalize({ ...base, role: 'MEMBER', isProductLead: true }, true).actor.id, 'u'); assert.equal(authorizeFinalize({ ...base, memberId: null, role: null, platformRole: 'PLATFORM_OWNER' }, true).memberId, null); assert.throws(() => authorizeBusiness({ ...base, platformRole: 'PLATFORM_OWNER' }, false), { code: 'WRITE_DISABLED' }); });
test('opaque invitation accepted exactly once under durable store contention', async () => { const { store, ctx, cleanup } = await fixture(); try {
    const token = await store.invite(ctx, 'VIEWER@aman.eg', 'VIEWER');assert.equal(store.read().invitations[0]!.provisionedByPlatform,false);
    const saved = readFileSync(store.path, 'utf8');
    assert.ok(!saved.includes(token) && saved.includes(hash(token)));
    const outcomes = await Promise.allSettled([store.accept(token, 'Viewer One', pwd), store.accept(token, 'Viewer Two', pwd)]);
    assert.equal(outcomes.filter(x => x.status === 'fulfilled').length, 1);
    const viewer = store.read().members.find(x => x.email === 'viewer@aman.eg')!;
    assert.equal(viewer.role, 'VIEWER');
    const login = await store.login(viewer.email, pwd);
    await store.change(ctx, viewer.id, 'VIEWER', false, false);
    assert.throws(() => store.session(login), { code: 'UNAUTHENTICATED' });
    await assert.rejects(() => store.login(viewer.email, pwd), { code: 'DEACTIVATED' });
}
finally {
    cleanup();
} });
test('resend/revoke/expiry replace bearer access; workspace scope stays strict', async () => { const { store, ctx, cleanup } = await fixture(); try {
    const old = await store.invite(ctx, 'member@aman.eg', 'MEMBER'), id = store.read().invitations[0]!.id, next = await store.rotate(ctx, id, false);
    assert.throws(() => store.invitation(old), { code: 'INVITE_INVALID' });
    await store.rotate(ctx, id, true);
    await assert.rejects(() => store.accept(next!, 'Member', pwd), { code: 'INVITE_INVALID' });
    const expired = await store.invite(ctx, 'expired@aman.eg', 'MEMBER');
    await store.mutate(state => { state.invitations.find(x => x.tokenHash === hash(expired))!.expiresAt = '2000-01-01T00:00:00Z'; });
    assert.throws(() => store.invitation(expired), { code: 'INVITE_INVALID' });
    assert.throws(() => new LocalAuthStore(store.path, 'foreign').session('anything'), { code: 'UNAUTHENTICATED' });
}
finally {
    cleanup();
} });
test('normal org flows cannot assign owners, alter platform identities or admin authority', async () => { const { store, ctx, cleanup } = await platformFixture(); try {
    const token = await store.invite(ctx, 'admin@aman.eg', 'ADMIN');
    await store.accept(token, 'Admin', pwd);
    const admin = contextForMember(store.read().members.find(x => x.email === 'admin@aman.eg'), 'workspace-a');
    await assert.rejects(() => store.invite(admin, 'admin2@aman.eg', 'ADMIN'), { code: 'OWNER_REQUIRED' });
    await assert.rejects(() => store.change(admin, admin.memberId!, 'MEMBER', true, false), { code: 'OWNER_REQUIRED' });
    await assert.rejects(() => store.invite(ctx, 'owner2@aman.eg', 'ORG_OWNER'), { code: 'OWNER_RESERVED' });
    await assert.rejects(() => store.change(admin, ctx.memberId!, 'MEMBER', false, false), { code: 'PLATFORM_IDENTITY_PROTECTED' });
    await assert.rejects(() => store.grantPlatformOwner(admin, admin.actor.id, 'Unauthorized elevation'), { code: 'PLATFORM_OWNER_REQUIRED' });
}
finally {
    cleanup();
} });
test('exact policies never leak domains or individual exceptions into another organization', () => { for (const email of ['pm@aman.eg', 'PM@RAYACORP.COM', 'mohamedhassanpe@outlook.com'])
    assert.equal(emailAllowed(email, policy), true); for (const email of ['pm@fakeaman.eg', 'pm@sub.aman.eg', 'pm@aman.eg.evil.test', 'someone@outlook.com', 'pm@raya.com', 'pm@aman.eg@evil.test'])
    assert.equal(emailAllowed(email, policy), false); assert.equal(emailAllowed('mohamedhassanpe@outlook.com', { domains: ['examplebank.com'], exactEmails: [] }), false); assert.equal(normalizeLegacyRole('Admin'), 'ADMIN'); assert.equal(normalizeLegacyRole('Owner'), 'ORG_OWNER'); });
test('shared global identity reuses password/profile; Member authority does not spill from second-org owner', async () => { const { store, ctx, cleanup } = await platformFixture(); try {
    const token = await store.invite(ctx, 'pm@aman.eg', 'MEMBER');
    await store.accept(token, 'Original PM', pwd);
    const pm = store.read().members.find(x => x.email === 'pm@aman.eg')!;
    const bank = await store.platformCreateOrganization(ctx, 'Bank', { domains: ['examplebank.com'], exactEmails: ['pm@aman.eg'] });
    await store.platformProvisionMembership(ctx, bank.organizationId, pm.email, 'ORG_OWNER', false, 'Approved bank owner');
    const bankStore = new LocalAuthStore(store.path, bank.workspaceId);
    const a = store.session(await store.login(pm.email, pwd)), b = bankStore.session(await bankStore.login(pm.email, pwd));
    assert.equal(a.actor.id, b.actor.id);
    assert.equal(a.role, 'MEMBER');
    assert.equal(b.role, 'ORG_OWNER');
    assert.equal(hasOrganizationAdminAuthority(a), false);
    await assert.rejects(() => store.invite(b, 'foreign@aman.eg', 'MEMBER'), { code: 'ACCESS_DENIED' });
    assert.equal(bankStore.read().identities.find(x => x.id === pm.userId)!.displayName, 'Original PM');
    assert.equal(store.read().identities.filter(x => x.email === pm.email).length, 1);
}
finally {
    cleanup();
} });
test('global identity normal invitation into second org verifies existing password and preserves profile', async () => { const { store, ctx, cleanup } = await platformFixture(); try {
    const t = await store.invite(ctx, 'pm@aman.eg', 'MEMBER');
    await store.accept(t, 'Original PM', pwd);
    const bank = await store.platformCreateOrganization(ctx, 'Bank', { domains: ['examplebank.com'], exactEmails: ['owner@aman.eg', 'pm@aman.eg'] });
    await store.platformProvisionMembership(ctx, bank.organizationId, 'owner@aman.eg', 'ORG_OWNER', false, 'Establish bank owner');
    const bankStore = new LocalAuthStore(store.path, bank.workspaceId), bankCtx = bankStore.session(await bankStore.login('owner@aman.eg', pwd));
    const invite = await bankStore.invite(bankCtx, 'pm@aman.eg', 'MEMBER');
    await assert.rejects(() => bankStore.accept(invite, 'Overwrite Name', pwd + 'wrong'), { code: 'INVALID_CREDENTIALS' });
    await bankStore.accept(invite, 'Overwrite Name', pwd);
    assert.equal(store.read().identities.find(x => x.email === 'pm@aman.eg')!.displayName, 'Original PM');
    assert.equal(store.read().identities.filter(x => x.email === 'pm@aman.eg').length, 1);
}
finally {
    cleanup();
} });
test('deactivation revokes only organization sessions; password change revokes all identity sessions', async () => { const { store, ctx, cleanup } = await platformFixture(); try {
    const t = await store.invite(ctx, 'pm@aman.eg', 'MEMBER');
    await store.accept(t, 'PM', pwd);
    const bank = await store.platformCreateOrganization(ctx, 'Bank', { domains: ['examplebank.com'], exactEmails: ['owner@aman.eg', 'pm@aman.eg'] });
    await store.platformProvisionMembership(ctx, bank.organizationId, 'owner@aman.eg', 'ORG_OWNER', false, 'Establish bank owner');
    await store.platformProvisionMembership(ctx, bank.organizationId, 'pm@aman.eg', 'MEMBER', false, 'Bank member');
    const bankStore = new LocalAuthStore(store.path, bank.workspaceId), a = await store.login('pm@aman.eg', pwd), b = await bankStore.login('pm@aman.eg', pwd), pm = store.read().members.find(x => x.email === 'pm@aman.eg')!;
    await store.change(ctx, pm.id, 'MEMBER', false, false);
    assert.throws(() => store.session(a), { code: 'UNAUTHENTICATED' });
    assert.equal(bankStore.session(b).actor.id, pm.userId);
    await bankStore.changePassword(bankStore.session(b), pwd, pwd + 'new');
    assert.throws(() => bankStore.session(b), { code: 'UNAUTHENTICATED' });
}
finally {
    cleanup();
} });
test('audited policy overrides persist by membership, normal invites cannot override', async () => { const { store, ctx, cleanup } = await platformFixture(); try {
    await assert.rejects(() => store.invite(ctx, 'outside@consultant.test', 'MEMBER'), { code: 'EMAIL_NOT_ALLOWED' });
    const granted = await store.platformProvisionMembership(ctx, 'org-a', 'outside@consultant.test', 'MEMBER', true, 'Approved consulting engagement');
    await store.accept(granted.invitationToken!, 'Consultant', pwd);
    const consultant = store.read().members.find(x => x.email === 'outside@consultant.test')!;
    assert.equal(consultant.policyOverride, true);
    assert.equal(store.session(await store.login(consultant.email, pwd)).role, 'MEMBER');
    assert.ok(store.read().events.some(x => x.policyOverridden && x.reason === 'Approved consulting engagement'));
    await assert.rejects(() => store.platformProvisionMembership(ctx, 'org-a', 'invalid', 'MEMBER', true, 'Invalid syntax'), /INVALID_EMAIL/);
}
finally {
    cleanup();
} });
test('multiple owners allowed, last owner removal rejected, replacement atomic and globally audited', async () => { const { store, ctx, cleanup } = await platformFixture(); try {
    const t = await store.invite(ctx, 'second@aman.eg', 'MEMBER');
    await store.accept(t, 'Second', pwd);
    const second = store.read().members.find(x => x.email === 'second@aman.eg')!;
    await store.platformProvisionMembership(ctx, 'org-a', second.email, 'ORG_OWNER', false, 'Additional org owner');
    assert.equal(store.read().members.filter(x => x.role === 'ORG_OWNER').length, 2);
    await store.platformProvisionMembership(ctx, 'org-a', 'owner@aman.eg', 'ADMIN', false, 'Demote first org owner');
    await assert.rejects(() => store.platformProvisionMembership(ctx, 'org-a', second.email, 'MEMBER', false, 'Remove last owner'), { code: 'LAST_ORG_OWNER' });
    await store.platformReplaceOrgOwner(ctx, 'org-a', ctx.actor.id, 'Restore original owner atomically');
    assert.equal(store.read().members.find(x => x.userId === ctx.actor.id)!.role, 'ORG_OWNER');
    await store.grantPlatformOwner(ctx, second.userId, 'Additional global operator');
    assert.equal(store.read().identities.find(x => x.id === second.userId)!.platformRole, 'PLATFORM_OWNER');
    const audit = store.read().events.find(x => x.action === 'PLATFORM_ROLE_GRANTED')!;
    assert.equal(audit.organizationId, null);
    assert.equal(audit.workspaceId, null);
}
finally {
    cleanup();
} });
test('platform owner with no org membership enters/recover org; sensitive operations still obey environment', async () => { const { store, ctx, cleanup } = await platformFixture(); try {
    const bank = await store.platformCreateOrganization(ctx, 'Bank', { domains: ['examplebank.com'], exactEmails: [] }), bankStore = new LocalAuthStore(store.path, bank.workspaceId), principal = bankStore.session(await bankStore.login('owner@aman.eg', pwd));
    assert.equal(principal.memberId, null);
    assert.equal(principal.role, null);
    assert.equal(principal.platformRole, 'PLATFORM_OWNER');
    await bankStore.platformConfigurePolicy(principal, bank.organizationId, { domains: ['examplebank.com'], exactEmails: [] });
    assert.throws(() => authorizeManagement(principal, false), { code: 'MANAGEMENT_DISABLED' });
    await store.renameWorkspace(ctx, 'Product workspace');
    assert.equal(store.read().workspace.name, 'Product workspace');
}
finally {
    cleanup();
} });
test('dedicated platform invitations retain resend/revoke and normal org actors cannot change them',async()=>{
 const {store,ctx,cleanup}=await platformFixture();try{
  const a=await store.invite(ctx,'admin@aman.eg','ADMIN');await store.accept(a,'Admin',pwd);const admin=contextForMember(store.read().members.find(x=>x.email==='admin@aman.eg'),'workspace-a');
  const grant=await store.platformProvisionMembership(ctx,'org-a','new@aman.eg','MEMBER',false,'Dedicated platform grant');const id=store.read().invitations.find(x=>x.tokenHash===hash(grant.invitationToken!))!.id;
  await assert.rejects(()=>store.rotate(admin,id,false),{code:'INVITE_INVALID'});
  await assert.rejects(()=>store.platformRotateInvitation(admin,id,false,'Unauthorized platform resend'),{code:'PLATFORM_OWNER_REQUIRED'});
  const next=await store.platformRotateInvitation(ctx,id,false,'Requested replacement link');assert.throws(()=>store.invitation(grant.invitationToken!),{code:'INVITE_INVALID'});assert.equal(store.invitation(next!).role,'MEMBER');
  await store.platformRotateInvitation(ctx,id,true,'Requested invitation cancellation');assert.throws(()=>store.invitation(next!),{code:'INVITE_INVALID'});
  await assert.rejects(()=>store.platformRotateInvitation(ctx,id,false,'Stale cancellation resend'),{code:'INVITE_INVALID'});
  const first=await store.platformProvisionMembership(ctx,'org-a','renew@aman.eg','MEMBER',false,'First platform invitation');const second=await store.platformProvisionMembership(ctx,'org-a','renew@aman.eg','VIEWER',false,'Replace pending platform invitation');assert.throws(()=>store.invitation(first.invitationToken!),{code:'INVITE_INVALID'});assert.equal(store.invitation(second.invitationToken!).role,'VIEWER');
  const snapshot=store.platformSnapshot(ctx);assert.equal(JSON.stringify(snapshot).includes(hash(second.invitationToken!)),false);assert.ok(snapshot.events.some(x=>x.action==='PLATFORM_INVITATION_RESENT'&&x.reason==='Requested replacement link'));
 }finally{cleanup();}
});

test('archived workspace or organization refuses existing and new sessions including platform recovery', async () => {
    for (const archived of ['workspace', 'organization'] as const) {
        const { store, ctx, cleanup } = await platformFixture();
        try {
            const invite = await store.invite(ctx, 'member@aman.eg', 'MEMBER');
            await store.accept(invite, 'Member', pwd);
            const memberToken = await store.login('member@aman.eg', pwd);
            const platformToken = await store.login('owner@aman.eg', pwd);
            const ownerInvite = await store.platformProvisionMembership(ctx, 'org-a', 'nextowner@aman.eg', 'ORG_OWNER', false, 'Pending synthetic owner invitation');
            await store.mutate(state => {
                if (archived === 'workspace') state.workspaces[0]!.status = 'ARCHIVED';
                else state.organizations[0]!.status = 'ARCHIVED';
            }, true);
            assert.throws(() => store.read(), { code: 'ACCESS_DENIED' });
            for (const token of [memberToken, platformToken]) assert.throws(() => store.session(token), { code: 'ACCESS_DENIED' });
            for (const email of ['member@aman.eg', 'owner@aman.eg']) await assert.rejects(() => store.login(email, pwd), { code: 'ACCESS_DENIED' });
            assert.throws(() => store.platformSnapshot(ctx), { code: 'ACCESS_DENIED' });
            await assert.rejects(() => store.renameWorkspace(ctx, 'Cannot rename archived workspace'), { code: 'ACCESS_DENIED' });
            assert.throws(() => store.invitation(ownerInvite.invitationToken!), { code: 'INVITE_INVALID' });
            await assert.rejects(() => store.accept(ownerInvite.invitationToken!, 'New owner', pwd), { code: 'INVITE_INVALID' });
            await store.logout(platformToken);
            assert.equal(store.read(true).sessions.some(session => session.tokenHash === hash(platformToken)), false);
        } finally { cleanup(); }
    }
});

test('archived organizations can retain history without active owners while active platform context remains usable', async () => {
    const { store, ctx, cleanup } = await platformFixture();
    try {
        const retired = await store.platformCreateOrganization(ctx, 'Retired generation', { domains: ['demo.example'], exactEmails: [] });
        const retiredStore = new LocalAuthStore(store.path, retired.workspaceId);
        const bootstrapToken = await retiredStore.login('owner@aman.eg', pwd);
        assert.equal(retiredStore.session(bootstrapToken).platformRole, 'PLATFORM_OWNER');
        await store.mutate(state => {
            state.organizations.find(org => org.id === retired.organizationId)!.status = 'ARCHIVED';
            state.workspaces.find(workspace => workspace.id === retired.workspaceId)!.status = 'ARCHIVED';
        }, true);
        assert.throws(() => retiredStore.session(bootstrapToken), { code: 'ACCESS_DENIED' });
        assert.equal(store.platformSnapshot(ctx).organizations.find(org => org.id === retired.organizationId)!.status, 'ARCHIVED');
        await store.renameWorkspace(ctx, 'Active product workspace');
        assert.equal(store.read().workspace.name, 'Active product workspace');
        await assert.rejects(() => store.mutate(state => { state.memberships.find(member => member.id === ctx.memberId)!.active = false; }), { code: 'LAST_ORG_OWNER' });
    } finally { cleanup(); }
});
