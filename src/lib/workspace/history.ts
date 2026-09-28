import type {ActivityEntry} from '../domain/types.ts';
import type {DeliveryEvent,DeliveryMember,WeeklyReview} from '../delivery/types.ts';
import {displayDate} from '../delivery/roadmap.ts';
import {activitySummary,clipSentence,isReadinessBaseline} from './copy.ts';
import type {CommitmentEvent} from './commitments.ts';
import type {QuestionEvent} from './questions.ts';
import type {RelationshipEvent} from './relationships.ts';
import type {RiskEvent} from './risks.ts';

/**
 * Initiative History: what happened to this initiative over time.
 *
 * A curated read-time projection over records that are already append-only
 * (activity log, delivery fact events, commitment/question/relationship/risk
 * events, Weekly Finals). No second history store is written, so History can
 * never disagree with the records it describes. Low-level audit rows, reads,
 * retries, rejections and cosmetic corrections are deliberately excluded.
 */
export const HISTORY_CATEGORIES=['DELIVERY','DECISIONS','KNOWLEDGE','COMMITMENTS','RISKS_QUESTIONS','SOURCES','RELATIONSHIPS','LIFECYCLE'] as const;
export type HistoryCategory=typeof HISTORY_CATEGORIES[number];
export const CATEGORY_LABEL:Record<HistoryCategory,string>={DELIVERY:'Delivery',DECISIONS:'Decisions',KNOWLEDGE:'Knowledge',COMMITMENTS:'Commitments',RISKS_QUESTIONS:'Risks & questions',SOURCES:'Sources',RELATIONSHIPS:'Relationships',LIFECYCLE:'Lifecycle'};
export interface HistoryEvent {id:string;at:string;category:HistoryCategory;label:string;sentence:string;actor:string;rationale:string|null;href:string|null;hrefLabel:string|null;provenance:{label:string;href:string|null}|null;}
export interface HistorySources {
 initiativeId:string;slug:string;names:Record<string,string>;members:DeliveryMember[];
 activity:ActivityEntry[];deliveryEvents:DeliveryEvent[];commitmentEvents:CommitmentEvent[];questionEvents:QuestionEvent[];relationshipEvents:RelationshipEvent[];riskEvents:RiskEvent[];reviews:WeeklyReview[];
 /** submissionId → title/date, to say "from Steering sync, 25 Sept". */
 evidence:{evidenceId:string;submissionId:string;title:string;date:string}[];
}

