'use client';
import {useActionState,useEffect,useRef,useState} from 'react';
import {ScopeField} from '@/components/auth/WorkspaceScope';
import {reviseSourceAction} from '@/app/initiatives/[slug]/manage/actions';
import type {SourceMapping} from '@/lib/workspace/source-mapping';
import styles from './management.module.css';

export function SourceMappingControl({mapping,slug,canUnlink}:{mapping:SourceMapping;slug:string;canUnlink:boolean}){
 const [operation,setOperation]=useState<'ROLE'|'UNLINK'|'RELINK'|null>(null);
 const [expectedRevision,setExpectedRevision]=useState(mapping.revision);
 const [draftRole,setDraftRole]=useState(mapping.role);
 const [draftReason,setDraftReason]=useState('');
 const begin=(next:'ROLE'|'UNLINK'|'RELINK')=>{setExpectedRevision(mapping.revision);setDraftRole(mapping.role);setDraftReason('');setOperation(next);};
 const [state,action,pending]=useActionState(reviseSourceAction,{error:null,message:null});
 const error=useRef<HTMLParagraphElement>(null);
 useEffect(()=>{if(state.error)error.current?.focus();else if(state.message)setOperation(null);},[state]);
 return <div>{state.message&&<p role="status">{state.message}</p>}{operation?<form action={action} onReset={event=>event.preventDefault()} className={styles.form}>
  <ScopeField/><input type="hidden" name="slug" value={slug}/><input type="hidden" name="mappingId" value={mapping.id}/><input type="hidden" name="expectedRevision" value={expectedRevision}/><input type="hidden" name="operation" value={operation}/>
  {state.error&&<p ref={error} tabIndex={-1} role="alert" className={styles.error}>{state.error}</p>}
  {operation==='ROLE'?<label>Role in this initiative<select name="role" value={draftRole} onChange={event=>setDraftRole(event.target.value as SourceMapping['role'])}><option value="GENERAL">General evidence</option><option value="REQUIREMENTS">Requirements</option><option value="DELIVERY">Delivery</option><option value="DECISIONS">Decisions</option></select></label>:<p>{operation==='UNLINK'?'Unlink this reference from the initiative? Its recorded evidence and history will remain.':'Relink this reference? Earlier mapping decisions will remain in history.'}</p>}
  <label>Reason<textarea name="reason" value={draftReason} onChange={event=>setDraftReason(event.target.value)} required maxLength={2000} rows={2}/></label>
  <div className={styles.actions}><button type="submit" disabled={pending}>{pending?'Saving…':operation==='UNLINK'?'Confirm unlink':operation==='RELINK'?'Confirm relink':'Save role'}</button><button type="button" disabled={pending} onClick={()=>setOperation(null)}>Cancel</button></div>
 </form>:<div className={styles.actions}>{mapping.unlinkedAt?<button type="button" onClick={()=>begin('RELINK')}>Review and relink</button>:<><button type="button" onClick={()=>begin('ROLE')}>Change source role</button>{canUnlink&&<button type="button" data-tone="danger" onClick={()=>begin('UNLINK')}>Unlink source</button>}</>}</div>}</div>;
}
