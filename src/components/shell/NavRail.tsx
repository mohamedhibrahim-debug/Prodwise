'use client';
import Link from 'next/link';
import {useCallback,useEffect,useRef,useState,useSyncExternalStore} from 'react';
import {usePathname} from 'next/navigation';
import {hasOrganizationAdminAuthority} from '@/lib/auth/roles';
import {BrandMark} from '@/components/primitives/BrandMark';
import {NotificationBell} from '@/components/notifications/NotificationBell';
import {InstrumentIcon,type InstrumentIconName} from './InstrumentIcon';
import {PendingHint} from './PendingHint';
import {openHelp,openPalette,OPEN_ORGANIZATION_SWITCHER,TOGGLE_SIDEBAR} from './events';
import {OrganizationControl} from './OrganizationControl';
import {AccountMenu} from './AccountMenu';
import {writeRailExpanded,RAIL_DRAWER_MAX,RAIL_OVERLAY_MAX} from './rail-preference';
import {useInitiativeTitle} from './shell-title';
import {sectionTitle} from './TopBar';
import type {ShellIdentity} from './ShellIdentity';
import styles from './NavRail.module.css';

type RailMode='drawer'|'overlay'|'pinned';
const RAIL_CHANGED='prodwise:rail-changed';
/** The remembered preference lives on <html data-rail> (set before paint) and in storage. */
function readExpanded(){return document.documentElement.dataset.rail!=='collapsed';}
function subscribeRail(callback:()=>void){window.addEventListener(RAIL_CHANGED,callback);return()=>window.removeEventListener(RAIL_CHANGED,callback);}
function setRailExpanded(next:boolean){try{writeRailExpanded(window.localStorage,next);}catch{}if(next)delete document.documentElement.dataset.rail;else document.documentElement.dataset.rail='collapsed';window.dispatchEvent(new Event(RAIL_CHANGED));}
function readMode():RailMode{return matchMedia(`(max-width:${RAIL_DRAWER_MAX}px)`).matches?'drawer':matchMedia(`(max-width:${RAIL_OVERLAY_MAX}px)`).matches?'overlay':'pinned';}
function subscribeViewport(callback:()=>void){const queries=[matchMedia(`(max-width:${RAIL_DRAWER_MAX}px)`),matchMedia(`(max-width:${RAIL_OVERLAY_MAX}px)`)];queries.forEach(q=>q.addEventListener('change',callback));return()=>queries.forEach(q=>q.removeEventListener('change',callback));}

interface NavLink{href:string;label:string;icon:InstrumentIconName;keys:string;match:(p:string)=>boolean}
const LINKS:NavLink[]=[
 {href:'/',label:'Home',icon:'home',keys:'G H',match:p=>p==='/'},
 {href:'/initiatives',label:'Initiatives',icon:'initiatives',keys:'G I',match:p=>p.startsWith('/initiatives')},
 {href:'/roadmap',label:'Roadmap',icon:'roadmap',keys:'G R',match:p=>p.startsWith('/roadmap')},
 {href:'/weekly-review',label:'Weekly Review',icon:'weekly',keys:'G W',match:p=>p.startsWith('/weekly-review')},
 {href:'/analysis/portfolio',label:'Analysis',icon:'analysis',keys:'G A',match:p=>p.startsWith('/analysis')},
];

/**
 * The product rail. Desktop: 232px expanded / 56px collapsed, toggled from the
 * header button or `[`, remembered per viewer. 781–1023px: starts collapsed and
 * expands as an overlay. Phones: a top bar with a slide-over drawer holding the
 * same items. The collapsed look is driven by the rail's own width (container
 * query), so a remembered collapse never flashes open on load.
 */
