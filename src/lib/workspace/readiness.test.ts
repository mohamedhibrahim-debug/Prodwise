import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalDemoData} from '../demo/canonical.ts';
import {readinessTransition} from './readiness-history.ts';
import {deriveReadiness,type InitiativeContext} from './readiness.ts';
const identity={workspaceId:'11111111-1111-4111-8111-111111111111',organizationId:'22222222-2222-4222-8222-222222222222',reviewerMemberId:'33333333-3333-4333-8333-333333333333',reviewerUserId:'44444444-4444-4444-8444-444444444444'};
function fixture(){const d=canonicalDemoData(identity);const s=d.source.snapshots[0]!; const context:InitiativeContext={id:'context',workspaceId:identity.workspaceId,initiativeId:s.initiative.id,label:'Pilot',note:null,revision:1,createdAt:'now',updatedAt:'now',retiredAt:null};return {initiative:s.initiative,facts:d.deliveryState.facts,members:d.source.members,claims:s.claims,currentContext:context,activeSourceLinks:1};}
test('ten readiness requirements distinguish missing from explicit Unknown without mutating facts',()=>{
  const f=fixture();const id=f.initiative.id;const target=f.facts.find(x=>x.initiativeId===id&&x.kind==='TARGET_LIVE')!;
  f.facts=f.facts.filter(x=>!(x.initiativeId===id&&['TARGET_LIVE','NEXT_MILESTONE'].includes(x.kind)));
  let r=deriveReadiness(f);assert.equal(r.total,10);assert.equal(r.requirements.find(x=>x.key==='target')!.met,false);
  f.facts.push({...target,value:{date:null,text:null,memberId:null,extent:null,unknown:true}});
  r=deriveReadiness(f);assert.equal(r.requirements.find(x=>x.key==='target')!.met,true);assert.equal(r.requirements.find(x=>x.key==='milestone')!.met,false);
  f.facts.push({...target,id:'milestone',kind:'NEXT_MILESTONE',value:{date:null,text:'Review',memberId:null,extent:null,dateUnknown:true}});
  assert.equal(deriveReadiness(f).requirements.find(x=>x.key==='milestone')!.met,true);
});
test('retired or foreign contexts and inactive owners do not satisfy readiness',()=>{
  const f=fixture();f.currentContext.workspaceId='foreign';f.members=f.members.map(m=>({...m,active:false}));
  const r=deriveReadiness({...f,previouslyReady:true});assert.equal(r.requirements.find(x=>x.key==='context')!.met,false);assert.equal(r.requirements.find(x=>x.key==='owner')!.met,false);assert.equal(r.wasReady,true);assert.equal(r.next?.key,'owner');
});
test('archive preserves evaluated requirements but offers no setup nudge',()=>{
  const f=fixture();const active=deriveReadiness(f);const archived=deriveReadiness({...f,initiative:{...f.initiative,archivedAt:'now'}});
  assert.equal(archived.label,'Archived');assert.equal(archived.next,null);assert.deepEqual(archived.requirements,active.requirements);
});

test('setup does not treat unverified active legacy entries as confirmed truth',()=>{
 const f=fixture();f.claims=f.claims.map(c=>({...c,status:'ACTIVE' as const,verifiedAt:null}));
 assert.equal(deriveReadiness(f).requirements.find(x=>x.key==='confirmed')!.met,false);
});
test('readiness history records transitions once and keeps losses explicit',()=>{
 const f=fixture();f.initiative.currentContextId=f.currentContext.id;f.initiative.description='A deliberate objective';
 const id=f.initiative.id,target=f.facts.find(x=>x.initiativeId===id&&x.kind==='TARGET_LIVE')!;
 f.facts=f.facts.filter(x=>!(x.initiativeId===id&&['TARGET_LIVE','NEXT_MILESTONE'].includes(x.kind)));
 f.facts.push({...target,value:{date:null,text:null,memberId:null,extent:null,unknown:true}},{...target,id:'milestone',kind:'NEXT_MILESTONE',value:{date:null,text:null,memberId:null,extent:null,unknown:true}});
 const args={...f,claims:[{status:'ACTIVE' as const,verifiedAt:'2026-09-27T10:00:00Z'}],contexts:[f.currentContext],activity:[],at:'2026-09-27T10:00:00Z',actor:{id:'human',label:'Synthetic PM'}};
 const reached=readinessTransition(args);assert.equal(reached?.eventType,'READINESS_REACHED');
 assert.equal(readinessTransition({...args,activity:[reached!]}),null);
 const lost=readinessTransition({...args,activity:[reached!],activeSourceLinks:0,at:'2026-09-27T11:00:00Z'});assert.equal(lost?.eventType,'READINESS_LOST');
 assert.equal(readinessTransition({...args,activity:[reached!,lost!],activeSourceLinks:0}),null);
 assert.equal(readinessTransition({...args,activity:[reached!,lost!],at:'2026-09-27T12:00:00Z'})?.eventType,'READINESS_REACHED');
});
