'use client';
import {ApplicabilityFields} from "../initiative/ApplicabilityFields";
import type {InitiativeContext} from "@/lib/workspace/readiness";

import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {useActionState,useState} from 'react';
import {ScopeField} from '@/components/auth/WorkspaceScope';
import {evidenceAction,batchEvidenceAction} from '@/app/initiatives/[slug]/evidence/actions';
import type {EvidenceState,MeetingNote,Proposal,ProposalType,Submission} from '@/lib/evidence/types';
import type {DeliveryMember} from '@/lib/delivery/types';
import styles from './evidence.module.css';

export interface WorkbenchClaim {id:string;subject:string;attribute:string;value:string;status:string;}
export interface WorkbenchRelationTarget {id:string;name:string;}
type Group={key:string;types:ProposalType[];meeting:string;evidence:string;lands:string};
/** Meeting order. Each group says where a confirmation lands, in plain words. */
const GROUPS:Group[]=[
 {key:'decided',types:['DECISION'],meeting:'Decided',evidence:'Decisions',lands:'Confirming adds a decision to Knowledge. It still needs verification before it counts as confirmed truth.'},
 {key:'commitments',types:['ACTION'],meeting:'Commitments',evidence:'Commitments',lands:'Confirming creates a commitment on this initiative. No owner or due date is inferred — choose them, or leave them unknown.'},
 {key:'risks',types:['RISK'],meeting:'Risks',evidence:'Risks',lands:'Confirming adds the risk to Knowledge. Once confirmed it can be tracked in Risks & questions.'},
 {key:'changed',types:['CHANGED_REQUIREMENT'],meeting:'Changed requirements',evidence:'Changed requirements',lands:'Confirming supersedes the current Knowledge entry. The earlier entry stays in history.'},
 {key:'dates',types:['DELIVERY'],meeting:'Date changes',evidence:'Delivery dates',lands:'Confirming updates delivery facts. Only the initiative owner or an administrator can confirm dates.'},
 {key:'questions',types:['OPEN_QUESTION'],meeting:'Open questions',evidence:'Open questions',lands:'Confirming opens a tracked question. A question is never recorded as a fact.'},
 {key:'related',types:['RELATIONSHIP'],meeting:'Related initiatives',evidence:'Related initiatives',lands:'Confirming records a relationship between initiatives once you choose its type and say why.'},
 {key:'knowledge',types:['REQUIREMENT','BUSINESS_RULE','ASSUMPTION','DEPENDENCY'],meeting:'Other knowledge',evidence:'Requirements & rules',lands:'Confirming adds to Knowledge as unverified. Verification is a separate step.'},
];
const KIND:Record<string,string>={DECISION:'Decision',ACTION:'Commitment',RISK:'Risk',CHANGED_REQUIREMENT:'Changed requirement',DELIVERY:'Date change',OPEN_QUESTION:'Open question',RELATIONSHIP:'Related initiative',REQUIREMENT:'Requirement',BUSINESS_RULE:'Business rule',ASSUMPTION:'Assumption',DEPENDENCY:'Dependency'};
const FACT:Record<string,string>={TARGET_LIVE:'Target Live',NEXT_MILESTONE:'Next milestone',DEV_STARTED:'Development start',ACTUAL_LIVE:'Actual Live'};
const day=(iso:string)=>new Date(`${iso.slice(0,10)}T12:00:00Z`).toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short',year:'numeric',timeZone:'UTC'});
const short=(iso:string)=>new Date(`${iso.slice(0,10)}T12:00:00Z`).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'});

function resultHref(slug:string,type:string,id:string){return type==='ACTION'?`/initiatives/${slug}/actions?action=${id}`:type==='DELIVERY'?`/initiatives/${slug}/delivery#delivery-history`:type==='QUESTION'?`/initiatives/${slug}/context#question-${id}`:type==='RELATIONSHIP'?`/initiatives/${slug}/manage#relationships`:`/initiatives/${slug}/knowledge?view=all#claim-${id}`;}
const RESULT:Record<string,string>={ACTION:'commitment',DELIVERY:'delivery fact',QUESTION:'open question',RELATIONSHIP:'relationship',KNOWLEDGE:'Knowledge entry · awaiting verification'};
function ResultLink({slug,type,id}:{slug:string;type:string;id:string}){return <Link className={styles.resultLink} href={resultHref(slug,type,id)} prefetch={false}>View {RESULT[type]??type.toLowerCase()} →</Link>;}

