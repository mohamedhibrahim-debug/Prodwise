import 'server-only';
import {randomUUID} from 'node:crypto';
import {cache} from 'react';
import {requireWorkspaceAccess,requireBusinessWriteAccess} from '@/lib/auth/access';
import {isLocalAuth} from '@/lib/auth/service';
import {withRepositoryContext} from '@/lib/auth/repository-context';
import {withLocalOwnerLock} from '@/lib/delivery/repository';
import {ownerFor} from '@/lib/delivery/model';
import {verifyAnchor} from '@/lib/evidence/anchor';
import {reviseRelationship,type InitiativeRelationship,type RelationshipCommand,type RelationshipEvent,type DateFact,type RelationshipType} from '@/lib/workspace/relationships';
import {readStore,writeStoreAtomic} from './store';
import {p1Rpc} from './p1-rpc';

export interface RelationshipRead {relationships:InitiativeRelationship[];events:RelationshipEvent[];}
export const readRelationships=cache(async():Promise<RelationshipRead>=>{
 const ctx=await requireWorkspaceAccess();
 if(isLocalAuth())return withRepositoryContext(ctx,async()=>{const s=readStore();return {relationships:s.relationships??[],events:s.relationshipEvents??[]};});
 return p1Rpc<RelationshipRead>(ctx,'read_relationships',{});
});

export async function saveRelationship(cmd:RelationshipCommand):Promise<string>{
 const ctx=await requireBusinessWriteAccess();
 if(!isLocalAuth())return p1Rpc<string>(ctx,'save_relationship',{p_input:cmd});
 return withRepositoryContext(ctx,async()=>withLocalOwnerLock(ctx,delivery=>writeStoreAtomic(s=>{
  const r=reviseRelationship(s.relationships??[],s.relationshipEvents??[],cmd,ctx,s.initiatives,id=>ownerFor(delivery.facts,id),new Date().toISOString());
  if(!r.event)return r.relationship.id;
  const list=(s.relationships??=[]);const at=list.findIndex(x=>x.id===r.relationship.id);if(at>=0)list[at]=r.relationship;else list.push(r.relationship);
  (s.relationshipEvents??=[]).push(r.event);
  const name=(id:string)=>s.initiatives.find(i=>i.id===id)?.name??'another initiative';
  const summary=`${name(r.relationship.fromInitiativeId)} ${r.relationship.type==='DEPENDS_ON'?'depends on':r.relationship.type==='PART_OF'?'is part of':'is related to'} ${name(r.relationship.toInitiativeId)} · ${r.event.type==='CONFIRMED'?'confirmed':r.event.type==='ENDED'?'ended':'updated'}`;
  for(const initiativeId of new Set([r.relationship.fromInitiativeId,r.relationship.toInitiativeId]))s.activity.push({id:randomUUID(),workspaceId:ctx.workspaceId,initiativeId,eventType:`RELATIONSHIP_${r.event.type}`,summary,occurredAt:r.event.at,entityType:'RELATIONSHIP',entityId:r.relationship.id,actorLabel:ctx.actor.label,payload:{relationshipId:r.relationship.id,note:r.event.note}});
  return r.relationship.id;
 })));
}

/** A RELATIONSHIP proposal becomes canonical only here: the person picks the type and says why. */
export async function confirmRelationshipProposal(input:{proposalId:string;version:number;requestId:string;type:RelationshipType;rationale:string;providerFactKind:DateFact|null;neededByFactKind:DateFact|null}):Promise<string>{
 const ctx=await requireBusinessWriteAccess();
 if(!isLocalAuth())return p1Rpc<string>(ctx,'save_relationship',{p_input:{operation:'CREATE',requestId:input.requestId,expectedRevision:0,type:input.type,rationale:input.rationale,providerFactKind:input.providerFactKind,neededByFactKind:input.neededByFactKind,proposalId:input.proposalId,proposalVersion:input.version}});
 return withRepositoryContext(ctx,async()=>withLocalOwnerLock(ctx,delivery=>writeStoreAtomic(s=>{
  const p=s.evidenceProposals?.find(x=>x.id===input.proposalId&&x.workspaceId===ctx.workspaceId);if(!p||p.type!=='RELATIONSHIP')throw Error('Proposal unavailable.');
  const receipt=s.evidenceConfirmations?.find(c=>c.proposalId===p.id);if(receipt){if(receipt.requestId!==input.requestId)throw Error(`Already confirmed by ${receipt.actorLabel}. Open the existing record.`);return receipt.resultId;}
  if(p.status!=='PENDING'||p.version!==input.version)throw Error('This proposal changed. Your input is retained; review the current record.');
  const sub=s.evidenceSubmissions?.find(x=>x.id===p.submissionId),anchor=s.evidenceAnchors?.find(a=>a.id===p.anchorId);if(!sub||!anchor||!verifyAnchor(sub.text,anchor,sub.textSha256))throw Error('The evidence anchor could not be verified. Nothing was changed.');
  const initiative=s.initiatives.find(i=>i.id===p.initiativeId)!;
  const r=reviseRelationship(s.relationships??[],s.relationshipEvents??[],{operation:'CREATE',requestId:input.requestId,expectedRevision:0,fromInitiativeId:p.initiativeId,toInitiativeId:p.payload.targetInitiativeId,type:input.type,rationale:input.rationale,providerFactKind:input.providerFactKind,neededByFactKind:input.neededByFactKind,evidenceId:sub.evidenceId,evidenceAnchorId:anchor.id,originProposalId:p.id,originHref:`/initiatives/${initiative.slug}/evidence/${sub.id}#proposal-${p.id}`},ctx,s.initiatives,id=>ownerFor(delivery.facts,id),new Date().toISOString());
  (s.relationships??=[]).push(r.relationship);if(r.event)(s.relationshipEvents??=[]).push(r.event);
  const at=r.relationship.confirmedAt;Object.assign(p,{status:'CONFIRMED',version:p.version+1,decidedAt:at,decidedBy:ctx.actor.id,reason:input.rationale,resultType:'RELATIONSHIP',resultId:r.relationship.id});
  (s.evidenceConfirmations??=[]).push({proposalId:p.id,workspaceId:ctx.workspaceId,initiativeId:p.initiativeId,proposalVersion:input.version,actorId:ctx.actor.id,actorLabel:ctx.actor.label,at,resultType:'RELATIONSHIP',resultId:r.relationship.id,requestId:input.requestId});
  const other=s.initiatives.find(i=>i.id===r.relationship.toInitiativeId)?.name??'another initiative';
  for(const initiativeId of new Set([r.relationship.fromInitiativeId,r.relationship.toInitiativeId]))s.activity.push({id:randomUUID(),workspaceId:ctx.workspaceId,initiativeId,eventType:'RELATIONSHIP_CONFIRMED',summary:`${initiative.name} ${input.type==='DEPENDS_ON'?'depends on':input.type==='PART_OF'?'is part of':'is related to'} ${other} · confirmed from ${sub.title}`,occurredAt:at,entityType:'RELATIONSHIP',entityId:r.relationship.id,actorLabel:ctx.actor.label,payload:{relationshipId:r.relationship.id,proposalId:p.id,submissionId:sub.id}});
  return r.relationship.id;
 })));
}
