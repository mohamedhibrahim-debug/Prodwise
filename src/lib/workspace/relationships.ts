import {displayDate} from '../delivery/display.ts';
import {randomUUID} from 'node:crypto';
import {canBusinessWrite,hasOrganizationAdminAuthority} from '../auth/roles.ts';
import type {WorkspaceAccess,DeliveryFact} from '../delivery/types.ts';
import type {Initiative} from '../domain/types.ts';
import {factFor} from '../delivery/model.ts';

/**
 * A confirmed relationship between two initiatives in one organization.
 * DEPENDS_ON reads "from depends on to"; "blocks" is only ever derived as its
 * inverse. Impact is derived at read time from recorded delivery facts and is
 * never stored — no evidence, no inferred impact.
 */
export const RELATIONSHIP_TYPES=['DEPENDS_ON','PART_OF','RELATED_TO'] as const;
export type RelationshipType=typeof RELATIONSHIP_TYPES[number];
export const DATE_FACTS=['TARGET_LIVE','NEXT_MILESTONE'] as const;
export type DateFact=typeof DATE_FACTS[number];
export interface InitiativeRelationship {
 id:string;workspaceId:string;fromInitiativeId:string;toInitiativeId:string;type:RelationshipType;rationale:string;
 providerFactKind:DateFact|null;neededByFactKind:DateFact|null;
 evidenceId:string|null;evidenceAnchorId:string|null;originProposalId:string|null;originHref:string|null;
 status:'ACTIVE'|'ENDED';createdBy:string;confirmedBy:string;confirmedByLabel:string;confirmedAt:string;
 endedBy:string|null;endedByLabel:string|null;endedAt:string|null;endReason:string|null;updatedAt:string;revision:number;
}
export interface RelationshipEvent {id:string;workspaceId:string;relationshipId:string;fromInitiativeId:string;toInitiativeId:string;seq:number;type:'CONFIRMED'|'UPDATED'|'ENDED';before:InitiativeRelationship|null;after:InitiativeRelationship;note:string;actor:{id:string;label:string};at:string;requestId:string;}
export interface RelationshipCommand {
 operation:'CREATE'|'UPDATE'|'END';id?:string;requestId:string;expectedRevision:number;
 fromInitiativeId?:string;toInitiativeId?:string;type?:RelationshipType;rationale?:string;
 providerFactKind?:DateFact|null;neededByFactKind?:DateFact|null;reason?:string;
 evidenceId?:string|null;evidenceAnchorId?:string|null;originProposalId?:string|null;originHref?:string|null;
}
export const TYPE_SENTENCE:Record<RelationshipType,string>={DEPENDS_ON:'depends on',PART_OF:'is part of',RELATED_TO:'is related to'};
export const FACT_LABEL:Record<DateFact,string>={TARGET_LIVE:'Target Live',NEXT_MILESTONE:'Next milestone'};

/** Admin, a Product Lead, or the owner of the initiative the relationship is recorded from. */
export function canManageRelationship(ctx:WorkspaceAccess,fromOwnerId:string|null){return canBusinessWrite(ctx)&&(hasOrganizationAdminAuthority(ctx)||ctx.isProductLead||Boolean(ctx.memberId)&&ctx.memberId===fromOwnerId);}

/** RELATED_TO is symmetric, so it is stored in one normalized direction. */
export function normalizeEnds(type:RelationshipType,from:string,to:string):[string,string]{return type==='RELATED_TO'&&from>to?[to,from]:[from,to];}

function reaches(active:InitiativeRelationship[],type:RelationshipType,start:string,goal:string):boolean{
 const seen=new Set<string>();const queue=[start];
 while(queue.length){const at=queue.shift()!;if(at===goal)return true;if(seen.has(at))continue;seen.add(at);for(const r of active)if(r.type===type&&r.fromInitiativeId===at)queue.push(r.toInitiativeId);}
 return false;
}

