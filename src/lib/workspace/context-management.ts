import {randomUUID} from 'node:crypto';
import type {WorkspaceAccess} from '../auth/core.ts';
import type {Initiative} from '../domain/types.ts';
import type {InitiativeContext} from './readiness.ts';
import {assertManagementWrite} from './management-policy.ts';

export interface ContextChange {initiativeId:string;expectedUpdatedAt:string;operation:'CREATE'|'SELECT'|'RENAME'|'RETIRE';contextId?:string;expectedRevision?:number;label?:string;note?:string;reason:string;}
export function changeContext(initiative:Initiative,contexts:InitiativeContext[],ctx:WorkspaceAccess,ownerId:string|null,input:ContextChange,at:string){
 assertManagementWrite(ctx,'CONTEXT',initiative,ownerId,input.expectedUpdatedAt);
 if(initiative.id!==input.initiativeId)throw new Error('Initiative unavailable.');
 if(!['CREATE','SELECT','RENAME','RETIRE'].includes(input.operation))throw new Error('Choose a supported context change.');
 const reason=input.reason.trim();if(!reason||reason.length>2000)throw new Error('Record a reason for this scope change (up to 2,000 characters).');
 const before=input.contextId?contexts.find(c=>c.id===input.contextId&&c.workspaceId===ctx.workspaceId&&c.initiativeId===initiative.id):undefined;
 if(input.operation!=='CREATE'&&!before)throw new Error('Context unavailable in this initiative.');
 if(before&&before.revision!==input.expectedRevision)throw new Error('This context changed while you were editing. Reload and review.');
 if(before?.retiredAt)throw new Error('This context is retired. Its history is preserved.');
 let after:InitiativeContext;
 if(input.operation==='CREATE'||input.operation==='RENAME'){
  const label=input.label?.trim(),note=input.note?.trim()||null;
  if(!label||label.length>160||(note?.length??0)>4000)throw new Error('Enter a context label up to 160 characters and an optional note up to 4,000 characters.');
  if(contexts.some(c=>c.workspaceId===ctx.workspaceId&&c.initiativeId===initiative.id&&!c.retiredAt&&c.id!==before?.id&&c.label.trim().normalize('NFKC').toLowerCase()===label.normalize('NFKC').toLowerCase()))throw new Error('An active context already has this label. Select it instead.');
  after=before?{...before,label,note,revision:before.revision+1,updatedAt:at}:{id:randomUUID(),workspaceId:ctx.workspaceId,initiativeId:initiative.id,label,note,revision:1,createdAt:at,updatedAt:at,retiredAt:null};
 }else after=input.operation==='RETIRE'?{...before!,revision:before!.revision+1,updatedAt:at,retiredAt:at}:before!;
 const nextInitiative={...initiative,updatedAt:at,currentContextId:input.operation==='CREATE'||input.operation==='SELECT'?after.id:input.operation==='RETIRE'&&initiative.currentContextId===after.id?null:initiative.currentContextId};
 return {initiative:nextInitiative,contexts:before?contexts.map(c=>c.id===before.id?after:c):[...contexts,after],before:before??null,after,reason};
}
