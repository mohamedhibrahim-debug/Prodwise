'use client';
import {useFormAction} from '@/components/forms/useFormAction';
import { useEffect, useRef, useState } from 'react';
import { NOTIFICATIONS_CHANGED } from '@/components/notifications/events';
import { listOrganizationContextsAction, switchOrganizationAction } from '@/app/account/organization-actions';
import type { AuthorizedContext } from '@/lib/auth/service';
import { organizationRoleLabel, type ShellIdentity } from './ShellIdentity';
import styles from './OrganizationControl.module.css';
export function OrganizationControl({identity,compact=false}:{identity:ShellIdentity;compact?:boolean}) {
  const dialog=useRef<HTMLDialogElement>(null);const trigger=useRef<HTMLButtonElement>(null);
  const [contexts,setContexts]=useState<AuthorizedContext[]|null>(null);const [loadError,setLoadError]=useState('');const [loading,setLoading]=useState(false);
  const [state, action, pending, keepAction] = useFormAction(switchOrganizationAction,{});
  const switchable=!identity.guest&&contexts?.length!==1;
  // This shell survives the client navigation that follows a switch: tell per-organization counts to re-read.
  const shownOrganization=useRef(identity.presentation.organizationName);
  useEffect(()=>{if(shownOrganization.current!==identity.presentation.organizationName){shownOrganization.current=identity.presentation.organizationName;window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED));}},[identity.presentation.organizationName]);
  async function open(){dialog.current?.showModal();setLoading(true);setLoadError('');try{const result=await listOrganizationContextsAction();setContexts(result);}catch{setLoadError('Organization choices could not be loaded. Your current organization is unchanged.');}finally{setLoading(false);}}
  function restoreFocus(){if(trigger.current)trigger.current.focus();else document.getElementById('main-content')?.focus();}
  function close(){dialog.current?.close();restoreFocus();}
  const body=<><strong>{identity.presentation.organizationName}</strong>{!compact&&<small>{organizationRoleLabel(identity)}</small>}{!compact&&identity.access.platformRole==='PLATFORM_OWNER'&&<small>Platform Owner · global authority</small>}{!compact&&identity.presentation.isDemo&&<small>{compact?'Demo':`Synthetic data · scenario ${new Date(identity.presentation.scenarioAt!).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'})}`}</small>}</>;
  return <div className={`${styles.control} ${compact?styles.compact:''}`}>
    {switchable?<button ref={trigger} type="button" className={styles.trigger} onClick={open} aria-haspopup="dialog" aria-label={`Current organization: ${identity.presentation.organizationName}. Choose organization`}>{body}<span aria-hidden="true">⌄</span></button>:<div className={styles.static} aria-label={`Current organization: ${identity.presentation.organizationName}`}>{body}</div>}
    <dialog ref={dialog} className={styles.dialog} onCancel={restoreFocus} aria-label="Switch organization">
      <header><h2>Switch organization</h2><button type="button" onClick={close} aria-label="Close organization chooser">Close ×</button></header>
      <p>Prodwise opens Home in the selected organization. Unsaved changes on this page are lost.</p>
      {loading?<p role="status">Loading authorized organizations…</p>:loadError?<p role="alert">{loadError}</p>:<form action={action} onReset={keepAction}>
        <input type="hidden" name="scopeWorkspaceId" value={identity.access.workspaceId}/>
        <fieldset disabled={pending}><legend>Authorized organizations</legend>{contexts?.map(ctx=><label className={styles.choice} key={ctx.workspaceId}><input type="radio" name="workspaceId" value={ctx.workspaceId} defaultChecked={ctx.current} required/><span><strong>{ctx.organizationName}</strong><small>{ctx.role?.replaceAll('_',' ')??'Platform access · not a member'}{ctx.current?' · Current organization':''}{ctx.isDemo?' · Synthetic Demo':''}</small></span></label>)}</fieldset>
        {contexts?.length===1&&<p>This is your only authorized active organization.</p>}
        {state.error&&<p role="alert">{state.error}</p>}
        <footer><button type="button" onClick={close}>Cancel</button><button type="submit" disabled={pending||!contexts||contexts.length<2}>{pending?'Switching…':'Switch organization'}</button></footer>
      </form>}
    </dialog>
  </div>;
}
