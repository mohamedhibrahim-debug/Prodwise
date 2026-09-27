import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import {reviseRelationship,dependencyImpact,relationshipCandidates,type InitiativeRelationship,type RelationshipCommand} from './relationships.ts';
import type {WorkspaceAccess,DeliveryFact} from '../delivery/types.ts';import type {Initiative} from '../domain/types.ts';
const ws='11111111-1111-4111-8111-111111111111';
const init=(id:string,name:string,extra:Partial<Initiative>={})=>({id,workspaceId:ws,name,slug:name.toLowerCase(),archivedAt:null,...extra}) as unknown as Initiative;
const A=init('a0000000-0000-4000-8000-000000000001','Merchant Insights'),B=init('b0000000-0000-4000-8000-000000000002','Instant Settlement Payout'),C=init('c0000000-0000-4000-8000-000000000003','Collections'),X=init('d0000000-0000-4000-8000-000000000004','Old',{archivedAt:'2026-01-01'} as Partial<Initiative>);
const owner:WorkspaceAccess={workspaceId:ws,organizationId:'o',memberId:'m-owner',actor:{id:'u-owner',label:'Owner'},role:'MEMBER',platformRole:null,isProductLead:false} as WorkspaceAccess;
const other:WorkspaceAccess={...owner,memberId:'m-other',actor:{id:'u-other',label:'Other'}};
const ownerOf=(id:string)=>id===A.id?'m-owner':null;const all=[A,B,C,X];
const create=(o:Partial<RelationshipCommand>={}):RelationshipCommand=>({operation:'CREATE',requestId:randomUUID(),expectedRevision:0,fromInitiativeId:A.id,toInitiativeId:B.id,type:'DEPENDS_ON',rationale:'Needs same-day settlement files',providerFactKind:'TARGET_LIVE',neededByFactKind:'NEXT_MILESTONE',...o});
const fact=(initiativeId:string,kind:DeliveryFact['kind'],date:string|null,extra:Partial<DeliveryFact['value']>={}):DeliveryFact=>({id:randomUUID(),workspaceId:ws,initiativeId,kind,revision:1,state:'SET',value:{date,text:null,memberId:null,extent:null,...extra},basis:'DIRECT_KNOWLEDGE',note:'',evidenceId:null,locator:null,supportDigest:null,confirmedByMemberId:null,confirmedByLabel:'x',updatedAt:'t'});
test('relationships: owner creates; non-owner member, self, archived target, duplicate and cycles are refused',()=>{
 const r=reviseRelationship([],[],create(),owner,all,ownerOf,'2026-10-01T10:00:00Z');assert.equal(r.relationship.confirmedBy,'u-owner');assert.equal(r.event!.type,'CONFIRMED');
 assert.throws(()=>reviseRelationship([],[],create(),other,all,ownerOf,'t'),/Only the owner/);
 assert.throws(()=>reviseRelationship([],[],create({toInitiativeId:A.id}),owner,all,ownerOf,'t'),/itself/);
 assert.throws(()=>reviseRelationship([],[],create({toInitiativeId:X.id}),owner,all,ownerOf,'t'),/archived/);
 assert.throws(()=>reviseRelationship([r.relationship],[r.event!],create(),owner,all,ownerOf,'t'),/Already recorded by Owner/);
 const bc=reviseRelationship([r.relationship],[],create({fromInitiativeId:B.id,toInitiativeId:C.id,providerFactKind:null,neededByFactKind:null}),{...owner,role:'ADMIN'},all,ownerOf,'t').relationship;
 assert.throws(()=>reviseRelationship([r.relationship,bc],[],create({fromInitiativeId:C.id,toInitiativeId:A.id,providerFactKind:null,neededByFactKind:null}),{...owner,role:'ADMIN'},all,ownerOf,'t'),/circular/);
 assert.throws(()=>reviseRelationship([],[],create({providerFactKind:'TARGET_LIVE',neededByFactKind:null}),owner,all,ownerOf,'t'),/both dates/);
 assert.throws(()=>reviseRelationship([],[],create({type:'RELATED_TO'}),owner,all,ownerOf,'t'),/only apply to a dependency/);});
