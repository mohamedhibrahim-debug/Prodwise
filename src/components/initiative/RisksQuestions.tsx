'use client';
import Link from 'next/link';
import {createContext,useContext,useState,useTransition} from 'react';
import {ScopeField} from '@/components/auth/WorkspaceScope';
import {questionAction,riskAction,type ContextActionState} from '@/app/initiatives/[slug]/context/actions';
import styles from './context.module.css';

type Status='OPEN'|'MITIGATING'|'ACCEPTED'|'CLOSED';
export interface RiskItem {claimId:string;subject:string;value:string;state:'TRACKED'|'NOT_TRACKED'|'AWAITING_VERIFICATION'|'SUPERSEDED';replacementClaimId:string|null;
 tracking:{id:string;revision:number;status:Status;ownerId:string|null;ownerName:string|null;mitigation:string|null;actionId:string|null;actionTitle:string|null;updatedAt:string}|null;
 source:{label:string;href:string}|null;canStatus:boolean;}
export interface QuestionItem {id:string;revision:number;question:string;status:'OPEN'|'ANSWERED'|'WITHDRAWN';ownerId:string|null;ownerName:string|null;confirmer:string|null;dueDate:string|null;overdueDays:number|null;
 origin:{label:string;href:string|null}|null;answerNote:string|null;answerClaim:{label:string;href:string}|null;resolvedBy:string|null;resolvedAt:string|null;reason:string|null;canDetails:boolean;canResolve:boolean;}
export interface Option {id:string;label:string;}
const STATUS:Record<Status,{label:string;glyph:string}>={OPEN:{label:'Open',glyph:'●'},MITIGATING:{label:'Mitigating',glyph:'◐'},ACCEPTED:{label:'Accepted',glyph:'◆'},CLOSED:{label:'Closed',glyph:'✓'}};
const day=(iso:string)=>new Date(iso.length===10?`${iso}T12:00:00Z`:iso).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:iso.length===10?'UTC':'Africa/Cairo'});
const rid=()=>crypto.randomUUID();
/** Rows can move between groups after a change (and remount); the outcome is announced here instead. */
const Notice=createContext<(m:{text:string;anchor:string})=>void>(()=>{});
function useCommand(action:(p:ContextActionState,f:FormData)=>Promise<ContextActionState>,anchor:string,onSuccess?:()=>void){
 const notify=useContext(Notice);const [pending,start]=useTransition();const [state,setState]=useState<ContextActionState>({error:null,message:null});const [requestId,setRequestId]=useState(rid);
 const run=(f:FormData)=>start(async()=>{const r=await action({error:null,message:null},f);setState(r.error?r:{error:null,message:null});if(!r.error){setRequestId(rid());onSuccess?.();notify({text:r.message??'Saved.',anchor:r.id&&anchor==='new-question'?`question-${r.id}`:anchor});}});
 return {run,pending,state,requestId};
}

function Feedback({state}:{state:ContextActionState}){return <>{state.error&&<p role="alert" className={styles.error}>{state.error}</p>}{state.message&&!state.error&&<p role="status" className={styles.ok}>✓ {state.message}</p>}</>;}
function Hidden({slug,op,id,revision,requestId}:{slug:string;op:string;id?:string;revision?:number;requestId:string}){return <><ScopeField/><input type="hidden" name="slug" value={slug}/><input type="hidden" name="operation" value={op}/>{id&&<input type="hidden" name="id" value={id}/>}<input type="hidden" name="expectedRevision" value={revision??0}/><input type="hidden" name="requestId" value={requestId}/></>;}

