'use client';
import {useFormAction} from '@/components/forms/useFormAction';
import {useEffect,useId,useRef,useState,useSyncExternalStore} from 'react';
import {useRouter} from 'next/navigation';
import {ScopeField} from '@/components/auth/WorkspaceScope';
import {dispositionAction,type QueueActionState} from '@/app/initiatives/[slug]/decisions/disposition-actions';
import type {ReviewFinding} from '@/lib/domain/types';
import type {EffectiveDisposition,DispositionKind} from '@/lib/review/dispositions';
import {formatDateTime} from '@/lib/domain/labels';
import styles from './DispositionControls.module.css';
const reasonEvent='prodwise:queue-reason';
function subscribeReason(callback:()=>void){window.addEventListener(reasonEvent,callback);return()=>window.removeEventListener(reasonEvent,callback);}
export function DispositionControls({finding,effective,slug}:{finding:ReviewFinding;effective:EffectiveDisposition;slug:string}) {
 const router=useRouter(),dialog=useRef<HTMLDialogElement>(null),trigger=useRef<HTMLButtonElement|null>(null),id=useId();const[kind,setKind]=useState<DispositionKind>('DEFERRED'),[mode,setMode]=useState('date');
 const key=`prodwise:queue-reason:${finding.initiativeId}:${finding.fingerprint}`;
 const reason=useSyncExternalStore(subscribeReason,()=>sessionStorage.getItem(key)??'',()=>'');
 const[state,action,pending,keepAction]=useFormAction(async(previous:QueueActionState,form:FormData)=>{const result=await dispositionAction(previous,form);if(result.result?.code==='ok'){sessionStorage.removeItem(key);window.dispatchEvent(new Event(reasonEvent));dialog.current?.close();trigger.current?.focus();router.refresh();}return result;},{result:null,error:null});
 const request=useRef<string>('');
 useEffect(()=>{request.current=crypto.randomUUID();},[finding.contentDigest,key]);
 function open(value:DispositionKind,button:HTMLButtonElement){setKind(value);trigger.current=button;request.current=crypto.randomUUID();dialog.current?.showModal();}
 function close(){dialog.current?.close();trigger.current?.focus();}
 return <div className={styles.controls}><div className={styles.bar}>{effective.activeRow?<button type="button" className="pw-btn" data-variant="secondary" data-size="sm" onClick={e=>open('WITHDRAWN',e.currentTarget)}>Return to Open</button>:<><button type="button" className="pw-btn" data-variant="secondary" data-size="sm" onClick={e=>open('DEFERRED',e.currentTarget)}>Defer…</button><button type="button" className="pw-btn" data-variant="destructive" data-size="sm" onClick={e=>open('DISMISSED',e.currentTarget)}>Dismiss…</button></>}</div>
 <dialog ref={dialog} className={styles.sheet} aria-labelledby={id} onCancel={close}><h3 id={id}>{kind==='DEFERRED'?'Defer comparison':kind==='DISMISSED'?'Dismiss comparison':'Return to Open'}</h3><p>{finding.title}</p><p>{kind==='DEFERRED'?'Stays on record. Returns to Open on the selected date, after the next Weekly Review Final, or if the underlying evidence changes.':kind==='DISMISSED'?'Recorded as not a real conflict for these exact claims. Returns only if they change.':'Appends a returned-to-Open record. Prior reasons stay in history.'}</p>
 <form onReset={event=>event.preventDefault()} action={form=>{form.set('clientRequestId',request.current);action(form);}}><ScopeField/><input type="hidden" name="initiativeId" value={finding.initiativeId}/><input type="hidden" name="findingId" value={finding.fingerprint}/><input type="hidden" name="expectedDigest" value={finding.contentDigest}/><input type="hidden" name="expectedLatestDispositionId" value={state.result?.code==='disposition_conflict'?state.result.latest?.id??'':effective.latestRow?.id??''}/><input type="hidden" name="kind" value={kind}/>
 {kind==='DEFERRED'&&<><label>End condition<select aria-label="End condition" name="mode" value={mode} onChange={e=>setMode(e.target.value)}><option value="date">Until a date</option><option value="review">Until the next Weekly Review</option></select></label>{mode==='date'&&<label>Return date<input name="deferUntil" type="date" required/></label>}</>}
 <label>Reason{kind==='WITHDRAWN'?' (optional)':''}<textarea name="reason" value={reason} maxLength={2000} required={kind!=='WITHDRAWN'} onChange={e=>{sessionStorage.setItem(key,e.target.value);window.dispatchEvent(new Event(reasonEvent));}}/></label>
 {state.error&&<p role="alert">{state.error}</p>}{state.result?.code==='disposition_conflict'&&state.result.latest&&<p>{state.result.latest.actor.label} {state.result.latest.kind==='DISMISSED'?'dismissed':'changed'} this at {formatDateTime(state.result.latest.at)}. <a href={`/initiatives/${slug}/decisions?item=${finding.fingerprint}`}>View current record</a></p>}{state.result?.code==='digest_conflict'&&<button type="button" className="pw-btn" data-variant="secondary" onClick={()=>router.refresh()}>Refresh comparison · reason retained</button>}
 <div className={styles.bar}><button type="button" className="pw-btn" data-variant="ghost" onClick={close}>Cancel</button><button type="submit" className="pw-btn" data-variant="primary" disabled={pending} aria-busy={pending||undefined}>{pending?'Recording…':kind==='DEFERRED'?'Record deferral':kind==='DISMISSED'?'Record dismissal':'Return to Open'}</button></div></form></dialog></div>;
}

