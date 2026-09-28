import Link from 'next/link';
import {notFound} from 'next/navigation';
import {readDelivery} from '@/lib/delivery/repository';
import {ownerFor} from '@/lib/delivery/model';
import {readQuestions} from '@/lib/data/questions';
import {readRisks} from '@/lib/data/risks';
import {readCommitments} from '@/lib/data/commitments';
import {readEvidence} from '@/lib/evidence/service';
import {canBusinessWrite} from '@/lib/auth/roles';
import {isDemoWriteEnabled,WRITE_DISABLED_MESSAGE} from '@/lib/env';
import {riskViews,canManageRisk,canChangeRiskStatus} from '@/lib/workspace/risks';
import {canChangeQuestion,questionOverdueDays} from '@/lib/workspace/questions';
import {RisksQuestions,type RiskItem,type QuestionItem} from '@/components/initiative/RisksQuestions';
import styles from '@/components/initiative/context-page.module.css';
export const metadata={title:'Risks & open questions'};export const dynamic='force-dynamic';
const short=(iso:string)=>new Date(iso.length===10?`${iso}T12:00:00Z`:iso).toLocaleDateString('en-GB',{day:'numeric',month:'short',timeZone:iso.length===10?'UTC':'Africa/Cairo'});
export default async function Context({params}:{params:Promise<{slug:string}>}){
 const [{slug},d,qs,rs,cs]=await Promise.all([params,readDelivery(),readQuestions(),readRisks(),readCommitments()]);
 const snap=d.source.snapshots.find(s=>s.initiative.slug===slug);if(!snap)notFound();const i=snap.initiative;const base=`/initiatives/${slug}`;
 const ev=await readEvidence(i.id);const owner=ownerFor(d.state.facts,i.id);const writer=canBusinessWrite(d.ctx)&&!i.archivedAt&&isDemoWriteEnabled;
 const today=(d.presentation.scenarioAt??new Date().toISOString()).slice(0,10);
 const member=(id:string|null)=>d.source.members.find(m=>m.id===id)?.displayName??null;
 const sourceOf=(claimId:string)=>{const p=ev.proposals.find(p=>p.resultId===claimId);const sub=p&&ev.submissions.find(s=>s.id===p.submissionId);if(!sub)return null;const m=ev.meetings?.find(x=>x.submissionId===sub.id);return {label:`${m?.title??sub.title}, ${short(m?.meetingDate??sub.createdAt)}`,href:`${base}/evidence/${sub.id}#proposal-${p!.id}`};};
 const actions=cs.actions.filter(a=>a.initiativeId===i.id);
 const risks:RiskItem[]=riskViews(snap.claims.map(c=>({id:c.id,initiativeId:i.id,type:c.type,status:c.status,subject:c.subject,value:c.value,supersededByClaimId:c.supersededByClaimId??null})),rs.tracking.filter(t=>t.initiativeId===i.id),i.id).map(v=>({claimId:v.claim.id,subject:v.claim.subject,value:v.claim.value,state:v.state,replacementClaimId:v.claim.supersededByClaimId,
  tracking:v.tracking?{id:v.tracking.id,revision:v.tracking.revision,status:v.tracking.status,ownerId:v.tracking.ownerMemberId,ownerName:member(v.tracking.ownerMemberId),mitigation:v.tracking.mitigationText,actionId:v.tracking.mitigationActionId,actionTitle:actions.find(a=>a.id===v.tracking!.mitigationActionId)?.title??null,updatedAt:v.tracking.updatedAt}:null,
  source:sourceOf(v.claim.id),canStatus:writer&&Boolean(v.tracking)&&canChangeRiskStatus(d.ctx,v.tracking!,owner)}));
 const claimLabel=(id:string)=>{const c=snap.claims.find(c=>c.id===id);return c?{label:`${c.subject} · ${c.attribute}: ${c.value}`,href:`${base}/knowledge?view=all#claim-${c.id}`}:{label:'A Knowledge entry',href:`${base}/knowledge?view=all`};};
 const questions:QuestionItem[]=qs.questions.filter(q=>q.initiativeId===i.id).map(q=>({id:q.id,revision:q.revision,question:q.question,status:q.status,ownerId:q.ownerMemberId,ownerName:member(q.ownerMemberId),confirmer:q.expectedConfirmerText,dueDate:q.dueDate,overdueDays:questionOverdueDays(q,today),
  origin:q.origin==='HUMAN_ENTRY'?{label:`Asked by ${q.createdByLabel}`,href:null}:{label:`From ${q.originLabel??(q.origin==='WEEKLY_REVIEW'?'Weekly Review':'saved evidence')}`,href:q.originHref},answerNote:q.answerNote,answerClaim:q.answerClaimId?claimLabel(q.answerClaimId):null,resolvedBy:q.resolvedByLabel,resolvedAt:q.resolvedAt,reason:q.resolutionReason,
  canDetails:writer&&canChangeQuestion(d.ctx,q,owner,'DETAILS'),canResolve:writer&&canChangeQuestion(d.ctx,q,owner,'RESOLVE')}));
 const people=d.source.members.filter(m=>m.active&&m.role!=='VIEWER').map(m=>({id:m.id,label:m.displayName}));
 return <div className={styles.page}><header className={styles.heading}><div><p className={styles.eyebrow}><Link prefetch={false} href={base}>{i.name}</Link> · Initiative context</p><h2>Risks & open questions</h2><p>What could go wrong, and what nobody has answered yet — tracked until someone resolves it.</p></div>
  <nav className={styles.links} aria-label="Related">{writer&&<Link prefetch={false} href={`${base}/evidence/new?kind=meeting`}>Add meeting notes</Link>}<Link prefetch={false} href={`${base}/history?c=RISKS_QUESTIONS`}>History</Link></nav></header>
  {i.archivedAt&&<p className={styles.notice}>Archived — read-only. Restore the initiative to change risks or questions.</p>}
  <RisksQuestions slug={slug} risks={risks} questions={questions} members={people} claims={snap.claims.filter(c=>c.status==='ACTIVE').map(c=>({id:c.id,label:`${c.subject} · ${c.attribute}: ${c.value}`}))} actions={actions.filter(a=>a.status==='OPEN'||a.status==='IN_PROGRESS').map(a=>({id:a.id,label:a.title}))} canManageRisks={writer&&canManageRisk(d.ctx,owner)} canAsk={writer} readOnlyReason={!canBusinessWrite(d.ctx)?'Your role is read-only.':i.archivedAt?null:!isDemoWriteEnabled?WRITE_DISABLED_MESSAGE:'Tracking risks is for the initiative owner, a Product Lead or an administrator.'}/></div>;
}