/** Activity types covered by a typed source elsewhere, or not meaningful product evolution. */
const EXCLUDED=new Set(['AI_PROPOSAL_REJECTED','MEETING_NOTES_CORRECTED','CLAIM_EVIDENCE_ANCHOR_UPDATED','DELIVERY_FACT_RECORDED','FINDING_DETECTED']);
function activityCategory(e:ActivityEntry):{category:HistoryCategory;label:string}|null{
 const t=e.eventType;
 if(EXCLUDED.has(t)||t.startsWith('COMMITMENT_')||t.startsWith('QUESTION_')||t.startsWith('RELATIONSHIP_')||t.startsWith('RISK_'))return null;
 if(t==='AI_PROPOSAL_CONFIRMED'||t==='AI_PROPOSAL_SUPERSEDED'){const receipt=(e.payload as {receipt?:{type?:string}}|null)?.receipt;const type=receipt?.type??e.entityType;if(/changed_requirement/.test(e.summary))return null;return type==='KNOWLEDGE'||type==='CLAIM'||type==='claim'?{category:'KNOWLEDGE',label:t==='AI_PROPOSAL_SUPERSEDED'?'Knowledge added by hand':'Knowledge added from evidence'}:null;}
 if(t==='INITIATIVE_CREATED')return {category:'LIFECYCLE',label:'Created'};
 if(t==='STAGE_CHANGED')return {category:'LIFECYCLE',label:'Stage changed'};
 if(t==='INITIATIVE_BASICS_CHANGED')return {category:'LIFECYCLE',label:'Basics edited'};
 if(t.startsWith('CONTEXT_')||t==='INITIATIVE_CONTEXT')return {category:'LIFECYCLE',label:'Scope / phase'};
 if(t==='INITIATIVE_ARCHIVED')return {category:'LIFECYCLE',label:'Archived'};
 if(t==='INITIATIVE_RESTORED')return {category:'LIFECYCLE',label:'Restored'};
 if(isReadinessBaseline(e))return null;
 if(t==='READINESS_REACHED')return {category:'LIFECYCLE',label:'Setup completed'};
 if(t==='READINESS_LOST')return {category:'LIFECYCLE',label:'Setup readiness lost'};
 if(t==='MEETING_NOTES_SAVED')return {category:'SOURCES',label:'Meeting notes added'};
 if(t==='EVIDENCE_SAVED'||t==='EVIDENCE_ADDED')return {category:'SOURCES',label:'Evidence saved'};
 if(t==='SOURCE_IMPORTED')return {category:'SOURCES',label:'Source imported'};
 if(t==='SOURCE_CHANGED')return {category:'SOURCES',label:'Source changed'};
 if(t==='SOURCE_UNAVAILABLE')return {category:'SOURCES',label:'Source unavailable'};
 if(t.startsWith('SOURCE_'))return {category:'SOURCES',label:t.includes('UNLINK')?'Source unlinked':'Source linked'};
 if(t==='CLAIM_VERIFIED')return {category:'KNOWLEDGE',label:'Knowledge confirmed'};
 if(t==='CLAIM_ADDED')return {category:'KNOWLEDGE',label:'Knowledge added by hand'};
 if(t==='CLAIM_VALUE_CHANGED')return {category:'KNOWLEDGE',label:'Knowledge edited'};
 if(t==='CLAIM_STATUS_CHANGED')return {category:'KNOWLEDGE',label:'Knowledge status changed'};
 if(t==='CLAIM_SUPERSESSION_SET')return {category:'KNOWLEDGE',label:'Replacement recorded'};
 if(t==='CLAIM_EVIDENCE_LINKED')return {category:'KNOWLEDGE',label:'Evidence linked'};
 if(t==='CLAIM_EVIDENCE_UNLINKED')return {category:'KNOWLEDGE',label:'Evidence unlinked'};
 if(t==='EVIDENCE_RECLASSIFIED')return {category:'SOURCES',label:'Evidence reclassified'};
 if(t==='CLAIM_SUPERSEDED')return {category:'KNOWLEDGE',label:'Requirement changed'};
 if(t==='KNOWLEDGE_APPLICABILITY_REVISED')return {category:'KNOWLEDGE',label:'Applicability revised'};
 if(t==='FINDING_DECIDED'||t==='DECISION_RECORDED'||t==='DEFINITION_AGREED')return {category:'DECISIONS',label:'Decision finalized'};
 if(t.startsWith('FINDING_')){const kind=t.replace('FINDING_','').replace('DISPOSITION_','');return {category:'DECISIONS',label:kind==='DEFERRED'?'Decision deferred':kind==='DISMISSED'?'Decision dismissed':kind==='REOPENED'?'Decision reopened':kind==='RESOLVED'?'Reviewed — note only':kind==='CONFIRMER_ASSIGNED'?'Confirmer assigned':'Decision updated'};}
 if(t==='DELIVERY_UPDATE')return {category:'DELIVERY',label:'Delivery update'};
 if(t==='DEPENDENCY_FLAGGED')return {category:'RELATIONSHIPS',label:'Dependency flagged'};
 return null;
}

const KIND:Record<string,string>={requirement:'Requirement',decision:'Decision',business_rule:'Business rule',risk:'Risk',dependency:'Dependency',assumption:'Assumption'};
/** "Human confirmed risk proposal from Steering sync · unverified Knowledge" → "Risk added from Steering sync · awaiting confirmation". */
function proposalSentence(summary:string){const m=/^Human (?:confirmed|entered|human_entryed|confirmed) (\w+)? ?(?:evidence )?proposal from (.+?)(?: · .*)?$/.exec(summary);if(!m)return summary.replace(/unverified Knowledge/,'awaiting confirmation');return `${KIND[m[1]??'']??'Knowledge entry'} added from ${m[2]} · awaiting confirmation`;}
const FACT:Record<string,string>={SCOPE:'Scope',OWNER:'Owner',SOLUTION_DEFINED:'Solution defined',DEV_STARTED:'Development start',TARGET_LIVE:'Target Live',ACTUAL_LIVE:'Actual Live',NEXT_MILESTONE:'Next milestone',BLOCKER:'Blocker',NEXT_STEP:'Next step'};
function deliverySentence(e:DeliveryEvent,member:(id:string|null|undefined)=>string):{label:string;sentence:string}|null{
 const a=e.after,b=e.before,name=FACT[a.kind]??a.kind;const val=(f:typeof a|null)=>!f||f.state==='RETRACTED'?'not recorded':f.value.unknown||f.value.dateUnknown&&!f.value.text?'Unknown':a.kind==='OWNER'?member(f.value.memberId):f.value.date&&f.value.text?`${f.value.text} (${displayDate(f.value.date)})`:f.value.date?displayDate(f.value.date):f.value.text??'recorded';
 if(a.kind==='OWNER')return {label:'Owner changed',sentence:b?`Owner ${val(b)} → ${val(a)}`:`Owner set to ${val(a)}`};
 if(a.kind==='BLOCKER')return a.state==='RETRACTED'||!a.value.text?{label:'Blocker cleared',sentence:b?.value.text?`Blocker cleared: ${b.value.text}`:'Blocker cleared'}:{label:'Blocker recorded',sentence:a.value.text};
 if(a.kind==='ACTUAL_LIVE'&&a.state==='SET'&&a.value.date)return {label:'Live recorded',sentence:`Actual Live recorded ${displayDate(a.value.date)}${a.value.extent==='PARTIAL'?' · partial':' · full named scope'}`};
 if(a.state==='RETRACTED')return {label:`${name} withdrawn`,sentence:`${name} withdrawn · now not recorded`};
 const before=b&&b.state==='SET'?val(b):null,after=val(a);if(before===after)return null;
 return {label:a.kind==='TARGET_LIVE'?'Target Live changed':`${name} ${before?'changed':'recorded'}`,sentence:before?`${name} ${before} → ${after}`:`${name}: ${after}`};
}

