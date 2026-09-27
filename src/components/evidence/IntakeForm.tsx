'use client';
import {useActionState,useEffect,useState} from 'react';
import {useRouter} from 'next/navigation';
import {ScopeField} from '@/components/auth/WorkspaceScope';
import {evidenceAction} from '@/app/initiatives/[slug]/evidence/actions';
import styles from './evidence.module.css';

/** One intake, two kinds of source. A meeting only adds a date and attendees;
 * everything after saving is the same evidence → proposal → confirmation flow. */
export function IntakeForm({slug,sources,kind,today}:{slug:string;sources:{id:string;name:string}[];kind:'PASTED'|'MEETING_NOTES';today:string}){
 const router=useRouter();const meeting=kind==='MEETING_NOTES';
 const [text,setText]=useState(''),[title,setTitle]=useState(''),[date,setDate]=useState(''),[attendees,setAttendees]=useState('');
 const [requestId]=useState(()=>crypto.randomUUID());const [state,action,pending]=useActionState(evidenceAction,{error:null});
 useEffect(()=>{if(state.submissionId)router.push(`/initiatives/${slug}/evidence/${state.submissionId}`);},[state.submissionId,router,slug]);
 const tooLong=text.length>20000;
 return <form action={action} onReset={e=>e.preventDefault()} className={styles.intake} aria-describedby="evidence-honesty">
  <ScopeField/><input type="hidden" name="slug" value={slug}/><input type="hidden" name="operation" value="SUBMIT"/><input type="hidden" name="requestId" value={requestId}/><input type="hidden" name="kind" value={kind}/>
  <div className={styles.intakeMain}>
   {meeting?<fieldset className={styles.meetingHeader}><legend>Meeting</legend>
    <label className={styles.titleField}>Meeting title<input name="title" value={title} onChange={e=>setTitle(e.target.value)} required maxLength={160} placeholder="e.g. Steering sync" autoComplete="off"/></label>
    <label>Date<input type="date" name="meetingDate" value={date} max={today} onChange={e=>setDate(e.target.value)} required aria-describedby="meeting-date-help"/></label>
    <label className={styles.titleField}><span>Attendees <span className={styles.optional}>optional</span></span><input name="attendees" value={attendees} onChange={e=>setAttendees(e.target.value)} maxLength={500} placeholder="Names as written in the notes" autoComplete="off"/></label>
    <p id="meeting-date-help" className={styles.fieldHelp}>The date places decisions and date changes correctly. Attendees are kept as written and never matched to accounts.</p>
   </fieldset>:<label>Evidence title<input name="title" value={title} onChange={e=>setTitle(e.target.value)} required maxLength={200} autoComplete="off"/></label>}
   {sources.length>0&&<label><span>Attach to a linked source <span className={styles.optional}>optional</span></span><select name="sourceItemId"><option value="">{meeting?'Create a new meeting-notes source':'Create a saved pasted-evidence source'}</option>{sources.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>}
   <label>{meeting?'Paste notes or a transcript':'Paste evidence'}<textarea name="text" value={text} onChange={e=>setText(e.target.value)} required rows={meeting?16:12} aria-describedby="paste-count" aria-invalid={tooLong||undefined}/></label>
   <p id="paste-count" className={tooLong?styles.countOver:styles.count} aria-live="polite">{text.length.toLocaleString()} / 20,000 characters{tooLong?' — shorten before saving':''}</p>
   {state.error&&<p role="alert" className={styles.error}>{state.error}</p>}
   <div className={styles.intakeActions}><button className={styles.primary} disabled={pending||!text.trim()||tooLong||!title.trim()||meeting&&!date}>{pending?'Saving…':meeting?'Save meeting notes':'Save evidence'}</button><span>Saved text is never edited afterwards.</span></div>
  </div>
  <aside id="evidence-honesty" className={styles.flow} aria-label="What happens next">
   <h3>What happens next</h3>
   <ol>
    <li><span><strong>Saved as a source.</strong> {meeting?'The notes stay exactly as pasted and become a meeting source of this initiative.':'Your text stays exactly as pasted and becomes a source of this initiative.'}</span></li>
    <li><span><strong>Claude proposes.</strong> {meeting?'Decisions, commitments, risks, changed requirements, date changes and open questions':'Knowledge, commitments, delivery dates and open questions'} — each with the exact quote it came from.</span></li>
    <li><span><strong>You confirm.</strong> Nothing becomes a record until you confirm it. Rejected and pending items appear nowhere else.</span></li>
   </ol>
   {meeting&&<p className={styles.flowNote}>Prodwise doesn’t join calls or read calendars, Drive or email. Paste what you have.</p>}
  </aside>
 </form>;
}