function Statement({p,claims,targets}:{p:Proposal;claims:WorkbenchClaim[];targets:WorkbenchRelationTarget[]}){
 if(p.type==='CHANGED_REQUIREMENT'){const current=claims.find(c=>c.id===p.payload.targetClaimId);return <div className={styles.change}><p className={styles.subject}>{p.payload.subject} · {p.payload.attribute}</p><p><span className={styles.was}>Current</span> <del>{current?.value??'Entry no longer available'}</del></p><p><span className={styles.now}>Proposed</span> <ins>{p.payload.value}</ins></p></div>;}
 if(p.type==='DELIVERY')return <><p className={styles.subject}>{FACT[p.payload.factKind??'']??'Delivery fact'}</p><p className={styles.statement}>{p.payload.date?short(p.payload.date):p.payload.value}{p.payload.factKind==='NEXT_MILESTONE'&&p.payload.date&&<span className={styles.aside}> · {p.payload.value}</span>}</p></>;
 if(p.type==='RELATIONSHIP')return <><p className={styles.subject}>Named in these notes</p><p className={styles.statement}>{targets.find(t=>t.id===p.payload.targetInitiativeId)?.name??'An initiative you can’t access'}</p></>;
 if(p.type==='ACTION'||p.type==='OPEN_QUESTION')return <p className={styles.statement}>{p.payload.value.charAt(0).toUpperCase()+p.payload.value.slice(1)}</p>;
 return <><p className={styles.subject}>{p.payload.subject} · {p.payload.attribute}</p><p className={styles.statement}>{p.payload.value}</p></>;
}

