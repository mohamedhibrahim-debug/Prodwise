import Link from 'next/link';
import {BUSINESS_LINE_LABEL,STAGE_LABEL} from '@/lib/domain/labels';
import type {Initiative} from '@/lib/domain/types';
import {readDelivery} from '@/lib/delivery/repository';
import {ownerFor} from '@/lib/delivery/model';
import {isDemoGuestSession} from '@/lib/auth/service';
import {OrganizationControl} from './OrganizationControl';
import {ShellActions} from './ShellActions';
import {WorkspaceTabs} from './WorkspaceTabs';
import styles from './WorkspaceHeader.module.css';
export async function WorkspaceHeader({initiative}:{initiative:Initiative}){
 const d=await readDelivery();const ownerId=ownerFor(d.state.facts.filter(f=>f.workspaceId===d.ctx.workspaceId),initiative.id);const owner=d.source.members.find(m=>m.id===ownerId);const guest=await isDemoGuestSession();
 return <header className={styles.header}><div className={styles.inner}><div className={styles.identity}><div className={styles.headerOrg}><OrganizationControl identity={{access:d.ctx,presentation:d.presentation,guest}} compact/></div><nav aria-label="Breadcrumb"><Link prefetch={false} href="/initiatives">Initiatives</Link><span>/</span></nav><h1 data-workspace-title title={initiative.name}>{initiative.name}</h1><span className={styles.stage}>{STAGE_LABEL[initiative.stage]}</span><span className={styles.meta}>{BUSINESS_LINE_LABEL[initiative.businessLine]}</span><span className={styles.meta}>Owner · {owner?.displayName??'Unassigned'}</span>{initiative.isDemo&&<span className={styles.meta}>Synthetic demo</span>}{d.ctx.role==='VIEWER'&&<span className={styles.meta}>Viewer · read-only</span>}</div><WorkspaceTabs slug={initiative.slug}/><ShellActions/></div></header>;
}
