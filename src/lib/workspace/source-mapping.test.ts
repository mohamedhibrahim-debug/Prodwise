import test from 'node:test';
import assert from 'node:assert/strict';
import {EMPTY_LIBRARY,mapSourceItems,reviseSourceMapping,type SourceMapInput} from './source-mapping.ts';
import type {WorkspaceAccess} from '../auth/core.ts';
const ctx:WorkspaceAccess={workspaceId:'w',organizationId:'org',memberId:'m',actor:{id:'u',label:'PM'},role:'MEMBER',platformRole:null,isProductLead:false};
const input:SourceMapInput={initiativeId:'i1',provider:'JIRA',providerWorkspace:'Synthetic delivery workspace',containerReference:'PAY',containerName:'Payments',role:'DELIVERY',items:[{reference:'PAY-102',name:'Settlement',kind:'Epic',url:null},{reference:'PAY-118',name:'Validation',kind:'Story',url:null}]};
test('many-to-many source mappings reuse the same canonical items without overwriting names or roles',()=>{
  const one=mapSourceItems(EMPTY_LIBRARY,ctx,input,'now');
  const two=mapSourceItems(one,ctx,{...input,initiativeId:'i2',role:'GENERAL'},'later');
  assert.equal(two.containers.length,1);assert.equal(two.items.length,2);assert.equal(two.mappings.length,4);assert.equal(two.mappings[0]!.role,'DELIVERY');
  assert.deepEqual(mapSourceItems(one,ctx,input,'retry'),one);
});
test('identical keys in different provider workspaces or organization workspaces never alias',()=>{
  const one=mapSourceItems(EMPTY_LIBRARY,ctx,input,'now');
  const two=mapSourceItems(one,ctx,{...input,providerWorkspace:'Other Jira workspace'},'later');assert.equal(two.items.length,4);
  const three=mapSourceItems(two,{...ctx,workspaceId:'foreign',organizationId:'other'},input,'later');assert.equal(three.items.length,6);
});
test('source syntax validation does not imply external lookup and rejects embedded credentials',()=>{
  assert.throws(()=>mapSourceItems(EMPTY_LIBRARY,ctx,{...input,items:[{...input.items[0]!,reference:'PAY-9X'}]},'now'),/key format/);
  assert.throws(()=>mapSourceItems(EMPTY_LIBRARY,ctx,{...input,items:[{...input.items[0]!,url:'https://user:password@example.test'}]},'now'),/credentials/);
  assert.throws(()=>mapSourceItems(EMPTY_LIBRARY,{...ctx,role:'VIEWER'},input,'now'),/role/);
});
test('unlink retains source and history; stale edits and implicit relink are refused',()=>{
  const one=mapSourceItems(EMPTY_LIBRARY,ctx,input,'now');const mapping=one.mappings[0]!;
  const unlink={mappingId:mapping.id,initiativeId:'i1',expectedRevision:1,action:'UNLINK' as const,reason:'No longer in scope'};
  const two=reviseSourceMapping(one,ctx,unlink,null,'later');assert.equal(two.items.length,2);assert.equal(two.mappings[0]!.unlinkedAt,'later');assert.equal(two.events.length,3);assert.equal(one.mappings[0]!.unlinkedAt,null);
  assert.throws(()=>reviseSourceMapping(two,ctx,unlink,null,'retry'),/changed/);
  assert.throws(()=>mapSourceItems(two,ctx,input,'retry'),/explicitly relink/);
  assert.throws(()=>reviseSourceMapping(one,{...ctx,actor:{id:'other',label:'Other'}},unlink,'another','later'),/role/);
  assert.throws(()=>reviseSourceMapping(one,{...ctx,workspaceId:'foreign'},unlink,null,'later'),/unavailable/);
});

test('source revisions enforce explicit relink, preserve history and reject stale or invalid changes',()=>{
 const one=mapSourceItems(EMPTY_LIBRARY,ctx,input,'first'),mapping=one.mappings[0]!;
 const change={mappingId:mapping.id,initiativeId:'i1',expectedRevision:1,action:'ROLE' as const,role:'REQUIREMENTS' as const,reason:'Used as requirements reference'};
 const two=reviseSourceMapping(one,ctx,change,null,'second');
 assert.equal(two.mappings[0]!.revision,2);assert.equal(two.events.at(-1)!.before!.role,'DELIVERY');
 assert.throws(()=>reviseSourceMapping(two,ctx,change,null,'stale'),/changed/);
 assert.throws(()=>reviseSourceMapping(two,ctx,{...change,expectedRevision:2,action:'BOGUS' as 'ROLE'},null,'invalid'),/supported/);
 const three=reviseSourceMapping(two,ctx,{...change,expectedRevision:2,action:'UNLINK'},null,'third');
 const four=reviseSourceMapping(three,ctx,{...change,expectedRevision:3,action:'RELINK'},null,'fourth');
 assert.equal(four.mappings[0]!.revision,4);assert.equal(four.mappings[0]!.unlinkedAt,null);
 assert.equal(four.events.at(-1)!.before!.unlinkedAt,'third');
 assert.throws(()=>reviseSourceMapping(four,{...ctx,role:'VIEWER'},{...change,expectedRevision:4},null,'fifth'),/role/);
});
