'use client';
import {usePathname} from 'next/navigation';
import {useEffect} from 'react';
import {NavRail} from './NavRail';
import {GlobalCommandBar} from './GlobalCommandBar';
import {CommandPalette} from './CommandPalette';
import {HelpPanel} from './HelpPanel';
import {NavigationProgress} from './NavigationProgress';
import {Suspense} from 'react';
import {WorkspaceScopeProvider} from '@/components/auth/WorkspaceScope';
import type {ShellIdentity} from './ShellIdentity';
import styles from '@/app/layout.module.css';
export function ApplicationShell({children,identity,writesEnabled}:{children:React.ReactNode;identity:ShellIdentity|null;writesEnabled:boolean}){
 const path=usePathname();
 useEffect(()=>{document.documentElement.dataset.prodwiseHydrated='true';return()=>{delete document.documentElement.dataset.prodwiseHydrated;};},[path]);
 useEffect(()=>{if(path==='/'&&new URLSearchParams(location.search).has('organizationChanged'))document.querySelector<HTMLElement>('h1')?.focus();},[path,identity?.access.workspaceId]);
 if(!identity||/^\/(login|invite)(\/|$)/.test(path))return <main id="main-content" tabIndex={-1}>{children}</main>;
 return <WorkspaceScopeProvider key={identity.access.workspaceId} workspaceId={identity.access.workspaceId}><a className="skip-link" href="#main-content">Skip to main content</a><Suspense fallback={null}><NavigationProgress/></Suspense><NavRail identity={identity} writesEnabled={writesEnabled}/><div className={styles.canvas}><GlobalCommandBar identity={identity}/><main className={styles.main} id="main-content" tabIndex={-1}>{children}</main></div><HelpPanel identity={identity}/><CommandPalette key={`${identity.access.organizationId}:${identity.access.actor.id}`} administration={!identity.guest&&(['ORG_OWNER','ADMIN'].includes(identity.access.role??'')||identity.access.platformRole==='PLATFORM_OWNER')} canSwitch={!identity.guest}/></WorkspaceScopeProvider>;
}
