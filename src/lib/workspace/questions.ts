import {randomUUID} from 'node:crypto';
import {canBusinessWrite,hasOrganizationAdminAuthority} from '../auth/roles.ts';
import type {WorkspaceAccess,DeliveryMember} from '../delivery/types.ts';
import type {Initiative} from '../domain/types.ts';
import {dateValid} from '../delivery/model.ts';

/**
 * An Open Question is an unresolved, tracked item — never Product Truth.
 * Its answer only becomes Knowledge when it links a claim that is already
 * ACTIVE; an answer note is shown as "not in Knowledge" and feeds nothing.
 */
export const QUESTION_STATUSES=['OPEN','ANSWERED','WITHDRAWN'] as const;
export type QuestionStatus=typeof QUESTION_STATUSES[number];
export type QuestionOrigin='HUMAN_ENTRY'|'CONFIRMED_AI_PROPOSAL'|'MEETING'|'WEEKLY_REVIEW';
export interface OpenQuestion {
 id:string;workspaceId:string;initiativeId:string;question:string;ownerMemberId:string|null;expectedConfirmerText:string|null;dueDate:string|null;
 status:QuestionStatus;origin:QuestionOrigin;originRefId:string|null;originHref:string|null;originLabel:string|null;evidenceId:string|null;evidenceAnchorId:string|null;
 answerClaimId:string|null;answerNote:string|null;resolutionReason:string|null;
 createdBy:string;createdByLabel:string;createdAt:string;updatedAt:string;resolvedBy:string|null;resolvedByLabel:string|null;resolvedAt:string|null;revision:number;
}
export type QuestionEventType='OPENED'|'UPDATED'|'ANSWERED'|'WITHDRAWN'|'REOPENED';
export interface QuestionEvent {id:string;workspaceId:string;initiativeId:string;questionId:string;seq:number;type:QuestionEventType;before:OpenQuestion|null;after:OpenQuestion;note:string;actor:{id:string;label:string};at:string;requestId:string;}
export type QuestionOperation='CREATE'|'EDIT'|'ANSWER'|'WITHDRAW'|'REOPEN';
export interface QuestionCommand {
 operation:QuestionOperation;id?:string;requestId:string;expectedRevision:number;
 question?:string;ownerMemberId?:string|null;expectedConfirmerText?:string|null;dueDate?:string|null;
 answerNote?:string|null;answerClaimId?:string|null;reason?:string|null;
 origin?:QuestionOrigin;originRefId?:string|null;originHref?:string|null;originLabel?:string|null;evidenceId?:string|null;evidenceAnchorId?:string|null;
}
export interface QuestionAnswerClaim {id:string;initiativeId:string;status:string;}

const uuid=/^[0-9a-f-]{36}$/i;
function authority(ctx:WorkspaceAccess,q:OpenQuestion,ownerId:string|null,operation:'DETAILS'|'RESOLVE'){
 if(!canBusinessWrite(ctx))return false;
 if(hasOrganizationAdminAuthority(ctx)||ctx.isProductLead||ctx.memberId===ownerId)return true;
 return operation==='DETAILS'?ctx.actor.id===q.createdBy:ctx.memberId===q.ownerMemberId;
}
/** Exposed so the UI asks the same question the server does (never re-derives it). */
export function canChangeQuestion(ctx:WorkspaceAccess,q:OpenQuestion,ownerId:string|null,operation:'DETAILS'|'RESOLVE'){return authority(ctx,q,ownerId,operation);}

