import {randomUUID} from 'node:crypto';
import {canBusinessWrite,hasOrganizationAdminAuthority} from '../auth/roles.ts';
import type {WorkspaceAccess,DeliveryMember} from '../delivery/types.ts';
import type {Initiative} from '../domain/types.ts';
import {dateValid} from '../delivery/model.ts';
import {ACTION_STATUSES,canChangeCommitment} from './commitment-policy.ts';
export {ACTION_STATUSES,canChangeCommitment} from './commitment-policy.ts';
export type ActionStatus=typeof ACTION_STATUSES[number];
export type ActionOrigin='HUMAN_ENTRY'|'WEEKLY_REVIEW'|'MEETING'|'DECISION'|'CONFIRMED_AI_PROPOSAL';
export interface Commitment {id:string;workspaceId:string;initiativeId:string;title:string;assigneeMemberId:string|null;dueDate:string|null;status:ActionStatus;blockedNote:string|null;origin:ActionOrigin;originRefId:string|null;originHref:string|null;evidenceId:string|null;createdBy:string;createdAt:string;updatedAt:string;completedAt:string|null;cancelledAt:string|null;revision:number;}
export interface CommitmentEvent {id:string;workspaceId:string;initiativeId:string;actionId:string;seq:number;type:'CREATED'|'UPDATED';before:Commitment|null;after:Commitment;note:string;actor:{id:string;label:string};at:string;requestId:string;}
export interface CommitmentInput {weekly?:{reviewId:string;reviewRevision:number;line:string};id?:string;requestId:string;expectedRevision:number;title:string;assigneeMemberId:string|null;dueDate:string|null;status:ActionStatus;blockedNote:string|null;evidenceId:string|null;note:string;origin?:ActionOrigin;originRefId?:string|null;originHref?:string|null;}
export function reviseCommitment(actions:Commitment[],events:CommitmentEvent[],input:CommitmentInput,ctx:WorkspaceAccess,initiative:Initiative,ownerId:string|null,members:DeliveryMember[],evidenceIds:string[],at:string){
 if(!canBusinessWrite(ctx))throw Error('Your role is read-only.');if(initiative.workspaceId!==ctx.workspaceId)throw Error('Initiative unavailable.');if(initiative.archivedAt)throw Error('Archived — restore to edit. Nothing was changed.');
 if(!/^[0-9a-f-]{36}$/i.test(input.requestId))throw Error('Reload this commitment before saving.');
 const replay=events.find(e=>e.workspaceId===ctx.workspaceId&&e.requestId===input.requestId);if(replay){if(replay.actor.id!==ctx.actor.id||replay.actionId!==(input.id??replay.actionId)||replay.after.title!==input.title.trim()||replay.after.status!==input.status||replay.after.assigneeMemberId!==input.assigneeMemberId||replay.after.dueDate!==input.dueDate||replay.after.blockedNote!==(input.blockedNote?.trim()||null)||replay.after.evidenceId!==input.evidenceId||replay.note!==input.note.trim())throw Error('This save request was already used for a different change.');return {action:actions.find(a=>a.id===replay.actionId)!,event:null};}
 const before=input.id?actions.find(a=>a.id===input.id&&a.workspaceId===ctx.workspaceId&&a.initiativeId===initiative.id):undefined;
 if(input.id&&!before)throw Error('Commitment unavailable.');if((before?.revision??0)!==input.expectedRevision)throw Error(`This commitment changed${before?` to ${before.status.toLowerCase().replaceAll('_',' ')} at ${before.updatedAt}`:''}. Your changes were not saved. Review the current record before retrying.`);
 const title=input.title.trim(),note=input.note.trim(),blockedNote=input.blockedNote?.trim()||null;
 if(!title||title.length>200||note.length>2000||blockedNote&&blockedNote.length>2000||!ACTION_STATUSES.includes(input.status))throw Error('Enter a title up to 200 characters and a valid status.');
 if(input.dueDate&&!dateValid(input.dueDate))throw Error('Use a valid due date or leave it unknown.');
 if(input.assigneeMemberId&&!members.some(m=>m.id===input.assigneeMemberId&&m.workspaceId===ctx.workspaceId&&m.active&&m.role!=='VIEWER'))throw Error('Choose an active non-Viewer member in this organization.');
 if(input.evidenceId&&!evidenceIds.includes(input.evidenceId))throw Error('Choose evidence from this initiative.');
 if(blockedNote&&!['OPEN','IN_PROGRESS'].includes(input.status))throw Error('Completed or cancelled commitments cannot be marked blocked.');
 if((input.status==='CANCELLED'||before&&['DONE','CANCELLED'].includes(before.status)&&['OPEN','IN_PROGRESS'].includes(input.status))&&!note)throw Error('A cancellation or reopening needs a reason.');
 if(before){const details=before.title!==title||before.dueDate!==input.dueDate||before.evidenceId!==input.evidenceId||before.assigneeMemberId!==input.assigneeMemberId;const release=ctx.memberId===before.assigneeMemberId&&input.assigneeMemberId===null&&before.title===title&&before.dueDate===input.dueDate&&before.evidenceId===input.evidenceId&&Boolean(note);if(!canChangeCommitment(ctx,before,ownerId,'STATUS')||details&&!canChangeCommitment(ctx,before,ownerId,'DETAILS')&&!release)throw Error('Only the assignee, initiative owner, creator, Product Lead or administration may update this commitment; detail edits have narrower access.');}
 const origin=before?.origin??input.origin??'HUMAN_ENTRY',originRefId=before?.originRefId??input.originRefId??null;
 if(!['HUMAN_ENTRY','WEEKLY_REVIEW','MEETING','DECISION','CONFIRMED_AI_PROPOSAL'].includes(origin)||origin!=='HUMAN_ENTRY'&&!originRefId)throw Error('A supported origin reference is required.');
 if(!before&&originRefId&&['WEEKLY_REVIEW','CONFIRMED_AI_PROPOSAL','MEETING'].includes(origin)){const existing=actions.find(a=>a.workspaceId===ctx.workspaceId&&a.origin===origin&&a.originRefId===originRefId);if(existing)return {action:existing,event:null};}
 const action:Commitment={id:before?.id??randomUUID(),workspaceId:ctx.workspaceId,initiativeId:initiative.id,title,assigneeMemberId:input.assigneeMemberId,dueDate:input.dueDate,status:input.status,blockedNote,origin,originRefId,originHref:before?.originHref??input.originHref??null,evidenceId:input.evidenceId,createdBy:before?.createdBy??ctx.actor.id,createdAt:before?.createdAt??at,updatedAt:at,completedAt:input.status==='DONE'?before?.completedAt??at:null,cancelledAt:input.status==='CANCELLED'?before?.cancelledAt??at:null,revision:(before?.revision??0)+1};
 const event:CommitmentEvent={id:randomUUID(),workspaceId:ctx.workspaceId,initiativeId:initiative.id,actionId:action.id,seq:action.revision,type:before?'UPDATED':'CREATED',before:before??null,after:action,note,actor:ctx.actor,at,requestId:input.requestId};return {action,event};
}
export function replayCommitment(events:CommitmentEvent[]):Commitment|null{return events.slice().sort((a,b)=>a.seq-b.seq).at(-1)?.after??null;}
