'use client';
import {useFormAction} from '@/components/forms/useFormAction';
import {useEffect,useRef,useState} from 'react';
import {ScopeField} from '@/components/auth/WorkspaceScope';
import {STAGES,type Initiative} from '@/lib/domain/types';
import {STAGE_LABEL} from '@/lib/domain/labels';
import {changeLifecycleAction} from '@/app/initiatives/[slug]/manage/actions';
import styles from './management.module.css';
export function LifecycleManager({initiative:i,canStage,canArchive}:{initiative:Initiative;canStage:boolean;canArchive:boolean}){
 const [edit,setEdit]=useState<{operation:'STAGE'|'ARCHIVE'|'RESTORE';stamp:string}|null>(null),[state,action,pending,keepAction]=useFormAction(changeLifecycleAction,{error:null,message:null});const error=useRef<HTMLParagraphElement>(null);
 const dialog=useRef<HTMLDialogElement>(null),heading=useRef<HTMLHeadingElement>(null),trigger=useRef<HTMLButtonElement>(null);
 function close(){dialog.current?.close();setEdit(null);requestAnimationFrame(()=>trigger.current?.focus());}
 useEffect(()=>{if(edit&&edit.operation!=='STAGE'){dialog.current?.showModal();heading.current?.focus();}},[edit]);
 useEffect(()=>{if(state.error)error.current?.focus();else if(state.message){dialog.current?.close();setEdit(null);requestAnimationFrame(()=>trigger.current?.focus());}},[state]);
 const form=edit?<form action={action} onReset={keepAction} className={styles.form}><ScopeField/><input type="hidden" name="slug" value={i.slug}/><input type="hidden" name="operation" value={edit.operation}/><input type="hidden" name="expectedUpdatedAt" value={edit.stamp}/>{state.error&&<p role="alert" tabIndex={-1} ref={error} className={styles.error}>{state.error}</p>}
 {edit.operation==='STAGE'?<label>Lifecycle stage<select name="stage" required defaultValue={i.stage}>{STAGES.map(s=><option key={s} value={s}>{STAGE_LABEL[s]}</option>)}</select></label>:<><h4 id="lifecycle-confirm-title" ref={heading} tabIndex={-1}>{edit.operation==='ARCHIVE'?'Archive':'Restore'} {i.name}?</h4><p id="lifecycle-confirm-description">{edit.operation==='ARCHIVE'?'The initiative becomes read-only and leaves the active portfolio. Evidence, decisions, delivery history and finalized reviews remain available. An administrator can restore it.':'The initiative returns to the active portfolio. Its existing facts and history will be retained.'}</p>{edit.operation==='ARCHIVE'&&<label>Type the initiative name<input name="confirmedName" required autoComplete="off"/></label>}</>}
 <label>Reason<textarea name="reason" required maxLength={2000} rows={3}/></label><div className={styles.actions}><button type="submit" disabled={pending}>{pending?'Saving…':edit.operation==='ARCHIVE'?'Confirm archive':edit.operation==='RESTORE'?'Restore initiative':'Save stage'}</button><button type="button" disabled={pending} onClick={close}>Cancel</button></div>
 </form>:null;
 return <div><p>{i.archivedAt?'Archived':'Active record'} · {STAGE_LABEL[i.stage]}</p><p className={styles.muted}>Lifecycle stage describes the work. Setup and attention remain separate.</p>{i.archivedAt&&<p>Archive reason: {i.archiveReason}</p>}{state.message&&<p role="status">{state.message}</p>}
 {edit?.operation==='STAGE'?form:<div className={styles.actions}>{canStage&&!i.archivedAt&&<button type="button" onClick={()=>setEdit({operation:'STAGE',stamp:i.updatedAt})}>Change lifecycle stage</button>}{canArchive&&<button ref={trigger} type="button" data-tone={i.archivedAt?undefined:'danger'} onClick={()=>setEdit({operation:i.archivedAt?'RESTORE':'ARCHIVE',stamp:i.updatedAt})}>{i.archivedAt?'Restore initiative':'Archive initiative'}</button>}{!canArchive&&<p className={styles.muted}>Only organization administration can archive or restore.</p>}</div>}
 {edit&&edit.operation!=='STAGE'&&<dialog ref={dialog} className={styles.dialog} role="alertdialog" aria-labelledby="lifecycle-confirm-title" aria-describedby="lifecycle-confirm-description" onCancel={e=>{e.preventDefault();if(!pending)close();}}>{form}</dialog>}</div>;
}