function ProposalCard({p,quote,slug,allowed,members,show,selected,toggle,duplicate,contexts,currentContextId,claims,targets,denied}:{p:Proposal;quote:string;slug:string;allowed:boolean;members:DeliveryMember[];show:()=>void;selected:boolean;toggle:()=>void;duplicate?:Proposal;contexts:InitiativeContext[];currentContextId:string|null;claims:WorkbenchClaim[];targets:WorkbenchRelationTarget[];denied:string|null}){
 const [requestId]=useState(()=>crypto.randomUUID());const [state,action,pending]=useActionState(evidenceAction,{error:null});const [reason,setReason]=useState('');const [draftValue,setDraftValue]=useState(p.payload.value);
 const open=p.status==='PENDING';const done=state.result||state.message&&!state.error;
 const statusText=p.status==='CONFIRMED'?'✓ Confirmed':p.status==='REJECTED'?'✕ Rejected':p.status==='SUPERSEDED_BY_HUMAN_ENTRY'?'✎ Replaced by your own entry':p.status==='OUTDATED'?'! Outdated':'○ Needs your decision';
 const people=members.filter(m=>m.active&&m.role!=='VIEWER');
 return <article className={styles.card} data-status={p.status.toLowerCase()} tabIndex={-1} id={`proposal-${p.id}`} aria-labelledby={`proposal-${p.id}-kind`}>
  <header><span id={`proposal-${p.id}-kind`} className={styles.kind}>{KIND[p.type]??p.type}</span><span className={styles.state}>{statusText}</span>{allowed&&open&&p.type!=='RELATIONSHIP'&&<label className={styles.select}><input type="checkbox" checked={selected} onChange={toggle}/><span className={styles.srOnly}>Select this {KIND[p.type]?.toLowerCase()} for batch confirmation</span></label>}</header>
  <Statement p={p} claims={claims} targets={targets}/>
  {p.status==='SUPERSEDED_BY_HUMAN_ENTRY'?<p className={styles.lands}>Replaced by your own entry · no AI quotation attached to the result.</p>:<figure className={styles.quote}><blockquote>{quote}</blockquote><figcaption><button type="button" className={styles.linkButton} onClick={show}>Show in {p.submissionId?'source':'evidence'}</button></figcaption></figure>}
  {duplicate&&<p className={styles.caution}>{duplicate.status==='CONFIRMED'?'A proposal with the same value or quote from this source was already confirmed. Confirming again creates a second record.':'A proposal with the same value or quote was replaced by a human entry. Confirming again creates another record.'} {duplicate.resultId&&<ResultLink slug={slug} type={duplicate.resultType!} id={duplicate.resultId}/>}</p>}
  {p.resultId&&<p className={styles.outcome}><ResultLink slug={slug} type={p.resultType!} id={p.resultId}/>{p.reason&&<span> · “{p.reason}”</span>}</p>}
  {p.status==='REJECTED'&&p.reason&&<p className={styles.outcome}>Rejected · “{p.reason}”</p>}
  {p.status==='OUTDATED'&&<p className={styles.caution}>{p.type==='CHANGED_REQUIREMENT'?'The Knowledge entry this targets changed after the notes were read. Nothing was changed.':'The delivery fact changed after this was read. Nothing was changed.'}</p>}
  {p.status==='OUTDATED'&&allowed&&p.type==='DELIVERY'&&<form action={action}><ScopeField/><input type="hidden" name="slug" value={slug}/><input type="hidden" name="proposalId" value={p.id}/><button name="operation" value="REPROPOSE" disabled={pending}>Propose again from current record</button></form>}
  {open&&allowed&&!done?<form action={action} onReset={e=>e.preventDefault()} className={styles.decide}><ScopeField/><input type="hidden" name="slug" value={slug}/><input type="hidden" name="proposalId" value={p.id}/><input type="hidden" name="version" value={p.version}/><input type="hidden" name="requestId" value={requestId}/>
   {(p.type==='ACTION'||p.type==='OPEN_QUESTION')&&<div className={styles.fields}><label>{p.type==='ACTION'?'Owner':'Who should answer'}<select name="assigneeMemberId" defaultValue=""><option value="">Not decided</option>{people.map(m=><option key={m.id} value={m.id}>{m.displayName}</option>)}</select></label><label><span>{p.type==='ACTION'?'Due':'Answer needed by'} <span className={styles.optional}>optional</span></span><input type="date" name="dueDate"/></label></div>}
   <div className={styles.buttons}><button className={styles.primary} name="operation" value="CONFIRM" disabled={pending}>{pending?'Saving…':'Confirm'}</button><button name="operation" value="REJECT" disabled={pending}>Reject</button></div>
   <details className={styles.more}><summary>More options</summary>
    <label><span>Note <span className={styles.optional}>optional · kept with your decision</span></span><textarea name="reason" value={reason} onChange={e=>setReason(e.target.value)} maxLength={2000} rows={2}/></label>
    {!['ACTION','OPEN_QUESTION','CHANGED_REQUIREMENT'].includes(p.type)&&<ApplicabilityFields contexts={contexts} contextId={currentContextId} effectiveDate={null} slug={slug}/>}
    <label>Wording<textarea name="value" value={draftValue} onChange={e=>setDraftValue(e.target.value)} rows={2}/></label>
    <p className={styles.fieldHelp}>Spacing, case and punctuation fixes keep the quote. A change of meaning becomes your own entry: it needs a note and carries no AI quotation.</p>
    <div className={styles.buttons}><button name="operation" value="EDIT" disabled={pending}>Save wording fix</button>{p.type!=='DELIVERY'&&<button name="operation" value="HUMAN_ENTRY" disabled={pending}>Add as my own entry</button>}{p.type==='DELIVERY'&&<Link className={styles.control} href={`/initiatives/${slug}/delivery`} prefetch={false}>Enter the date myself</Link>}</div>
   </details>
  </form>:open&&!allowed?<p className={styles.readOnly}>{denied??'Read-only for your role.'}</p>:null}
  {state.error&&<p role="alert" className={styles.error}>{state.error}</p>}{state.message&&!state.error&&<p role="status" className={styles.outcome}>{state.message}</p>}{state.result&&<p className={styles.outcome}><ResultLink slug={slug} type={state.result.type} id={state.result.id}/></p>}
 </article>;
}