function RiskRow({r,slug,canManage,members,actions}:{r:RiskItem;slug:string;canManage:boolean;members:Option[];actions:Option[]}){
 const {run:act,pending,state,requestId}=useCommand(riskAction,`risk-${r.claimId}`);const [status,setStatus]=useState<Status>(r.tracking?.status??'OPEN');
 const t=r.tracking;const needsReason=status==='ACCEPTED'||status==='CLOSED';
 return <li className={styles.item} id={`risk-${r.claimId}`} data-status={t?.status.toLowerCase()??r.state.toLowerCase()}>
  <div className={styles.itemHead}>{t?<span className={styles.chip} data-status={t.status.toLowerCase()}><span aria-hidden="true">{STATUS[t.status].glyph}</span> {STATUS[t.status].label}</span>:r.state==='AWAITING_VERIFICATION'?<span className={styles.chip} data-status="unverified"><span aria-hidden="true">○</span> Awaiting verification</span>:r.state==='SUPERSEDED'?<span className={styles.chip} data-status="superseded"><span aria-hidden="true">↻</span> Statement superseded</span>:<span className={styles.chip} data-status="untracked"><span aria-hidden="true">●</span> Open · not tracked</span>}
   {t&&<span className={styles.updated}>Updated {day(t.updatedAt)}</span>}</div>
  <p className={styles.statement}><span>{r.subject}</span> {r.value}</p>
  {t&&<dl className={styles.facts}><div><dt>Owner</dt><dd>{t.ownerName??'No owner recorded'}</dd></div><div><dt>Mitigation</dt><dd>{t.mitigation??(t.actionTitle?'':'No mitigation recorded')}{t.actionTitle&&<> {t.mitigation?'· ':''}<Link prefetch={false} href={`/initiatives/${slug}/actions?action=${t.actionId}`}>Commitment: {t.actionTitle}</Link></>}</dd></div></dl>}
  <p className={styles.source}>{r.source?<Link prefetch={false} href={r.source.href}>Source · {r.source.label}</Link>:'Source · entered by hand'} · <Link prefetch={false} href={`/initiatives/${slug}/knowledge?view=all#claim-${r.claimId}`}>Knowledge entry</Link></p>
  <div className={styles.actions}>
   {r.state==='NOT_TRACKED'&&canManage&&<form action={act}><Hidden slug={slug} op="START" requestId={requestId}/><input type="hidden" name="claimId" value={r.claimId}/><button className={styles.secondary} disabled={pending}>{pending?'Starting…':'Track this risk'}</button></form>}
   {r.state==='AWAITING_VERIFICATION'&&<Link prefetch={false} className={styles.secondary} href={`/initiatives/${slug}/knowledge?view=all#claim-${r.claimId}`}>Verify in Knowledge</Link>}
   {r.state==='SUPERSEDED'&&t&&canManage&&r.replacementClaimId&&<form action={act}><Hidden slug={slug} op="CARRY" id={t.id} requestId={requestId}/><input type="hidden" name="claimId" value={r.replacementClaimId}/><button className={styles.secondary} disabled={pending}>Carry tracking forward</button></form>}
   {t&&r.state==='TRACKED'&&r.canStatus&&<details className={styles.more}><summary>Change status</summary><form action={act} className={styles.sheet}><Hidden slug={slug} op="STATUS" id={t.id} revision={t.revision} requestId={requestId}/>
    <fieldset className={styles.statusChoice}><legend>Status</legend>{(Object.keys(STATUS) as Status[]).map(s=><label key={s}><input type="radio" name="status" value={s} checked={status===s} onChange={()=>setStatus(s)} disabled={s===t.status}/><span aria-hidden="true">{STATUS[s].glyph}</span> {STATUS[s].label}{s===t.status?' (current)':''}</label>)}</fieldset>
    {needsReason&&<label>Why is it {status==='ACCEPTED'?'accepted':'closed'}?<textarea name="reason" rows={2} maxLength={2000} required/></label>}
    <button className={styles.primary} disabled={pending||status===t.status}>{pending?'Saving…':'Save status'}</button></form></details>}
   {t&&r.state==='TRACKED'&&canManage&&<details className={styles.more}><summary>Owner & mitigation</summary><form action={act} className={styles.sheet}><Hidden slug={slug} op="UPDATE" id={t.id} revision={t.revision} requestId={requestId}/>
    <label>Owner<select name="ownerMemberId" defaultValue={t.ownerId??''}><option value="">No owner</option>{members.map(m=><option key={m.id} value={m.id}>{m.label}</option>)}</select></label>
    <label>Mitigation <span className={styles.hint}>up to 500 characters</span><textarea name="mitigationText" rows={2} maxLength={500} defaultValue={t.mitigation??''}/></label>
    <label>Linked commitment<select name="mitigationActionId" defaultValue={t.actionId??''}><option value="">None</option>{actions.map(a=><option key={a.id} value={a.id}>{a.label}</option>)}</select></label>
    <button className={styles.primary} disabled={pending}>{pending?'Saving…':'Save'}</button></form></details>}
  </div>
  <Feedback state={state}/>
 </li>;
}

