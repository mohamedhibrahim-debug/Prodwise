'use server';
import {revalidatePath} from 'next/cache';
import {assertFormWorkspace} from '@/lib/auth/scope';
import {requireBusinessWriteAccess} from '@/lib/auth/access';
import {saveRelationship,confirmRelationshipProposal} from '@/lib/data/relationships';
import {RELATIONSHIP_TYPES,DATE_FACTS,type DateFact,type RelationshipType} from '@/lib/workspace/relationships';
export interface RelationshipActionState {error:string|null;message:string|null;id?:string;}
const dateFact=(v:FormDataEntryValue|null):DateFact|null=>DATE_FACTS.includes(String(v) as DateFact)?String(v) as DateFact:null;
const relType=(v:FormDataEntryValue|null):RelationshipType=>{const t=String(v);if(!RELATIONSHIP_TYPES.includes(t as RelationshipType))throw Error('Choose how these initiatives relate.');return t as RelationshipType;};
function refresh(){revalidatePath('/','layout');}
export async function relationshipAction(_previous:RelationshipActionState,form:FormData):Promise<RelationshipActionState>{
 const text=(k:string)=>String(form.get(k)??'');
 try{
  const ctx=await requireBusinessWriteAccess();assertFormWorkspace(form,ctx);const operation=text('operation');const dates=form.get('withDates')==='on';
  if(operation==='CREATE'){const id=await saveRelationship({operation:'CREATE',requestId:text('requestId'),expectedRevision:0,fromInitiativeId:text('fromInitiativeId'),toInitiativeId:text('toInitiativeId'),type:relType(form.get('type')),rationale:text('rationale'),providerFactKind:dates?dateFact(form.get('providerFactKind')):null,neededByFactKind:dates?dateFact(form.get('neededByFactKind')):null});return {error:null,message:'Relationship recorded.',id};}
  if(operation==='UPDATE'){await saveRelationship({operation:'UPDATE',id:text('id'),requestId:text('requestId'),expectedRevision:Number(text('expectedRevision')),rationale:text('rationale'),providerFactKind:dates?dateFact(form.get('providerFactKind')):null,neededByFactKind:dates?dateFact(form.get('neededByFactKind')):null});return {error:null,message:'Relationship updated.'};}
  if(operation==='END'){await saveRelationship({operation:'END',id:text('id'),requestId:text('requestId'),expectedRevision:Number(text('expectedRevision')),reason:text('reason')});return {error:null,message:'Relationship ended. It stays in history.'};}
  if(operation==='CONFIRM_PROPOSAL'){const id=await confirmRelationshipProposal({proposalId:text('proposalId'),version:Number(text('version')),requestId:text('requestId'),type:relType(form.get('type')),rationale:text('rationale'),providerFactKind:dates?dateFact(form.get('providerFactKind')):null,neededByFactKind:dates?dateFact(form.get('neededByFactKind')):null});return {error:null,message:'Relationship confirmed from this evidence.',id};}
  throw Error('Unsupported relationship command.');
 }catch(e){return {error:e instanceof Error?e.message:'The relationship was not saved.',message:null};}
 finally{refresh();}
}