function MeetingDetails({slug,meeting,canCorrect}:{slug:string;meeting:MeetingNote;canCorrect:boolean}){
 const [state,action,pending]=useActionState(evidenceAction,{error:null});
 return <div className={styles.meetingMeta}><span>{day(meeting.meetingDate)}</span>{meeting.attendeesText&&<span>With {meeting.attendeesText}</span>}{canCorrect&&<details className={styles.correct}><summary>Correct details</summary><form action={action}><ScopeField/><input type="hidden" name="slug" value={slug}/><input type="hidden" name="operation" value="CORRECT_MEETING"/><input type="hidden" name="submissionId" value={meeting.submissionId}/><input type="hidden" name="expectedRevision" value={meeting.revision}/><label>Title<input name="title" defaultValue={meeting.title} maxLength={160} required/></label><label>Date<input type="date" name="meetingDate" defaultValue={meeting.meetingDate} required/></label><label>Attendees<input name="attendees" defaultValue={meeting.attendeesText??''} maxLength={500}/></label><p className={styles.fieldHelp}>The notes themselves never change.</p><button disabled={pending}>{pending?'Saving…':'Save details'}</button>{state.error&&<p role="alert" className={styles.error}>{state.error}</p>}{state.message&&<p role="status">{state.message}</p>}</form></details>}</div>;
}

