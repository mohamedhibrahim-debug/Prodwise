import {randomUUID} from 'node:crypto';
import type {ActivityEntry,Initiative,MemoryClaim} from '../domain/types.ts';
import type {DeliveryFact,DeliveryMember} from '../delivery/types.ts';
import {deriveReadiness,type InitiativeContext} from './readiness.ts';
export function readinessTransition(input:{initiative:Initiative;facts:DeliveryFact[];members:DeliveryMember[];claims:Pick<MemoryClaim,'status'|'verifiedAt'>[];contexts:InitiativeContext[];activeSourceLinks:number;activity:ActivityEntry[];at:string;actor:{id:string;label:string}}):ActivityEntry|null{
 const i=input.initiative;if(i.archivedAt)return null;
 const previous=input.activity.filter(e=>e.initiativeId===i.id&&['READINESS_REACHED','READINESS_LOST'].includes(e.eventType)).sort((a,b)=>a.occurredAt.localeCompare(b.occurredAt)).at(-1);
 const r=deriveReadiness({...input,currentContext:input.contexts.find(c=>c.id===i.currentContextId)??null});
 if(previous&&r.ready===(previous.eventType==='READINESS_REACHED'))return null;
 // No earlier record: the first observation, ready or not, is not a change anyone made. It is kept
 // as a baseline (later transitions compare against it) and never shown as a history event.
 const baseline=!previous;
 return {id:randomUUID(),workspaceId:i.workspaceId,initiativeId:i.id,eventType:r.ready?'READINESS_REACHED':'READINESS_LOST',summary:baseline?'Setup status first recorded':r.ready?'Setup complete; attention is tracked separately':`Setup needs review: ${r.requirements.filter(x=>!x.met).map(x=>x.label).join(', ')}`,occurredAt:input.at,entityType:'INITIATIVE',entityId:i.id,actorLabel:baseline?null:input.actor.label,payload:{...(baseline?{baseline:true}:{actor:input.actor}),requirements:r.requirements.map(x=>({key:x.key,met:x.met})),ready:r.ready}};
}
