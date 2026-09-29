'use client';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {Fragment,useSyncExternalStore} from 'react';
import {NotificationBell} from '@/components/notifications/NotificationBell';
import {InstrumentIcon} from './InstrumentIcon';
import {DemoContextPill} from './OrganizationControl';
import {openHelp,openPalette} from './events';
import {useInitiativeTitle} from './shell-title';
import type {ShellIdentity} from './ShellIdentity';
import {adminBreadcrumb} from '@/components/admin/model';
import styles from './TopBar.module.css';

export function sectionTitle(path:string){
 return path==='/'?'Home':path.startsWith('/initiatives')?'Initiatives':path.startsWith('/roadmap')?'Roadmap':path.startsWith('/analysis')?'Analysis':path.startsWith('/weekly-review')?'Weekly Review':path.startsWith('/administration')||path.startsWith('/users')||path.startsWith('/platform')?'Administration':path.startsWith('/account')?'My account':path.startsWith('/notifications')?'Notifications':path.startsWith('/sources')?'Sources':'Prodwise';
}

const noSubscription=()=>()=>{};
const isApplePlatform=()=>/Mac|iPhone|iPad/.test(navigator.platform||navigator.userAgent);

type Crumb={label:string;href?:string};
function crumbs(path:string,initiativeSlug:string|null,initiativeTitle:string|null):Crumb[]{
 if(initiativeSlug)return [{label:'Initiatives',href:'/initiatives'},{label:initiativeTitle??'Initiative',href:path===`/initiatives/${initiativeSlug}`?undefined:`/initiatives/${initiativeSlug}`}];
 if(path==='/initiatives/new')return [{label:'Initiatives',href:'/initiatives'},{label:'New initiative'}];
 if(path.startsWith('/account/connections'))return [{label:'My account',href:'/account'},{label:'Connected sources'}];
 if(path.startsWith('/administration'))return adminBreadcrumb(path);
 if(path.startsWith('/analysis/projects/'))return [{label:'Analysis',href:'/analysis/portfolio'},{label:'Initiative'}];
 return [{label:sectionTitle(path)}];
}

/**
 * The one top bar, identical on every signed-in page: where you are on the
 * left, global actions on the right (search, notifications, help).
 */
export function TopBar({identity}:{identity:ShellIdentity}){
 const path=usePathname();
 const slug=/^\/initiatives\/([^/]+)/.exec(path)?.[1];const initiativeSlug=slug&&slug!=='new'?slug:null;
 const title=useInitiativeTitle(initiativeSlug);
 const mac=useSyncExternalStore(noSubscription,isApplePlatform,()=>true);
 const trail=crumbs(path,initiativeSlug,title);
 return <header className={styles.bar}>
  <nav aria-label="Breadcrumb" className={styles.crumbs}><ol>{trail.map((c,i)=><Fragment key={i}><li aria-current={i===trail.length-1?'page':undefined}>{c.href?<Link href={c.href} prefetch={i===0}>{c.label}</Link>:<span>{c.label}</span>}</li>{i<trail.length-1&&<li aria-hidden="true" className={styles.sep}>/</li>}</Fragment>)}</ol></nav>
  <div className={styles.actions}>
   {identity.access.role==='VIEWER'&&<span className={styles.chip} data-tip="You can read everything in this organization; changes need a Member role or above.">Viewer · read-only</span>}
   <DemoContextPill identity={identity}/>
   <button type="button" className={styles.search} onClick={openPalette} aria-label="Search" aria-keyshortcuts={mac?'Meta+K':'Control+K'}><InstrumentIcon name="search"/><span>Search…</span><kbd className="pw-kbd">{mac?'⌘':'Ctrl'}</kbd><kbd className="pw-kbd">K</kbd></button>
   <div className={styles.bell} data-tip="Notifications" data-tip-kbd="G N"><NotificationBell compact/></div>
   <button type="button" className="pw-btn" data-variant="ghost" data-icon-only="" onClick={()=>openHelp()} aria-label="Help" data-tip="Help" data-tip-kbd="?"><InstrumentIcon name="help"/></button>
  </div>
 </header>;
}
