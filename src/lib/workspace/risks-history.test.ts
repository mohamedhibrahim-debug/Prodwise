import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import {reviseRisk,riskViews,type RiskClaim} from './risks.ts';
import {buildInitiativeHistory,pageHistory,weekOf,type HistorySources} from './history.ts';
import type {WorkspaceAccess,DeliveryMember} from '../delivery/types.ts';import type {Initiative} from '../domain/types.ts';
const ws='11111111-1111-4111-8111-111111111111';const I={id:'i1',workspaceId:ws,name:'Flex',slug:'flex',archivedAt:null} as unknown as Initiative;
const owner:WorkspaceAccess={workspaceId:ws,organizationId:'o',memberId:'m-owner',actor:{id:'u-owner',label:'Owner'},role:'MEMBER',platformRole:null,isProductLead:false} as WorkspaceAccess;
const riskOwner:WorkspaceAccess={...owner,memberId:'m-risk',actor:{id:'u-risk',label:'Risk owner'}};
const members:DeliveryMember[]=[{id:'m-owner',workspaceId:ws,displayName:'Owner',role:'MEMBER',active:true,isProductLead:false},{id:'m-risk',workspaceId:ws,displayName:'Risk owner',role:'MEMBER',active:true,isProductLead:false}];
const claim=(o:Partial<RiskClaim>={}):RiskClaim=>({id:'c1',initiativeId:'i1',type:'RISK',status:'ACTIVE',subject:'Settlement files',value:'may arrive late',supersededByClaimId:null,...o});
test('risks: only an ACTIVE risk claim can be tracked, by the initiative owner; one tracking per claim',()=>{
 assert.throws(()=>reviseRisk([],[],{operation:'START',claimId:'c1',requestId:randomUUID(),expectedRevision:0},owner,I,'m-owner',members,[claim({status:'UNVERIFIED'})],[],'t'),/awaiting verification/);
 assert.throws(()=>reviseRisk([],[],{operation:'START',claimId:'c1',requestId:randomUUID(),expectedRevision:0},riskOwner,I,'m-owner',members,[claim()],[],'t'),/Only the initiative owner/);
 const a=reviseRisk([],[],{operation:'START',claimId:'c1',requestId:randomUUID(),expectedRevision:0,ownerMemberId:'m-risk'},owner,I,'m-owner',members,[claim()],[],'t');assert.equal(a.tracking.status,'OPEN');assert.equal(a.event!.statement,'Settlement files: may arrive late');
 assert.equal(reviseRisk([a.tracking],[a.event!],{operation:'START',claimId:'c1',requestId:randomUUID(),expectedRevision:0},owner,I,'m-owner',members,[claim()],[],'t').event,null);});
test('risks: risk owner changes status; accept/close need a reason; stale revision refused; owner cannot edit mitigation',()=>{
 const a=reviseRisk([],[],{operation:'START',claimId:'c1',requestId:randomUUID(),expectedRevision:0,ownerMemberId:'m-risk'},owner,I,'m-owner',members,[claim()],[],'t').tracking;
 const m=reviseRisk([a],[],{operation:'STATUS',id:a.id,requestId:randomUUID(),expectedRevision:1,status:'MITIGATING'},riskOwner,I,'m-owner',members,[claim()],[],'t2').tracking;assert.equal(m.status,'MITIGATING');
 assert.throws(()=>reviseRisk([m],[],{operation:'STATUS',id:a.id,requestId:randomUUID(),expectedRevision:2,status:'CLOSED'},riskOwner,I,'m-owner',members,[claim()],[],'t'),/Say why/);
 assert.throws(()=>reviseRisk([m],[],{operation:'STATUS',id:a.id,requestId:randomUUID(),expectedRevision:1,status:'OPEN'},owner,I,'m-owner',members,[claim()],[],'t'),/changed by someone else/);
 assert.throws(()=>reviseRisk([m],[],{operation:'UPDATE',id:a.id,requestId:randomUUID(),expectedRevision:2,mitigationText:'x'},riskOwner,I,'m-owner',members,[claim()],[],'t'),/Only the initiative owner/);
 assert.equal(reviseRisk([m],[],{operation:'STATUS',id:a.id,requestId:randomUUID(),expectedRevision:2,status:'CLOSED',reason:'Fixed upstream'},riskOwner,I,'m-owner',members,[claim()],[],'t3').tracking.resolvedAt,'t3');});
