'use client';
import {useFormAction} from '@/components/forms/useFormAction';
import Link from 'next/link';
import {useState} from 'react';
import {ScopeField} from '@/components/auth/WorkspaceScope';
import {relationshipAction} from '@/app/initiatives/[slug]/manage/relationship-actions';
import styles from './relationships.module.css';

export interface RelationshipRowView {id:string;revision:number;group:'DEPENDS_ON'|'BLOCKS'|'PART_OF'|'CONTAINS'|'RELATED_TO';type:'DEPENDS_ON'|'PART_OF'|'RELATED_TO';outgoing:boolean;other:{name:string;slug:string;archived:boolean}|null;rationale:string;impactText:string|null;late:boolean;assessed:boolean;providerFactKind:string|null;neededByFactKind:string|null;confirmedBy:string;confirmedAt:string;originHref:string|null;endedBy:string|null;endedAt:string|null;endReason:string|null;}
export interface RelationshipCandidate {id:string;name:string;archived:boolean;targetLive:string|null;nextMilestone:string|null;}
const GROUP:Record<RelationshipRowView['group'],{label:string;hint:string}>={
 DEPENDS_ON:{label:'Depends on',hint:'This initiative needs these to deliver first.'},
 BLOCKS:{label:'Needed by',hint:'Recorded by these initiatives: they depend on this one.'},
 PART_OF:{label:'Part of',hint:''},CONTAINS:{label:'Contains',hint:'Recorded by the part initiatives.'},RELATED_TO:{label:'Related to',hint:''}};
const FACT:Record<string,string>={TARGET_LIVE:'Target Live',NEXT_MILESTONE:'Next milestone'};
/** Mid-sentence form: Target Live stays a proper name; a milestone does not. */
const mid=(k:string)=>k==='TARGET_LIVE'?'Target Live':'next milestone';
const day=(iso:string)=>new Date(iso.length===10?`${iso}T12:00:00Z`:iso).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:iso.length===10?'UTC':'Africa/Cairo'});

function RowActions({row,slug}:{row:RelationshipRowView;slug:string}){
 const [state, action, pending, keepAction] = useFormAction(relationshipAction,{error:null,message:null});const [requestId]=useState(()=>crypto.randomUUID());
 const [rationale,setRationale]=useState(row.rationale);const [reason,setReason]=useState('');const [dates,setDates]=useState(Boolean(row.providerFactKind));
 return <div className={styles.rowActions}>
  <details><summary>Edit</summary><form action={action} onReset={keepAction} className={styles.inlineForm}><ScopeField/><input type="hidden" name="slug" value={slug}/><input type="hidden" name="operation" value="UPDATE"/><input type="hidden" name="id" value={row.id}/><input type="hidden" name="expectedRevision" value={row.revision}/><input type="hidden" name="requestId" value={requestId}/>
   <label>Why they are related<textarea name="rationale" rows={2} maxLength={1000} value={rationale} onChange={e=>setRationale(e.target.value)} required/></label>
   {row.type==='DEPENDS_ON'&&<DateChoice checked={dates} onToggle={setDates} provider={row.providerFactKind} needed={row.neededByFactKind} targetName={row.other?.name??'The other initiative'}/>}
   <button className={styles.primary} disabled={pending}>{pending?'Saving…':'Save changes'}</button></form></details>
  <details><summary>End relationship…</summary><form action={action} onReset={keepAction} className={styles.inlineForm}><ScopeField/><input type="hidden" name="slug" value={slug}/><input type="hidden" name="operation" value="END"/><input type="hidden" name="id" value={row.id}/><input type="hidden" name="expectedRevision" value={row.revision}/><input type="hidden" name="requestId" value={requestId}/>
   <label>Why it no longer applies<textarea name="reason" rows={2} maxLength={1000} value={reason} onChange={e=>setReason(e.target.value)} required/></label><p className={styles.help}>Ending keeps the relationship in both initiatives’ history.</p>
   <button className={styles.destructive} data-tone="danger" disabled={pending||!reason.trim()}>{pending?'Ending…':'End relationship'}</button>{!reason.trim()&&<p className="disabled-reason">Add the reason for ending it — it is kept in history.</p>}</form></details>
  {state.error&&<p role="alert" className={styles.error}>{state.error}</p>}{state.message&&<p role="status" className={styles.ok}>{state.message}</p>}
 </div>;
}

