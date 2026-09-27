import type {FindingState,ReviewFinding} from '../domain/types.ts';
import {canBusinessWrite} from '../auth/roles.ts';
import type {WorkspaceAccess} from '../auth/core.ts';
export type DispositionKind='DEFERRED'|'DISMISSED'|'WITHDRAWN';
export type QueueLane='open'|'deferred'|'dismissed'|'resolved';
export interface QueueFinalization {id:string;workspaceId:string;finalizedAt:string;}
export interface DispositionCommand {workspaceId:string;initiativeId:string;findingId:string;kind:DispositionKind;deferUntil:string|null;deferUntilNextReview:boolean;reason:string;expectedDigest:string;expectedLatestDispositionId:string|null;clientRequestId:string;}
export interface FindingDisposition extends DispositionCommand {id:string;organizationId:string;underlyingDigest:string;actor:{id:string;label:string};at:string;claimIds:string[];evidenceIds:string[];claimRevisions:{id:string;updatedAt:string}[];}
export interface EffectiveDisposition {lane:QueueLane;reopenReason?:string;activeRow?:FindingDisposition;latestRow?:FindingDisposition;}
export function orgDay(asOf:string):string {return new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Cairo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(asOf));}
export function latestDisposition(rows:readonly FindingDisposition[],findingId:string,asOf:string):FindingDisposition|undefined{return rows.filter(r=>r.findingId===findingId&&Date.parse(r.at)<=Date.parse(asOf)).sort((a,b)=>Date.parse(b.at)-Date.parse(a.at)||b.id.localeCompare(a.id))[0];}
/** Existing merged decision state wins. This pure projection never mutates findings or hashes. */
export function effectiveDisposition(finding:ReviewFinding,rows:readonly FindingDisposition[],finalizations:readonly QueueFinalization[],asOf:string):EffectiveDisposition {
 if(finding.status==='RESOLVED')return {lane:'resolved'};
 const latest=latestDisposition(rows.filter(r=>r.initiativeId===finding.initiativeId),finding.fingerprint,asOf);
 if(!latest||latest.kind==='WITHDRAWN')return {lane:'open',latestRow:latest};
 if(latest.underlyingDigest!==finding.contentDigest)return {lane:'open',latestRow:latest,reopenReason:latest.kind==='DISMISSED'?`evidence changed since dismissal on ${friendlyDay(latest.at)}`:'evidence changed since deferral'};
 if(latest.kind==='DISMISSED')return {lane:'dismissed',activeRow:latest,latestRow:latest};
 const ended=latest.deferUntil?orgDay(asOf)>=latest.deferUntil:finalizations.some(f=>f.workspaceId===latest.workspaceId&&Date.parse(f.finalizedAt)>Date.parse(latest.at)&&Date.parse(f.finalizedAt)<=Date.parse(asOf));
 return ended?{lane:'open',latestRow:latest,reopenReason:latest.deferUntil?`deferral ended ${friendlyDay(latest.deferUntil)}`:'the next Weekly Review was finalized'}:{lane:'deferred',activeRow:latest,latestRow:latest};
}
export function friendlyDay(value:string):string{return new Intl.DateTimeFormat('en-GB',{timeZone:value.length===10?'UTC':'Africa/Cairo',day:'numeric',month:'short'}).format(new Date(value.length===10?`${value}T00:00:00Z`:value));}
export interface QueueItem {finding:ReviewFinding;effective:EffectiveDisposition;}
export function projectQueue(findings:readonly ReviewFinding[],rows:readonly FindingDisposition[],finalizations:readonly QueueFinalization[],asOf:string,states:readonly FindingState[]=[]) {
 const lanes:{open:QueueItem[];deferred:QueueItem[];dismissed:QueueItem[];resolved:QueueItem[]}={open:[],deferred:[],dismissed:[],resolved:[]};
 for(const finding of findings.filter(f=>f.type==='CONFLICT'&&f.actionable)){const effective=effectiveDisposition(finding,rows,finalizations,asOf);lanes[effective.lane].push({finding,effective});}
 const standing=states.filter(s=>s.outcome&&!findings.some(f=>f.fingerprint===s.fingerprint));
 const history=[...rows.filter(r=>Date.parse(r.at)<=Date.parse(asOf)).map(row=>({id:row.id,row,reopenReason:null as string|null})),...lanes.open.filter(i=>i.effective.reopenReason&&i.effective.latestRow).map(i=>({id:`reopened:${i.effective.latestRow!.id}:${i.effective.reopenReason}`,row:i.effective.latestRow!,reopenReason:i.effective.reopenReason!}))];
 const replaced=findings.filter(f=>f.type==='SUPERSEDED');
 return {asOf,lanes,standing,history,replaced,counts:{open:lanes.open.length,deferred:lanes.deferred.length,dismissed:lanes.dismissed.length,resolved:lanes.resolved.length+standing.length,history:history.length+replaced.length}};
}
export type DispositionResult={code:'ok';row:FindingDisposition;replay:boolean}|{code:'digest_conflict'|'forbidden'|'archived'|'invalid';message:string}|{code:'disposition_conflict';message:string;latest:FindingDisposition|null};
/** Pure command validation, used under the local store lock; actor/time are server supplied. */
export function prepareDisposition(rows:readonly FindingDisposition[],finding:ReviewFinding|null,finalizations:readonly QueueFinalization[],ctx:WorkspaceAccess,input:DispositionCommand,asOf:string,id:string,archived=false):DispositionResult {
 if(!canBusinessWrite(ctx)||ctx.workspaceId!==input.workspaceId)return {code:'forbidden',message:'You cannot change this organization.'};
 if(archived)return {code:'archived',message:'Archived — restore to edit. Nothing changed.'};
 const prior=rows.find(r=>r.organizationId===ctx.organizationId&&r.clientRequestId===input.clientRequestId);
 if(prior){const same=(Object.keys(input) as (keyof DispositionCommand)[]).every(k=>prior[k]===input[k]);return prior.actor.id===ctx.actor.id&&same?{code:'ok',row:prior,replay:true}:{code:'invalid',message:'This request was already used.'};}
 if(!finding||finding.fingerprint!==input.findingId||finding.contentDigest!==input.expectedDigest)return {code:'digest_conflict',message:'The compared claims changed. Your reason is retained; review the current comparison.'};
 const latest=latestDisposition(rows.filter(r=>r.workspaceId===ctx.workspaceId&&r.initiativeId===input.initiativeId),input.findingId,asOf);
 if((latest?.id??null)!==input.expectedLatestDispositionId)return {code:'disposition_conflict',latest:latest??null,message:'Another person changed this queue item. Your reason is retained.'};
 if(!['DEFERRED','DISMISSED','WITHDRAWN'].includes(input.kind)||input.reason.length>2000||input.kind!=='WITHDRAWN'&&!input.reason.trim()||finding.status==='RESOLVED')return {code:'invalid',message:'Enter a reason for an unresolved comparison.'};
 if(input.kind==='DEFERRED') {if(Boolean(input.deferUntil)===input.deferUntilNextReview||input.deferUntil&&(!/^\d{4}-\d{2}-\d{2}$/.test(input.deferUntil)||Number.isNaN(Date.parse(input.deferUntil))||new Date(input.deferUntil).toISOString().slice(0,10)!==input.deferUntil||input.deferUntil<=orgDay(asOf)))return {code:'invalid',message:'Choose a future date or the next Weekly Review.'};}
 else if(input.deferUntil||input.deferUntilNextReview)return {code:'invalid',message:'Only a deferral can have an end condition.'};
 if(input.kind==='WITHDRAWN'&&!effectiveDisposition(finding,rows,finalizations,asOf).activeRow)return {code:'invalid',message:'Already open.'};
 const row:FindingDisposition={...input,id,organizationId:ctx.organizationId,underlyingDigest:finding.contentDigest,actor:{...ctx.actor},at:asOf,claimIds:finding.claims.map(c=>c.claimId),evidenceIds:[...new Set(finding.claims.flatMap(c=>c.evidence.map(e=>e.evidenceId)))],claimRevisions:[]};
 return {code:'ok',row,replay:false};
}
