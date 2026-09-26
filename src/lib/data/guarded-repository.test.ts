import { test } from 'node:test';
import assert from 'node:assert/strict';
import { guardedRepository } from './guarded-repository.ts';
import type { Repository } from './repository.ts';
import type { WorkspaceAccess } from '../auth/core.ts';
import { repositoryContext } from '../auth/repository-context.ts';
const ctx:WorkspaceAccess={workspaceId:'a',organizationId:'org-a',platformRole:null,memberId:'m',actor:{id:'real-user',label:'Real PM'},role:'MEMBER',isProductLead:false};
test('synchronous guarded repository is not assimilated as a Promise',async()=>{
  let accessChecks=0;
  const repo=guardedRepository(async()=>{accessChecks++;return ctx;},()=>({} as Repository),()=>true,()=>true);
  assert.equal(Reflect.get(repo,'then'),undefined);
  assert.equal(await Promise.resolve(repo),repo);
  assert.equal(accessChecks,0);
});
function fixture(access:()=>Promise<WorkspaceAccess>=async()=>ctx,enabled=true){
  const calls:{name:string,args:unknown[],ctx:unknown}[]=[];
  const raw={listInitiatives:async()=>[{id:'i1',workspaceId:'a'},{id:'i2',workspaceId:'a'},{id:'foreign',workspaceId:'b'}],
    getClaim:async(id:string)=>({id,workspaceId:id==='foreign'?'b':'a',initiativeId:id==='c2'?'i2':'i1'}),
    getEvidence:async(id:string)=>({id,workspaceId:id==='foreign'?'b':'a',initiativeId:id==='e2'?'i2':'i1'}),
    getInitiativeSnapshot:async()=>({initiative:{id:'foreign',workspaceId:'b'}}),
    listInitiativeSnapshots:async()=>[{initiative:{id:'i1',workspaceId:'a'}},{initiative:{id:'foreign',workspaceId:'b'}}]};
  for(const name of ['createInitiative','createEvidence','updateEvidence','createClaim','updateClaim','setClaimEvidence','verifyClaim','setEvidenceAnchor','resolveConflict','assignFindingConfirmer','setFindingState','reopenFindingState'])Object.assign(raw,{[name]:async(...args:unknown[])=>{calls.push({name,args,ctx:repositoryContext()});return null;}});
  return {calls,repo:guardedRepository(access,()=>raw as unknown as Repository,()=>enabled,()=>true)};
}
test('every mutation denies Viewer before environment; unauthorized reads never reach raw store',async()=>{
  let resolves=0;const {repo,calls}=fixture(async()=>{resolves++;return {...ctx,role:'VIEWER'};},false);
  for(const name of ['createInitiative','createEvidence','updateEvidence','createClaim','updateClaim','setClaimEvidence','verifyClaim','setEvidenceAnchor','resolveConflict','assignFindingConfirmer','setFindingState','reopenFindingState']){
    await assert.rejects(()=>Reflect.get(repo,name)({initiativeId:'i1'}),{code:'VIEW_ONLY'});
  }
  assert.equal(resolves,12);assert.equal(calls.length,0);
  const denied=fixture(async()=>{throw Object.assign(new Error('Access denied'),{code:'UNAUTHENTICATED'});});
  await assert.rejects(()=>denied.repo.listInitiatives(),{code:'UNAUTHENTICATED'});
});
test('guard checks foreign IDs before writes and preserves same-initiative constraints',async()=>{
  const {repo,calls}=fixture();
  await assert.rejects(()=>repo.updateClaim('foreign',{}),{code:'ACCESS_DENIED'});
  await assert.rejects(()=>repo.updateClaim('c1',{supersededByClaimId:'c2'}),{code:'ACCESS_DENIED'});
  await assert.rejects(()=>repo.setClaimEvidence('c1',['e2']),{code:'ACCESS_DENIED'});
  await assert.rejects(()=>repo.setEvidenceAnchor('c1','e2',{locator:'x',excerpt:'x',actor:ctx.actor}),{code:'ACCESS_DENIED'});
  await assert.rejects(()=>repo.createClaim({initiativeId:'foreign'} as never),{code:'ACCESS_DENIED'});
  assert.equal(calls.length,0);
});
test('raw reads cannot expose another workspace and actual signed actor overrides caller input',async()=>{
  const {repo,calls}=fixture();
  assert.equal((await repo.listInitiatives()).length,2);
  assert.equal((await repo.listInitiativeSnapshots()).length,1);
  assert.equal(await repo.getClaim('foreign'),null);assert.equal(await repo.getEvidence('foreign'),null);
  assert.equal(await repo.getInitiativeSnapshot('foreign'),null);
  await repo.verifyClaim('c1',{actor:{id:'spoofed',label:'Spoof'},basis:'DIRECT_KNOWLEDGE',note:'test',expectedUpdatedAt:'now'} as never);
  assert.deepEqual((calls[0]!.args[1] as {actor:unknown}).actor,ctx.actor);
  assert.deepEqual(calls[0]!.ctx,ctx);
  assert.equal(repositoryContext(),undefined);
});
test('membership is resolved anew after a previously rendered write form',async()=>{
  let active=ctx;const {repo,calls}=fixture(async()=>active);
  await repo.createInitiative({name:'Allowed'} as never);active={...ctx,role:'VIEWER'};
  await assert.rejects(()=>repo.createInitiative({name:'Denied'} as never),{code:'VIEW_ONLY'});
  assert.equal(calls.length,1);
  await assert.rejects(()=>fixture(undefined,false).repo.createInitiative({name:'Disabled'} as never),{code:'WRITE_DISABLED'});
});
