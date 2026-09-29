"use client";
import {useFormAction} from '@/components/forms/useFormAction';
import {useEffect,useRef} from 'react';
import {ScopeField} from '@/components/auth/WorkspaceScope';
import {Button,ButtonLink} from '@/components/primitives/Button';
import {BUSINESS_LINES,STAGES} from '@/lib/domain/types';
import {businessLineText,STAGE_LABEL} from '@/lib/domain/labels';
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
 <label className={styles.field}><span className={styles.label}>Initiative name</span><input className={styles.input} name="name" required maxLength={160} autoComplete="off" autoFocus/></label>
 <div className={styles.pair}>
  <label className={styles.field}><span className={styles.label}>Business line</span><select className={styles.select} name="businessLine" required defaultValue=""><option value="" disabled>Choose…</option>{BUSINESS_LINES.map(v=><option value={v} key={v}>{businessLineText(v)}</option>)}</select></label>
  <label className={styles.field}><span className={styles.label}>Lifecycle stage</span><select className={styles.select} name="stage" required defaultValue=""><option value="" disabled>Choose…</option>{STAGES.map(stage=><option key={stage} value={stage}>{STAGE_LABEL[stage]}</option>)}</select></label>
 </div>
 {canAssign?<label className={styles.field}><span className={styles.label}>Primary owner</span><select className={styles.select} name="ownerMemberId" required defaultValue={self?.id??''}><option value="" disabled>Choose an active member</option>{eligible.map(m=><option key={m.id} value={m.id}>{m.displayName}{m.id===selfId?' (you)':''}</option>)}</select></label>
  :<div className={styles.field}><span className={styles.label}>Primary owner</span><p className={styles.static}>You ({self?.displayName??'No eligible membership'})</p><input type="hidden" name="ownerMemberId" value={self?.id??''}/></div>}
 <details className={styles.optionalGroup}><summary>Add objective and scope now <span className={styles.optional}>· optional</span></summary><label className={styles.field}><span className={styles.label}>Objective / problem</span><textarea className={styles.textarea} name="description" rows={3} maxLength={4000}/></label><label className={styles.field}><span className={styles.label}>Current scope / phase</span><input className={styles.input} name="contextLabel" maxLength={160} placeholder="For example: Phase 1 — merchant pilot"/></label><p className={styles.hint}>Creates a named context. No phase or delivery date is assumed.</p></details>
 <div className={styles.actions}><Button variant="primary" type="submit" disabled={pending||(!canAssign&&!self)}>{pending?'Creating…':'Create initiative'}</Button><ButtonLink variant="ghost" href="/initiatives">Cancel</ButtonLink></div>
 </form>;
}
