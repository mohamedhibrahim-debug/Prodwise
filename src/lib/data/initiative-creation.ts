import 'server-only';
import {randomUUID} from 'node:crypto';
import {requireBusinessWriteAccess} from '@/lib/auth/access';
import {isLocalAuth,adminClient,configuredWorkspaceId} from '@/lib/auth/service';
import {withRepositoryContext} from '@/lib/auth/repository-context';
import {readDeliveryFresh,withLocalOwnerLock} from '@/lib/delivery/repository';
import {digest} from '@/lib/delivery/model';
import {localDeliveryPath} from '@/lib/delivery/local-path';
import {prepareInitiativeCreation,type InitiativeCreation} from '@/lib/workspace/initiative-creation';
import {readStore,writeStoreWithDelivery} from './store';
export async function createManagedInitiative(input:InitiativeCreation,workspaceId:string):Promise<string>{
 const ctx=await requireBusinessWriteAccess();if(ctx.workspaceId!==workspaceId)throw new Error('Your organization changed. Reload before saving.');
 if(!isLocalAuth()){
  const {data,error}=await adminClient().rpc('create_managed_initiative',{p_workspace_id:ctx.workspaceId,p_member_id:ctx.memberId??ctx.actor.id,p_input:input});
  if(error)throw new Error(error.message.includes('DUPLICATE_NAME')?'An initiative with this name already exists. Open it from Initiatives or use a distinct name.':error.message.includes('OWNER')?'Choose an active owner you are allowed to assign in this organization.':'Creation was refused. Check the fields and your access, then retry.');
  return String(data);
 }
 const d=await readDeliveryFresh();
 return withRepositoryContext(ctx,async()=>withLocalOwnerLock(ctx,state=>{
  const store=readStore(),inputDigest=digest(input),prior=store.creationCommands?.find(c=>c.workspaceId===ctx.workspaceId&&c.requestId===input.requestId);
  if(prior){if(prior.actorId!==ctx.actor.id||prior.inputDigest!==inputDigest)throw new Error('This creation request was already used. Reload before creating another initiative.');const existing=store.initiatives.find(i=>i.id===prior.initiativeId);if(!existing)throw new Error('Creation recovery is required.');return existing.slug;}
  const at=new Date().toISOString(),plan=prepareInitiativeCreation(input,ctx,d.source.members,store.initiatives,at);
  const next={...state,facts:[...state.facts,plan.owner],events:[...state.events,plan.ownerEvent]};
  return writeStoreWithDelivery(localDeliveryPath(process.cwd(),ctx.workspaceId,configuredWorkspaceId()),next,s=>{
   s.initiatives.push(plan.initiative);if(plan.context)(s.contexts??=[]).push(plan.context);
   (s.creationCommands??=[]).push({workspaceId:ctx.workspaceId,requestId:input.requestId,initiativeId:plan.initiative.id,actorId:ctx.actor.id,inputDigest});
   s.activity.push({id:randomUUID(),workspaceId:ctx.workspaceId,initiativeId:plan.initiative.id,eventType:'INITIATIVE_CREATED',summary:'Initiative created with a primary owner; setup continues',occurredAt:at,entityType:'INITIATIVE',entityId:plan.initiative.id,payload:{ownerMemberId:input.ownerMemberId,stage:input.stage,currentContextId:plan.context?.id??null,actor:ctx.actor},actorLabel:ctx.actor.label});
   return plan.initiative.slug;
  });
 }));
}