export function NavRail({identity,writesEnabled}:{identity:ShellIdentity;writesEnabled:boolean}){
 const pathname=usePathname();
 const expanded=useSyncExternalStore(subscribeRail,readExpanded,()=>true);
 const mode=useSyncExternalStore(subscribeViewport,readMode,()=>'pinned' as RailMode);
 // Optimistic highlight and overlay belong to the path they were set on, so a navigation clears them.
 const [overlayOn,setOverlayOn]=useState<string|null>(null);
 const [optimisticFor,setOptimisticFor]=useState<{href:string;from:string}|null>(null);
 const overlay=mode==='overlay'&&overlayOn===pathname;
 const optimistic=optimisticFor?.from===pathname?optimisticFor.href:null;
 const setOptimistic=(href:string)=>setOptimisticFor({href,from:pathname});
 const drawer=useRef<HTMLDialogElement>(null);const menuButton=useRef<HTMLButtonElement>(null);const rail=useRef<HTMLElement>(null);
 const slug=/^\/initiatives\/([^/]+)/.exec(pathname)?.[1];const initiativeSlug=slug&&slug!=='new'?slug:null;
 const initiativeTitle=useInitiativeTitle(initiativeSlug);

 // Navigation settled: close the drawer.
 useEffect(()=>{if(drawer.current?.open)drawer.current.close();},[pathname]);

 const toggle=useCallback(()=>{
  if(mode==='drawer'){const d=drawer.current;if(d?.open)d.close();else d?.showModal();return;}
  if(mode==='overlay'){setOverlayOn(was=>was===pathname?null:pathname);return;}
  setRailExpanded(!readExpanded());
 },[mode,pathname]);
 useEffect(()=>{window.addEventListener(TOGGLE_SIDEBAR,toggle);return()=>window.removeEventListener(TOGGLE_SIDEBAR,toggle);},[toggle]);

 // Overlay closes on Escape or an outside press.
 useEffect(()=>{
  if(!overlay)return;
  const down=(e:PointerEvent)=>{const t=e.target as Node;if(rail.current&&!rail.current.contains(t)&&!(t instanceof Element&&t.closest('[role=menu]')))setOverlayOn(null);};
  const key=(e:KeyboardEvent)=>{if(e.key==='Escape')setOverlayOn(null);};
  document.addEventListener('pointerdown',down);document.addEventListener('keydown',key);
  return()=>{document.removeEventListener('pointerdown',down);document.removeEventListener('keydown',key);};
 },[overlay]);

 // On a phone the organization switcher lives in the drawer: open it first.
 useEffect(()=>{const open=()=>{if(mode==='drawer'&&!drawer.current?.open){drawer.current?.showModal();requestAnimationFrame(()=>window.dispatchEvent(new CustomEvent(OPEN_ORGANIZATION_SWITCHER)));}};window.addEventListener(OPEN_ORGANIZATION_SWITCHER,open);return()=>window.removeEventListener(OPEN_ORGANIZATION_SWITCHER,open);},[mode]);

 const collapsed=mode==='overlay'?!overlay:mode==='pinned'?!expanded:false;
 const tip=(label:string)=>collapsed?label:undefined;
 const isActive=(link:NavLink)=>optimistic?optimistic===link.href:link.match(pathname);
 const closeDrawer=()=>{if(drawer.current?.open)drawer.current.close();};

 const navigation=(inDrawer:boolean)=><>
  <nav aria-label="Primary" className={styles.nav}>
   {inDrawer&&<button type="button" className={styles.navItem} onClick={()=>{closeDrawer();openPalette();}}><InstrumentIcon name="search"/><span className={styles.label}>Search</span></button>}
   {LINKS.map(link=>{const active=isActive(link);return <Link key={link.href} href={link.href} onClick={()=>{if(!link.match(pathname))setOptimistic(link.href);}} className={styles.navItem} aria-current={active?'page':undefined} data-tip={inDrawer?undefined:tip(link.label)} data-tip-kbd={link.keys} data-tip-side="right" aria-label={collapsed&&!inDrawer?link.label:undefined}><InstrumentIcon name={link.icon}/><span className={styles.label}>{link.label}</span><PendingHint/></Link>;})}
   {inDrawer&&<div className={styles.drawerBell}><NotificationBell/></div>}
  </nav>
  {initiativeSlug&&<nav className={styles.context} aria-label="Current initiative">
   <p className={styles.sectionLabel}>Current initiative</p>
   <Link prefetch={false} href={`/initiatives/${initiativeSlug}`} className={styles.navItem} data-sub="" aria-current={pathname===`/initiatives/${initiativeSlug}`?'page':undefined} data-tip={inDrawer?undefined:tip(initiativeTitle??'Current initiative')} data-tip-side="right" aria-label={collapsed&&!inDrawer?(initiativeTitle??'Current initiative'):undefined}><InstrumentIcon name="initiative"/><span className={styles.label}>{initiativeTitle??'Initiative'}</span></Link>
  </nav>}
 </>;

 const footer=(inDrawer:boolean)=><div className={styles.footer}>
  <nav aria-label="Administration and help" className={styles.utilities}>
   {!identity.guest&&hasOrganizationAdminAuthority(identity.access)&&<Link prefetch={false} href="/administration" className={styles.navItem} aria-current={pathname.startsWith('/administration')?'page':undefined} data-tip={inDrawer?undefined:tip('Administration')} data-tip-side="right" aria-label={collapsed&&!inDrawer?'Administration':undefined}><InstrumentIcon name="administration"/><span className={styles.label}>Administration</span></Link>}
   <button className={styles.navItem} type="button" onClick={()=>{closeDrawer();openHelp();}} data-help-trigger="" data-tip={inDrawer?undefined:tip('Help')} data-tip-kbd="?" data-tip-side="right" aria-label={collapsed&&!inDrawer?'Help':undefined}><InstrumentIcon name="help"/><span className={styles.label}>Help</span></button>
  </nav>
  {!writesEnabled&&<p className={styles.environment} data-tip={collapsed&&!inDrawer?'Changes are disabled in this environment':undefined} data-tip-side="right"><span aria-hidden="true" className={styles.lock}/><span className={styles.label}>Changes disabled in this environment</span></p>}
  <AccountMenu identity={identity} collapsed={collapsed&&!inDrawer}/>
 </div>;

 const brand=<Link href="/" className={styles.brand} aria-label="Prodwise home" data-tip={tip('Home')} data-tip-side="right"><BrandMark size={22}/><span className={styles.wordmark}>Prodwise</span></Link>;

 return <>
  <header className={styles.mobileBar}>
   <button ref={menuButton} type="button" className="pw-btn" data-variant="chrome" data-icon-only="" onClick={()=>drawer.current?.showModal()} aria-label="Open navigation" aria-haspopup="dialog"><InstrumentIcon name="menu"/></button>
   <Link href="/" className={styles.mobileBrand} aria-label="Prodwise home"><BrandMark size={20}/></Link>
   <p className={styles.mobileTitle}>{initiativeTitle&&initiativeSlug?initiativeTitle:sectionTitle(pathname)}</p>
   <button type="button" className="pw-btn" data-variant="chrome" data-icon-only="" onClick={openPalette} aria-label="Search"><InstrumentIcon name="search"/></button>
   <div id="ask-prodwise-slot-mobile" className={styles.askSlot}/>
   <div className={styles.mobileBell}><NotificationBell compact/></div>
  </header>

  <aside ref={rail} className={styles.rail} data-overlay={overlay||undefined} aria-label="Product navigation">
   <div className={styles.head}>
    {brand}
    <button type="button" className={`pw-btn ${styles.toggle}`} data-variant="chrome" data-size="sm" data-icon-only="" onClick={toggle} aria-label={collapsed?'Expand sidebar':'Collapse sidebar'} aria-expanded={!collapsed} data-tip={collapsed?'Expand sidebar':'Collapse sidebar'} data-tip-kbd="[" data-tip-side={collapsed?'right':'bottom'}>
     <InstrumentIcon name="sidebar-collapse" className={styles.iconCollapse}/><InstrumentIcon name="sidebar-expand" className={styles.iconExpand}/>
    </button>
   </div>
   <div className={styles.organization}><OrganizationControl identity={identity} collapsed={collapsed}/></div>
   <div className={styles.scroll}>{navigation(false)}</div>
   {footer(false)}
   <svg className={styles.arcBleed} viewBox="0 0 200 200" aria-hidden="true" focusable="false"><circle cx="100" cy="100" r="92" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="60 12"/></svg>
  </aside>

  <dialog ref={drawer} className={styles.drawer} aria-label="Navigation" onCancel={()=>menuButton.current?.focus()} onClick={e=>{if(e.target===drawer.current)drawer.current.close();}}>
   <div className={styles.drawerInner}>
    <div className={styles.head}><Link href="/" className={styles.brand} aria-label="Prodwise home"><BrandMark size={22}/><span className={styles.wordmark}>Prodwise</span></Link><button type="button" className="pw-btn" data-variant="chrome" data-icon-only="" onClick={()=>{closeDrawer();menuButton.current?.focus();}} aria-label="Close navigation"><InstrumentIcon name="close"/></button></div>
    <div className={styles.organization}><OrganizationControl identity={identity}/></div>
    <div className={styles.scroll}>{navigation(true)}</div>
    {footer(true)}
   </div>
  </dialog>
 </>;
}
