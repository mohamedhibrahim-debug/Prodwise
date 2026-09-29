'use client';
import {useFormAction} from '@/components/forms/useFormAction';
import {useEffect,useRef,useState} from 'react';
import {NOTIFICATIONS_CHANGED} from '@/components/notifications/events';
import {listOrganizationContextsAction,switchOrganizationAction} from '@/app/account/organization-actions';
import {hasOrganizationAdminAuthority} from '@/lib/auth/roles';
import type {AuthorizedContext} from '@/lib/auth/context-types';
import {FloatingLayer,MenuButton,MenuLabel,MenuLink,MenuScope,MenuSeparator,MenuSubmit,menuKeyDown,usePopover} from '@/components/primitives/Popover';
import {InstrumentIcon} from './InstrumentIcon';
import {OPEN_ORGANIZATION_SWITCHER} from './events';
import {initials,roleShortLabel,type ShellIdentity} from './ShellIdentity';
import styles from './OrganizationControl.module.css';

/**
 * Workspace switcher (audit §E3): a compact trigger at the top of the rail.
 * With more than one authorized organization it opens a one-click list; each
 * row submits the existing switch action, whose server-side authorization is
 * unchanged. With one organization it is a plain label with no affordance.
 */
export function OrganizationControl({identity,collapsed=false}:{identity:ShellIdentity;collapsed?:boolean}){
 const [contexts,setContexts]=useState<AuthorizedContext[]|null>(identity.contexts??null);
 const [loadError,setLoadError]=useState('');
 const [state,action,pending,keepAction]=useFormAction(switchOrganizationAction,{});
 const [target,setTarget]=useState<string|null>(null);
 const popover=usePopover({placement:collapsed?'right-start':'bottom-start',kind:'menu',onOpenChange:open=>{if(open)void refresh();}});
 const switchable=!identity.guest&&(contexts?.length??0)>1;
 const {presentation,access}=identity;

 // The shell survives the client navigation that follows a switch: tell per-organization counts to re-read.
 const shownOrganization=useRef(presentation.organizationName);
 useEffect(()=>{if(shownOrganization.current!==presentation.organizationName){shownOrganization.current=presentation.organizationName;window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED));}},[presentation.organizationName]);
 // Opened from the command palette or the account menu; only the visible instance answers.
 const {setOpen,triggerRef}=popover;
 useEffect(()=>{const open=()=>{if(triggerRef.current?.getClientRects().length)setOpen(true);};window.addEventListener(OPEN_ORGANIZATION_SWITCHER,open);return()=>window.removeEventListener(OPEN_ORGANIZATION_SWITCHER,open);},[setOpen,triggerRef]);

 async function refresh(){setLoadError('');try{setContexts(await listOrganizationContextsAction());}catch{if(!contexts)setLoadError('Organization choices could not be loaded. Your current organization is unchanged.');}}

 const demoTag=presentation.isDemo&&<span className={styles.demoTag}>Synthetic demo</span>;
 const body=<>
  <span className={styles.avatar} data-demo={presentation.isDemo||undefined} aria-hidden="true">{initials(presentation.organizationName)}</span>
  <span className={styles.text}><strong>{presentation.organizationName}</strong><small>{presentation.isDemo?demoTag:roleShortLabel(access.role,access.platformRole)}</small></span>
 </>;
 const label=`Organization: ${presentation.organizationName}${presentation.isDemo?' (synthetic demo)':''}`;

 if(!switchable)return <div className={styles.control} data-collapsed={collapsed||undefined}>
  <div className={styles.static} aria-label={label} role="group" data-tip={collapsed?presentation.organizationName:undefined} data-tip-side="right" tabIndex={collapsed?0:undefined}>{body}</div>
 </div>;

 return <div className={styles.control} data-collapsed={collapsed||undefined}>
  <button type="button" className={styles.trigger} aria-label={`${label}. Switch organization`} data-tip={collapsed?presentation.organizationName:undefined} data-tip-side="right" {...popover.triggerProps}>{body}<InstrumentIcon name="chevrons" className={styles.chevron}/></button>
  <FloatingLayer popover={popover} role="menu" label="Switch organization" width={300} onKeyDown={menuKeyDown(popover.close)}>
   <MenuScope close={popover.close}>
    <MenuLabel>Organizations</MenuLabel>
    {loadError&&<p role="alert" className={styles.error}>{loadError}</p>}
    <form action={action} onReset={keepAction} onSubmit={e=>{const submitter=(e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement|null;setTarget(submitter?.value??null);}} aria-busy={pending||undefined}>
     <input type="hidden" name="scopeWorkspaceId" value={access.workspaceId}/>
     {contexts?.map(ctx=>{
      const row={icon:<span className={styles.rowAvatar} data-demo={ctx.isDemo||undefined}>{initials(ctx.organizationName)}</span>,description:<>{ctx.role?roleShortLabel(ctx.role):'Platform access · not a member'}{ctx.isDemo&&<> · <span className={styles.inlineTag}>Synthetic demo</span></>}</>,trailing:ctx.current?<InstrumentIcon name="check"/>:undefined};
      return ctx.current
       ?<MenuButton key={ctx.workspaceId} checked {...row}>{ctx.organizationName}</MenuButton>
       :<MenuSubmit key={ctx.workspaceId} name="workspaceId" value={ctx.workspaceId} checked={false} disabled={pending} pending={pending&&target===ctx.workspaceId} {...row}>{ctx.organizationName}</MenuSubmit>;
     })}
    </form>
    {state.error&&<p role="alert" className={styles.error}>{state.error}</p>}
    <p className={styles.note}>Switching opens Home in that organization. Unsaved changes on this page are lost.</p>
    {hasOrganizationAdminAuthority(access)&&<><MenuSeparator/><MenuLink href="/administration" icon={<InstrumentIcon name="administration"/>}>Organization settings</MenuLink></>}
   </MenuScope>
  </FloatingLayer>
 </div>;
}

/** Top-bar Demo context: the user-facing dataset label and scenario date. Never the registry key. */
export function DemoContextPill({identity}:{identity:ShellIdentity}){
 if(!identity.presentation.isDemo)return null;
 const date=identity.presentation.scenarioAt?new Date(identity.presentation.scenarioAt).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}):null;
 const text=[identity.datasetLabel,date&&`scenario ${date}`].filter(Boolean).join(' · ');
 return <span className={styles.demoPill} data-tip="Synthetic data. Records are dated up to the scenario date; changes you make carry today's date." tabIndex={0}><span className={styles.dot} aria-hidden="true"/>Synthetic demo{text&&<small>{text}</small>}</span>;
}
