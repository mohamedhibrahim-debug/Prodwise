import {randomUUID} from 'node:crypto';
import type {ActivityEntry,Initiative,MemoryClaim} from '../domain/types.ts';
import type {DeliveryFact,DeliveryMember} from '../delivery/types.ts';
import {deriveReadiness,type InitiativeContext} from './readiness.ts';
export function readinessTransition(input:{initiative:Initiative;facts:DeliveryFact[];members:DeliveryMember[];claims:Pick<MemoryClaim,'status'|'verifiedAt'>[];contexts:InitiativeContext[];activeSourceLinks:number;activity:ActivityEntry[];at:string;actor:{id:string;label:string}}):ActivityEntry|null{
 const i=input.initiative;if(i.archivedAt)return null;
 const previous=input.activity.filter(e=>e.initiativeId===i.id&&['READINESS_REACHED','READINESS_LOST'].includes(e.eventType)).sort((a,b)=>a.occurredAt.localeCompare(b.occurredAt)).at(-1);
 const r=deriveReadiness({...input,currentContext:input.contexts.find(c=>c.id===i.currentContextId)??null});
 if(r.ready===(previous?.eventType==='READINESS_REACHED'))return null;
 return {id:randomUUID(),workspaceId:i.workspaceId,initiativeId:i.id,eventType:r.ready?'READINESS_REACHED':'READINESS_LOST',summary:r.ready?'Setup complete — ready for intelligence; attention remains separate':`Setup needs review: ${r.requirements.filter(x=>!x.met).map(x=>x.label).join(', ')}`,occurredAt:input.at,entityType:'INITIATIVE',entityId:i.id,actorLabel:input.actor.label,payload:{actor:input.actor,requirements:r.requirements.map(x=>({key:x.key,met:x.met})),ready:r.ready}};
}