export function reviseQuestion(questions:OpenQuestion[],events:QuestionEvent[],cmd:QuestionCommand,ctx:WorkspaceAccess,initiative:Initiative,ownerId:string|null,members:DeliveryMember[],claims:QuestionAnswerClaim[],at:string):{question:OpenQuestion;event:QuestionEvent|null}{
 if(!canBusinessWrite(ctx))throw Error('Your role is read-only.');
 if(initiative.workspaceId!==ctx.workspaceId)throw Error('Initiative unavailable.');
 if(initiative.archivedAt)throw Error('Archived — restore to edit. Nothing was changed.');
 if(!uuid.test(cmd.requestId))throw Error('Reload this question before saving.');
 const replay=events.find(e=>e.workspaceId===ctx.workspaceId&&e.requestId===cmd.requestId);
 if(replay){if(replay.actor.id!==ctx.actor.id||(cmd.id&&replay.questionId!==cmd.id))throw Error('This save request was already used for a different change.');return {question:questions.find(q=>q.id===replay.questionId)!,event:null};}
 const before=cmd.id?questions.find(q=>q.id===cmd.id&&q.workspaceId===ctx.workspaceId&&q.initiativeId===initiative.id):undefined;
 if(cmd.operation!=='CREATE'&&!before)throw Error('Question unavailable.');
 if((before?.revision??0)!==cmd.expectedRevision)throw Error(`This question changed${before?` — ${before.status==='OPEN'?'it was edited':`marked ${before.status.toLowerCase()}`} by ${before.resolvedByLabel??'another person'}`:''}. Your change was not saved; your input is kept.`);
 const reason=(cmd.reason??'').trim();if(reason.length>2000)throw Error('Keep the reason under 2,000 characters.');
 const member=(id:string|null|undefined)=>{if(id&&!members.some(m=>m.id===id&&m.workspaceId===ctx.workspaceId&&m.active&&m.role!=='VIEWER'))throw Error('Choose an active non-Viewer member in this organization.');return id??null;};
 let next:OpenQuestion;let type:QuestionEventType;
 if(cmd.operation==='CREATE'){
  const question=(cmd.question??'').trim();if(!question||question.length>300)throw Error('Ask a question of 1–300 characters.');
  if(cmd.dueDate&&!dateValid(cmd.dueDate))throw Error('Use a valid due date or leave it unknown.');
  const origin=cmd.origin??'HUMAN_ENTRY';if(!['HUMAN_ENTRY','CONFIRMED_AI_PROPOSAL','MEETING','WEEKLY_REVIEW'].includes(origin)||origin!=='HUMAN_ENTRY'&&!cmd.originRefId)throw Error('A supported origin reference is required.');
  if(origin!=='HUMAN_ENTRY'){const existing=questions.find(q=>q.workspaceId===ctx.workspaceId&&q.origin===origin&&q.originRefId===cmd.originRefId);if(existing)return {question:existing,event:null};}
  const confirmer=(cmd.expectedConfirmerText??'').trim()||null;if(confirmer&&confirmer.length>200)throw Error('Keep the expected confirmer under 200 characters.');
  next={id:randomUUID(),workspaceId:ctx.workspaceId,initiativeId:initiative.id,question,ownerMemberId:member(cmd.ownerMemberId),expectedConfirmerText:confirmer,dueDate:cmd.dueDate||null,status:'OPEN',origin,originRefId:origin==='HUMAN_ENTRY'?null:cmd.originRefId!,originHref:origin==='HUMAN_ENTRY'?null:cmd.originHref??null,originLabel:origin==='HUMAN_ENTRY'?null:(cmd.originLabel??'').trim().slice(0,200)||null,evidenceId:cmd.evidenceId??null,evidenceAnchorId:cmd.evidenceAnchorId??null,answerClaimId:null,answerNote:null,resolutionReason:null,createdBy:ctx.actor.id,createdByLabel:ctx.actor.label,createdAt:at,updatedAt:at,resolvedBy:null,resolvedByLabel:null,resolvedAt:null,revision:1};
  type='OPENED';
 }else{
  const prior=before!;
  if(cmd.operation==='EDIT'){
   if(prior.status!=='OPEN')throw Error('Only an open question can be edited. Reopen it first.');
   if(!authority(ctx,prior,ownerId,'DETAILS'))throw Error('Only the creator, the initiative owner, a Product Lead or administration can edit this question.');
   const question=(cmd.question??prior.question).trim();if(!question||question.length>300)throw Error('Ask a question of 1–300 characters.');
   const due=cmd.dueDate===undefined?prior.dueDate:cmd.dueDate||null;if(due&&!dateValid(due))throw Error('Use a valid due date or leave it unknown.');
   const confirmer=cmd.expectedConfirmerText===undefined?prior.expectedConfirmerText:(cmd.expectedConfirmerText??'').trim()||null;
   next={...prior,question,dueDate:due,ownerMemberId:cmd.ownerMemberId===undefined?prior.ownerMemberId:member(cmd.ownerMemberId),expectedConfirmerText:confirmer};type='UPDATED';
   if(JSON.stringify(next)===JSON.stringify(prior))throw Error('Nothing changed.');
  }else{
   if(!authority(ctx,prior,ownerId,'RESOLVE'))throw Error('Only the question owner, the initiative owner, a Product Lead or administration can resolve this question.');
   if(cmd.operation==='ANSWER'){
    if(prior.status!=='OPEN')throw Error('This question is no longer open.');
    const note=(cmd.answerNote??'').trim()||null,claimId=cmd.answerClaimId||null;
    if(!note&&!claimId)throw Error('Record an answer note or link a confirmed Knowledge entry.');
    if(note&&note.length>2000)throw Error('Keep the answer under 2,000 characters.');
    if(claimId){const c=claims.find(c=>c.id===claimId&&c.initiativeId===initiative.id);if(!c||c.status!=='ACTIVE')throw Error('Only a confirmed (active) Knowledge entry in this initiative can answer a question. Unverified entries cannot be linked.');}
    next={...prior,status:'ANSWERED',answerNote:note,answerClaimId:claimId,resolutionReason:null,resolvedBy:ctx.actor.id,resolvedByLabel:ctx.actor.label,resolvedAt:at};type='ANSWERED';
   }else if(cmd.operation==='WITHDRAW'){
    if(prior.status!=='OPEN')throw Error('This question is no longer open.');
    if(!reason)throw Error('Say why this question is no longer relevant.');
    next={...prior,status:'WITHDRAWN',resolutionReason:reason,resolvedBy:ctx.actor.id,resolvedByLabel:ctx.actor.label,resolvedAt:at};type='WITHDRAWN';
   }else{
    if(prior.status==='OPEN')throw Error('This question is already open.');
    if(!reason)throw Error('Say why this question is being reopened.');
    // The earlier answer stays in the event history; reopening never erases it.
    next={...prior,status:'OPEN',answerNote:null,answerClaimId:null,resolutionReason:null,resolvedBy:null,resolvedByLabel:null,resolvedAt:null};type='REOPENED';
   }
  }
  next={...next,updatedAt:at,revision:prior.revision+1};
 }
 const event:QuestionEvent={id:randomUUID(),workspaceId:ctx.workspaceId,initiativeId:initiative.id,questionId:next.id,seq:next.revision,type,before:before??null,after:next,note:reason,actor:ctx.actor,at,requestId:cmd.requestId};
 return {question:next,event};
}

/** Days overdue against a calendar date (no timezone); null when no due date or not open. */
export function questionOverdueDays(q:Pick<OpenQuestion,'status'|'dueDate'>,today:string):number|null{
 if(q.status!=='OPEN'||!q.dueDate)return null;const d=Math.round((Date.parse(today.slice(0,10))-Date.parse(q.dueDate))/86_400_000);return d>0?d:null;
}