test('risks: supersession never moves tracking; carry forward only to the replacement; views derive untracked/awaiting states',()=>{
 const a=reviseRisk([],[],{operation:'START',claimId:'c1',requestId:randomUUID(),expectedRevision:0},owner,I,'m-owner',members,[claim()],[],'t').tracking;
 const claims=[claim({status:'SUPERSEDED',supersededByClaimId:'c2'}),claim({id:'c2'}),claim({id:'c3',status:'UNVERIFIED'}),claim({id:'c4'})];
 assert.deepEqual(riskViews(claims,[a],'i1').map(v=>`${v.claim.id}:${v.state}`),['c1:SUPERSEDED','c2:NOT_TRACKED','c3:AWAITING_VERIFICATION','c4:NOT_TRACKED']);
 assert.throws(()=>reviseRisk([a],[],{operation:'CARRY',id:a.id,claimId:'c4',requestId:randomUUID(),expectedRevision:0},owner,I,'m-owner',members,claims,[],'t'),/replaced this risk/);
 const carried=reviseRisk([a],[],{operation:'CARRY',id:a.id,claimId:'c2',requestId:randomUUID(),expectedRevision:0},owner,I,'m-owner',members,claims,[],'t').tracking;assert.equal(carried.carriedFromTrackingId,a.id);
 assert.deepEqual(riskViews(claims,[a,carried],'i1').map(v=>v.claim.id),['c2','c3','c4']);});
const src=(o:Partial<HistorySources>={}):HistorySources=>({initiativeId:'i1',slug:'flex',names:{i1:'Flex',i2:'Payout'},members,activity:[],deliveryEvents:[],commitmentEvents:[],questionEvents:[],relationshipEvents:[],riskEvents:[],reviews:[],evidence:[{evidenceId:'e1',submissionId:'s1',title:'Steering sync',date:'2026-09-25'}],...o});
test('history: meaningful events only — rejections, cosmetic corrections, duplicates covered by typed events and other initiatives are excluded',()=>{
 const act=(eventType:string,extra:object={})=>({id:randomUUID(),workspaceId:ws,initiativeId:'i1',eventType,summary:eventType,occurredAt:'2026-09-20T10:00:00Z',actorLabel:'Owner',entityType:null,entityId:null,payload:null,...extra});
 const h=buildInitiativeHistory(src({activity:[act('INITIATIVE_CREATED'),act('AI_PROPOSAL_REJECTED'),act('MEETING_NOTES_CORRECTED'),act('COMMITMENT_CREATED'),act('RELATIONSHIP_CONFIRMED'),act('MEETING_NOTES_SAVED',{payload:{submissionId:'s1'}}),act('STAGE_CHANGED',{initiativeId:'other'}),act('AI_PROPOSAL_CONFIRMED',{payload:{receipt:{type:'ACTION'}}}),act('AI_PROPOSAL_CONFIRMED',{payload:{receipt:{type:'KNOWLEDGE'},submissionId:'s1'}})]}));
 assert.deepEqual(h.map(e=>e.label).sort(),['Created','Knowledge added from evidence','Meeting notes added']);
 assert.equal(h.find(e=>e.label==='Knowledge added from evidence')!.provenance!.label,'from Steering sync, 25 Sept 2026');});
test('history: delivery facts read as movement with rationale and evidence provenance; weekly Finals link to the stored Final',()=>{
 const f=(date:string,rev:number)=>({id:randomUUID(),workspaceId:ws,initiativeId:'i1',kind:'TARGET_LIVE' as const,revision:rev,state:'SET' as const,value:{date,text:null,memberId:null,extent:null},basis:'EVIDENCE' as const,note:'From Steering sync',evidenceId:'e1',locator:null,supportDigest:null,confirmedByMemberId:null,confirmedByLabel:'Owner',updatedAt:'t'});
 const h=buildInitiativeHistory(src({deliveryEvents:[{id:'d1',workspaceId:ws,initiativeId:'i1',occurredAt:'2026-09-25T10:00:00Z',actor:{id:'u',label:'Owner'},before:f('2026-10-08',2),after:f('2026-10-15',3)}],reviews:[{id:'r1',workspaceId:ws,week:'2026-W39',status:'FINAL',finalizedAt:'2026-09-27T10:00:00Z',finalizedByLabel:'Owner',sections:[{initiativeId:'i1'}]} as never]}));
 assert.equal(h[0]!.label,'Weekly Review finalized');assert.equal(h[0]!.href,'/weekly-review?week=2026-W39&initiative=flex');
 assert.equal(h[1]!.sentence,'Target Live 8 Oct 2026 → 15 Oct 2026');assert.equal(h[1]!.rationale,'From Steering sync');assert.equal(h[1]!.provenance!.href,'/initiatives/flex/evidence/s1');});
