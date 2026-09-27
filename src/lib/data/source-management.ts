import 'server-only';
import {requireBusinessWriteAccess} from '@/lib/auth/access';
import {adminClient,isLocalAuth} from '@/lib/auth/service';
import {withRepositoryContext} from '@/lib/auth/repository-context';
import {readDeliveryFresh,withLocalOwnerLock} from '@/lib/delivery/repository';
import {ownerFor} from '@/lib/delivery/model';
import {assertManagementWrite} from '@/lib/workspace/management-policy';
import {mapSourceItems,reviseSourceMapping,type SourceMapInput,type SourceRevisionInput} from '@/lib/workspace/source-mapping';
import {writeStoreAtomic} from './store';

export async function changeSourceMapping(input:SourceRevisionInput,workspaceId:string):Promise<void>{
 const ctx=await requireBusinessWriteAccess();if(ctx.workspaceId!==workspaceId)throw new Error('Your organization changed. Reload before saving.');
 if(isLocalAuth()){
  await withRepositoryContext(ctx,async()=>withLocalOwnerLock(ctx,state=>writeStoreAtomic(s=>{
   const i=s.initiatives.find(x=>x.id===input.initiativeId&&x.workspaceId===ctx.workspaceId);if(!i)throw new Error('Initiative unavailable.');
   const mapping=s.sourceMappings?.find(m=>m.id===input.mappingId&&m.workspaceId===ctx.workspaceId&&m.initiativeId===i.id);
   if(!mapping)throw new Error('Source mapping unavailable.');
   const owner=ownerFor(state.facts,i.id);
   assertManagementWrite(ctx,input.action==='UNLINK'?'SOURCE_UNLINK':'SOURCE_LINK',i,owner,undefined,mapping.linkedBy);
   const next=reviseSourceMapping({containers:s.sourceContainers??[],items:s.sourceItems??[],mappings:s.sourceMappings??[],events:[]},ctx,input,owner,new Date().toISOString());
   s.sourceMappings=next.mappings;
   for(const event of next.events)s.activity.push({id:event.id,workspaceId:ctx.workspaceId,initiativeId:i.id,eventType:`SOURCE_${input.action}`,summary:input.action==='UNLINK'?'Source unlinked; evidence retained':input.action==='RELINK'?'Source explicitly relinked':'Source role changed',occurredAt:event.at,entityType:'SOURCE_MAPPING',entityId:event.mappingId,payload:{before:event.before,after:event.after,reason:input.reason.trim(),actor:ctx.actor},actorLabel:ctx.actor.label});
  })));return;
 }
 const {error}=await adminClient().rpc('revise_initiative_source',{p_workspace_id:ctx.workspaceId,p_member_id:ctx.memberId??ctx.actor.id,p_input:input});
 if(error)throw new Error(error.message.includes('STALE')?'This source mapping changed. Reload and review before saving.':'The source change was refused. Reload and check your access.');
}

export async function linkSourceItems(input:SourceMapInput,workspaceId:string):Promise<void>{
 const ctx=await requireBusinessWriteAccess();if(ctx.workspaceId!==workspaceId)throw new Error('Your organization changed. Reload before saving.');
 const d=await readDeliveryFresh(),i=d.source.snapshots.find(s=>s.initiative.id===input.initiativeId)?.initiative;
 if(!i)throw new Error('This initiative is unavailable in your organization.');
 assertManagementWrite(ctx,'SOURCE_LINK',{...i,workspaceId:ctx.workspaceId},ownerFor(d.state.facts,i.id));
 // Validate every proposed reference before either adapter writes anything.
 mapSourceItems({containers:[],items:[],mappings:[],events:[]},ctx,input,new Date().toISOString());
 if(isLocalAuth()){
  await withRepositoryContext(ctx,async()=>writeStoreAtomic(s=>{
   const current=s.initiatives.find(x=>x.id===i.id&&x.workspaceId===ctx.workspaceId);if(!current)throw new Error('Initiative unavailable.');
   assertManagementWrite(ctx,'SOURCE_LINK',current,null);
   const next=mapSourceItems({containers:s.sourceContainers??[],items:s.sourceItems??[],mappings:s.sourceMappings??[],events:[]},ctx,input,new Date().toISOString());
   s.sourceContainers=next.containers;s.sourceItems=next.items;s.sourceMappings=next.mappings;
   for(const event of next.events)s.activity.push({id:event.id,workspaceId:ctx.workspaceId,initiativeId:i.id,eventType:'SOURCE_MAPPED',summary:'Source item mapped to initiative',occurredAt:event.at,entityType:'SOURCE_MAPPING',entityId:event.mappingId,payload:{before:event.before,after:event.after,actor:ctx.actor},actorLabel:ctx.actor.label});
  }));return;
 }
 const {error}=await adminClient().rpc('map_initiative_sources',{p_workspace_id:ctx.workspaceId,p_member_id:ctx.memberId??ctx.actor.id,p_input:input});
 if(error)throw new Error(error.message.includes('RELINK')?'This source was previously unlinked. Review its history before relinking.':'The source mapping was refused. Reload and check your access.');
}
