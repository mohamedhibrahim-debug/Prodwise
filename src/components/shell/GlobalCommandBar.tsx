'use client';
import {usePathname} from 'next/navigation';
import {ShellActions} from './ShellActions';
import {OrganizationControl} from './OrganizationControl';
import type {ShellIdentity} from './ShellIdentity';
import styles from './GlobalCommandBar.module.css';
export function GlobalCommandBar({identity}:{identity:ShellIdentity}){
 const path=usePathname();if(/^\/initiatives\/[^/]+/.test(path)&&path!='/initiatives/new')return null;
 const title=path==='/'?'Home':path.startsWith('/initiatives')?'Initiatives':path.startsWith('/roadmap')?'Roadmap':path.startsWith('/analysis')?'Analysis':path.startsWith('/weekly-review')?'Weekly Review':path.startsWith('/administration')?'Administration':path.startsWith('/account')?'My account':'Prodwise';
 return <header className={styles.bar}><div className={styles.leading}><div className={styles.organization}><OrganizationControl identity={identity} compact/></div><strong>{title}</strong></div><div className={styles.trailing}>{identity.access.role==='VIEWER'&&<span>Viewer · read-only</span>}<ShellActions/></div></header>;
}