export function buildInitiativeHistory(src:HistorySources):HistoryEvent[]{
 const id=src.initiativeId,base=`/initiatives/${src.slug}`,out:HistoryEvent[]=[];
 const member=(m:string|null|undefined)=>src.members.find(x=>x.id===m)?.displayName??(m?'a former member':'nobody');
 const ev=(evidenceId:string|null|undefined)=>{const e=src.evidence.find(x=>x.evidenceId===evidenceId);return e?{label:`from ${e.title}, ${displayDate(e.date)}`,href:`${base}/evidence/${e.submissionId}`}:null;};
 for(const e of src.activity){if(e.initiativeId!==id)continue;const c=activityCategory(e);if(!c)continue;
  const payload=(e.payload??{}) as Record<string,unknown>;const sub=typeof payload.submissionId==='string'?src.evidence.find(x=>x.submissionId===payload.submissionId):undefined;
  out.push({id:`a:${e.id}`,at:e.occurredAt,...c,sentence:clipSentence(e.eventType==='INITIATIVE_CREATED'?'Initiative created in Prodwise':e.eventType.startsWith('AI_PROPOSAL_')?proposalSentence(e.summary):activitySummary(e)),actor:e.actorLabel??'Recorded actor',rationale:typeof payload.reason==='string'&&payload.reason?payload.reason:null,
   href:c.category==='KNOWLEDGE'?`${base}/knowledge?view=all`:c.category==='DECISIONS'?`${base}/decisions`:c.category==='SOURCES'?(sub?`${base}/evidence/${sub.submissionId}`:`${base}/sources`):c.category==='LIFECYCLE'?`${base}/manage`:null,hrefLabel:c.category==='SOURCES'&&sub?'Open evidence':c.category==='KNOWLEDGE'?'Open Knowledge':c.category==='DECISIONS'?'Open Decisions':null,
   provenance:c.category!=='SOURCES'&&sub?{label:`from ${sub.title}, ${displayDate(sub.date)}`,href:`${base}/evidence/${sub.submissionId}`}:null});}
 for(const e of src.deliveryEvents){if(e.initiativeId!==id)continue;const s=deliverySentence(e,member);if(!s)continue;
  out.push({id:`d:${e.id}`,at:e.occurredAt,category:e.after.kind==='OWNER'?'LIFECYCLE':'DELIVERY',label:s.label,sentence:s.sentence,actor:e.after.preparedAsFixture?'Prodwise demo setup':e.actor.label,rationale:e.after.note||null,href:`${base}/delivery#delivery-history`,hrefLabel:'Delivery facts',provenance:e.after.basis==='EVIDENCE'?ev(e.after.evidenceId)??{label:'from recorded evidence',href:null}:null});}
 for(const e of src.commitmentEvents){if(e.initiativeId!==id)continue;const a=e.after,b=e.before;let label:string|null=null,sentence=a.title;
  if(!b)label='Commitment created',sentence=`${a.title}${a.assigneeMemberId?` · owner ${member(a.assigneeMemberId)}`:' · no owner yet'}${a.dueDate?` · due ${displayDate(a.dueDate)}`:''}`;
  else if(a.status!==b.status)label=a.status==='DONE'?'Commitment completed':a.status==='CANCELLED'?'Commitment cancelled':['DONE','CANCELLED'].includes(b.status)?'Commitment reopened':a.status==='IN_PROGRESS'?'Commitment started':null;
  else if(a.assigneeMemberId!==b.assigneeMemberId)label='Commitment reassigned',sentence=`${a.title} · ${member(b.assigneeMemberId)} → ${member(a.assigneeMemberId)}`;
  else if(a.dueDate!==b.dueDate)label='Commitment due date changed',sentence=`${a.title} · ${b.dueDate?displayDate(b.dueDate):'no date'} → ${a.dueDate?displayDate(a.dueDate):'no date'}`;
  else if(a.blockedNote!==b.blockedNote)label=a.blockedNote?'Commitment blocked':'Commitment unblocked',sentence=a.blockedNote?`${a.title} · ${a.blockedNote}`:a.title;
  if(!label)continue;
  out.push({id:`c:${e.id}`,at:e.at,category:'COMMITMENTS',label,sentence,actor:e.actor.label,rationale:e.note||null,href:`${base}/actions?action=${a.id}`,hrefLabel:'Open commitment',provenance:!b&&a.origin==='MEETING'?{label:`from meeting notes${ev(a.evidenceId)?` · ${ev(a.evidenceId)!.label.replace(/^from /,'')}`:''}`,href:a.originHref}:!b&&a.origin==='WEEKLY_REVIEW'?{label:'from a Weekly Review next step',href:a.originHref}:!b&&a.origin==='CONFIRMED_AI_PROPOSAL'?ev(a.evidenceId):null});}
 for(const e of src.questionEvents){if(e.initiativeId!==id||e.type==='UPDATED')continue;const q=e.after;
  out.push({id:`q:${e.id}`,at:e.at,category:'RISKS_QUESTIONS',label:e.type==='OPENED'?'Question opened':e.type==='ANSWERED'?'Question answered':e.type==='WITHDRAWN'?'Question withdrawn':'Question reopened',sentence:e.type==='ANSWERED'?`${q.question} — ${q.answerClaimId?'answered by a confirmed Knowledge entry':`“${q.answerNote}” (answer note, not in Knowledge)`}`:q.question,actor:e.actor.label,rationale:e.note||null,href:`${base}/context#question-${q.id}`,hrefLabel:'Open question',provenance:e.type==='OPENED'&&q.originHref?{label:q.origin==='MEETING'?`from ${q.originLabel??'meeting notes'}`:q.origin==='WEEKLY_REVIEW'?'from a Weekly Review':`from ${q.originLabel??'saved evidence'}`,href:q.originHref}:null});}
 for(const e of src.relationshipEvents){if(e.fromInitiativeId!==id&&e.toInitiativeId!==id)continue;const r=e.after;const verb=r.type==='DEPENDS_ON'?'depends on':r.type==='PART_OF'?'is part of':'is related to';
  out.push({id:`r:${e.id}`,at:e.at,category:'RELATIONSHIPS',label:e.type==='CONFIRMED'?'Relationship confirmed':e.type==='ENDED'?'Relationship ended':'Relationship updated',sentence:`${src.names[r.fromInitiativeId]??'An initiative you can’t access'} ${verb} ${src.names[r.toInitiativeId]??'an initiative you can’t access'}`,actor:e.actor.label,rationale:e.type==='ENDED'?r.endReason:e.type==='CONFIRMED'?r.rationale:null,href:`${base}/manage?section=relationships#relationships`,hrefLabel:'Relationships',provenance:e.type==='CONFIRMED'&&r.originHref?{label:'from saved evidence',href:r.originHref}:null});}
 for(const e of src.riskEvents){if(e.initiativeId!==id)continue;const r=e.after;
  out.push({id:`k:${e.id}`,at:e.at,category:'RISKS_QUESTIONS',label:e.type==='STARTED'?'Risk tracking started':e.type==='CARRIED'?'Risk tracking carried forward':r.status==='CLOSED'?'Risk closed':r.status==='ACCEPTED'?'Risk accepted':r.status==='MITIGATING'?'Risk being mitigated':e.type==='STATUS'?'Risk reopened':'Risk updated',sentence:e.type==='UPDATED'?`${e.statement} — ${[e.before?.ownerMemberId!==r.ownerMemberId?`owner ${member(r.ownerMemberId)}`:null,e.before?.mitigationText!==r.mitigationText?`mitigation: ${r.mitigationText??'removed'}`:null,e.before?.mitigationActionId!==r.mitigationActionId?(r.mitigationActionId?'linked to a commitment':'commitment link removed'):null].filter(Boolean).join(' · ')}`:e.statement,actor:e.actor.label,rationale:e.note||null,href:`${base}/context#risk-${r.claimId}`,hrefLabel:'Open risk',provenance:null});}
 for(const r of src.reviews){if(r.status!=='FINAL'||!r.finalizedAt||!r.sections.some(s=>s.initiativeId===id))continue;
  out.push({id:`w:${r.id}`,at:r.finalizedAt,category:'LIFECYCLE',label:'Weekly Review finalized',sentence:`${r.week.replace(/^\d{4}-/,'')} Final includes this initiative`,actor:r.preparedAsFixture?'Prodwise demo setup':r.finalizedByLabel??'Recorded actor',rationale:null,href:`/weekly-review?week=${r.week}&initiative=${src.slug}`,hrefLabel:'Open Final as stored',provenance:null});}
 return collapseBursts(out.sort((a,b)=>b.at.localeCompare(a.at)||b.id.localeCompare(a.id)));
}