test('history: pages of 50 with a stable cursor, category and text filters, ISO week labels',()=>{
 const many=Array.from({length:120},(_,n)=>({id:`e${String(n).padStart(3,'0')}`,at:new Date(Date.UTC(2026,8,1)+n*3_600_000).toISOString(),category:n%2?'DELIVERY' as const:'SOURCES' as const,label:'x',sentence:n===7?'needle':'y',actor:'a',rationale:null,href:null,hrefLabel:null,provenance:null})).sort((a,b)=>b.at.localeCompare(a.at));
 const p1=pageHistory(many,{categories:[],text:''},null);assert.equal(p1.events.length,50);assert.equal(p1.total,120);const p2=pageHistory(many,{categories:[],text:''},p1.next);assert.equal(p2.events.length,50);assert.ok(p2.events[0]!.at<p1.events[49]!.at);const p3=pageHistory(many,{categories:[],text:''},p2.next);assert.equal(p3.events.length,20);assert.equal(p3.next,null);
 assert.equal(pageHistory(many,{categories:['DELIVERY'],text:''},null).total,60);assert.equal(pageHistory(many,{categories:[],text:'needle'},null).total,1);
 assert.equal(weekOf('2026-09-25T10:00:00Z').label,'Week 39 · 21–27 Sept 2026');assert.equal(weekOf('2026-10-01T00:00:00Z').label,'Week 40 · 28 Sept–4 Oct 2026');});
import {weeklyContextDelta} from './weekly-context.ts';
test('weekly context delta: only events inside the window, overdue reconstructed at the window end, deterministic for past windows',()=>{
 const q={id:'q1',workspaceId:ws,initiativeId:'i1',question:'Who signs?',ownerMemberId:null,expectedConfirmerText:null,dueDate:'2026-09-24',status:'OPEN' as const,origin:'MEETING' as const,originRefId:'p',originHref:null,originLabel:null,evidenceId:null,evidenceAnchorId:null,answerClaimId:null,answerNote:null,resolutionReason:null,createdBy:'u',createdByLabel:'U',createdAt:'2026-09-21T10:00:00Z',updatedAt:'2026-09-21T10:00:00Z',resolvedBy:null,resolvedByLabel:null,resolvedAt:null,revision:1};
 const opened={id:'e1',workspaceId:ws,initiativeId:'i1',questionId:'q1',seq:1,type:'OPENED' as const,before:null,after:q,note:'',actor:{id:'u',label:'U'},at:'2026-09-21T10:00:00Z',requestId:'r'};
 const answered={...opened,id:'e2',seq:2,type:'ANSWERED' as const,after:{...q,status:'ANSWERED' as const,answerNote:'Finance',revision:2},at:'2026-10-02T10:00:00Z'};
 const inW39=weeklyContextDelta({initiativeId:'i1',slug:'flex',from:'2026-09-20T00:00:00Z',to:'2026-09-27T12:00:00Z',questions:[{...q,status:'ANSWERED'}],questionEvents:[opened,answered],riskEvents:[],relationshipEvents:[],names:{}});
 assert.deepEqual(inW39.map(l=>l.kind),['QUESTION','OVERDUE']);assert.match(inW39[1]!.text,/overdue 3 days/);
 const inW40=weeklyContextDelta({initiativeId:'i1',slug:'flex',from:'2026-09-27T12:00:00Z',to:'2026-10-04T12:00:00Z',questions:[{...q,status:'ANSWERED'}],questionEvents:[opened,answered],riskEvents:[],relationshipEvents:[],names:{}});
 assert.deepEqual(inW40.map(l=>l.text),['Question answered: Who signs? (answer note, not in Knowledge)']);});