export function Workbench({slug,initiativeName,submission,evidence,writer,canDelivery,canCorrect,members,contexts,currentContextId,claims,targets}:{slug:string;initiativeName:string;submission:Submission;evidence:EvidenceState;writer:boolean;canDelivery:boolean;canCorrect:boolean;members:DeliveryMember[];contexts:InitiativeContext[];currentContextId:string|null;claims:WorkbenchClaim[];targets:WorkbenchRelationTarget[]}){
 const router=useRouter();const [stopMessage,setStopMessage]=useState('');const [tab,setTab]=useState<'evidence'|'proposals'>('proposals');const [selectedForBatch,setSelectedForBatch]=useState<Record<string,string>>({});const [batchState,batchAction,batchPending]=useActionState(batchEvidenceAction,{error:null});const [selected,setSelected]=useState<string|null>(null);const [readState,action,pending]=useActionState(evidenceAction,{error:null});const [attemptRequest,setAttemptRequest]=useState(()=>crypto.randomUUID());
 const meeting=submission.kind==='MEETING_NOTES'?evidence.meetings?.find(m=>m.submissionId===submission.id)??null:null;
 const attempts=evidence.attempts.filter(a=>a.submissionId===submission.id),latest=attempts.at(-1),proposals=evidence.proposals.filter(p=>p.submissionId===submission.id);
 const allowedFor=(p:Proposal)=>writer&&(p.type!=='DELIVERY'||canDelivery);
 const batchCommands=proposals.filter(p=>p.status==='PENDING'&&selectedForBatch[p.id]&&allowedFor(p)&&p.type!=='RELATIONSHIP').map(p=>({id:p.id,version:p.version,requestId:selectedForBatch[p.id]}));
 function toggleBatch(p:Proposal){setSelectedForBatch(previous=>{const next={...previous};if(next[p.id])delete next[p.id];else next[p.id]=crypto.randomUUID();return next;});}
 function show(p:Proposal){setSelected(p.id);setTab('evidence');requestAnimationFrame(()=>{const q=document.getElementById('evidence-quote');q?.focus();q?.scrollIntoView({block:'center',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});});}
 const [reviewedHere]=useState(()=>new Set(evidence.proposals.filter(p=>p.submissionId===submission.id&&(p.status==='PENDING'||p.status==='OUTDATED')).map(p=>p.id)));
 const anchor=evidence.anchors.find(a=>a.id===proposals.find(p=>p.id===selected)?.anchorId);
 const count=(f:(p:Proposal)=>boolean)=>proposals.filter(f).length;
 const confirmed=count(p=>p.status==='CONFIRMED'||p.status==='SUPERSEDED_BY_HUMAN_ENTRY'),rejected=count(p=>p.status==='REJECTED'),pendingCount=count(p=>p.status==='PENDING'),outdated=count(p=>p.status==='OUTDATED');
 const reader=latest?.model==='synthetic-provider-fixture'?'a synthetic test fixture (not Claude)':latest?.model?`Claude (${latest.model})`:'Claude';
 const readingLine=pending&&!stopMessage?'Reading with Claude…':stopMessage?'Reading stopped':!latest?'Not read yet':latest.status==='READY'?`Read by ${reader}`:latest.status==='READING'?'Reading…':latest.status==='TIMED_OUT'?'Reading timed out':latest.status==='STOPPED'?'Reading stopped':'Reading did not complete';
 const duplicateOf=(p:Proposal)=>proposals.find(other=>other.id!==p.id&&['CONFIRMED','SUPERSEDED_BY_HUMAN_ENTRY'].includes(other.status)&&other.type===p.type&&(other.payload.value.trim()===p.payload.value.trim()||evidence.anchors.find(a=>a.id===other.anchorId)?.quote===evidence.anchors.find(a=>a.id===p.anchorId)?.quote)&&other.payload.phase===p.payload.phase&&other.payload.factKind===p.payload.factKind);
 const renderGroups=(rows:Proposal[])=>GROUPS.map(g=>{const items=rows.filter(p=>g.types.includes(p.type));if(!items.length)return null;return <section key={g.key} className={styles.group} aria-labelledby={`group-${g.key}-${rows===proposals?'all':'x'}`}><h4 id={`group-${g.key}-${rows===proposals?'all':'x'}`}>{meeting?g.meeting:g.evidence} <span>{items.length}</span></h4>{rows.some(p=>p.status==='PENDING')&&<p className={styles.lands}>{g.lands}</p>}{items.map(p=><ProposalCard key={p.id} contexts={contexts} currentContextId={currentContextId} claims={claims} targets={targets} p={p} quote={evidence.anchors.find(x=>x.id===p.anchorId)?.quote??'Quote unavailable'} slug={slug} allowed={allowedFor(p)} denied={!writer?null:'Only the initiative owner or an administrator can confirm date changes.'} members={members} show={()=>show(p)} selected={Boolean(selectedForBatch[p.id])} toggle={()=>toggleBatch(p)} duplicate={duplicateOf(p)}/>)}</section>;});
 // Cards decided during this visit stay where they were, showing their outcome, until the next visit.
 const inReview=(p:Proposal)=>p.status==='PENDING'||p.status==='OUTDATED'||reviewedHere.has(p.id);
 const pendingRows=proposals.filter(inReview),handledRows=proposals.filter(p=>!inReview(p));
 return <div className={styles.page}>
  <header className={styles.heading}><div><p className={styles.eyebrow}>{meeting?'Meeting notes':'Saved evidence'} · {initiativeName}</p><h2>{meeting?.title??submission.title}</h2>{meeting?<MeetingDetails slug={slug} meeting={meeting} canCorrect={canCorrect&&writer}/>:<p className={styles.meetingMeta}><span>Saved {short(submission.createdAt)}</span><span>{submission.charLength.toLocaleString()} characters</span></p>}</div><Link href={`/initiatives/${slug}/evidence`} prefetch={false}>← All saved evidence</Link></header>
  <div className={styles.readBar} data-state={latest?.status??'NONE'}>
   <p className={styles.readStatus} role="status"><strong>{readingLine}</strong>{latest?.status==='READY'&&latest.endedAt&&<span> · {new Date(latest.endedAt).toLocaleString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit',timeZone:'Africa/Cairo'})} Cairo</span>}{latest?.discardedCount?<span> · {latest.discardedCount} unsupported {latest.discardedCount===1?'candidate':'candidates'} discarded before saving</span>:null}</p>
   {writer&&<form action={action}><ScopeField/><input type="hidden" name="slug" value={slug}/><input type="hidden" name="submissionId" value={submission.id}/><input type="hidden" name="operation" value="READ"/><input type="hidden" name="requestId" value={attemptRequest}/><button className={!latest?styles.primary:undefined} disabled={pending} onClick={()=>{setStopMessage('');setAttemptRequest(crypto.randomUUID());}}>{pending?'Reading…':latest?'Read again':meeting?'Read these notes with Claude':'Read with Claude'}</button></form>}
   {pending&&<button type="button" onClick={async()=>{const r=await fetch(`/api/evidence/${submission.id}/stop`,{method:'POST'});if(r.ok){setStopMessage('Reading stopped. Your text stays saved.');router.refresh();}else setStopMessage('Stop was refused under your current access.');}}>Stop</button>}
  </div>
  {latest?.errorCode&&<p role="status" className={styles.caution}>Your text is saved. {latest.errorCode==='NOT_CONFIGURED'?'Claude is not configured in this environment, so nothing was read.':latest.errorCode==='TIMED_OUT'||latest.errorCode==='READING_EXPIRED'?'Reading took too long and was stopped.':'Reading did not complete.'} {writer?'You can read again, or add your own entries.':''}</p>}
  {stopMessage&&<p role="status" className={styles.caution}>{stopMessage}</p>}
  {readState.error&&<p role="alert" className={styles.error}>{readState.error}</p>}
  {proposals.length>0&&<p className={styles.wrapUp} aria-live="polite"><strong>{confirmed} confirmed</strong> · {rejected} rejected · <strong>{pendingCount} pending</strong>{outdated?` · ${outdated} outdated`:''} <span>— pending items stay here; nothing is added until you confirm.</span></p>}
  <div className={styles.mobileTabs} role="tablist" aria-label="Evidence workbench"><button role="tab" aria-selected={tab==='evidence'} aria-controls="workbench-source" onClick={()=>setTab('evidence')}>{meeting?'Notes':'Evidence'}</button><button role="tab" aria-selected={tab==='proposals'} aria-controls="workbench-proposals" onClick={()=>setTab('proposals')}>Proposals ({proposals.length})</button></div>
  <div className={styles.layout}>
   <section id="workbench-source" className={styles.evidence} data-active={tab==='evidence'} aria-label={meeting?'Meeting notes as pasted':'Saved evidence'}><h3>{meeting?'Notes as pasted':'Original evidence'} <span>read-only</span></h3><p className={styles.meta}><Link href={`/sources/${submission.sourceItemId}`} prefetch={false}>Source record</Link> · saved {short(submission.createdAt)}</p>{anchor?<><pre>{submission.text.slice(0,anchor.start)}<mark id="evidence-quote" tabIndex={-1}>{anchor.quote}</mark>{submission.text.slice(anchor.end)}</pre><button type="button" className={styles.linkButton} onClick={()=>{setTab('proposals');requestAnimationFrame(()=>document.getElementById(`proposal-${selected}`)?.focus());}}>← Back to the proposal</button></>:<pre>{submission.text}</pre>}</section>
   <section id="workbench-proposals" className={styles.proposals} data-active={tab==='proposals'} aria-label="Proposed understanding">
    {batchState.message&&<section className={styles.caution} aria-label="Batch results"><p role="status">{batchState.message}</p>{batchState.batch?.map(r=><p key={r.proposalId}>{proposals.find(p=>p.id===r.proposalId)?.payload.value??'Proposal'} · {r.error??'Confirmed'} {r.result&&<ResultLink slug={slug} type={r.result.type} id={r.result.id}/>}</p>)}</section>}
    {batchState.error&&<p role="alert" className={styles.error}>{batchState.error}</p>}
    {!proposals.length&&<div className={styles.empty}><h4>{latest?.status==='READY'?'Nothing supported was found':meeting?'Read the notes to see what was decided':'Read the evidence to propose understanding'}</h4><p>{latest?.status==='READY'?'No record was created. You can still add your own entries.':meeting?'Claude will propose decisions, commitments, risks, changed requirements, date changes and open questions, each with the exact words it came from. You confirm what becomes a record.':'Claude will propose Knowledge, commitments and dates with exact quotes. You confirm what becomes a record.'}</p>{writer&&latest?.status==='READY'&&<Link className={styles.control} href={`/initiatives/${slug}/knowledge/new`} prefetch={false}>Add my own entry</Link>}</div>}
    {pendingRows.length>0&&<><h3 className={styles.stage}>{pendingCount+outdated?'Needs your decision':'Reviewed in this visit'} <span>{pendingCount+outdated||pendingRows.length}</span></h3>{renderGroups(pendingRows)}</>}
    {handledRows.length>0&&<details className={styles.history} open={!pendingRows.length}><summary>Decided <span>{handledRows.length}</span></summary>{renderGroups(handledRows)}</details>}
    {writer&&batchCommands.length>0&&<form action={batchAction} className={styles.batch}><ScopeField/><input type="hidden" name="slug" value={slug}/><input type="hidden" name="commands" value={JSON.stringify(batchCommands)}/><p><strong>{batchCommands.length} selected.</strong> Each is confirmed separately; commitments and questions stay without owner or date.</p><button className={styles.primary} disabled={batchPending}>{batchPending?'Confirming…':`Confirm ${batchCommands.length} selected`}</button><button type="button" onClick={()=>setSelectedForBatch({})} disabled={batchPending}>Clear</button></form>}
   </section>
  </div>
 </div>;
}
