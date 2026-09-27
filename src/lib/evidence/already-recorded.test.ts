import test from 'node:test';
import assert from 'node:assert/strict';
import {alreadyRecorded,sameTextAs} from './already-recorded.ts';
import type {Proposal,Submission} from './types.ts';

const proposal=(id:string,type:Proposal['type'],payload:Partial<Proposal['payload']>,status:Proposal['status']='PENDING'):Proposal=>({id,workspaceId:'w',initiativeId:'i1',submissionId:'s1',attemptId:'a',anchorId:'x',type,payload:{subject:'',attribute:'',value:'',domain:'PRODUCT',phase:null,...payload} as Proposal['payload'],version:1,baseRevision:0,status,decidedBy:null,decidedAt:null,reason:null,resultType:null,resultId:null});
const facts={slug:'mff',initiativeId:'i1',names:{i1:'Merchant Flex Finance',i2:'Instant Settlement Payout'},
 claims:[{id:'c1',subject:'Pilot scope',attribute:'Merchant cap',value:'Limited to 40 merchants.',status:'ACTIVE'},{id:'c2',subject:'Old',attribute:'Rule',value:'x',status:'REJECTED'}],
 commitments:[{id:'k1',initiativeId:'i1',title:'Publish the communication pack',status:'OPEN'},{id:'k2',initiativeId:'i1',title:'Cancelled thing',status:'CANCELLED'}],
 questions:[{id:'q1',initiativeId:'i1',question:'Who signs off the fee table?',status:'OPEN'}],
 relationships:[{id:'r1',fromInitiativeId:'i2',toInitiativeId:'i1',type:'DEPENDS_ON',status:'ACTIVE'}],
 facts:[{initiativeId:'i1',kind:'TARGET_LIVE',state:'SET',value:{date:'2026-10-15'}}]};

test('exact matches (ignoring case, spacing, punctuation) are flagged with a link to the existing record',()=>{
 const hits=alreadyRecorded([
  proposal('p1','DECISION',{subject:'pilot scope',attribute:'merchant cap',value:'limited to 40 merchants'}),
  proposal('p2','ACTION',{value:'publish the communication pack'}),
  proposal('p3','OPEN_QUESTION',{value:'Who signs off the fee table'}),
  proposal('p4','RELATIONSHIP',{targetInitiativeId:'i2'}),
  proposal('p5','DELIVERY',{factKind:'TARGET_LIVE',date:'2026-10-15'}),
 ],facts);
 assert.deepEqual(Object.keys(hits).sort(),['p1','p2','p3','p4','p5']);
 assert.match(hits.p4!.label,/Recorded relationship: Instant Settlement Payout depends on Merchant Flex Finance/);
 assert.equal(hits.p2!.href,'/initiatives/mff/actions?action=k1');
});

test('different wording, rejected or cancelled records, and decided proposals are never flagged',()=>{
 const hits=alreadyRecorded([
  proposal('p1','DECISION',{subject:'Pilot scope',attribute:'Merchant cap',value:'limited to 50 merchants'}),
  proposal('p2','BUSINESS_RULE',{subject:'Old',attribute:'Rule',value:'x'}),
  proposal('p3','ACTION',{value:'Cancelled thing'}),
  proposal('p4','DELIVERY',{factKind:'TARGET_LIVE',date:'2026-10-22'}),
  proposal('p5','ACTION',{value:'publish the communication pack'},'CONFIRMED'),
 ],facts);
 assert.deepEqual(hits,{});
});

test('same text points to the copy where decisions were already made, else the earliest',()=>{
 const s=(id:string,at:string,sha:string,initiativeId='i1'):Submission=>({id,workspaceId:'w',organizationId:'o',initiativeId,sourceItemId:'x',evidenceId:'e',kind:'PASTED',title:id,text:'',textSha256:sha,charLength:0,createdBy:'u',createdAt:at,requestId:id});
 const all=[s('a','2026-09-20T10:00:00Z','h'),s('b','2026-09-21T10:00:00Z','h'),s('c','2026-09-19T10:00:00Z','h','i2'),s('d','2026-09-22T10:00:00Z','other')];
 assert.equal(sameTextAs(all[1]!,all)?.id,'a');
 assert.equal(sameTextAs(all[0]!,all),null);
 assert.equal(sameTextAs(all[3]!,all),null);
 const progress=(id:string)=>id==='b'?5:0;
 assert.equal(sameTextAs(all[0]!,all,progress)?.id,'b');
 assert.equal(sameTextAs(all[1]!,all,progress),null);
});