export function reviseRelationship(rows:InitiativeRelationship[],events:RelationshipEvent[],cmd:RelationshipCommand,ctx:WorkspaceAccess,initiatives:Initiative[],ownerOf:(initiativeId:string)=>string|null,at:string):{relationship:InitiativeRelationship;event:RelationshipEvent|null}{
 if(!canBusinessWrite(ctx))throw Error('Your role is read-only.');
 if(!/^[0-9a-f-]{36}$/i.test(cmd.requestId))throw Error('Reload before saving this relationship.');
 const replay=events.find(e=>e.workspaceId===ctx.workspaceId&&e.requestId===cmd.requestId);
 if(replay){if(replay.actor.id!==ctx.actor.id)throw Error('This save request was already used.');return {relationship:rows.find(r=>r.id===replay.relationshipId)!,event:null};}
 const scoped=(id:string|undefined)=>initiatives.find(i=>i.id===id&&i.workspaceId===ctx.workspaceId);
 const active=rows.filter(r=>r.workspaceId===ctx.workspaceId&&r.status==='ACTIVE');
 const kind=(k:DateFact|null|undefined)=>{if(k!=null&&!DATE_FACTS.includes(k))throw Error('Choose Target Live or Next milestone.');return k??null;};
 let next:InitiativeRelationship,before:InitiativeRelationship|undefined,type:RelationshipEvent['type'];const note=(cmd.reason??'').trim();
 if(cmd.operation==='CREATE'){
  if(cmd.expectedRevision!==0)throw Error('Reload before saving this relationship.');
  const t=cmd.type;if(!t||!RELATIONSHIP_TYPES.includes(t))throw Error('Choose how these initiatives relate.');
  const fromI=scoped(cmd.fromInitiativeId),toI=scoped(cmd.toInitiativeId);if(!fromI||!toI)throw Error('Choose an initiative in this organization.');
  if(fromI.id===toI.id)throw Error('An initiative cannot relate to itself.');
  if(fromI.archivedAt)throw Error('Archived — restore to edit. Nothing was changed.');
  if(toI.archivedAt)throw Error(`${toI.name} is archived. New relationships to archived initiatives are not allowed.`);
  if(!canManageRelationship(ctx,ownerOf(fromI.id)))throw Error(`Only the owner of ${fromI.name}, a Product Lead or administration can record its relationships.`);
  const rationale=(cmd.rationale??'').trim();if(!rationale||rationale.length>1000)throw Error('Say why these initiatives are related (up to 1,000 characters).');
  const provider=kind(cmd.providerFactKind),needed=kind(cmd.neededByFactKind);
  if(t!=='DEPENDS_ON'&&(provider||needed))throw Error('Dates only apply to a dependency.');
  if(Boolean(provider)!==Boolean(needed))throw Error('Choose both dates, or neither.');
  const [f,to]=normalizeEnds(t,fromI.id,toI.id);
  const existing=active.find(r=>r.type===t&&r.fromInitiativeId===f&&r.toInitiativeId===to);
  if(existing)throw Error(`Already recorded by ${existing.confirmedByLabel}.`);
  if(t==='PART_OF'&&active.some(r=>r.type==='PART_OF'&&r.fromInitiativeId===f))throw Error(`${fromI.name} is already part of another initiative. End that relationship first.`);
  if((t==='PART_OF'||t==='DEPENDS_ON')&&reaches(active,t,to,f))throw Error(t==='DEPENDS_ON'?'This would create a circular dependency: the other initiative already depends on this one, directly or through others. End or change that relationship first, or record this one as Related.':'This would make an initiative part of itself through its parts. Change the existing part-of relationship first.');
  next={id:randomUUID(),workspaceId:ctx.workspaceId,fromInitiativeId:f,toInitiativeId:to,type:t,rationale,providerFactKind:provider,neededByFactKind:needed,evidenceId:cmd.evidenceId??null,evidenceAnchorId:cmd.evidenceAnchorId??null,originProposalId:cmd.originProposalId??null,originHref:cmd.originHref??null,status:'ACTIVE',createdBy:ctx.actor.id,confirmedBy:ctx.actor.id,confirmedByLabel:ctx.actor.label,confirmedAt:at,endedBy:null,endedByLabel:null,endedAt:null,endReason:null,updatedAt:at,revision:1};
  type='CONFIRMED';
 }else{
  before=rows.find(r=>r.id===cmd.id&&r.workspaceId===ctx.workspaceId);if(!before)throw Error('Relationship unavailable.');
  if(before.revision!==cmd.expectedRevision)throw Error(`This relationship was changed${before.endedByLabel?` by ${before.endedByLabel}`:''}. Your change was not saved; your input is kept.`);
  if(before.status!=='ACTIVE')throw Error('This relationship has ended. Record a new one if it applies again.');
  const fromI=scoped(before.fromInitiativeId);if(!fromI)throw Error('Relationship unavailable.');
  if(fromI.archivedAt)throw Error('Archived — restore to edit. Nothing was changed.');
  if(!canManageRelationship(ctx,ownerOf(fromI.id)))throw Error(`Only the owner of ${fromI.name}, a Product Lead or administration can change its relationships.`);
  if(cmd.operation==='END'){if(!note||note.length>1000)throw Error('Say why this relationship no longer applies.');next={...before,status:'ENDED',endedBy:ctx.actor.id,endedByLabel:ctx.actor.label,endedAt:at,endReason:note};type='ENDED';}
  else{
   const rationale=(cmd.rationale??before.rationale).trim();if(!rationale||rationale.length>1000)throw Error('Say why these initiatives are related (up to 1,000 characters).');
   const provider=cmd.providerFactKind===undefined?before.providerFactKind:kind(cmd.providerFactKind),needed=cmd.neededByFactKind===undefined?before.neededByFactKind:kind(cmd.neededByFactKind);
   if(before.type!=='DEPENDS_ON'&&(provider||needed))throw Error('Dates only apply to a dependency.');if(Boolean(provider)!==Boolean(needed))throw Error('Choose both dates, or neither.');
   next={...before,rationale,providerFactKind:provider,neededByFactKind:needed};type='UPDATED';
   if(JSON.stringify(next)===JSON.stringify(before))throw Error('Nothing changed.');
  }
  next={...next,updatedAt:at,revision:before.revision+1};
 }
 return {relationship:next,event:{id:randomUUID(),workspaceId:ctx.workspaceId,relationshipId:next.id,fromInitiativeId:next.fromInitiativeId,toInitiativeId:next.toInitiativeId,seq:next.revision,type,before:before??null,after:next,note,actor:ctx.actor,at,requestId:cmd.requestId}};
}

