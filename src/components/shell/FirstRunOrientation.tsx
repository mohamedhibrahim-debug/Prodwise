'use client';
import Link from 'next/link';
import {useSyncExternalStore} from 'react';
import type {ShellIdentity} from './ShellIdentity';
import styles from './HelpPanel.module.css';
export const RESTART_ORIENTATION='prodwise:restart-orientation';
const CHANGED='prodwise:orientation-changed';
export const orientationStorageKey=(identity:ShellIdentity)=>`prodwise.orientation.v2:${identity.access.actor.id}:${identity.access.organizationId}`;
export function FirstRunOrientation({identity}:{identity:ShellIdentity}){
 const key=orientationStorageKey(identity);
 const value=useSyncExternalStore(callback=>{const restart=()=>{try{localStorage.removeItem(key);}catch{}callback();};window.addEventListener('storage',callback);window.addEventListener(CHANGED,callback);window.addEventListener(RESTART_ORIENTATION,restart);return()=>{window.removeEventListener('storage',callback);window.removeEventListener(CHANGED,callback);window.removeEventListener(RESTART_ORIENTATION,restart);};},()=>{try{return localStorage.getItem(key)??'show';}catch{return 'show';}},()=>null);
 if(value===null||value==='dismissed')return null;
 return <section className={styles.orientation} aria-label="Start here"><p>{identity.presentation.isDemo?'This is a synthetic organization. Start with Merchant Flex Finance: two sources disagree on the repayment divisor (27 vs 30).':'Start with your portfolio attention, then open an initiative to inspect its current record and supporting sources.'}{identity.access.role==='VIEWER'?' You can explore records with read-only access.':''}</p><div><Link prefetch={false} href={identity.presentation.isDemo?'/initiatives/merchant-flex-finance':'/initiatives'}>{identity.presentation.isDemo?'Open Merchant Flex Finance':'Open Initiatives'}</Link><button type="button" onClick={()=>{try{localStorage.setItem(key,'dismissed');}catch{}window.dispatchEvent(new Event(CHANGED));}}>Dismiss</button></div></section>;
}
