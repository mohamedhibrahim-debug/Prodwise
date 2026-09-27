import Link from 'next/link';
import {BUSINESS_LINE_LABEL,STAGE_LABEL} from '@/lib/domain/labels';
import type {Initiative} from '@/lib/domain/types';
import {readDelivery} from '@/lib/delivery/repository';
import {readManagement} from '@/lib/data/management-read';
import {buildPortfolioProjection} from '@/lib/workspace/portfolio';
import {ownerFor} from '@/lib/delivery/model';
import {isDemoGuestSession} from '@/lib/auth/service';
import {OrganizationControl} from './OrganizationControl';
import {ShellActions} from './ShellActions';
import {WorkspaceTabs} from './WorkspaceTabs';
import styles from './WorkspaceHeader.module.css';
export async function WorkspaceHeader({initiative}:{initiative:Initiative}){
 const [d,m]=await Promise.all([readDelivery(),readManagement()]);const row=buildPortfolioProjection({source:{...d.source,snapshots:d.source.snapshots.filter(s=>s.initiative.id===initiative.id)},state:d.state,workspaceId:d.ctx.workspaceId,asOf:new Date().toISOString(),management:m}).rows[0];const ownerId=ownerFor(d.state.facts.filter(f=>f.workspaceId===d.ctx.workspaceId),initiative.id);const owner=d.source.members.find(m=>m.id===ownerId);const guest=await isDemoGuestSession();
 return <header className={styles.header}><div className={styles.inner}><div className={styles.identity}><div className={styles.headerOrg}><OrganizationControl identity={{access:d.ctx,presentation:d.presentation,guest}} compact/></div><nav aria-label="Breadcrumb"><Link prefetch={false} href="/initiatives">Initiatives</Link><span>/</span></nav><h1 data-workspace-title title={initiative.name}>{initiative.name}</h1><span className={styles.stage}>{STAGE_LABEL[initiative.stage]}</span><span className={styles.meta}>{BUSINESS_LINE_LABEL[initiative.businessLine]}</span><span className={styles.owner}>Owner · {owner?.displayName??'No owner recorded'}</span>{row&&<><Link prefetch={false} className={styles.signal} href={`/initiatives/${initiative.slug}/setup?step=review`}>{row.setup.label} · {row.setup.completed}/10</Link><Link prefetch={false} className={styles.signal} href={`/initiatives/${initiative.slug}/decisions`}>Attention: {row.attention.length?`${row.attention.length} open`:row.snapshot.claims.length?'No open items in current checks':'Not assessed'}</Link></>}{initiative.isDemo&&<span className={styles.meta}>Synthetic demo</span>}{d.ctx.role==='VIEWER'&&<span className={styles.meta}>Viewer · read-only</span>}<Link prefetch={false} href={`/initiatives/${initiative.slug}/manage`} className={styles.manage}>{d.ctx.role==='VIEWER'?'Initiative details':'Manage initiative'}</Link></div>{initiative.archivedAt&&<p role="status" className={styles.meta}>Archived · read-only. Records and history are preserved. An administrator can restore this initiative in Manage initiative.</p>}<WorkspaceTabs slug={initiative.slug}/><ShellActions/></div></header>;
}
