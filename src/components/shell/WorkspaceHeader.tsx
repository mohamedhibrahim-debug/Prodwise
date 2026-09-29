import { BusinessLine } from '@/components/primitives/BusinessLine';
import Link from 'next/link';
import {AddEvidenceMenu} from '@/components/evidence/AddEvidenceMenu';
import {InitiativeArc} from '@/components/primitives/InitiativeArc';
import {STAGE_LABEL} from '@/lib/domain/labels';
import type {Initiative} from '@/lib/domain/types';
import {readDelivery} from '@/lib/delivery/repository';
import {readManagement} from '@/lib/data/management-read';
import {buildPortfolioProjection} from '@/lib/workspace/portfolio';
import {ownerFor} from '@/lib/delivery/model';
import {canBusinessWrite} from '@/lib/auth/roles';
import {isDemoWriteEnabled} from '@/lib/env';
import {WorkspaceTabs} from './WorkspaceTabs';
import {PublishInitiativeTitle} from './shell-title';
import {initials} from './ShellIdentity';
import {readRelationships} from '@/lib/data/relationships';
import styles from './WorkspaceHeader.module.css';

/**
 * The initiative header: title and actions on one row, uniform meta chips
 * beneath, then the tab strip. Rendered by the initiative layout, so it
 * persists while tabs change. The breadcrumb lives in the global top bar.
 */
export async function WorkspaceHeader({initiative}:{initiative:Initiative}){
 const [d,m,rel]=await Promise.all([readDelivery(),readManagement(),readRelationships()]);const row=buildPortfolioProjection({source:d.source,state:d.state,workspaceId:d.ctx.workspaceId,asOf:d.presentation.scenarioAt??new Date().toISOString(),management:m,relationships:rel.relationships}).rows.find(x=>x.initiative.id===initiative.id);const ownerId=ownerFor(d.state.facts.filter(f=>f.workspaceId===d.ctx.workspaceId),initiative.id);const owner=d.source.members.find(m=>m.id===ownerId);
 const viewer=d.ctx.role==='VIEWER';
 return <header className={styles.header}>
  <PublishInitiativeTitle slug={initiative.slug} name={initiative.name}/>
  <div className={styles.inner}>
   <div className={styles.titleRow}>
    <h1 data-workspace-title title={initiative.name}>{initiative.name}</h1>
    <span className={styles.headerActions}>
     {canBusinessWrite(d.ctx)&&!initiative.archivedAt&&isDemoWriteEnabled&&<AddEvidenceMenu slug={initiative.slug} connectors={!d.presentation.isDemo}/>}
     <Link prefetch={false} href={`/initiatives/${initiative.slug}/manage`} className="pw-btn" data-variant="secondary" data-size="md">{viewer?'Initiative details':'Manage initiative'}</Link>
    </span>
   </div>
   <div className={styles.metaRow}>
    <span className={styles.chip} data-kind="stage"><InitiativeArc stage={initiative.stage} size={16}/>{STAGE_LABEL[initiative.stage]}</span>
    <span className={styles.chip}><BusinessLine code={initiative.businessLine}/></span>
    <span className={styles.chip} data-kind="owner">{owner?<><span className={styles.avatar} aria-hidden="true">{initials(owner.displayName)}</span><span><span className="visually-hidden">Owner </span>{owner.displayName}</span></>:<span className={styles.muted}><span className="visually-hidden">Owner </span>Unassigned</span>}</span>
    {row&&<>
     {!row.setup.ready&&<Link prefetch={false} className={styles.signal} data-tone="open" href={`/initiatives/${initiative.slug}/setup?step=review`}><span aria-hidden="true">○</span>{row.setup.label} · {row.setup.completed}/{row.setup.total}</Link>}
     <Link prefetch={false} className={styles.signal} data-tone={row.attention.length?'attention':'neutral'} href={`/initiatives/${initiative.slug}#attention`}><span aria-hidden="true">{row.attention.length?'▲':'·'}</span>{row.attention.length?`${row.attention.length} need attention`:row.snapshot.claims.length?'No open items in current checks':'Not assessed'}</Link>
    </>}
    {initiative.isDemo&&<span className={styles.chip} data-kind="demo">Synthetic demo</span>}
   </div>
   {initiative.archivedAt&&<p role="status" className={styles.archived}>Archived · read-only. Records and history are preserved. An administrator can restore this initiative in Manage initiative.</p>}
   <WorkspaceTabs slug={initiative.slug}/>
  </div>
 </header>;
}