export type Impact=
 |{assessed:false;reason:string}
 |{assessed:true;late:false;delivered?:true;providerDate:string|null;neededDate:string|null}
 |{assessed:true;late:true;days:number;providerDate:string;neededDate:string};
/**
 * Dependency impact, derived only from recorded delivery facts. Anything
 * unknown, missing or unspecified yields "not assessed" — never risk, never healthy.
 */
export function dependencyImpact(r:Pick<InitiativeRelationship,'type'|'status'|'fromInitiativeId'|'toInitiativeId'|'providerFactKind'|'neededByFactKind'>,facts:DeliveryFact[],names:{from:string;to:string},today?:string):Impact|null{
 if(r.type!=='DEPENDS_ON'||r.status!=='ACTIVE')return null;
 if(!r.providerFactKind||!r.neededByFactKind)return {assessed:false,reason:'which dates matter was not recorded'};
 const live=factFor(facts,r.toInitiativeId,'ACTUAL_LIVE');
 if(live?.state==='SET'&&live.value.date&&live.value.extent==='FULL')return {assessed:true,late:false,delivered:true,providerDate:live.value.date,neededDate:null};
 const describe=(f:DeliveryFact|null|undefined,label:string,name:string)=>!f||f.state!=='SET'?`${name} ${label} is not recorded`:f.value.unknown||f.value.dateUnknown||!f.value.date?`${name} ${label} is Unknown`:null;
 const provider=factFor(facts,r.toInitiativeId,r.providerFactKind),needed=factFor(facts,r.fromInitiativeId,r.neededByFactKind);
 const missing=describe(provider,FACT_LABEL[r.providerFactKind],names.to)??describe(needed,r.neededByFactKind==='TARGET_LIVE'?'Target Live':'next milestone',names.from);
 if(missing)return {assessed:false,reason:missing};
 const p=provider!.value.date!,n=needed!.value.date!;
 // A provider date already in the past with no recorded Actual Live proves nothing about when it lands.
 if(today&&p<today)return {assessed:false,reason:`${names.to} ${FACT_LABEL[r.providerFactKind]} (${displayDate(p)}) has passed without a recorded Actual Live`};
 if(p>n)return {assessed:true,late:true,days:Math.round((Date.parse(p)-Date.parse(n))/86_400_000),providerDate:p,neededDate:n};
 return {assessed:true,late:false,providerDate:p,neededDate:n};
}

/** Exact, normalized initiative names found in a quote (used to propose — never to confirm). */
export function namedInitiatives(quote:string,initiatives:Pick<Initiative,'id'|'name'>[],selfId:string){
 const norm=(s:string)=>s.normalize('NFKC').toLowerCase().replace(/\s+/g,' ');const q=norm(quote);
 return initiatives.filter(i=>i.id!==selfId&&i.name.trim().length>=4&&q.includes(norm(i.name.trim())));
}

/** After a reading: one RELATIONSHIP proposal per initiative named verbatim in an accepted quote.
 * It proposes only — the confirming person chooses the type and writes the rationale. */
export function relationshipCandidates<A extends {type:string;anchor:{start:number;end:number;quote:string}}>(accepted:A[],initiatives:Pick<Initiative,'id'|'name'>[],selfId:string){
 const out:{type:'RELATIONSHIP';payload:{subject:string;attribute:string;value:string;domain:'PRODUCT';phase:null;targetInitiativeId:string};anchor:A['anchor']}[]=[];const seen=new Set<string>();
 for(const a of accepted)for(const target of namedInitiatives(a.anchor.quote,initiatives,selfId)){
  if(seen.has(target.id))continue;const at=a.anchor.quote.toLowerCase().indexOf(target.name.trim().toLowerCase());if(at<0)continue;
  seen.add(target.id);out.push({type:'RELATIONSHIP',payload:{subject:target.name,attribute:'relationship',value:a.anchor.quote.slice(at,at+target.name.trim().length),domain:'PRODUCT',phase:null,targetInitiativeId:target.id},anchor:a.anchor});
 }
 return out;
}
