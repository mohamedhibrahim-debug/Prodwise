import test from 'node:test';
import assert from 'node:assert/strict';
import { assertManagementWrite, canManageInitiative, validateInitialOwner, type InitiativeWrite } from './management-policy.ts';
import type { WorkspaceAccess } from '../auth/core.ts';
const member:WorkspaceAccess={workspaceId:'w',organizationId:'o',memberId:'m',actor:{id:'u',label:'PM'},platformRole:null,role:'MEMBER',isProductLead:false};
const row={workspaceId:'w',updatedAt:'v1'};
const operations:InitiativeWrite[]=['CREATE','BASICS','CONTEXT','OWNER','DELIVERY','SOURCE_LINK','SOURCE_UNLINK','ARCHIVE','RESTORE'];
test('Viewer cannot perform any initiative-management write even with Product Lead flag',()=>{
  for(const op of operations) assert.equal(canManageInitiative({...member,role:'VIEWER',isProductLead:true},op,'m','u'),false,op);
});
test('organization and platform administrators retain every management capability',()=>{
  for(const ctx of [{...member,role:'ADMIN' as const},{...member,role:'ORG_OWNER' as const},{...member,role:null,memberId:null,platformRole:'PLATFORM_OWNER' as const}])
    for(const op of operations) assert.equal(canManageInitiative(ctx,op,null),true,op);
});
test('assigned PM metadata authority does not permit ownership hand-off or archive',()=>{
  for(const op of ['BASICS','CONTEXT','DELIVERY'] as const) {assert.equal(canManageInitiative(member,op,'m'),true);assert.equal(canManageInitiative(member,op,'other'),false);}
  assert.equal(canManageInitiative(member,'OWNER','m'),false);
  assert.equal(canManageInitiative(member,'ARCHIVE','m'),false);
  const lead={...member,isProductLead:true};
  assert.equal(canManageInitiative(lead,'OWNER',null),true);
  assert.equal(canManageInitiative(lead,'DELIVERY','other'),false);
  assert.equal(canManageInitiative(lead,'ARCHIVE',null),false);
});
test('source unlink authorizes only administrator, current owner or original linker',()=>{
  assert.equal(canManageInitiative(member,'SOURCE_UNLINK','other','u'),true);
  assert.equal(canManageInitiative(member,'SOURCE_UNLINK','other','someone'),false);
});
test('scope, archive and stale state are rejected before a canonical edit',()=>{
  assert.throws(()=>assertManagementWrite(member,'BASICS',{...row,workspaceId:'foreign'},'m','v1'),/unavailable/);
  assert.throws(()=>assertManagementWrite(member,'BASICS',{...row,archivedAt:'now'},'m','v1'),/Archived/);
  assert.throws(()=>assertManagementWrite(member,'BASICS',row,'m','v0'),/changed while/);
  assert.doesNotThrow(()=>assertManagementWrite({...member,role:'ADMIN'},'RESTORE',{...row,archivedAt:'now'},'m','v1'));
});
test('initial owner exception is self-only; inactive, Viewer and cross-scope members are invalid',()=>{
  const m={id:'m',workspaceId:'w',displayName:'PM',role:'MEMBER' as const,active:true,isProductLead:false};
  assert.doesNotThrow(()=>validateInitialOwner(member,'m',[m]));
  assert.throws(()=>validateInitialOwner(member,'other',[{...m,id:'other'}]),/assign yourself/);
  for(const invalid of [{...m,active:false},{...m,role:'VIEWER' as const},{...m,workspaceId:'foreign'}]) assert.throws(()=>validateInitialOwner(member,'m',[invalid]),/active owner/);
  assert.doesNotThrow(()=>validateInitialOwner({...member,isProductLead:true},'other',[{...m,id:'other'}]));
  assert.throws(()=>validateInitialOwner({...member,role:null,platformRole:'PLATFORM_OWNER',memberId:null},'u',[m]),/active owner/);
});
