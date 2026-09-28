import { BusinessLine } from '@/components/primitives/BusinessLine';
import Link from 'next/link';
import {notFound} from 'next/navigation';
import {readDelivery} from '@/lib/delivery/repository';
import {factFor,ownerFor} from '@/lib/delivery/model';import {cairoDay as orgDayOf} from '@/lib/delivery/model';
import {displayDate} from '@/lib/delivery/roadmap';
import {BUSINESS_LINE_LABEL,STAGE_LABEL,displaySourceReference} from '@/lib/domain/labels';
const SOURCE_ROLE_LABEL={REQUIREMENTS:'Requirements source',DELIVERY:'Delivery source',DECISIONS:'Decisions source',GENERAL:'General reference'} as const;
import {canManageInitiative} from '@/lib/workspace/management-policy';
import {isDemoWriteEnabled,WRITE_DISABLED_MESSAGE} from '@/lib/env';
import {readManagement} from '@/lib/data/management-read';
import {SourceMappingControl} from '@/components/initiative/SourceMappingControl';
import {SourceMapper} from '@/components/initiative/SourceMapper';
import {ContextManager} from '@/components/initiative/ContextManager';
import {LifecycleManager} from '@/components/initiative/LifecycleManager';
import {OwnerManager} from '@/components/initiative/OwnerManager';
import {ManageBasics} from '@/components/initiative/ManageBasics';
import {RelationshipManager,type RelationshipRowView} from '@/components/initiative/RelationshipManager';
import {readRelationships} from '@/lib/data/relationships';
import {relationshipsFor,type RelationshipRow} from '@/lib/workspace/relationship-view';
import {canManageRelationship} from '@/lib/workspace/relationships';
import styles from '@/components/initiative/management.module.css';
export const dynamic='force-dynamic';
export default async function ManageInitiative({params,searchParams}:{params:Promise<{slug:string}>;searchParams:Promise<{section?:string;edit?:string}>}){
 const [{slug},q,d,management,rel]=await Promise.all([params,searchParams,readDelivery(),readManagement(),readRelationships()]);
 const snapshot=d.source.snapshots.find(s=>s.initiative.slug===slug);if(!snapshot)notFound();
 const i=snapshot.initiative,base=`/initiatives/${slug}`,ownerId=ownerFor(d.state.facts,i.id),owner=d.source.members.find(m=>m.id===ownerId);
 const scope=factFor(d.state.facts,i.id,'SCOPE'),target=factFor(d.state.facts,i.id,'TARGET_LIVE');
 const mapped=management.mappings.filter(m=>m.initiativeId===i.id);
 const allowed=canManageInitiative(d.ctx,'BASICS',ownerId)&&!i.archivedAt;
 const sections=[['basics','Basics'],['ownership','Ownership'],['context','Scope / phase'],['delivery','Delivery'],['relationships','Relationships'],['sources','Sources'],['lifecycle','Lifecycle']];
 const facts=d.state.facts.filter(f=>f.workspaceId===d.ctx.workspaceId);const ends=d.source.snapshots.map(s=>({id:s.initiative.id,name:s.initiative.name,slug:s.initiative.slug,archived:Boolean(s.initiative.archivedAt)}));
 const view=(r:RelationshipRow):RelationshipRowView=>({id:r.relationship.id,revision:r.relationship.revision,group:r.group,type:r.relationship.type,outgoing:r.relationship.fromInitiativeId===i.id||r.relationship.type==='RELATED_TO',other:r.other?{name:r.other.name,slug:r.other.slug,archived:r.other.archived}:null,rationale:r.relationship.rationale,impactText:r.impactText,late:r.late,assessed:Boolean(r.impact?.assessed),providerFactKind:r.relationship.providerFactKind,neededByFactKind:r.relationship.neededByFactKind,confirmedBy:r.relationship.confirmedByLabel,confirmedAt:r.relationship.confirmedAt,originHref:r.relationship.originHref,endedBy:r.relationship.endedByLabel,endedAt:r.relationship.endedAt,endReason:r.relationship.endReason});
 const relEditable=!i.archivedAt&&isDemoWriteEnabled&&canManageRelationship(d.ctx,ownerId);
 const links=sections.map(([id,label])=><Link key={id} prefetch={false} href={`${base}/manage?section=${id}#${id}`} aria-current={q.section===id?'page':undefined}>{label}</Link>);
 return <div className={styles.page}>
  <div className={styles.heading}><div><h2>{d.ctx.role==='VIEWER'?'Initiative details':'Manage initiative'}</h2><p className={styles.muted}>Keep purpose, responsibility and delivery context current. Confirmed changes preserve history.</p></div><div className={styles.headingLinks}><Link prefetch={false} className={styles.link} href={base}>Back to Brief</Link><Link prefetch={false} className={styles.link} href={`${base}/setup?step=review`}>Review setup</Link></div></div>
  <details className={styles.mobileIndex}><summary>Sections ({sections.length})</summary><nav aria-label="Management sections">{links}</nav></details>
  <div className={styles.layout}><aside className={styles.index}><nav aria-label="Management sections">{links}</nav></aside><div>
   <section id="basics" className={styles.section}><h3>Basics</h3>{q.edit==='basics'&&allowed&&isDemoWriteEnabled?<ManageBasics initiative={i}/>:<><dl><dt>Name</dt><dd>{i.name}</dd><dt>Business line</dt><dd><BusinessLine code={i.businessLine} detailed/></dd><dt>Objective / problem</dt><dd>{i.description||'Not recorded'}</dd><dt>Lifecycle stage</dt><dd>{STAGE_LABEL[i.stage]}</dd></dl>{allowed&&isDemoWriteEnabled?<Link prefetch={false} className={styles.link} href={`${base}/manage?section=basics&edit=basics#basics`}>Edit basics</Link>:<p className={styles.muted}>{!allowed?'Only the assigned PM or an organization administrator can edit these basics.':WRITE_DISABLED_MESSAGE}</p>}</>}</section>
   <section id="ownership" className={styles.section}><h3>Ownership</h3><OwnerManager initiativeId={i.id} workspaceId={d.ctx.workspaceId} fact={factFor(d.state.facts,i.id,'OWNER')} members={d.source.members} editable={!i.archivedAt&&isDemoWriteEnabled&&canManageInitiative(d.ctx,'OWNER',ownerId)}/><Link prefetch={false} className={styles.link} href={`${base}/delivery#delivery-history`}>View assignment history</Link></section>
   <section id="context" className={styles.section}><h3>Scope / phase</h3><ContextManager slug={slug} updatedAt={i.updatedAt} currentId={i.currentContextId??null} contexts={management.contexts.filter(c=>c.initiativeId===i.id)} editable={!i.archivedAt&&isDemoWriteEnabled&&canManageInitiative(d.ctx,'CONTEXT',ownerId)} legacy={scope?.value.text??null}/></section>
   <section id="delivery" className={styles.section}><h3>Delivery</h3><p>Target Live · {target?.value.unknown?'Explicitly unknown':target?.value.date?displayDate(target.value.date):'Not recorded'}</p><p className={styles.muted}>Planned dates stay separate from actual delivery. Every confirmation keeps its previous value and reason.</p><Link prefetch={false} className={styles.link} href={`${base}/delivery`}>Manage delivery facts</Link></section>
   <section id="relationships" className={styles.section}><h3>Relationships</h3><p className={styles.muted}>How {i.name} connects to other initiatives. A date impact appears only when both recorded dates support it — never estimated.</p>
    <RelationshipManager slug={slug} self={{id:i.id,name:i.name,targetLive:target?.value.date??null,nextMilestone:factFor(facts,i.id,'NEXT_MILESTONE')?.value.date??null}} rows={relationshipsFor(i.id,rel.relationships,ends,facts,'ACTIVE',orgDayOf(d.presentation.scenarioAt??new Date().toISOString())).map(view)} ended={relationshipsFor(i.id,rel.relationships,ends,facts,'ENDED').map(view)}
     candidates={d.source.snapshots.filter(s=>s.initiative.id!==i.id).map(s=>({id:s.initiative.id,name:s.initiative.name,archived:Boolean(s.initiative.archivedAt),targetLive:factFor(facts,s.initiative.id,'TARGET_LIVE')?.value.date??null,nextMilestone:factFor(facts,s.initiative.id,'NEXT_MILESTONE')?.value.date??null}))}
     editable={relEditable} denied={i.archivedAt?'Archived — relationships are read-only.':!isDemoWriteEnabled?WRITE_DISABLED_MESSAGE:'Only the initiative owner, a Product Lead or an administrator can record relationships for this initiative.'}/></section>
   <section id="sources" className={styles.section}><h3>Sources</h3><p>{mapped.filter(m=>!m.unlinkedAt).length} active references · {snapshot.evidence.length} evidence {snapshot.evidence.length===1?'record':'records'} retained.</p><p className={styles.muted}>References and recorded evidence are not live connections to external systems.</p>{mapped.length>0&&<ul>{mapped.map(m=>{const item=management.items.find(x=>x.id===m.itemId);return item?<li key={m.id}><Link prefetch={false} href={`/sources/${item.id}`}>{item.name}</Link> {displaySourceReference(item.reference)&&<> · {displaySourceReference(item.reference)}</>} · {SOURCE_ROLE_LABEL[m.role]}{m.unlinkedAt?' · Unlinked':''}{m.unlinkedAt&&<p className={styles.muted}>Unlinked: {m.unlinkReason}</p>}{!i.archivedAt&&isDemoWriteEnabled&&canManageInitiative(d.ctx,'SOURCE_LINK',ownerId)&&<SourceMappingControl mapping={m} slug={slug} canUnlink={canManageInitiative(d.ctx,'SOURCE_UNLINK',ownerId,m.linkedBy)}/>}</li>:null;})}</ul>}{!i.archivedAt&&isDemoWriteEnabled&&canManageInitiative(d.ctx,'SOURCE_LINK',ownerId)&&<SourceMapper slug={slug} name={i.name}/>}<Link prefetch={false} className={styles.link} href={`${base}/sources`}>Open recorded evidence</Link></section>
   <section id="lifecycle" className={styles.section}><h3>Lifecycle</h3><LifecycleManager initiative={i} canStage={isDemoWriteEnabled&&canManageInitiative(d.ctx,'BASICS',ownerId)} canArchive={isDemoWriteEnabled&&canManageInitiative(d.ctx,'ARCHIVE',ownerId)}/></section>
  </div></div>
 </div>;
}
