import type {Proposal,Submission} from './types.ts';

/** What the workbench tells a person before they confirm something that already exists. */
export interface AlreadyRecorded {label:string;href:string;}
export interface RecordedFacts {
 slug:string;initiativeId:string;
 claims:{id:string;subject:string;attribute:string;value:string;status:string}[];
 commitments:{id:string;initiativeId:string;title:string;status:string}[];
 questions:{id:string;initiativeId:string;question:string;status:string}[];
 relationships:{id:string;fromInitiativeId:string;toInitiativeId:string;type:string;status:string}[];
 facts:{initiativeId:string;kind:string;state:string;value:{date:string|null}}[];
 names:Record<string,string>;
}
const norm=(text:string)=>text.normalize('NFKC').toLowerCase().replace(/[\s.,;:!?'"“”‘’()-]+/g,' ').trim();
const VERB:Record<string,string>={DEPENDS_ON:'depends on',PART_OF:'is part of',RELATED_TO:'is related to'};

/**
 * Exact matches only (after case, spacing and punctuation are ignored). It never judges
 * meaning: a proposal with different words is not flagged, and a flag never blocks.
 */
export function alreadyRecorded(proposals:Proposal[],r:RecordedFacts):Record<string,AlreadyRecorded>{
 const out:Record<string,AlreadyRecorded>={};const base=`/initiatives/${r.slug}`;
 for(const p of proposals){
  if(p.status!=='PENDING')continue;const v=norm(p.payload.value??'');let hit:AlreadyRecorded|null=null;
  if(p.type==='RELATIONSHIP'){const other=p.payload.targetInitiativeId;const rel=r.relationships.find(x=>x.status==='ACTIVE'&&(x.fromInitiativeId===r.initiativeId&&x.toInitiativeId===other||x.toInitiativeId===r.initiativeId&&x.fromInitiativeId===other));if(rel)hit={label:`${r.names[rel.fromInitiativeId]??'This initiative'} ${VERB[rel.type]??'is related to'} ${r.names[rel.toInitiativeId]??'another initiative'} is already recorded`,href:`${base}/manage#relationships`};}
  else if(p.type==='ACTION'){const a=r.commitments.find(x=>x.initiativeId===r.initiativeId&&x.status!=='CANCELLED'&&norm(x.title)===v);if(a)hit={label:'The same commitment is already recorded',href:`${base}/actions?action=${a.id}`};}
  else if(p.type==='OPEN_QUESTION'){const q=r.questions.find(x=>x.initiativeId===r.initiativeId&&x.status!=='WITHDRAWN'&&norm(x.question)===v);if(q)hit={label:q.status==='ANSWERED'?'The same question is already recorded and answered':'The same question is already open',href:`${base}/context#question-${q.id}`};}
  else if(p.type==='DELIVERY'){const f=r.facts.find(x=>x.initiativeId===r.initiativeId&&x.kind===p.payload.factKind&&x.state==='SET');if(f&&p.payload.date&&f.value.date===p.payload.date)hit={label:'This date is already the recorded value',href:`${base}/delivery#delivery-history`};}
  else if(p.type==='CHANGED_REQUIREMENT'){const c=r.claims.find(x=>x.id===p.payload.targetClaimId);if(c&&norm(c.value)===v)hit={label:'Knowledge already holds this value',href:`${base}/knowledge?view=all#claim-${c.id}`};}
  else{const c=r.claims.find(x=>x.status!=='REJECTED'&&norm(x.subject)===norm(p.payload.subject)&&norm(x.attribute)===norm(p.payload.attribute)&&norm(x.value)===v);if(c)hit={label:'The same entry is already in Knowledge',href:`${base}/knowledge?view=all#claim-${c.id}`};}
  if(hit)out[p.id]=hit;
 }
 return out;
}

/** An earlier saved text with identical content, if any (same initiative). */
export function sameTextAs(submission:Submission,all:Submission[]):Submission|null{
 return all.filter(s=>s.id!==submission.id&&s.initiativeId===submission.initiativeId&&s.textSha256===submission.textSha256&&s.createdAt<=submission.createdAt).sort((a,b)=>a.createdAt.localeCompare(b.createdAt))[0]??null;
}