function DateChoice({checked,onToggle,provider,needed,targetName}:{checked:boolean;onToggle:(v:boolean)=>void;provider:string|null;needed:string|null;targetName:string}){
 return <fieldset className={styles.dates}><legend className={styles.srOnly}>Dates that matter</legend>
  <label className={styles.check}><input type="checkbox" name="withDates" checked={checked} onChange={e=>onToggle(e.target.checked)}/>Compare recorded dates</label>
  {checked&&<p className={styles.sentence}><span>{targetName}’s</span><select name="providerFactKind" defaultValue={provider??'TARGET_LIVE'} aria-label={`${targetName} date`}><option value="TARGET_LIVE">Target Live</option><option value="NEXT_MILESTONE">Next milestone</option></select><span>must land before this initiative’s</span><select name="neededByFactKind" defaultValue={needed??'NEXT_MILESTONE'} aria-label="This initiative’s date"><option value="NEXT_MILESTONE">Next milestone</option><option value="TARGET_LIVE">Target Live</option></select></p>}
  <p className={styles.help}>Prodwise only shows a date impact when both recorded dates are known. Nothing is estimated.</p>
 </fieldset>;
}

function Composer({slug,self,candidates,open}:{slug:string;self:{id:string;name:string;targetLive:string|null;nextMilestone:string|null};candidates:RelationshipCandidate[];open:boolean}){
 const [state, action, pending, keepAction] = useFormAction(relationshipAction,{error:null,message:null});const [requestId,setRequestId]=useState(()=>crypto.randomUUID());
 const [type,setType]=useState<'DEPENDS_ON'|'PART_OF'|'RELATED_TO'>('DEPENDS_ON');const [target,setTarget]=useState('');const [rationale,setRationale]=useState('');const [dates,setDates]=useState(false);const [provider,setProvider]=useState('TARGET_LIVE');const [needed,setNeeded]=useState('NEXT_MILESTONE');
 // A recorded relationship clears the composer and takes a fresh request id.
 const [handled,setHandled]=useState<string|undefined>(undefined);
 if(state.id&&state.id!==handled){setHandled(state.id);setRequestId(crypto.randomUUID());setTarget('');setRationale('');setDates(false);}
 const t=candidates.find(c=>c.id===target);
 const p=t?(provider==='TARGET_LIVE'?t.targetLive:t.nextMilestone):null,n=needed==='TARGET_LIVE'?self.targetLive:self.nextMilestone;
 const preview=!t||type!=='DEPENDS_ON'||!dates?null:!p?`${t.name} ${FACT[provider]??provider} is not recorded, so no impact will be shown.`:!n?`${self.name}’s ${mid(needed)} is not recorded, so no impact will be shown.`:p>n?`Today this would show an impact: ${t.name} ${FACT[provider]??provider} (${day(p)}) is after ${self.name}’s ${mid(needed)} (${day(n)}).`:`Today no impact: ${t.name} ${FACT[provider]??provider} (${day(p)}) is on or before ${self.name}’s ${mid(needed)} (${day(n)}).`;
 return <><details className={styles.composer} open={open}><summary>Record a relationship</summary>
  <form action={action} onReset={keepAction}><ScopeField/><input type="hidden" name="slug" value={slug}/><input type="hidden" name="operation" value="CREATE"/><input type="hidden" name="requestId" value={requestId}/><input type="hidden" name="fromInitiativeId" value={self.id}/>
   <p className={styles.sentence}><strong>{self.name}</strong>
    <select name="type" value={type} onChange={e=>setType(e.target.value as typeof type)} aria-label="Relationship"><option value="DEPENDS_ON">depends on</option><option value="PART_OF">is part of</option><option value="RELATED_TO">is related to</option></select>
    <select name="toInitiativeId" value={target} onChange={e=>setTarget(e.target.value)} aria-label="Other initiative" required><option value="">Choose an initiative…</option>{candidates.filter(c=>!c.archived).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></p>
   <label className={styles.block}>Why? <span className={styles.help}>Shown wherever the relationship appears.</span><textarea name="rationale" rows={2} maxLength={1000} value={rationale} onChange={e=>setRationale(e.target.value)} placeholder={type==='DEPENDS_ON'?'e.g. Needs same-day settlement files before the pilot can start':'What connects them'} required/></label>
   {type==='DEPENDS_ON'&&<fieldset className={styles.dates}><legend className={styles.srOnly}>Dates that matter</legend><label className={styles.check}><input type="checkbox" name="withDates" checked={dates} onChange={e=>setDates(e.target.checked)}/>Compare recorded dates</label>
    {dates&&<p className={styles.sentence}><span>{t?.name??'The other initiative'}’s</span><select name="providerFactKind" value={provider} onChange={e=>setProvider(e.target.value)} aria-label="Their date"><option value="TARGET_LIVE">Target Live</option><option value="NEXT_MILESTONE">Next milestone</option></select><span>must land before this initiative’s</span><select name="neededByFactKind" value={needed} onChange={e=>setNeeded(e.target.value)} aria-label="This initiative’s date"><option value="NEXT_MILESTONE">Next milestone</option><option value="TARGET_LIVE">Target Live</option></select></p>}
    {preview?<p className={styles.preview} aria-live="polite">{preview}</p>:<p className={styles.help}>Prodwise only shows a date impact when both recorded dates are known. Nothing is estimated.</p>}</fieldset>}
   <div className={styles.buttons}><button className={styles.primary} disabled={pending||!target||!rationale.trim()}>{pending?'Recording…':'Record relationship'}</button>{(!target||!rationale.trim())&&<p className="disabled-reason">{!target?'Choose the other initiative.':'Add why they are related.'}</p>}</div>
   {state.error&&<p role="alert" className={styles.error}>{state.error}</p>}
  </form></details>{state.message&&<p role="status" className={styles.ok}>✓ {state.message} It now appears above and on the Brief and Roadmap.</p>}</>;
}

export function RelationshipManager({slug,self,rows,ended,candidates,editable,denied}:{slug:string;self:{id:string;name:string;targetLive:string|null;nextMilestone:string|null};rows:RelationshipRowView[];ended:RelationshipRowView[];candidates:RelationshipCandidate[];editable:boolean;denied:string|null}){
 const groups=(['DEPENDS_ON','BLOCKS','PART_OF','CONTAINS','RELATED_TO'] as const).map(g=>({g,items:rows.filter(r=>r.group===g)})).filter(x=>x.items.length);
 return <div className={styles.manager}>
  {!rows.length&&<p className={styles.empty}>No relationships recorded.</p>}
  {groups.map(({g,items})=><div key={g} className={styles.group}><h4>{GROUP[g].label} <span>{items.length}</span></h4>{GROUP[g].hint&&<p className={styles.help}>{GROUP[g].hint}</p>}<ul>{items.map(r=><li key={r.id} className={styles.row} data-late={r.late||undefined}>
   <div className={styles.main}>
    <p className={styles.name}>{r.other?<Link prefetch={false} href={`/initiatives/${r.other.slug}`}>{r.other.name}</Link>:'An initiative you can’t access'}{r.other?.archived&&<span className={styles.tag}>Archived</span>}</p>
    <p className={styles.rationale}>{r.rationale}</p>
    {r.impactText&&<p className={r.late?styles.impactLate:r.assessed?styles.impactOk:styles.impactNone}><span aria-hidden="true">{r.late?'▲':r.assessed?'✓':'○'}</span> {r.late?'Date impact · ':''}{r.impactText}</p>}
    <p className={styles.meta}>Confirmed by {r.confirmedBy} · {day(r.confirmedAt)}{r.originHref&&<> · <Link prefetch={false} href={r.originHref}>from saved evidence</Link></>}</p>
   </div>
   {editable&&r.outgoing?<RowActions row={r} slug={slug}/>:!r.outgoing&&r.other?<p className={styles.recorded}>Recorded from {r.other.name}</p>:null}
  </li>)}</ul></div>)}
  {ended.length>0&&<details className={styles.ended}><summary>Ended <span>{ended.length}</span></summary><ul>{ended.map(r=><li key={r.id} className={styles.row}><div className={styles.main}><p className={styles.name}>{GROUP[r.group].label} {r.other?.name??'an initiative you can’t access'}</p><p className={styles.meta}>Ended by {r.endedBy} · {r.endedAt?day(r.endedAt):''} — “{r.endReason}”</p></div></li>)}</ul></details>}
  {editable?<Composer slug={slug} self={self} candidates={candidates} open={!rows.length}/>:denied&&<p className={styles.help}>{denied}</p>}
 </div>;
}
