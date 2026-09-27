import type {DeliveryFact} from '../delivery/types.ts';
import {ownerFor} from '../delivery/model.ts';
import {relationshipsFor,type RelationshipEnd} from './relationship-view.ts';
import {questionOverdueDays,type OpenQuestion} from './questions.ts';
import type {InitiativeRelationship} from './relationships.ts';

export interface OwnerAttentionRow {key:string;kind:'DEPENDENCY'|'QUESTION';initiative:RelationshipEnd;label:string;detail:string;href:string;sort:number;}
/**
 * Owner-routed rows for Home. A dependency impact goes to the owner of the
 * initiative that waits; an overdue question to its owner, or the initiative
 * owner when nobody was named. Only recorded facts create a row.
 */
export function ownerAttention(input:{memberId:string|null;facts:DeliveryFact[];relationships:InitiativeRelationship[];questions:OpenQuestion[];ends:RelationshipEnd[];today:string}):OwnerAttentionRow[]{
 if(!input.memberId)return [];const rows:OwnerAttentionRow[]=[];const live=input.ends.filter(e=>!e.archived);
 for(const e of live){if(ownerFor(input.facts,e.id)!==input.memberId)continue;
  for(const r of relationshipsFor(e.id,input.relationships,input.ends,input.facts,'ACTIVE',input.today).filter(x=>x.group==='DEPENDS_ON'&&x.late))rows.push({key:`dep:${r.relationship.id}`,kind:'DEPENDENCY',initiative:e,label:`Dependency date impact · waits on ${r.other?.name??'another initiative'}`,detail:r.impactText??'',href:`/initiatives/${e.slug}/manage?section=relationships#relationships`,sort:0});}
 for(const q of input.questions){const e=live.find(x=>x.id===q.initiativeId);if(!e)continue;const days=questionOverdueDays(q,input.today);if(days===null)continue;
  const routed=q.ownerMemberId??ownerFor(input.facts,e.id);if(routed!==input.memberId)continue;
  rows.push({key:`q:${q.id}`,kind:'QUESTION',initiative:e,label:`Open question overdue ${days} ${days===1?'day':'days'}`,detail:q.question,href:`/initiatives/${e.slug}/context#question-${q.id}`,sort:1});}
 return rows.sort((a,b)=>a.sort-b.sort||a.initiative.name.localeCompare(b.initiative.name));
}
