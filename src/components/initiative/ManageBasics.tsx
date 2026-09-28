'use client';
import {useFormAction} from '@/components/forms/useFormAction';
import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import type {Initiative} from '@/lib/domain/types';
import {BUSINESS_LINES} from '@/lib/domain/types';
import {BUSINESS_LINE_LABEL,businessLineText} from '@/lib/domain/labels';
import {ScopeField} from '@/components/auth/WorkspaceScope';
import {saveInitiativeBasics} from '@/app/initiatives/[slug]/manage/actions';
import styles from './management.module.css';
export function ManageBasics({initiative:i}:{initiative:Initiative}){
 const [state, action, pending, keepAction] = useFormAction(saveInitiativeBasics,{error:null,message:null});
 const [expectedUpdatedAt]=useState(i.updatedAt);
 const error=useRef<HTMLParagraphElement>(null);
 useEffect(()=>{if(state.error)error.current?.focus();},[state]);
 return <form action={action} onReset={keepAction} className={styles.form}>
  <ScopeField/><input type="hidden" name="slug" value={i.slug}/><input type="hidden" name="expectedUpdatedAt" value={expectedUpdatedAt}/>
  {state.error&&<p ref={error} tabIndex={-1} role="alert" className={styles.error}>{state.error}</p>}
  {state.message&&<p role="status">{state.message}</p>}
  <label>Initiative name <span aria-hidden="true">*</span><input name="name" required maxLength={160} defaultValue={i.name}/></label>
  <label>Business line <span aria-hidden="true">*</span><select name="businessLine" required defaultValue={i.businessLine}>{BUSINESS_LINES.map(l=><option key={l} value={l}>{businessLineText(l)}</option>)}</select></label>
  <label>Objective / problem <span className={styles.muted}>Optional to save</span><textarea name="description" maxLength={4000} rows={4} defaultValue={i.description??''}/></label>
  <p className={styles.muted}>Describe the problem this initiative addresses. Renaming keeps existing links and history.</p>
  <div className={styles.actions}><button type="submit" disabled={pending}>{pending?'Saving…':'Save basics'}</button><Link prefetch={false} href={`/initiatives/${i.slug}/manage`}>Cancel</Link></div>
 </form>;
}
