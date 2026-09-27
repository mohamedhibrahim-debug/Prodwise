import {randomUUID} from 'node:crypto';
import {canBusinessWrite,hasOrganizationAdminAuthority} from '../auth/roles.ts';
import type {WorkspaceAccess,DeliveryMember} from '../delivery/types.ts';
import type {Initiative} from '../domain/types.ts';

/**
 * Risk tracking extends a Knowledge RISK claim; the risk statement stays the
 * claim. Tracking holds only status, owner and mitigation — it never edits the
 * claim, and it never moves silently when the claim is superseded.
 */
export const RISK_STATUSES=['OPEN','MITIGATING','ACCEPTED','CLOSED'] as const;
export type RiskStatus=typeof RISK_STATUSES[number];
export const RISK_STATUS_LABEL:Record<RiskStatus,string>={OPEN:'Open',MITIGATING:'Mitigating',ACCEPTED:'Accepted',CLOSED:'Closed'};
export interface RiskTracking {id:string;workspaceId:string;initiativeId:string;claimId:string;status:RiskStatus;ownerMemberId:string|null;mitigationText:string|null;mitigationActionId:string|null;carriedFromTrackingId:string|null;createdBy:string;createdAt:string;updatedAt:string;resolvedAt:string|null;revision:number;}
export interface RiskEvent {id:string;workspaceId:string;initiativeId:string;trackingId:string;claimId:string;seq:number;type:'STARTED'|'STATUS'|'UPDATED'|'CARRIED';before:RiskTracking|null;after:RiskTracking;statement:string;note:string;actor:{id:string;label:string};at:string;requestId:string;}
export interface RiskClaim {id:string;initiativeId:string;type:string;status:string;subject:string;value:string;supersededByClaimId:string|null;}
export interface RiskCommand {operation:'START'|'UPDATE'|'STATUS'|'CARRY';id?:string;claimId?:string;requestId:string;expectedRevision:number;status?:RiskStatus;ownerMemberId?:string|null;mitigationText?:string|null;mitigationActionId?:string|null;reason?:string;}

export function canManageRisk(ctx:WorkspaceAccess,initiativeOwnerId:string|null){return canBusinessWrite(ctx)&&(hasOrganizationAdminAuthority(ctx)||ctx.isProductLead||Boolean(ctx.memberId)&&ctx.memberId===initiativeOwnerId);}
export function canChangeRiskStatus(ctx:WorkspaceAccess,t:Pick<RiskTracking,'ownerMemberId'>,initiativeOwnerId:string|null){return canManageRisk(ctx,initiativeOwnerId)||canBusinessWrite(ctx)&&Boolean(ctx.memberId)&&ctx.memberId===t.ownerMemberId;}
export const statementOf=(c:Pick<RiskClaim,'subject'|'value'>)=>`${c.subject}: ${c.value}`;

