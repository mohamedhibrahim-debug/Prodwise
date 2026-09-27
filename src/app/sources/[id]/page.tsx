import Link from 'next/link';
import {notFound} from 'next/navigation';
import {readManagement} from '@/lib/data/management-read';
import {getRepository} from '@/lib/data';
import {MapExistingSource} from '@/components/initiative/MapExistingSource';
import {requireWorkspaceAccess} from '@/lib/auth/access';
import {canBusinessWrite} from '@/lib/auth/roles';
import {isDemoWriteEnabled} from '@/lib/env';
import styles from '@/components/initiative/management.module.css';
export const dynamic='force-dynamic';
export default async function SourceDetail({params}:{params:Promise<{id:string}>}){
 const [{id},m,initiatives,ctx]=await Promise.all([params,readManagement(),getRepository().listInitiatives(),requireWorkspaceAccess()]);
 const item=m.items.find(x=>x.id===id);if(!item)notFound();
 const source=m.containers.find(x=>x.id===item.containerId);if(!source)notFound();
 const mappings=m.mappings.filter(x=>x.itemId===id);
 return <div className={styles.page}><div className={styles.heading}><div><p className={styles.muted}>Manual source reference</p><h1>{item.name}</h1><p>{item.reference} · {item.kind}</p></div><Link prefetch={false} className={styles.link} href="/initiatives">Initiatives</Link></div>
 <section className={styles.section}><h2>Source context</h2><dl><dt>Type</dt><dd>{source.provider.replaceAll('_',' ').toLowerCase()}</dd><dt>Source workspace</dt><dd>{source.providerWorkspace}</dd><dt>Container</dt><dd>{source.name} · {source.reference}</dd><dt>Status</dt><dd>Manual reference · no live connection</dd><dt>Recorded</dt><dd><time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleDateString('en-GB',{timeZone:'Africa/Cairo'})}</time></dd></dl>{item.url&&<a className={styles.link} href={item.url} rel="noopener noreferrer" target="_blank">Open original reference</a>}</section>
 <section className={styles.section}><h2>Initiatives this source supports</h2><p className={styles.muted}>One retained source can support several initiatives in this organization. Each mapping has its own role and history.</p><ul>{mappings.map(link=>{const i=initiatives.find(x=>x.id===link.initiativeId);return i?<li key={link.id}><Link prefetch={false} href={`/initiatives/${i.slug}/manage?section=sources#sources`}>{i.name}</Link> · {link.role.toLowerCase()}{link.unlinkedAt?' · Unlinked — history retained':''}{i.archivedAt?' · Archived':''} · revision {link.revision}</li>:null;})}</ul></section>
 {canBusinessWrite(ctx)&&isDemoWriteEnabled&&<section className={styles.section}><h2>Map to another initiative</h2><p className={styles.muted}>Reuse this exact reference. Previously unlinked mappings must be restored from that initiative’s Manage page.</p><MapExistingSource itemId={item.id} initiatives={initiatives.filter(i=>!i.archivedAt&&!mappings.some(x=>x.initiativeId===i.id)).map(i=>({slug:i.slug,name:i.name}))}/></section>}
 </div>;
}