function QuestionRow({q,slug,members,claims}:{q:QuestionItem;slug:string;members:Option[];claims:Option[]}){
 const {run:act,pending,state,requestId}=useCommand(questionAction,`question-${q.id}`);const [mode,setMode]=useState<'note'|'claim'>('note');
 return <li className={styles.item} id={`question-${q.id}`} data-status={q.status.toLowerCase()} data-overdue={q.overdueDays?true:undefined}>
  <div className={styles.itemHead}><span className={styles.chip} data-status={q.status==='OPEN'?(q.overdueDays?'overdue':'question'):q.status.toLowerCase()}><span aria-hidden="true">{q.status==='OPEN'?'?':q.status==='ANSWERED'?'✓':'–'}</span> {q.status==='OPEN'?(q.overdueDays?`Overdue ${q.overdueDays} ${q.overdueDays===1?'day':'days'}`:'Open'):q.status==='ANSWERED'?'Answered':'Withdrawn'}</span>{q.origin&&(q.origin.href?<Link prefetch={false} className={styles.origin} href={q.origin.href}>{q.origin.label}</Link>:<span className={styles.origin}>{q.origin.label}</span>)}</div>
  <p className={styles.question}>{q.question}</p>
  <dl className={styles.facts}><div><dt>Who answers</dt><dd>{q.ownerName??q.confirmer??'Not decided'}{q.ownerName&&q.confirmer?` · expected confirmer ${q.confirmer}`:''}</dd></div><div><dt>Needed by</dt><dd>{q.dueDate?day(q.dueDate):'No date'}</dd></div></dl>
  {q.status==='ANSWERED'&&<p className={styles.answer}>{q.answerClaim?<><strong>Confirmed Knowledge →</strong> <Link prefetch={false} href={q.answerClaim.href}>{q.answerClaim.label}</Link></>:<><strong>Answer note — not in Knowledge.</strong> “{q.answerNote}”</>}<span> · {q.resolvedBy}{q.resolvedAt?`, ${day(q.resolvedAt)}`:''}</span></p>}
  {q.status==='WITHDRAWN'&&<p className={styles.answer}><strong>Withdrawn:</strong> {q.reason}<span> · {q.resolvedBy}{q.resolvedAt?`, ${day(q.resolvedAt)}`:''}</span></p>}
  <div className={styles.actions}>
   {q.status==='OPEN'&&q.canResolve&&<details className={styles.more} open={false}><summary className={styles.secondarySummary}>Answer</summary><form action={act} className={styles.sheet}><Hidden slug={slug} op="ANSWER" id={q.id} revision={q.revision} requestId={requestId}/>
    <fieldset className={styles.statusChoice}><legend>How was it answered?</legend><label><input type="radio" checked={mode==='note'} onChange={()=>setMode('note')}/> With a note</label><label><input type="radio" checked={mode==='claim'} onChange={()=>setMode('claim')} disabled={!claims.length}/> By a confirmed Knowledge entry{!claims.length?' (none confirmed yet)':''}</label></fieldset>
    {mode==='note'?<label>Answer<textarea name="answerNote" rows={2} maxLength={2000} required/><span className={styles.hint}>Kept as an answer note. It does not become Knowledge or change delivery facts.</span></label>:<label>Knowledge entry<select name="answerClaimId" required defaultValue=""><option value="" disabled>Choose a confirmed entry…</option>{claims.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}</select><span className={styles.hint}>Only confirmed entries can answer a question. <Link prefetch={false} href={`/initiatives/${slug}/knowledge/new`}>Record the answer as Knowledge</Link>, verify it, then link it here.</span></label>}
    <button className={styles.primary} disabled={pending}>{pending?'Saving…':'Record answer'}</button></form></details>}
   {q.status==='OPEN'&&(q.canDetails||q.canResolve)&&<details className={styles.more}><summary>More</summary><div className={styles.sheet}>
    {q.canDetails&&<form action={act} className={styles.subform}><Hidden slug={slug} op="EDIT" id={q.id} revision={q.revision} requestId={requestId}/><label>Question<textarea name="question" rows={2} maxLength={300} defaultValue={q.question} required/></label><div className={styles.two}><label>Who answers<select name="ownerMemberId" defaultValue={q.ownerId??''}><option value="">Not decided</option>{members.map(m=><option key={m.id} value={m.id}>{m.label}</option>)}</select></label><label>Needed by<input type="date" name="dueDate" defaultValue={q.dueDate??''}/></label></div><button className={styles.secondary} disabled={pending}>Save changes</button></form>}
    {q.canResolve&&<form action={act} className={styles.subform}><Hidden slug={slug} op="WITHDRAW" id={q.id} revision={q.revision} requestId={requestId}/><label>Why is it no longer relevant?<textarea name="reason" rows={2} maxLength={2000} required/></label><button className={styles.quiet} data-tone="danger" disabled={pending}>Withdraw question</button></form>}
   </div></details>}
   {q.status!=='OPEN'&&q.canResolve&&<details className={styles.more}><summary>Reopen</summary><form action={act} className={styles.sheet}><Hidden slug={slug} op="REOPEN" id={q.id} revision={q.revision} requestId={requestId}/><label>Why reopen it?<textarea name="reason" rows={2} maxLength={2000} required/></label><button className={styles.secondary} disabled={pending}>Reopen question</button></form></details>}
  </div>
  <Feedback state={state}/>
 </li>;
}