export function reviseRisk(rows:RiskTracking[],events:RiskEvent[],cmd:RiskCommand,ctx:WorkspaceAccess,initiative:Initiative,initiativeOwnerId:string|null,members:DeliveryMember[],claims:RiskClaim[],actionIds:string[],at:string):{tracking:RiskTracking;event:RiskEvent|null}{
 if(!canBusinessWrite(ctx))throw Error('Your role is read-only.');
 if(initiative.workspaceId!==ctx.workspaceId)throw Error('Initiative unavailable.');
 if(initiative.archivedAt)throw Error('Archived — restore to edit. Nothing was changed.');
 if(!/^[0-9a-f-]{36}$/i.test(cmd.requestId))throw Error('Reload before saving this risk.');
 const replay=events.find(e=>e.workspaceId===ctx.workspaceId&&e.requestId===cmd.requestId);
 if(replay){if(replay.actor.id!==ctx.actor.id)throw Error('This save request was already used.');return {tracking:rows.find(r=>r.id===replay.trackingId)!,event:null};}
 const reason=(cmd.reason??'').trim();if(reason.length>2000)throw Error('Keep the reason under 2,000 characters.');
 const owner=(id:string|null|undefined)=>{if(id&&!members.some(m=>m.id===id&&m.workspaceId===ctx.workspaceId&&m.active&&m.role!=='VIEWER'))throw Error('Choose an active non-Viewer member in this organization.');return id??null;};
 const mitigation=(t:string|null|undefined)=>{const v=(t??'').trim()||null;if(v&&v.length>500)throw Error('Keep the mitigation under 500 characters.');return v;};
 const action=(id:string|null|undefined)=>{if(id&&!actionIds.includes(id))throw Error('Choose a commitment from this initiative.');return id??null;};
 const trackable=(id:string|undefined)=>{const c=claims.find(c=>c.id===id&&c.initiativeId===initiative.id);if(!c||c.type!=='RISK')throw Error('Only a risk recorded in this initiative’s Knowledge can be tracked.');if(c.status!=='ACTIVE')throw Error('This risk is awaiting verification. Confirm it in Knowledge before tracking it.');return c;};
 let next:RiskTracking,before:RiskTracking|undefined,type:RiskEvent['type'],claim:RiskClaim;
 if(cmd.operation==='START'||cmd.operation==='CARRY'){
  if(!canManageRisk(ctx,initiativeOwnerId))throw Error('Only the initiative owner, a Product Lead or administration can start tracking a risk.');
  if(cmd.expectedRevision!==0)throw Error('Reload before saving this risk.');
  claim=trackable(cmd.claimId);
  const existing=rows.find(r=>r.workspaceId===ctx.workspaceId&&r.claimId===claim.id);if(existing)return {tracking:existing,event:null};
  let from:RiskTracking|undefined;
  if(cmd.operation==='CARRY'){from=rows.find(r=>r.id===cmd.id&&r.workspaceId===ctx.workspaceId&&r.initiativeId===initiative.id);const old=from&&claims.find(c=>c.id===from!.claimId);if(!from||!old||old.status!=='SUPERSEDED'||old.supersededByClaimId!==claim.id)throw Error('Tracking can only be carried to the entry that replaced this risk.');}
  next={id:randomUUID(),workspaceId:ctx.workspaceId,initiativeId:initiative.id,claimId:claim.id,status:from?.status??'OPEN',ownerMemberId:from?.ownerMemberId??owner(cmd.ownerMemberId),mitigationText:from?.mitigationText??mitigation(cmd.mitigationText),mitigationActionId:from?.mitigationActionId??action(cmd.mitigationActionId),carriedFromTrackingId:from?.id??null,createdBy:ctx.actor.id,createdAt:at,updatedAt:at,resolvedAt:null,revision:1};
  type=from?'CARRIED':'STARTED';
 }else{
  before=rows.find(r=>r.id===cmd.id&&r.workspaceId===ctx.workspaceId&&r.initiativeId===initiative.id);if(!before)throw Error('Risk unavailable.');
  if(before.revision!==cmd.expectedRevision)throw Error(`This risk was changed by someone else (now ${RISK_STATUS_LABEL[before.status]}). Your change was not saved; your input is kept.`);
  claim=claims.find(c=>c.id===before!.claimId)??{id:before.claimId,initiativeId:initiative.id,type:'RISK',status:'UNKNOWN',subject:'Risk',value:'',supersededByClaimId:null};
  if(cmd.operation==='STATUS'){
   const status=cmd.status;if(!status||!RISK_STATUSES.includes(status))throw Error('Choose a status.');if(status===before.status)throw Error('Nothing changed.');
   if(!canChangeRiskStatus(ctx,before,initiativeOwnerId))throw Error('Only the risk owner, the initiative owner, a Product Lead or administration can change its status.');
   if((status==='ACCEPTED'||status==='CLOSED')&&!reason)throw Error(`Say why this risk is ${status==='ACCEPTED'?'accepted':'closed'}.`);
   next={...before,status,resolvedAt:status==='CLOSED'||status==='ACCEPTED'?at:null};type='STATUS';
  }else{
   if(!canManageRisk(ctx,initiativeOwnerId))throw Error('Only the initiative owner, a Product Lead or administration can change a risk’s owner or mitigation.');
   next={...before,ownerMemberId:cmd.ownerMemberId===undefined?before.ownerMemberId:owner(cmd.ownerMemberId),mitigationText:cmd.mitigationText===undefined?before.mitigationText:mitigation(cmd.mitigationText),mitigationActionId:cmd.mitigationActionId===undefined?before.mitigationActionId:action(cmd.mitigationActionId)};type='UPDATED';
   if(JSON.stringify(next)===JSON.stringify(before))throw Error('Nothing changed.');
  }
  next={...next,updatedAt:at,revision:before.revision+1};
 }
 return {tracking:next,event:{id:randomUUID(),workspaceId:ctx.workspaceId,initiativeId:initiative.id,trackingId:next.id,claimId:next.claimId,seq:next.revision,type,before:before??null,after:next,statement:statementOf(claim),note:reason,actor:ctx.actor,at,requestId:cmd.requestId}};
}

export type RiskView={claim:RiskClaim;tracking:RiskTracking|null;state:'TRACKED'|'NOT_TRACKED'|'AWAITING_VERIFICATION'|'SUPERSEDED'};
/** Every RISK claim in view, with its tracking or a derived read-time state (nothing stored for untracked risks). */
export function riskViews(claims:RiskClaim[],rows:RiskTracking[],initiativeId:string):RiskView[]{
 return claims.filter(c=>c.initiativeId===initiativeId&&c.type==='RISK'&&['ACTIVE','UNVERIFIED','SUPERSEDED'].includes(c.status)).map(c=>{const t=rows.find(r=>r.claimId===c.id)??null;
  const state:RiskView['state']=c.status==='SUPERSEDED'?'SUPERSEDED':c.status==='UNVERIFIED'?'AWAITING_VERIFICATION':t?'TRACKED':'NOT_TRACKED';return {claim:c,tracking:t,state};})
  .filter(v=>v.state!=='SUPERSEDED'||v.tracking&&!rows.some(r=>r.carriedFromTrackingId===v.tracking!.id));
}
