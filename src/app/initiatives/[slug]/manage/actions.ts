'use server';
import { safeMessage } from '@/lib/errors/safe-message';
import {revalidatePath} from 'next/cache';
import {assertFormWorkspace} from '@/lib/auth/scope';
import {requireBusinessWriteAccess} from '@/lib/auth/access';
import {updateInitiativeBasics,updateInitiativeContext,setInitiativeArchive} from '@/lib/data/initiative-management';
import {updateInitiativeStage} from '@/lib/workspace/stage';
import type {Stage} from '@/lib/domain/types';
import {readManagement} from '@/lib/data/management-read';
import {getRepository} from '@/lib/data';
import type {BusinessLine} from '@/lib/domain/types';
import {linkSourceItems,changeSourceMapping} from '@/lib/data/source-management';
import type {SourceMapInput,SourceProvider,SourceRole} from '@/lib/workspace/source-mapping';
export interface ManageActionState {error:string|null;message:string|null;}
export async function changeLifecycleAction(_previous:ManageActionState,form:FormData):Promise<ManageActionState>{
 try{
  const ctx=await requireBusinessWriteAccess();assertFormWorkspace(form,ctx);const i=await getRepository().getInitiativeBySlug(String(form.get('slug')??''));if(!i)throw new Error('Initiative unavailable.');
  const operation=String(form.get('operation')),expectedUpdatedAt=String(form.get('expectedUpdatedAt')??''),reason=String(form.get('reason')??'');
  if(operation==='STAGE')await updateInitiativeStage({initiativeId:i.id,scopeWorkspaceId:ctx.workspaceId,expectedUpdatedAt,reason,stage:String(form.get('stage')) as Stage});
  else if(operation==='ARCHIVE'||operation==='RESTORE')await setInitiativeArchive({workspaceId:ctx.workspaceId,initiativeId:i.id,expectedUpdatedAt,reason,archive:operation==='ARCHIVE',confirmedName:String(form.get('confirmedName')??'')});
  else throw new Error('Choose a supported lifecycle change.');
  revalidatePath('/initiatives','layout');revalidatePath('/');revalidatePath('/roadmap');revalidatePath('/analysis','layout');revalidatePath('/weekly-review');
  return {error:null,message:operation==='ARCHIVE'?'Archived. Records and history are preserved.':operation==='RESTORE'?'Restored to the active portfolio.':'Lifecycle stage saved with its reason.'};
 }catch(error){return {error:safeMessage(error, 'The lifecycle change was refused.'),message:null};}
}
export async function saveContextAction(_previous:ManageActionState,form:FormData):Promise<ManageActionState>{
 try{
  const ctx=await requireBusinessWriteAccess();assertFormWorkspace(form,ctx);
  const i=await getRepository().getInitiativeBySlug(String(form.get('slug')??''));if(!i)throw new Error('Initiative unavailable.');
  const operation=String(form.get('operation'));if(operation!=='CREATE'&&operation!=='SELECT'&&operation!=='RENAME'&&operation!=='RETIRE')throw new Error('Choose a supported context change.');
  await updateInitiativeContext({initiativeId:i.id,expectedUpdatedAt:String(form.get('expectedUpdatedAt')??''),operation,contextId:String(form.get('contextId')??'')||undefined,expectedRevision:Number(form.get('expectedRevision'))||undefined,label:String(form.get('label')??''),note:String(form.get('note')??''),reason:String(form.get('reason')??'')},ctx.workspaceId);
  revalidatePath('/initiatives','layout');revalidatePath('/');revalidatePath('/analysis','layout');
  return {error:null,message:'Scope context saved. Earlier labels and changes remain in history.'};
 }catch(error){return {error:safeMessage(error, 'The context change could not be saved.'),message:null};}
}
export async function reviseSourceAction(_previous:ManageActionState,form:FormData):Promise<ManageActionState>{
 try{
  const ctx=await requireBusinessWriteAccess();assertFormWorkspace(form,ctx);
  const i=await getRepository().getInitiativeBySlug(String(form.get('slug')??''));
  if(!i)throw new Error('This initiative is unavailable in your organization.');
  const action=String(form.get('operation'));
  if(action!=='UNLINK'&&action!=='RELINK'&&action!=='ROLE')throw new Error('Choose a supported change.');
  const revision=Number(form.get('expectedRevision'));if(!Number.isSafeInteger(revision)||revision<1)throw new Error('Reload this source before saving.');
  await changeSourceMapping({initiativeId:i.id,mappingId:String(form.get('mappingId')??''),expectedRevision:revision,action,role:String(form.get('role')) as SourceRole,reason:String(form.get('reason')??'')},ctx.workspaceId);
  revalidatePath('/initiatives','layout');revalidatePath('/sources','layout');revalidatePath('/');
  return {error:null,message:action==='UNLINK'?'Source unlinked. Evidence and history are preserved.':action==='RELINK'?'Source relinked. Previous unlink history is preserved.':'Source role updated.'};
 }catch(error){return {error:safeMessage(error, 'The source change could not be saved.'),message:null};}
}
export async function mapSourcesAction(_previous:ManageActionState,form:FormData):Promise<ManageActionState>{
 try{
  const ctx=await requireBusinessWriteAccess();assertFormWorkspace(form,ctx);
  const slug=String(form.get('slug')??''),i=await getRepository().getInitiativeBySlug(slug);
  if(!i)throw new Error('This initiative is unavailable in your organization.');
  const raw=String(form.get('items')??'');if(raw.length>50000)throw new Error('Map at most 25 references at a time.');
  const items=JSON.parse(raw) as SourceMapInput['items'];if(!Array.isArray(items)||items.some(x=>!x||typeof x.reference!=='string'||typeof x.name!=='string'||typeof x.kind!=='string'||(x.url!==null&&typeof x.url!=='string')))throw new Error('Review each source reference.');
  await linkSourceItems({initiativeId:i.id,provider:String(form.get('provider')) as SourceProvider,providerWorkspace:String(form.get('providerWorkspace')??''),containerReference:String(form.get('containerReference')??''),containerName:String(form.get('containerName')??''),role:String(form.get('role')) as SourceRole,items},ctx.workspaceId);
  revalidatePath('/initiatives','layout');revalidatePath('/sources','layout');revalidatePath('/');
  return {error:null,message:'Source items linked. These are manual references; add their content before using them as evidence.'};
 }catch(error){return {error:safeMessage(error, 'The source mapping could not be saved.'),message:null};}
}
export async function saveInitiativeBasics(_previous:ManageActionState,form:FormData):Promise<ManageActionState>{
 try{
  const ctx=await requireBusinessWriteAccess();assertFormWorkspace(form,ctx);
  const slug=String(form.get('slug')??'');const i=await getRepository().getInitiativeBySlug(slug);
  if(!i)throw new Error('This initiative is unavailable in your organization.');
  await updateInitiativeBasics({workspaceId:ctx.workspaceId,initiativeId:i.id,expectedUpdatedAt:String(form.get('expectedUpdatedAt')??''),name:String(form.get('name')??''),businessLine:String(form.get('businessLine')??'') as BusinessLine,description:String(form.get('description')??'')});
  revalidatePath('/initiatives','layout');revalidatePath('/');revalidatePath('/analysis','layout');revalidatePath('/weekly-review');
  return {error:null,message:'Basics saved. The initiative link stays the same; history preserves your change.'};
 }catch(error){return {error:safeMessage(error, 'The edit could not be saved.'),message:null};}
}

export async function mapExistingSourceAction(_previous:ManageActionState,form:FormData):Promise<ManageActionState>{
 try{
  const ctx=await requireBusinessWriteAccess();assertFormWorkspace(form,ctx);
  const [m,i]=await Promise.all([readManagement(),getRepository().getInitiativeBySlug(String(form.get('slug')??''))]);
  const item=m.items.find(x=>x.id===String(form.get('itemId'))&&x.workspaceId===ctx.workspaceId),container=m.containers.find(x=>x.id===item?.containerId&&x.workspaceId===ctx.workspaceId);
  if(!item||!container||!i)throw new Error('The source or initiative is unavailable in this organization.');
  await linkSourceItems({initiativeId:i.id,provider:container.provider,providerWorkspace:container.providerWorkspace,containerReference:container.reference,containerName:container.name,role:String(form.get('role')) as SourceRole,items:[{reference:item.reference,name:item.name,kind:item.kind,url:item.url}]},ctx.workspaceId);
  revalidatePath('/sources','layout');revalidatePath('/initiatives','layout');revalidatePath('/');return {error:null,message:'Source mapped. The existing reference and its history are retained.'};
 }catch(error){return {error:safeMessage(error, 'The source could not be mapped.'),message:null};}
}
