import type {QuestionEvent,OpenQuestion} from './questions.ts';
import type {RiskEvent} from './risks.ts';
import type {RelationshipEvent} from './relationships.ts';
import {questionOverdueDays} from './questions.ts';

export interface WeeklyContextLine {id:string;kind:'RISK'|'QUESTION'|'DEPENDENCY'|'OVERDUE';text:string;href:string;at:string|null;}
/**
 * Risks, questions and dependencies that changed inside a review window, plus
 * questions overdue at its end. Derived from immutable timestamped events, so a
 * past window reads the same every time; it is never written into a Final.
 */
export function weeklyContextDelta(input:{initiativeId:string;slug:string;from:string|null;to:string;questions:OpenQuestion[];questionEvents:QuestionEvent[];riskEvents:RiskEvent[];relationshipEvents:RelationshipEvent[];names:Record<string,string>}):WeeklyContextLine[]{
 const inWindow=(at:string)=>(!input.from||at>input.from)&&at<=input.to;const base=`/initiatives/${input.slug}`;const out:WeeklyContextLine[]=[];
 for(const e of input.riskEvents)if(e.initiativeId===input.initiativeId&&inWindow(e.at)&&e.type!=='UPDATED')out.push({id:e.id,kind:'RISK',at:e.at,href:`${base}/context#risk-${e.claimId}`,text:e.type==='STARTED'?`Risk tracked: ${e.statement}`:e.type==='CARRIED'?`Risk tracking carried forward: ${e.statement}`:`Risk ${e.before?.status.toLowerCase()} → ${e.after.status.toLowerCase()}: ${e.statement}${e.note?` — ${e.note}`:''}`});
 for(const e of input.questionEvents)if(e.initiativeId===input.initiativeId&&inWindow(e.at)&&e.type!=='UPDATED')out.push({id:e.id,kind:'QUESTION',at:e.at,href:`${base}/context#question-${e.questionId}`,text:`Question ${e.type.toLowerCase()}: ${e.after.question}${e.type==='ANSWERED'?e.after.answerClaimId?' (answered by confirmed Knowledge)':' (answer note, not in Knowledge)':''}`});
 for(const e of input.relationshipEvents)if((e.fromInitiativeId===input.initiativeId||e.toInitiativeId===input.initiativeId)&&inWindow(e.at)&&e.type!=='UPDATED'){const r=e.after;out.push({id:e.id,kind:'DEPENDENCY',at:e.at,href:`${base}/manage?section=relationships#relationships`,text:`${e.type==='CONFIRMED'?'Relationship confirmed':'Relationship ended'}: ${input.names[r.fromInitiativeId]??'another initiative'} ${r.type==='DEPENDS_ON'?'depends on':r.type==='PART_OF'?'is part of':'is related to'} ${input.names[r.toInitiativeId]??'another initiative'}`});}
 const end=input.to.slice(0,10);
 // Overdue at the window end, reconstructed from each question's events up to then.
 for(const q of input.questions){if(q.initiativeId!==input.initiativeId)continue;const asOf=input.questionEvents.filter(e=>e.questionId===q.id&&e.at<=input.to).sort((a,b)=>a.seq-b.seq).at(-1)?.after;if(!asOf)continue;const days=questionOverdueDays(asOf,end);if(days)out.push({id:`overdue:${q.id}`,kind:'OVERDUE',at:null,href:`${base}/context#question-${q.id}`,text:`Question overdue ${days} ${days===1?'day':'days'}: ${asOf.question}`});}
 return out.sort((a,b)=>a.at===b.at?0:a.at===null?1:b.at===null?-1:a.at<b.at?-1:1);
}
