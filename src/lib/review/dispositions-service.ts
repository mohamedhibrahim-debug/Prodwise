import 'server-only';
import {randomUUID} from 'node:crypto';
import {requireWorkspaceAccess,requireBusinessWriteAccess} from '../auth/access';
import {isLocalAuth,adminClient,configuredWorkspaceId} from '../auth/service';
import {withRepositoryContext} from '../auth/repository-context';
import {readStore,writeStoreAtomic,writeStoreWithDelivery,type StoreShape} from '../data/store';
import {withLocalOwnerLock} from '../delivery/repository';
import {LocalDeliveryStore} from '../delivery/local-store';
import {localDeliveryPath} from '../delivery/local-path';
import {runReview} from './engine';
import {applyFindingStates} from './merge';
import {projectQueue,prepareDisposition,type FindingDisposition,type QueueFinalization,type DispositionCommand,type DispositionResult} from './dispositions';
import type {DeliveryState} from '../delivery/types';
import type {ClaimWithEvidence} from '../domain/types';
function claimsFor(s:StoreShape,id:string):ClaimWithEvidence[]{return s.claims.filter(c=>c.initiativeId===id).map(c=>({...c,evidence:s.claimEvidence.filter(l=>l.claimId===c.id).flatMap(l=>s.evidence.filter(e=>e.id===l.evidenceId))}));}
function finals(state:DeliveryState):QueueFinalization[]{return state.reviews.filter(r=>r.status==='FINAL'&&r.finalizedAt).map(r=>({id:r.id,workspaceId:r.workspaceId,finalizedAt:r.finalizedAt!}));}
export async function readQueue(initiativeId:string,asOf=new Date().toISOString()):Promise<{dispositions:FindingDisposition[];finalizations:QueueFinalization[];asOf:string}> {
 const ctx=await requireWorkspaceAccess();
 if(!isLocalAuth()){const {data,error}=await adminClient().rpc('read_finding_dispositions',{p_workspace_id:ctx.workspaceId,p_member_id:ctx.memberId??ctx.actor.id,p_initiative_id:initiativeId,p_as_of:asOf});if(error)throw Error('Decision queue unavailable.');return {...data,asOf};}
 return withRepositoryContext(ctx,async()=>{
  const s=readStore(),i=s.initiatives.find(i=>i.id===initiativeId);if(!i)throw Error('Initiative unavailable in this organization.');
  const delivery=await new LocalDeliveryStore(localDeliveryPath(process.cwd(),ctx.workspaceId,configuredWorkspaceId())).read(),finalizations=finals(delivery),dispositions=(s.findingDispositions??[]).filter(r=>r.workspaceId===ctx.workspaceId&&r.initiativeId===initiativeId);
  // Audit observed transitions once. This records an evaluator observation, not a human decision.
  const queue=projectQueue(applyFindingStates(runReview(i.id,claimsFor(s,i.id)),s.findingStates.filter(f=>f.initiativeId===i.id)),dispositions,finalizations,asOf);
  const reopens=queue.lanes.open.filter(x=>x.effective.reopenReason&&x.effective.latestRow);
  if(!i.archivedAt&&reopens.some(x=>!s.activity.some(a=>a.eventType==='FINDING_DISPOSITION_REOPENED'&&a.payload?.dispositionId===x.effective.latestRow!.id&&a.payload?.reopenReason===x.effective.reopenReason)))writeStoreAtomic(current=>{
   for(const x of reopens){if(current.activity.some(a=>a.eventType==='FINDING_DISPOSITION_REOPENED'&&a.payload?.dispositionId===x.effective.latestRow!.id&&a.payload?.reopenReason===x.effective.reopenReason))continue;current.activity.push({id:randomUUID(),workspaceId:ctx.workspaceId,initiativeId:i.id,eventType:'FINDING_DISPOSITION_REOPENED',summary:`Reopened: ${x.effective.reopenReason}.`,entityType:'finding',entityId:x.finding.fingerprint,actorLabel:null,occurredAt:asOf,payload:{dispositionId:x.effective.latestRow!.id,reopenReason:x.effective.reopenReason,observedByEvaluator:true}});}
  });
  return {dispositions:structuredClone(dispositions),finalizations,asOf};
 });
}
class DispositionReceipt extends Error {constructor(readonly result:DispositionResult){super(result.code);}}
export async function recordDisposition(input:DispositionCommand):Promise<DispositionResult> {
 const ctx=await requireBusinessWriteAccess();if(ctx.workspaceId!==input.workspaceId)return {code:'forbidden',message:'Your organization changed. Reload before saving.'};
 if(!/^[0-9a-f-]{36}$/i.test(input.clientRequestId)||!/^[0-9a-f-]{36}$/i.test(input.initiativeId))return {code:'invalid',message:'Invalid request.'};
 if(!isLocalAuth()){const {data,error}=await adminClient().rpc('record_disposition',{p_workspace_id:ctx.workspaceId,p_member_id:ctx.memberId??ctx.actor.id,p_input:input});if(error)return {code:'invalid',message:"Couldn't record this. Nothing changed. Retry."};return data as DispositionResult;}
 try{return await withRepositoryContext(ctx,async()=>withLocalOwnerLock(ctx,delivery=>writeStoreWithDelivery(localDeliveryPath(process.cwd(),ctx.workspaceId,configuredWorkspaceId()),delivery,s=>{
  const i=s.initiatives.find(i=>i.id===input.initiativeId&&i.workspaceId===ctx.workspaceId);if(!i)throw new DispositionReceipt({code:'forbidden',message:'Initiative unavailable.'});
  const claims=claimsFor(s,i.id),finding=applyFindingStates(runReview(i.id,claims),s.findingStates.filter(f=>f.initiativeId===i.id)).find(f=>f.fingerprint===input.findingId)??null;
  const result=prepareDisposition(s.findingDispositions??[],finding,finals(delivery),ctx,input,new Date().toISOString(),randomUUID(),Boolean(i.archivedAt));
  if(result.code!=='ok'||result.replay)throw new DispositionReceipt(result);
  result.row.claimRevisions=claims.filter(c=>result.row.claimIds.includes(c.id)).map(c=>({id:c.id,updatedAt:c.updatedAt}));
  (s.findingDispositions??=[]).push(result.row);s.activity.push({id:randomUUID(),workspaceId:ctx.workspaceId,initiativeId:i.id,eventType:`FINDING_${result.row.kind}`,summary:result.row.kind==='WITHDRAWN'?'Returned to Open.':`${result.row.kind==='DEFERRED'?'Deferred':'Dismissed'}: ${result.row.reason}`,occurredAt:result.row.at,entityType:'finding',entityId:input.findingId,actorLabel:ctx.actor.label,payload:{dispositionId:result.row.id,findingId:input.findingId,digest:result.row.underlyingDigest,clientRequestId:input.clientRequestId}});return result;
 })));}catch(e){if(e instanceof DispositionReceipt)return e.result;throw e;}
}