function Composer({slug,members}:{slug:string;members:Option[]}){
 const [text,setText]=useState('');const {run,pending,state,requestId}=useCommand(questionAction,'new-question',()=>setText(''));
 return <form action={run} className={styles.composer}><Hidden slug={slug} op="CREATE" requestId={requestId}/>
  <label className={styles.srOnly} htmlFor="new-question">Ask an open question</label><div className={styles.composerLine}><input id="new-question" name="question" value={text} onChange={e=>setText(e.target.value)} maxLength={300} placeholder="Ask an open question…" autoComplete="off"/><button className={styles.primary} disabled={pending||!text.trim()}>{pending?'Adding…':'Add question'}</button></div>
  {text.trim()&&<div className={styles.two}><label>Who answers <span className={styles.hint}>optional</span><select name="ownerMemberId" defaultValue=""><option value="">Not decided</option>{members.map(m=><option key={m.id} value={m.id}>{m.label}</option>)}</select></label><label>Needed by <span className={styles.hint}>optional</span><input type="date" name="dueDate"/></label></div>}
  <Feedback state={state}/></form>;
}

export function RisksQuestions({slug,risks,questions,members,claims,actions,canManageRisks,canAsk,readOnlyReason}:{slug:string;risks:RiskItem[];questions:QuestionItem[];members:Option[];claims:Option[];actions:Option[];canManageRisks:boolean;canAsk:boolean;readOnlyReason:string|null}){
 const [tab,setTab]=useState<'risks'|'questions'>(()=>typeof window!=='undefined'&&window.location.hash.startsWith('#question')?'questions':'risks');
 const [notice,setNotice]=useState<{text:string;anchor:string}|null>(null);
 const tracked=(s:Status)=>risks.filter(r=>r.state==='TRACKED'&&r.tracking?.status===s);
 const riskGroups:[string,RiskItem[],boolean][]=[['Open',[...tracked('OPEN'),...risks.filter(r=>r.state==='NOT_TRACKED')],true],['Mitigating',tracked('MITIGATING'),true],['Awaiting verification',risks.filter(r=>r.state==='AWAITING_VERIFICATION'),true],['Statement superseded',risks.filter(r=>r.state==='SUPERSEDED'),true],['Accepted',tracked('ACCEPTED'),true],['Closed',tracked('CLOSED'),false]];
 const open=questions.filter(q=>q.status==='OPEN').sort((a,b)=>(b.overdueDays??-1)-(a.overdueDays??-1)||(a.dueDate??'9').localeCompare(b.dueDate??'9'));
 const questionGroups:[string,QuestionItem[],boolean][]=[['Open',open,true],['Answered',questions.filter(q=>q.status==='ANSWERED'),true],['Withdrawn',questions.filter(q=>q.status==='WITHDRAWN'),false]];
 const openRisks=risks.filter(r=>r.state==='NOT_TRACKED'||r.tracking&&['OPEN','MITIGATING'].includes(r.tracking.status)&&r.state==='TRACKED').length;
 const renderGroups=<T,>(groups:[string,T[],boolean][],row:(x:T)=>React.ReactNode)=>groups.filter(([,items])=>items.length).map(([label,items,expanded])=>expanded?<section key={label} className={styles.group}><h4>{label} <span>{items.length}</span></h4><ul>{items.map(row)}</ul></section>:<details key={label} className={styles.group}><summary><h4>{label} <span>{items.length}</span></h4></summary><ul>{items.map(row)}</ul></details>);
 return <Notice.Provider value={setNotice}><div className={styles.workspace}>
  <p className={styles.notice} role="status" aria-live="polite">{notice&&<>✓ {notice.text} <a href={`#${notice.anchor}`}>Show it</a><button type="button" onClick={()=>setNotice(null)} aria-label="Dismiss">×</button></>}</p>
  <div className={styles.segmented} role="tablist" aria-label="Risks and open questions"><button role="tab" aria-selected={tab==='risks'} aria-controls="risks-panel" onClick={()=>setTab('risks')}>Risks ({risks.length})</button><button role="tab" aria-selected={tab==='questions'} aria-controls="questions-panel" onClick={()=>setTab('questions')}>Questions ({questions.length})</button></div>
  <div className={styles.columns}>
   <section id="risks-panel" className={styles.panel} data-active={tab==='risks'} aria-labelledby="risks-heading">
    <header className={styles.panelHead}><h3 id="risks-heading">Risks</h3><p>{openRisks} open · {tracked('MITIGATING').length} mitigating</p></header>
    <p className={styles.explain}>A risk is recorded in Knowledge first. Tracking adds status, an owner and mitigation; it never changes what the risk says.</p>
    {risks.length?renderGroups(riskGroups,r=><RiskRow key={r.claimId} r={r} slug={slug} canManage={canManageRisks} members={members} actions={actions}/>):<p className={styles.empty}>No risks recorded. Risks arrive from confirmed evidence or meeting notes, or from <Link prefetch={false} href={`/initiatives/${slug}/knowledge/new`}>a Knowledge entry you add</Link>.</p>}
    {!canManageRisks&&readOnlyReason&&<p className={styles.hint}>{readOnlyReason}</p>}
   </section>
   <section id="questions-panel" className={styles.panel} data-active={tab==='questions'} aria-labelledby="questions-heading">
    <header className={styles.panelHead}><h3 id="questions-heading">Open questions</h3><p>{open.length} open{open.some(q=>q.overdueDays)?` · ${open.filter(q=>q.overdueDays).length} overdue`:''}</p></header>
    <p className={styles.explain}>Unresolved questions are tracked until answered. An answer becomes a fact only when it links a confirmed Knowledge entry.</p>
    {canAsk&&<Composer slug={slug} members={members}/>}
    {questions.length?renderGroups(questionGroups,q=><QuestionRow key={q.id} q={q} slug={slug} members={members} claims={claims}/>):<p className={styles.empty}>No open questions.</p>}
   </section>
  </div>
 </div></Notice.Provider>;
}
