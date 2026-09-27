import test from 'node:test';
import assert from 'node:assert/strict';
import {changeContext} from './context-management.ts';
import type {WorkspaceAccess} from '../auth/core.ts';
import type {Initiative} from '../domain/types.ts';
const ctx:WorkspaceAccess={workspaceId:'w',organizationId:'o',memberId:'m',actor:{id:'u',label:'Synthetic PM'},role:'MEMBER',platformRole:null,isProductLead:false};
const initiative={id:'i',workspaceId:'w',updatedAt:'first',currentContextId:null} as Initiative;
const input={initiativeId:'i',expectedUpdatedAt:'first',operation:'CREATE' as const,label:'Pilot',reason:'Limit current work to pilot merchants'};
test('context creation selects human label; retirement preserves it and makes current context missing',()=>{
 const first=changeContext(initiative,[],ctx,'m',input,'second');assert.equal(first.initiative.currentContextId,first.after.id);
 const retired=changeContext(first.initiative,first.contexts,ctx,'m',{...input,operation:'RETIRE',contextId:first.after.id,expectedRevision:1,expectedUpdatedAt:'second'},'third');
 assert.equal(retired.contexts.length,1);assert.equal(retired.after.label,'Pilot');assert.equal(retired.after.retiredAt,'third');assert.equal(retired.initiative.currentContextId,null);assert.equal(first.after.retiredAt,null);
});
test('context changes reject stale revisions, cross initiative IDs, Viewer writes and implicit Product Lead authority',()=>{
 const first=changeContext(initiative,[],ctx,'m',input,'second');
 assert.throws(()=>changeContext(first.initiative,first.contexts,ctx,'m',input,'third'),/changed/);
 assert.throws(()=>changeContext(initiative,[],{...ctx,role:'VIEWER'},'m',input,'second'),/role/);
 assert.throws(()=>changeContext(initiative,[],{...ctx,isProductLead:true},'other',input,'second'),/role/);
 assert.throws(()=>changeContext(first.initiative,first.contexts,ctx,'m',{...input,operation:'SELECT',contextId:first.after.id,expectedUpdatedAt:'second',expectedRevision:0},'third'),/changed/);
 assert.throws(()=>changeContext({...initiative,id:'other'},first.contexts,ctx,'m',{...input,initiativeId:'other',operation:'SELECT',contextId:first.after.id,expectedRevision:1},'third'),/unavailable/);
});
test('contexts reject duplicate active labels and never infer legacy phase strings',()=>{
 const first=changeContext(initiative,[],ctx,'m',input,'second');
 assert.throws(()=>changeContext(first.initiative,first.contexts,ctx,'m',{...input,label:' pilot ',expectedUpdatedAt:'second'},'third'),/already/);
 assert.equal(first.contexts.length,1);
});
