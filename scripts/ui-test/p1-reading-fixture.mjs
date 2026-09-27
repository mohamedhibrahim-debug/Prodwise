// LOCAL TEST FIXTURE ONLY. Plays the reader for a saved submission when no
// Anthropic key exists, so rendered and E2E checks can exercise the real
// confirmation paths. The attempt is labelled model 'synthetic-provider-fixture'
// (the Workbench says "a synthetic test fixture (not Claude)"), and every
// candidate passes through the same server-side filter as Claude output.
// Usage: node … p1-reading-fixture.mjs <submissionId> <candidates.json>
import {readFileSync,writeFileSync,renameSync,existsSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {resolve,join} from 'node:path';
import {filterCandidates,SUPERSEDABLE} from '../../src/lib/evidence/filter.ts';
import {verifyAnchor} from '../../src/lib/evidence/anchor.ts';
import {relationshipCandidates} from '../../src/lib/workspace/relationships.ts';
if(process.env.AUTH_MODE!=='local'||process.env.VERCEL||process.env.NODE_ENV==='production')throw new Error('Local fixture checkout only.');
const [submissionId,candidatesPath]=process.argv.slice(2);if(!submissionId||!candidatesPath)throw new Error('Usage: <submissionId> <candidates.json>');
const storePath=resolve('.data/prodwise.json');const store=JSON.parse(readFileSync(storePath,'utf8'));
const sub=store.evidenceSubmissions.find(s=>s.id===submissionId);if(!sub)throw new Error('Submission not found.');
const deliveryPath=join(resolve('.data/delivery'),`${sub.workspaceId}.json`);const facts=existsSync(deliveryPath)?JSON.parse(readFileSync(deliveryPath,'utf8')).facts:[];
const claims=store.claims.filter(c=>c.initiativeId===sub.initiativeId&&SUPERSEDABLE.includes(c.status)&&['REQUIREMENT','BUSINESS_RULE','DECISION','ASSUMPTION','DEPENDENCY'].includes(c.type)).slice(0,40).map((c,n)=>({ref:`K${n+1}`,id:c.id,updatedAt:c.updatedAt,type:c.type,status:c.status,subject:c.subject,attribute:c.attribute,value:c.value,domain:c.domain,phase:c.phase}));
const raw=JSON.parse(readFileSync(candidatesPath,'utf8'));
// Candidates may name a target by subject/attribute instead of ref; resolve to the offered ref.
for(const c of raw)if(c.type==='CHANGED_REQUIREMENT'&&c.payload.targetSubject){c.payload.target=claims.find(k=>k.subject===c.payload.targetSubject&&k.attribute===c.payload.targetAttribute)?.ref;}
const filtered=filterCandidates(sub.text,raw,sub.kind==='MEETING_NOTES'?claims:[]);const discarded=filtered.discarded;
const accepted=[...filtered.accepted,...relationshipCandidates(filtered.accepted,store.initiatives.filter(i=>i.workspaceId===sub.workspaceId&&!i.archivedAt),sub.initiativeId)];
const now=new Date().toISOString();const attemptId=randomUUID();
store.evidenceAttempts.push({id:attemptId,workspaceId:sub.workspaceId,initiativeId:sub.initiativeId,submissionId,requestId:randomUUID(),status:'READY',startedAt:now,endedAt:now,errorCode:null,model:'synthetic-provider-fixture',promptVersion:'ANCHORED_EVIDENCE_V1',discardedCount:discarded});
for(const c of accepted){if(!verifyAnchor(sub.text,c.anchor,sub.textSha256))throw new Error('Anchor failed verification.');const anchorId=randomUUID();store.evidenceAnchors.push({id:anchorId,workspaceId:sub.workspaceId,initiativeId:sub.initiativeId,submissionId,...c.anchor});
 const base=c.type==='DELIVERY'?(facts.find(f=>f.initiativeId===sub.initiativeId&&f.kind===c.payload.factKind)?.revision??0):0;
 store.evidenceProposals.push({id:randomUUID(),workspaceId:sub.workspaceId,initiativeId:sub.initiativeId,submissionId,attemptId,anchorId,type:c.type,payload:c.payload,version:1,baseRevision:base,status:'PENDING',decidedBy:null,decidedAt:null,reason:null,resultType:null,resultId:null});}
const tmp=`${storePath}.${randomUUID()}.tmp`;writeFileSync(tmp,JSON.stringify(store,null,2));renameSync(tmp,storePath);
console.log(JSON.stringify({attemptId,accepted:accepted.map(a=>a.type),discarded}));
