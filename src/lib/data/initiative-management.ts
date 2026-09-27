import 'server-only';
import {randomUUID} from 'node:crypto';
import {requireBusinessWriteAccess} from '@/lib/auth/access';
import {adminClient,isLocalAuth} from '@/lib/auth/service';
import {withRepositoryContext} from '@/lib/auth/repository-context';
import {readDeliveryFresh,withLocalOwnerLock} from '@/lib/delivery/repository';
import {ownerFor} from '@/lib/delivery/model';
import {BUSINESS_LINES,type BusinessLine} from '@/lib/domain/types';
import {assertManagementWrite} from '@/lib/workspace/management-policy';
import {writeStoreAtomic} from './store';
import {changeContext,type ContextChange} from '@/lib/workspace/context-management';

export async function setInitiativeArchive(input:{workspaceId:string;initiativeId:string;expectedUpdatedAt:string;archive:boolean;reason:string;confirmedName:string}):Promise<void>{
 const ctx=await requireBusinessWriteAccess();if(ctx.workspaceId!==input.workspaceId)throw new Error('Your organization changed. Reload before saving.');
 const reason=input.reason.trim();if(!reason||reason.length>2000)throw new Error('Record a reason up to 2,000 characters.');
 if(isLocalAuth()){
  await withRepositoryContext(ctx,async()=>withLocalOwnerLock(ctx,()=>writeStoreAtomic(s=>{
   const i=s.initiatives.find(x=>x.id===input.initiativeId&&x.workspaceId===ctx.workspaceId);if(!i)throw new Error('Initiative unavailable.');
   assertManagementWrite(ctx,input.archive?'ARCHIVE':'RESTORE',i,null,input.expectedUpdatedAt);
   if(Boolean(i.archivedAt)===input.archive)throw new Error(input.archive?'Already archived.':'This initiative is already active.');
   if(input.archive&&input.confirmedName.trim()!==i.name)throw new Error('Type the initiative name to confirm archival.');
   const at=new Date(Math.max(Date.now(),Date.parse(i.updatedAt)+1)).toISOString(),before={archivedAt:i.archivedAt??null,archiveReason:i.archiveReason??null};
   Object.assign(i,{archivedAt:input.archive?at:null,archivedBy:input.archive?ctx.actor.id:null,archiveReason:input.archive?reason:null,updatedAt:at});
   s.activity.push({id:randomUUID(),workspaceId:ctx.workspaceId,initiativeId:i.id,eventType:input.archive?'INITIATIVE_ARCHIVED':'INITIATIVE_RESTORED',summary:input.archive?'Initiative archived; records and history preserved':'Initiative restored to the active portfolio',occurredAt:at,entityType:'INITIATIVE',entityId:i.id,payload:{before,after:{archivedAt:i.archivedAt,archiveReason:i.archiveReason},reason,actor:ctx.actor},actorLabel:ctx.actor.label});
  })));return;
 }
 const {error}=await adminClient().rpc('set_initiative_archive',{p_workspace_id:ctx.workspaceId,p_member_id:ctx.memberId??ctx.actor.id,p_initiative_id:input.initiativeId,p_expected_updated_at:input.expectedUpdatedAt,p_archive:input.archive,p_reason:reason,p_confirmed_name:input.confirmedName});
 if(error)throw new Error(error.message.includes('STALE')?'This initiative changed. Reload and review before continuing.':'The archive change was refused. Check your access and confirmation.');
}

