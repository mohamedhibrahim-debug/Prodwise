import Link from 'next/link';
import {notFound} from 'next/navigation';
import {readDelivery} from '@/lib/delivery/repository';
import {factFor,ownerFor} from '@/lib/delivery/model';
import {BUSINESS_LINE_LABEL,STAGE_LABEL} from '@/lib/domain/labels';
import {canManageInitiative} from '@/lib/workspace/management-policy';
import {isDemoWriteEnabled,WRITE_DISABLED_MESSAGE} from '@/lib/env';
import {readManagement} from '@/lib/data/management-read';
import {SourceMappingControl} from '@/components/initiative/SourceMappingControl';
import {SourceMapper} from '@/components/initiative/SourceMapper';
import {ContextManager} from '@/components/initiative/ContextManager';
import {LifecycleManager} from '@/components/initiative/LifecycleManager';
import {OwnerManager} from '@/components/initiative/OwnerManager';
import {ManageBasics} from '@/components/initiative/ManageBasics';
import styles from '@/components/initiative/management.module.css';
export const dynamic='force-dynamic';
export default async function ManageInitiative({params,searchParams}:{params:Promise<{slug:string}>;searchParams:Promise<{section?:string;edit?:string}>}){
 const [{slug},q,d,management]=await Promise.all([params,searchParams,readDelivery(),readManagement()]);
 const snapshot=d.source.snapshots.find(s=>s.initiative.slug===slug);if(!snapshot)notFound();
 const i=snapshot.initiative,base=`/initiatives/${slug}`,ownerId=ownerFor(d.state.facts,i.id),owner=d.source.members.find(m=>m.id===ownerId);
 const scope=factFor(d.state.facts,i.id,'SCOPE'),target=factFor(d.state.facts,i.id,'TARGET_LIVE');
 const mapped=management.mappings.filter(m=>m.initiativeId===i.id);
 const allowed=canManageInitiative(d.ctx,'BASICS',ownerId)&&!i.archivedAt;
 const sections=[['basics','Basics'],['ownership','Ownership'],['context','Scope / phase'],['delivery','Delivery'],['sources','Sources'],['lifecycle','Lifecycle']];
 const links=sections.map(([id,label])=><Link key={id} prefetch={false} href={`${base}/manage?section=${id}#${id}`} aria-current={q.section===id?'page':undefined}>{label}</Link>);
 return <div className={styles.page}>
  <div className={styles.heading}><div><h2>{d.ctx.role==='VIEWER'?'Initiative details':'Manage initiative'}</h2><p className={styles.muted}>Keep purpose, responsibility and delivery context current. Confirmed changes preserve history.</p></div><div className={styles.headingLinks}><Link prefetch={false} className={styles.link} href={base}>Back to Brief</Link><Link prefetch={false} className={styles.link} href={`${base}/setup?step=review`}>Review setup</Link></div></div>
  <details className={styles.mobileIndex}><summary>Sections ({sections.length})</summary><nav aria-label="Management sections">{links}</nav></details>
  <div className={styles.layout}><aside className={styles.index}><nav aria-label="Management sections">{links}</nav></aside><div>
   <section id="basics" className={styles.section}><h3>Basics</h3>{q.edit==='basics'&&allowed&&isDemoWriteEnabled?<ManageBasics initiative={i}/>:<><dl><dt>Name</dt><dd>{i.name}</dd><dt>Business line</dt><dd>{BUSINESS_LINE_LABEL[i.businessLine]}</dd><dt>Objective / problem</dt><dd>{i.description||'Not recorded'}</dd><dt>Lifecycle stage</dt><dd>{STAGE_LABEL[i.stage]}</dd></dl>{allowed&&isDemoWriteEnabled?<Link prefetch={false} className={styles.link} href={`${base}/manage?section=basics&edit=basics#basics`}>Edit basics</Link>:<p className={styles.muted}>{!allowed?'Only the assigned PM or an organization administrator can edit these basics.':WRITE_DISABLED_MESSAGE}</p>}</>}</section>
   <section id="ownership" className={styles.section}><h3>Ownership</h3><OwnerManager initiativeId={i.id} workspaceId={d.ctx.workspaceId} fact={factFor(d.state.facts,i.id,'OWNER')} members={d.source.members} editable={!i.archivedAt&&isDemoWriteEnabled&&canManageInitiative(d.ctx,'OWNER',ownerId)}/><Link prefetch={false} className={styles.link} href={`${base}/delivery#delivery-history`}>View assignment history</Link></section>
   <section id="context" className={styles.section}><h3>Scope / phase</h3><ContextManager slug={slug} updatedAt={i.updatedAt} currentId={i.currentContextId??null} contexts={management.contexts.filter(c=>c.initiativeId===i.id)} editable={!i.archivedAt&&isDemoWriteEnabled&&canManageInitiative(d.ctx,'CONTEXT',ownerId)} legacy={scope?.value.text??null}/></section>
   <section id="delivery" className={styles.section}><h3>Delivery</h3><p>Target Live · {target?.value.unknown?'Explicitly unknown':target?.value.date??'Not recorded'}</p><p className={styles.muted}>Planned dates stay separate from actual delivery. Every confirmation keeps its previous value and reason.</p><Link prefetch={false} className={styles.link} href={`${base}/delivery`}>Manage delivery facts</Link></section>
   <section id="sources" className={styles.section}><h3>Sources</h3><p>{mapped.filter(m=>!m.unlinkedAt).length} active references · {snapshot.evidence.length} evidence {snapshot.evidence.length===1?'record':'records'} retained.</p><p className={styles.muted}>References and recorded evidence are not live connections to external systems.</p>{mapped.length>0&&<ul>{mapped.map(m=>{const item=management.items.find(x=>x.id===m.itemId);return item?<li key={m.id}><Link prefetch={false} href={`/sources/${item.id}`}>{item.name}</Link> · {item.reference} · {m.role.toLowerCase()} · {m.unlinkedAt?'Unlinked':'Manual reference'}{m.unlinkedAt&&<p className={styles.muted}>Unlinked: {m.unlinkReason}</p>}{!i.archivedAt&&isDemoWriteEnabled&&canManageInitiative(d.ctx,'SOURCE_LINK',ownerId)&&<SourceMappingControl mapping={m} slug={slug} canUnlink={canManageInitiative(d.ctx,'SOURCE_UNLINK',ownerId,m.linkedBy)}/>}</li>:null;})}</ul>}{!i.archivedAt&&isDemoWriteEnabled&&canManageInitiative(d.ctx,'SOURCE_LINK',ownerId)&&<SourceMapper slug={slug} name={i.name}/>}<Link prefetch={false} className={styles.link} href={`${base}/sources`}>Open recorded evidence</Link></section>
   <section id="lifecycle" className={styles.section}><h3>Lifecycle</h3><LifecycleManager initiative={i} canStage={isDemoWriteEnabled&&canManageInitiative(d.ctx,'BASICS',ownerId)} canArchive={isDemoWriteEnabled&&canManageInitiative(d.ctx,'ARCHIVE',ownerId)}/></section>
  </div></div>
 </div>;
}
