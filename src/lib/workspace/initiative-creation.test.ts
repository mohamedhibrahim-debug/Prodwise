import test from 'node:test';import assert from 'node:assert/strict';
import {prepareInitiativeCreation,type InitiativeCreation} from './initiative-creation.ts';
import type {WorkspaceAccess} from '../auth/core.ts';import type {DeliveryMember} from '../delivery/types.ts';
const ctx:WorkspaceAccess={workspaceId:'w',organizationId:'o',memberId:'m',role:'MEMBER',platformRole:null,isProductLead:false,actor:{id:'u',label:'Synthetic PM'}};
const members:DeliveryMember[]=[{id:'m',workspaceId:'w',role:'MEMBER',active:true,isProductLead:false,displayName:'Synthetic PM'},{id:'other',workspaceId:'w',role:'MEMBER',active:true,isProductLead:false,displayName:'Other PM'}];
const input:InitiativeCreation={requestId:'11111111-1111-4111-8111-111111111111',name:'Synthetic pilot',businessLine:'FS',stage:'DISCOVERY',ownerMemberId:'m',description:'',contextLabel:''};
test('creation establishes exactly one canonical initial owner without assuming setup readiness',()=>{
 const plan=prepareInitiativeCreation(input,ctx,members,[],'2026-09-27T10:00:00Z');assert.equal(plan.owner.value.memberId,'m');assert.equal(plan.owner.initiativeId,plan.initiative.id);assert.equal(plan.owner.revision,1);assert.equal(plan.context,null);assert.equal(plan.initiative.overallState,'UNKNOWN');assert.equal(plan.initiative.description,null);
});
test('creation preserves existing authority: member self assignment only, scoped non-viewer targets',()=>{
 assert.throws(()=>prepareInitiativeCreation({...input,ownerMemberId:'other'},ctx,members,[],'now'),/yourself/);
 assert.throws(()=>prepareInitiativeCreation(input,{...ctx,role:'VIEWER'},members,[],'now'),/Viewers/);
 assert.throws(()=>prepareInitiativeCreation(input,ctx,[{...members[0]!,workspaceId:'foreign'}],[],'now'),/active owner/);
 const admin=prepareInitiativeCreation({...input,ownerMemberId:'other'},{...ctx,role:'ADMIN'},members,[],'now');assert.equal(admin.owner.value.memberId,'other');
});
test('creation rejects duplicate names and invalid stages; controlled context is deliberately entered',()=>{
 const first=prepareInitiativeCreation({...input,contextLabel:'Pilot A'},ctx,members,[],'now');assert.equal(first.context?.label,'Pilot A');assert.equal(first.initiative.currentContextId,first.context?.id);
 assert.throws(()=>prepareInitiativeCreation({...input,name:' SYNTHETIC PILOT '},ctx,members,[first.initiative],'now'),/already/);
 assert.throws(()=>prepareInitiativeCreation({...input,stage:'DONE' as 'DISCOVERY'},ctx,members,[],'now'),/lifecycle/);
});
