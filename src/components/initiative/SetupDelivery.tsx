'use client';
import { DateField } from '@/components/forms/DateField';
import {useFormAction} from '@/components/forms/useFormAction';
import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {ScopeField} from '@/components/auth/WorkspaceScope';
import {saveSetupDelivery} from '@/app/initiatives/[slug]/setup/actions';
import type {DeliveryFact} from '@/lib/delivery/types';
import styles from './setup.module.css';
const fields=[['TARGET_LIVE','Target Live','Planned date for the named delivery scope.'],['DEV_STARTED','Development Start','Actual start, if known. Optional for setup.'],['NEXT_MILESTONE','Next milestone','The next named checkpoint and its planned date.']] as const;
function Field({kind,label,hint,fact}:{kind:string;label:string;hint:string;fact?:DeliveryFact}){
 const value=fact?.state==='SET'?fact.value:null;
 const [mode,setMode]=useState(value?.unknown?'UNKNOWN':value?.dateUnknown?'DATE_UNKNOWN':value?'KNOWN':'');
 return <fieldset className={styles.field}><legend>{label}</legend><p className={styles.hint}>{hint}</p><input type="hidden" name={`${kind}:revision`} value={fact?.revision??0}/><div className={styles.options}>
 {[['','Not recorded'],['KNOWN',kind==='NEXT_MILESTONE'?'Name and date known':'Date known'],['UNKNOWN',kind==='NEXT_MILESTONE'?'Milestone unknown':'Unknown'],...(kind==='NEXT_MILESTONE'?[['DATE_UNKNOWN','Name known · date unknown']]:[])].map(([id,text])=><label key={id}><input type="radio" name={`${kind}:mode`} value={id} checked={mode===id} onChange={()=>setMode(id!)}/>{text}</label>)}</div>
 {mode==='KNOWN'&&<label>Date<DateField name={`${kind}:date`} required defaultValue={value?.date??''} warnPast={kind==='TARGET_LIVE'||kind==='NEXT_MILESTONE'}/></label>}{kind==='NEXT_MILESTONE'&&['KNOWN','DATE_UNKNOWN'].includes(mode)&&<label>Milestone name<input name={`${kind}:text`} required maxLength={2000} defaultValue={value?.text??''}/></label>}
 {mode==='UNKNOWN'&&<p className={styles.hint}>Records an explicit unknown with your confirmation reason.</p>}{mode===''&&value&&<p className={styles.hint}>This selection leaves the existing fact unchanged. Use Manage delivery facts to withdraw a recorded value.</p>}
 </fieldset>;
}
export function SetupDelivery({slug,updatedAt,facts,contextLabel,editable}:{slug:string;updatedAt:string;facts:DeliveryFact[];contextLabel:string|null;editable:boolean}){
 const [initial]=useState({updatedAt,facts,contextLabel});const [state, action, pending, keepAction] = useFormAction(saveSetupDelivery,{error:null,message:null});const error=useRef<HTMLParagraphElement>(null);
 useEffect(()=>{if(state.error)error.current?.focus();},[state]);
 if(state.message)return <div className={styles.saved}><p role="status">{state.message}</p><Link href={`/initiatives/${slug}/setup?step=sources`}>Continue to Sources →</Link><Link href={`/initiatives/${slug}/manage?section=delivery`}>Review delivery facts</Link></div>;
 const scope=initial.facts.find(f=>f.kind==='SCOPE');const scopeLabel=scope?.state==='SET'?scope.value.text:initial.contextLabel;
 return <form action={action} onReset={keepAction} className={styles.form}><ScopeField/><input type="hidden" name="slug" value={slug}/><input type="hidden" name="expectedUpdatedAt" value={initial.updatedAt}/>{state.error&&<p ref={error} tabIndex={-1} role="alert" className={styles.error}>{state.error}</p>}{!scopeLabel&&editable&&<p className={styles.needsScope} role="note"><strong>Choose or create the current scope above first.</strong> Delivery dates belong to a scope, so they can be entered once one is chosen.</p>}<fieldset disabled={!editable||pending||!scopeLabel} className={styles.body}>
 <p className={styles.hint}>Delivery dates apply to: <strong>{scope?.state==='SET'?scope.value.text:initial.contextLabel??'Choose a current scope above'}</strong>. Saving confirms this delivery scope; changing an earlier delivery scope requires reviewing its existing facts.</p><input type="hidden" name="scope" value={scope?.state==='SET'?scope.value.text??'':initial.contextLabel??''}/><input type="hidden" name="SCOPE:revision" value={scope?.revision??0}/>

 {fields.map(([kind,label,hint])=><Field key={kind} kind={kind} label={label} hint={hint} fact={initial.facts.find(f=>f.kind===kind)}/>)}
 <p className={styles.hint}>Unknown is a deliberate record. Not recorded remains missing and does not complete setup.</p><label>Why / where this comes from *<textarea name="reason" required maxLength={2000} rows={3}/></label><p className={styles.hint}>Required: explain the source or why a date is unknown.</p><button className={styles.primary} type="submit" disabled={!initial.contextLabel}>{pending?'Saving…':'Confirm delivery context'}</button>{!initial.contextLabel&&<p className="disabled-reason">Set the current scope / phase first — delivery dates belong to a scope.</p>}</fieldset>{!editable&&<p className={styles.hint}>The assigned PM or organization administration can save delivery context when environment writes are enabled.</p>}</form>;
}
