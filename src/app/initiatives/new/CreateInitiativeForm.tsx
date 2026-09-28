"use client";
import {useFormAction} from '@/components/forms/useFormAction';
import {useEffect,useRef} from 'react';
import Link from 'next/link';
import {ScopeField} from '@/components/auth/WorkspaceScope';
import {BUSINESS_LINES,STAGES} from '@/lib/domain/types';
import {BUSINESS_LINE_LABEL,businessLineText,STAGE_LABEL} from '@/lib/domain/labels';
import type {DeliveryMember} from '@/lib/delivery/types';
import {createInitiativeAction} from './actions';
import styles from './new.module.css';
export function CreateInitiativeForm({requestId,members,selfId,canAssign}:{requestId:string;members:DeliveryMember[];selfId:string|null;canAssign:boolean}){
 const [state, action, pending, keepAction] = useFormAction(createInitiativeAction,{error:null});const error=useRef<HTMLParagraphElement>(null);
 useEffect(()=>{if(state.error)error.current?.focus();},[state]);
 const eligible=members.filter(m=>m.active&&m.role!=='VIEWER'),self=eligible.find(m=>m.id===selfId);
 return <form action={action} onReset={keepAction} className={styles.form}>
 <ScopeField/><input type="hidden" name="clientRequestId" value={requestId}/>
 {state.error&&<p ref={error} tabIndex={-1} role="alert" className={styles.error}>{state.error}</p>}
 <fieldset className={styles.group}><legend>Basics <span className={styles.optional}>* Required to create</span></legend>
 <label className={styles.field}>Initiative name *<input className={styles.input} name="name" required maxLength={160} autoComplete="off"/></label>
 <label className={styles.field}>Business line *<select className={styles.select} name="businessLine" required defaultValue=""><option value="" disabled>Choose a business line</option>{BUSINESS_LINES.map(v=><option value={v} key={v}>{businessLineText(v)}</option>)}</select></label>
 {canAssign?<label className={styles.field}>Primary owner *<select className={styles.select} name="ownerMemberId" required defaultValue={self?.id??''}><option value="" disabled>Choose an active member</option>{eligible.map(m=><option key={m.id} value={m.id}>{m.displayName}{m.id===selfId?' (you)':''}</option>)}</select></label>:<div className={styles.field}><span>Primary owner *</span><p>You ({self?.displayName??'No eligible membership'})</p><input type="hidden" name="ownerMemberId" value={self?.id??''}/></div>}
 <p className={styles.hint}>Responsible for this initiative. Shown on Home, Weekly Review and Actions.</p>
 <fieldset className={styles.stageGroup}><legend>Lifecycle stage *</legend><div className={styles.stages}>{STAGES.map(stage=><label key={stage}><input type="radio" name="stage" value={stage} required/>{STAGE_LABEL[stage]}</label>)}</div></fieldset>
 </fieldset>
 <details className={styles.optionalGroup}><summary>Optional now: objective and scope</summary><p className={styles.hint}>You can create now and add these during setup. Missing information stays visible.</p><label className={styles.field}>Objective / problem<textarea className={styles.textarea} name="description" rows={3} maxLength={4000}/></label><label className={styles.field}>Current scope / phase<input className={styles.input} name="contextLabel" maxLength={160} placeholder="For example: Phase 1 — merchant pilot"/></label><p className={styles.hint}>Creates a named context for this initiative. No phase or delivery date is assumed.</p></details>
 <div className={styles.actions}><button className={styles.primary} type="submit" disabled={pending||(!canAssign&&!self)}>{pending?'Creating…':'Create initiative'}</button><Link prefetch={false} href="/initiatives">Cancel</Link></div>
 </form>;
}