/** A burst of identical entries (same kind, sentence and person within one minute — e.g. twenty Jira issues mapped at once)
 * reads as one line with a count. Nothing is hidden: the count says how many records it stands for. */
export function collapseBursts(events:HistoryEvent[]):HistoryEvent[]{
 const out:(HistoryEvent&{count?:number;baseSentence?:string})[]=[];
 for(const e of events){const last=out.at(-1);
  if(last&&last.label===e.label&&last.actor===e.actor&&last.category===e.category&&last.at.slice(0,16)===e.at.slice(0,16)&&(last.baseSentence??last.sentence)===e.sentence){last.count=(last.count??1)+1;last.baseSentence??=e.sentence;
   last.sentence=e.category==='SOURCES'&&/^Source item mapped/.test(last.baseSentence)?`${last.count} source references mapped to this initiative`:`${last.baseSentence} · ${last.count} records`;continue;}
  out.push({...e});}
 return out.map(({baseSentence:_b,count:_c,...e})=>e);
}

/** Newest first, 50 per page; the cursor is the last event's position key. */
export function pageHistory(events:HistoryEvent[],filter:{categories:HistoryCategory[];text:string},before:string|null,size=50){
 const text=filter.text.trim().toLowerCase();
 const matched=events.filter(e=>(!filter.categories.length||filter.categories.includes(e.category))&&(!text||`${e.label} ${e.sentence} ${e.rationale??''} ${e.actor}`.toLowerCase().includes(text)));
 const key=(e:HistoryEvent)=>`${e.at}|${e.id}`;const start=before?matched.findIndex(e=>key(e)<before):0;
 const page=start<0?[]:matched.slice(start,start+size);const last=page.at(-1);
 return {events:page,total:matched.length,next:last&&matched.indexOf(last)<matched.length-1?key(last):null};
}