export async function updateInitiativeContext(input:ContextChange,workspaceId:string):Promise<void>{
 const ctx=await requireBusinessWriteAccess();if(ctx.workspaceId!==workspaceId)throw new Error('Your organization changed. Reload before saving.');
 if(isLocalAuth()){
  await withRepositoryContext(ctx,async()=>withLocalOwnerLock(ctx,state=>writeStoreAtomic(s=>{
   const i=s.initiatives.find(x=>x.id===input.initiativeId&&x.workspaceId===ctx.workspaceId);if(!i)throw new Error('Initiative unavailable.');
   const at=new Date(Math.max(Date.now(),Date.parse(i.updatedAt)+1)).toISOString();
   const next=changeContext(i,s.contexts??[],ctx,ownerFor(state.facts,i.id),input,at);
   s.initiatives=s.initiatives.map(x=>x.id===i.id?next.initiative:x);s.contexts=next.contexts;
   s.activity.push({id:randomUUID(),workspaceId:ctx.workspaceId,initiativeId:i.id,eventType:`CONTEXT_${input.operation}`,summary:input.operation==='RETIRE'?`Retired scope: ${next.after.label}`:input.operation==='RENAME'?`Renamed scope to ${next.after.label}`:`Current scope: ${next.after.label}`,occurredAt:at,entityType:'INITIATIVE_CONTEXT',entityId:next.after.id,payload:{before:next.before,after:next.after,previousCurrentContextId:i.currentContextId??null,currentContextId:next.initiative.currentContextId,reason:next.reason,actor:ctx.actor},actorLabel:ctx.actor.label});
  })));return;
 }
 const {error}=await adminClient().rpc('change_initiative_context',{p_workspace_id:ctx.workspaceId,p_member_id:ctx.memberId??ctx.actor.id,p_input:input});
 if(error)throw new Error(error.message.includes('STALE')?'The initiative or context changed. Reload and review before saving.':'The context change was refused. Check your access and the current context.');
}

export interface BasicsEdit {workspaceId:string;initiativeId:string;expectedUpdatedAt:string;name:string;businessLine:BusinessLine;description:string;}
export async function updateInitiativeBasics(input:BasicsEdit):Promise<void>{
  const ctx=await requireBusinessWriteAccess();
  if(ctx.workspaceId!==input.workspaceId)throw new Error('Your organization changed. Reload before saving.');
  const name=input.name.trim(),description=input.description.trim();
  if(!name||name.length>160||description.length>4000||!BUSINESS_LINES.includes(input.businessLine))throw new Error('Enter a name (up to 160 characters), business line and an objective up to 4,000 characters.');
  const d=await readDeliveryFresh();
  const current=d.source.snapshots.find(s=>s.initiative.id===input.initiativeId)?.initiative;
  if(!current)throw new Error('This initiative is unavailable in your organization.');
  const owner=ownerFor(d.state.facts,input.initiativeId);
  assertManagementWrite(ctx,'BASICS',{...current,workspaceId:ctx.workspaceId},owner,input.expectedUpdatedAt);
  if(isLocalAuth()){
    await withRepositoryContext(ctx,async()=>withLocalOwnerLock(ctx,state=>writeStoreAtomic(store=>{
      const i=store.initiatives.find(x=>x.id===input.initiativeId&&x.workspaceId===ctx.workspaceId);
      if(!i)throw new Error('This initiative is unavailable in your organization.');
      assertManagementWrite(ctx,'BASICS',i,ownerFor(state.facts,i.id),input.expectedUpdatedAt);
      const before={name:i.name,businessLine:i.businessLine,description:i.description};
      const after={name,businessLine:input.businessLine,description:description||null};
      if(JSON.stringify(before)===JSON.stringify(after))return;
      const at=new Date(Math.max(Date.now(),Date.parse(i.updatedAt)+1)).toISOString();Object.assign(i,after,{updatedAt:at});
      store.activity.push({id:randomUUID(),workspaceId:ctx.workspaceId,initiativeId:i.id,eventType:'INITIATIVE_BASICS_CHANGED',summary:before.name!==name?`Renamed from ${before.name}`:'Initiative purpose and business context updated',occurredAt:at,entityType:'INITIATIVE',entityId:i.id,payload:{before,after,actor:ctx.actor},actorLabel:ctx.actor.label});
    })));
    return;
  }
  const {error}=await adminClient().rpc('update_initiative_basics',{p_workspace_id:ctx.workspaceId,p_member_id:ctx.memberId??ctx.actor.id,p_initiative_id:input.initiativeId,p_expected_updated_at:input.expectedUpdatedAt,p_name:name,p_business_line:input.businessLine,p_description:description||null});
  if(error)throw new Error(error.message.includes('STALE')?'This initiative changed while you were editing. Reload and review the latest values.':'The edit was refused. Check your access and reload.');
}