test('relationships: RELATED_TO is normalized; PART_OF allows one parent; end needs a reason and a current revision',()=>{
 const rel=reviseRelationship([],[],create({fromInitiativeId:B.id,toInitiativeId:A.id,type:'RELATED_TO',providerFactKind:null,neededByFactKind:null}),{...owner,role:'ADMIN'},all,ownerOf,'t').relationship;assert.equal(rel.fromInitiativeId,A.id);
 const parent=reviseRelationship([],[],create({type:'PART_OF',providerFactKind:null,neededByFactKind:null}),owner,all,ownerOf,'t').relationship;
 assert.throws(()=>reviseRelationship([parent],[],create({type:'PART_OF',toInitiativeId:C.id,providerFactKind:null,neededByFactKind:null}),owner,all,ownerOf,'t'),/already part of/);
 assert.throws(()=>reviseRelationship([parent],[],{operation:'END',id:parent.id,requestId:randomUUID(),expectedRevision:1,reason:''},owner,all,ownerOf,'t'),/Say why/);
 assert.throws(()=>reviseRelationship([parent],[],{operation:'END',id:parent.id,requestId:randomUUID(),expectedRevision:0,reason:'x'},owner,all,ownerOf,'t'),/changed/);
 const ended=reviseRelationship([parent],[],{operation:'END',id:parent.id,requestId:randomUUID(),expectedRevision:1,reason:'Split out'},owner,all,ownerOf,'t2').relationship;assert.equal(ended.status,'ENDED');assert.equal(ended.endReason,'Split out');assert.equal(ended.revision,2);});
test('dependency impact: shown only when both recorded dates are known and the provider is later',()=>{
 const r={type:'DEPENDS_ON' as const,status:'ACTIVE' as const,fromInitiativeId:A.id,toInitiativeId:B.id,providerFactKind:'TARGET_LIVE' as const,neededByFactKind:'NEXT_MILESTONE' as const};const names={from:A.name,to:B.name};
 const late=dependencyImpact(r,[fact(B.id,'TARGET_LIVE','2026-10-29'),fact(A.id,'NEXT_MILESTONE','2026-10-22',{text:'Pilot'})],names);assert.deepEqual(late,{assessed:true,late:true,days:7,providerDate:'2026-10-29',neededDate:'2026-10-22'});
 assert.equal((dependencyImpact(r,[fact(B.id,'TARGET_LIVE','2026-10-20'),fact(A.id,'NEXT_MILESTONE','2026-10-22')],names) as {late:boolean}).late,false);
 assert.deepEqual(dependencyImpact(r,[fact(B.id,'TARGET_LIVE',null,{unknown:true}),fact(A.id,'NEXT_MILESTONE','2026-10-22')],names),{assessed:false,reason:'Instant Settlement Payout Target Live is Unknown'});
 // A provider date already past with no Actual Live is not reassurance: impact is not assessed, with the reason.
 const stale=dependencyImpact(r,[fact(B.id,'TARGET_LIVE','2026-09-24'),fact(A.id,'NEXT_MILESTONE','2026-10-22')],names,'2026-09-26') as {assessed:boolean;reason:string};assert.equal(stale.assessed,false);assert.match(stale.reason,/passed without a recorded Actual Live/);
 assert.equal((dependencyImpact(r,[fact(B.id,'TARGET_LIVE','2026-09-24'),fact(A.id,'NEXT_MILESTONE','2026-10-22')],names,'2026-09-20') as {late:boolean}).late,false);
 assert.deepEqual(dependencyImpact(r,[fact(A.id,'NEXT_MILESTONE','2026-10-22')],names),{assessed:false,reason:'Instant Settlement Payout Target Live is not recorded'});
 assert.deepEqual(dependencyImpact({...r,providerFactKind:null,neededByFactKind:null},[],names),{assessed:false,reason:'which dates matter was not recorded'});
 assert.equal((dependencyImpact(r,[fact(B.id,'TARGET_LIVE','2026-10-29'),fact(B.id,'ACTUAL_LIVE','2026-10-01',{extent:'FULL'}),fact(A.id,'NEXT_MILESTONE','2026-10-22')],names) as {delivered?:boolean}).delivered,true);
 assert.equal(dependencyImpact({...r,type:'RELATED_TO'},[],names),null);assert.equal(dependencyImpact({...r,status:'ENDED'},[],names),null);});
test('relationship proposals: only exact names of other active initiatives, once per target, value copied from the quote',()=>{
 const accepted=[{type:'DEPENDENCY',anchor:{start:0,end:40,quote:'We depend on instant settlement payout files'}},{type:'RISK',anchor:{start:0,end:10,quote:'Instant Settlement Payout may slip; Merchant Insights waits'}}];
 const out=relationshipCandidates(accepted,[A,B,C],A.id);assert.deepEqual(out.map(o=>o.payload.targetInitiativeId),[B.id]);assert.equal(out[0]!.payload.value,'instant settlement payout');assert.ok(accepted[0]!.anchor.quote.includes(out[0]!.payload.value));});
