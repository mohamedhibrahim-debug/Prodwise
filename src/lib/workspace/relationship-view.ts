import type {DeliveryFact} from '../delivery/types.ts';
import {displayDate} from '../delivery/roadmap.ts';
import {dependencyImpact,FACT_LABEL,type Impact,type InitiativeRelationship} from './relationships.ts';

export interface RelationshipEnd {id:string;name:string;slug:string;archived:boolean;}
export type RelationshipGroup='DEPENDS_ON'|'BLOCKS'|'PART_OF'|'CONTAINS'|'RELATED_TO';
export const GROUP_LABEL:Record<RelationshipGroup,string>={DEPENDS_ON:'Depends on',BLOCKS:'Needed by',PART_OF:'Part of',CONTAINS:'Contains',RELATED_TO:'Related to'};
export interface RelationshipRow {relationship:InitiativeRelationship;group:RelationshipGroup;other:RelationshipEnd|null;impact:Impact|null;impactText:string|null;late:boolean;}

/** One sentence per impact, used identically on Manage, Brief, Roadmap and Home. */
export function impactSentence(r:InitiativeRelationship,impact:Impact|null,names:{from:string;to:string}):string|null{
 if(!impact)return null;
 if(!impact.assessed)return `Impact not assessed: ${impact.reason}.`;
 if('delivered' in impact&&impact.delivered)return `${names.to} is recorded as fully live (${displayDate(impact.providerDate)}).`;
 const p=FACT_LABEL[r.providerFactKind!],n=r.neededByFactKind==='TARGET_LIVE'?'Target Live':'next milestone';
 // Lead with who is waiting on whom: the dependent initiative needs the other one by its own date.
 if(impact.late)return `${names.from} needs ${names.to} by its ${n} (${displayDate(impact.neededDate)}); ${names.to}’s ${p} is ${displayDate(impact.providerDate)}, ${impact.days} ${impact.days===1?'day':'days'} later.`;
 return `${names.from} needs ${names.to} by its ${n} (${displayDate(impact.neededDate)}); ${names.to}’s ${p} (${displayDate(impact.providerDate)}) is on or before that.`;
}

/**
 * Relationships seen from one initiative. `ends` holds only initiatives the viewer
 * can read; anything else is shown as "An initiative you can't access".
 */
export function relationshipsFor(initiativeId:string,all:InitiativeRelationship[],ends:RelationshipEnd[],facts:DeliveryFact[],status:'ACTIVE'|'ENDED'='ACTIVE',today?:string):RelationshipRow[]{
 const end=(id:string)=>ends.find(e=>e.id===id)??null;const rows:RelationshipRow[]=[];
 for(const r of all){
  if(r.status!==status||(r.fromInitiativeId!==initiativeId&&r.toInitiativeId!==initiativeId))continue;
  const outgoing=r.fromInitiativeId===initiativeId;const group:RelationshipGroup=r.type==='RELATED_TO'?'RELATED_TO':r.type==='DEPENDS_ON'?(outgoing?'DEPENDS_ON':'BLOCKS'):(outgoing?'PART_OF':'CONTAINS');
  const other=end(outgoing?r.toInitiativeId:r.fromInitiativeId);
  const names={from:end(r.fromInitiativeId)?.name??'An initiative you can’t access',to:end(r.toInitiativeId)?.name??'An initiative you can’t access'};
  const impact=other?dependencyImpact(r,facts,names,today):null;
  rows.push({relationship:r,group,other,impact,impactText:impactSentence(r,impact,names),late:Boolean(impact&&impact.assessed&&impact.late)});
 }
 const order:RelationshipGroup[]=['DEPENDS_ON','BLOCKS','PART_OF','CONTAINS','RELATED_TO'];
 return rows.sort((a,b)=>order.indexOf(a.group)-order.indexOf(b.group)||Number(b.late)-Number(a.late)||(a.other?.name??'').localeCompare(b.other?.name??''));
}
