'use client';
import Image from 'next/image';
import Link from 'next/link';
import {useEffect,useRef,useState} from 'react';
import {usePathname} from 'next/navigation';
import {logoutAction} from '@/app/login/actions';
import {hasOrganizationAdminAuthority} from '@/lib/auth/roles';
import {InstrumentIcon} from './InstrumentIcon';
import {openPalette} from './events';
import {OrganizationControl} from './OrganizationControl';
import {NotificationBell} from '@/components/notifications/NotificationBell';
import {OPEN_HELP} from './HelpPanel';
import type {ShellIdentity} from './ShellIdentity';
import styles from './NavRail.module.css';
export function NavRail({identity,writesEnabled}:{identity:ShellIdentity;writesEnabled:boolean}){
 const pathname=usePathname();const[expanded,setExpanded]=useState(true);const[title,setTitle]=useState('Initiative');const drawer=useRef<HTMLDialogElement>(null);const trigger=useRef<HTMLButtonElement>(null);
 useEffect(()=>{const media=matchMedia('(min-width:1101px)');function sync(){let saved;try{saved=localStorage.getItem('prodwise.navigation.expanded');}catch{}setExpanded(media.matches&&saved!=='false');}sync();media.addEventListener('change',sync);return()=>media.removeEventListener('change',sync);},[]);
 useEffect(()=>{document.documentElement.style.setProperty('--rail-w',expanded?'248px':'76px');return()=>{document.documentElement.style.removeProperty('--rail-w');};},[expanded]);
 useEffect(()=>{function update(){const text=document.querySelector('[data-workspace-title]')?.textContent;if(text)setTitle(text);}update();const observer=new MutationObserver(update);observer.observe(document.body,{childList:true,subtree:true});return()=>observer.disconnect();},[pathname]);
 function close(){drawer.current?.close();trigger.current?.focus();}
 const links=[{href:'/',label:'Home',icon:'home' as const,active:pathname==='/'},{href:'/initiatives',label:'Initiatives',icon:'initiatives' as const,active:pathname.startsWith('/initiatives')},{href:'/roadmap',label:'Roadmap',icon:'reporting' as const,active:pathname.startsWith('/roadmap')},{href:'/weekly-review',label:'Weekly Review',icon:'event' as const,active:pathname.startsWith('/weekly-review')},{href:'/analysis/portfolio',label:'Analysis',icon:'reporting' as const,active:pathname.startsWith('/analysis')}];
 const brand=<div className={styles.brand}><Image src="/assets/prodwise-logo-mark.png" alt="" width={32} height={32} unoptimized/><strong>Prodwise</strong></div>;
 const navigation=<><nav aria-label="Primary">{links.map(link=><Link key={link.href} href={link.href} onClick={close} title={link.label} aria-label={link.label} className={`${styles.navItem} ${link.active?styles.active:''}`} aria-current={link.active?'page':undefined}><InstrumentIcon name={link.icon}/><span>{link.label}</span></Link>)}</nav>{pathname.startsWith('/initiatives/')&&pathname!='/initiatives/new'&&<nav className={styles.context} aria-label="Current initiative"><Link prefetch={false} href={`/initiatives/${pathname.split('/')[2]}`} className={styles.navItem} title={title}><InstrumentIcon name="initiatives"/><span>{title}</span></Link></nav>}</>;
 const utilities=<nav aria-label="Administration and account" className={styles.utilities}>
 {!identity.guest&&hasOrganizationAdminAuthority(identity.access)&&<Link prefetch={false} href="/administration" className={styles.navItem} onClick={close} title="Administration"><InstrumentIcon name="administration"/><span>Administration</span></Link>}
 <button className={styles.navItem} type="button" title="Help" aria-label="Help" onClick={()=>{close();window.dispatchEvent(new Event(OPEN_HELP));}}><b aria-hidden="true">?</b><span>Help</span></button>
 <details className={styles.account}><summary className={styles.navItem} title={`Account: ${identity.access.actor.label}`}><b aria-hidden="true">{identity.access.actor.label.slice(0,1)}</b><span>{identity.access.actor.label}</span></summary><div className={styles.accountMenu}><Link prefetch={false} href="/account" onClick={close}>My account</Link><form action={logoutAction}><button type="submit">Sign out</button></form></div></details>
 {!writesEnabled&&<p>Changes disabled in this environment</p>}
 </nav>;
 return <><header className={styles.mobileBar}><button ref={trigger} type="button" onClick={()=>drawer.current?.showModal()} aria-label="Open navigation"><InstrumentIcon name="menu"/></button><Image src="/assets/prodwise-logo-mark.png" alt="" width={24} height={24} unoptimized/><div className={styles.mobileIdentity}><span>Prodwise{identity.presentation.isDemo?' · Demo':''}</span><OrganizationControl identity={identity} compact/></div><NotificationBell compact/><button type="button" onClick={openPalette} aria-label="Search"><InstrumentIcon name="search"/></button></header>
 <aside className={`${styles.rail} ${expanded?styles.expanded:''}`} aria-label="Product navigation">{brand}<div className={styles.organization}><OrganizationControl identity={identity}/></div>{navigation}<div className={styles.footer}>{utilities}<button className={styles.pin} type="button" onClick={()=>{const next=!expanded;setExpanded(next);try{localStorage.setItem('prodwise.navigation.expanded',String(next));}catch{}}} aria-label={expanded?'Collapse navigation':'Pin expanded navigation'} aria-pressed={expanded}><InstrumentIcon name="pin"/><span>{expanded?'Collapse':'Expand'}</span></button></div></aside>
 <dialog ref={drawer} className={styles.drawer} aria-label="Navigation" onCancel={()=>trigger.current?.focus()}>{brand}<button type="button" className={styles.close} onClick={close} aria-label="Close navigation">Close ×</button><OrganizationControl identity={identity}/>{navigation}{utilities}</dialog></>;
}
