'use client';
import {useFormAction} from '@/components/forms/useFormAction';
import {useEffect,useRef,useState} from 'react';
import {ScopeField} from '@/components/auth/WorkspaceScope';
import {saveContextAction} from '@/app/initiatives/[slug]/manage/actions';
import type {InitiativeContext} from '@/lib/workspace/readiness';
import styles from './management.module.css';
type Edit={operation:'CREATE'|'SELECT'|'RENAME'|'RETIRE';context?:InitiativeContext;expectedUpdatedAt:string;label?:string};
export function ContextManager({slug,updatedAt,currentId,contexts,editable,legacy}:{slug:string;updatedAt:string;currentId:string|null;contexts:InitiativeContext[];editable:boolean;legacy:string|null}){
 const [edit,setEdit]=useState<Edit|null>(null),[state,action,pending,keepAction]=useFormAction(saveContextAction,{error:null,message:null});
 const error=useRef<HTMLParagraphElement>(null),title=useRef<HTMLInputElement>(null);
 // eslint-disable-next-line react-hooks/set-state-in-effect -- closes the editor after the server action reports success
 useEffect(()=>{if(state.error)error.current?.focus();else if(state.message)setEdit(null);},[state]);
 useEffect(()=>{if(edit?.operation==='CREATE'||edit?.operation==='RENAME')title.current?.focus();},[edit]);
 const begin=(operation:Edit['operation'],context?:InitiativeContext,label?:string)=>setEdit({operation,context,expectedUpdatedAt:updatedAt,label});
 const current=contexts.find(c=>c.id===currentId&&!c.retiredAt);
 return <div><p><strong>Current context: {current?.label??'None selected'}</strong></p><p className={styles.muted}>Name the phase, pilot or release boundary this initiative currently covers. Retiring a context keeps its evidence and history.</p>
 {legacy&&!contexts.some(c=>!c.retiredAt&&c.label.trim().toLowerCase()===legacy.trim().toLowerCase())&&<p className={styles.muted}>Earlier scope text: “{legacy}”. Create a scope from it to use it for dates and Knowledge. {editable&&!edit&&<button type="button" onClick={()=>begin('CREATE',undefined,legacy)}>Create scope from this</button>}</p>}
 {state.message&&<p role="status">{state.message}</p>}
 {edit?<form action={action} onReset={keepAction} className={styles.form}>
  <ScopeField/><input type="hidden" name="slug" value={slug}/><input type="hidden" name="operation" value={edit.operation}/><input type="hidden" name="expectedUpdatedAt" value={edit.expectedUpdatedAt}/><input type="hidden" name="contextId" value={edit.context?.id??''}/><input type="hidden" name="expectedRevision" value={edit.context?.revision??''}/>
  {state.error&&<p ref={error} role="alert" tabIndex={-1} className={styles.error}>{state.error}</p>}
  {edit.operation==='CREATE'||edit.operation==='RENAME'?<><label>Context label<input ref={title} name="label" required maxLength={160} defaultValue={edit.context?.label??edit.label??''} placeholder="For example: Phase 1 — merchant pilot"/></label><label>Scope note <span className={styles.muted}>Optional</span><textarea name="note" maxLength={4000} rows={3} defaultValue={edit.context?.note??''}/></label></>:<p>{edit.operation==='RETIRE'?`Retire “${edit.context?.label}”? It remains in history. If current, setup will show that a context needs to be selected.`:`Use “${edit.context?.label}” as the current context? Existing evidence applicability is preserved.`}</p>}
  <label>Why this scope change?<textarea name="reason" required maxLength={2000} rows={2}/></label>
  <div className={styles.actions}><button type="submit" disabled={pending}>{pending?'Saving…':edit.operation==='CREATE'?'Create and select context':edit.operation==='RETIRE'?'Confirm retirement':edit.operation==='SELECT'?'Use this context':'Save context'}</button><button type="button" disabled={pending} onClick={()=>setEdit(null)}>Cancel</button></div>
 </form>:<>{editable&&<div className={styles.actions}><button type="button" onClick={()=>begin('CREATE')}>New context</button></div>}{contexts.length>0&&<ul>{contexts.map(c=><li key={c.id}><p>{c.label} {c.retiredAt?'· Retired':c.id===currentId?'· Current':''}</p>{c.note&&<p className={styles.muted}>{c.note}</p>}{editable&&!c.retiredAt&&<div className={styles.actions}>{c.id!==currentId&&<button type="button" onClick={()=>begin('SELECT',c)}>Use as current</button>}<button type="button" onClick={()=>begin('RENAME',c)}>Rename / edit note</button><button type="button" onClick={()=>begin('RETIRE',c)}>Retire context</button></div>}</li>)}</ul>}</>}
 </div>;
}