/** ISO week label for grouping, e.g. "Week 39 · 21–27 Sept 2026". */
/** Grouped by the calendar day in the zone the timeline displays (Cairo), so a late-evening event never sits under the wrong week. */
export function weekOf(at:string,timeZone='Africa/Cairo'){const local=new Date(at).toLocaleDateString('en-CA',{timeZone});const d=new Date(`${/^\d{4}-\d{2}-\d{2}$/.test(local)?local:at.slice(0,10)}T12:00:00Z`);const day=(d.getUTCDay()+6)%7;const monday=new Date(d);monday.setUTCDate(d.getUTCDate()-day);const sunday=new Date(monday);sunday.setUTCDate(monday.getUTCDate()+6);
 const thursday=new Date(monday);thursday.setUTCDate(monday.getUTCDate()+3);const jan4=new Date(Date.UTC(thursday.getUTCFullYear(),0,4));const week=1+Math.round(((thursday.getTime()-jan4.getTime())/86_400_000-3+((jan4.getUTCDay()+6)%7))/7);
 const f=(x:Date,o:Intl.DateTimeFormatOptions)=>x.toLocaleDateString('en-GB',{...o,timeZone:'UTC'});
 return {key:`${thursday.getUTCFullYear()}-W${week}`,label:`Week ${week} · ${f(monday,{day:'numeric'})}${monday.getUTCMonth()!==sunday.getUTCMonth()?' '+f(monday,{month:'short'}):''}–${f(sunday,{day:'numeric',month:'short',year:'numeric'})}`};}
