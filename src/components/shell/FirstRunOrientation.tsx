'use client';
import Link from 'next/link';
import {useSyncExternalStore} from 'react';
import {InstrumentIcon} from './InstrumentIcon';
import type {ShellIdentity} from './ShellIdentity';
import styles from './HelpPanel.module.css';
export const RESTART_ORIENTATION='prodwise:restart-orientation';
const CHANGED='prodwise:orientation-changed';
export const orientationStorageKey=(identity:ShellIdentity)=>`prodwise.orientation.v2:${identity.access.actor.id}:${identity.access.organizationId}`;
/** One quiet line on Home for first-time visitors: where to start. Dismissible; Help can restart it. */
export function FirstRunOrientation({identity,demoLead=null}:{identity:ShellIdentity;demoLead?:string|null}){
 const key=orientationStorageKey(identity);
 const value=useSyncExternalStore(callback=>{const restart=()=>{try{localStorage.removeItem(key);}catch{}callback();};window.addEventListener('storage',callback);window.addEventListener(CHANGED,callback);window.addEventListener(RESTART_ORIENTATION,restart);return()=>{window.removeEventListener('storage',callback);window.removeEventListener(CHANGED,callback);window.removeEventListener(RESTART_ORIENTATION,restart);};},()=>{try{return localStorage.getItem(key)??'show';}catch{return 'show';}},()=>null);
 if(value===null||value==='dismissed')return null;
 const demo=identity.presentation.isDemo;
 return <section className={styles.orientation} aria-label="Start here">
  <p><strong>Start here.</strong> {demo?`This organization is synthetic.${demoLead?` ${demoLead}`:''}`:'Review what needs attention, then open an initiative to inspect its record and sources.'}{identity.access.role==='VIEWER'?' Your access is read-only.':''}</p>
  <div>
   <Link prefetch={false} className="pw-btn" data-variant="secondary" data-size="sm" href={demo&&demoLead?'/initiatives/merchant-flex-finance':'/initiatives'}>{demo&&demoLead?'Open Merchant Flex Finance':'Open Initiatives'}</Link>
   <button type="button" className="pw-btn" data-variant="ghost" data-size="sm" data-icon-only="" aria-label="Dismiss" data-tip="Dismiss · Help can show this again" onClick={()=>{try{localStorage.setItem(key,'dismissed');}catch{}window.dispatchEvent(new Event(CHANGED));}}><InstrumentIcon name="close"/></button>
  </div>
 </section>;
}
