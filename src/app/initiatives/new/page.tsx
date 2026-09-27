import Link from 'next/link';
import {randomUUID} from 'node:crypto';
import {readDelivery} from '@/lib/delivery/repository';
import {canBusinessWrite,hasOrganizationAdminAuthority} from '@/lib/auth/roles';
import {isDemoWriteEnabled,WRITE_DISABLED_MESSAGE} from '@/lib/env';
import {CreateInitiativeForm} from './CreateInitiativeForm';
import styles from './new.module.css';
export const dynamic='force-dynamic';
export const metadata={title:'Create Initiative'};
export default async function NewInitiativePage(){
 const d=await readDelivery(),allowed=canBusinessWrite(d.ctx);
 return <div className={styles.page}><Link prefetch={false} className={styles.back} href="/initiatives">← Initiatives</Link><h1 className={styles.title}>Create an initiative</h1><p className={styles.intro}>Four essentials create the record. Complete its setup at your own pace.</p><ol className={styles.steps} aria-label="Initiative setup"><li aria-current="step">1 · Basics</li><li>2 · Delivery context</li><li>3 · Sources</li><li>4 · Review</li></ol><p className={styles.mobileStep}>Step 1 of 4 · Basics</p>
 <div className={styles.layout}><div>{!allowed?<p className={styles.notice}>Your Viewer role can read initiatives. A Member or administrator can create one.</p>:!isDemoWriteEnabled?<p className={styles.notice}>{WRITE_DISABLED_MESSAGE}</p>:<CreateInitiativeForm requestId={randomUUID()} members={d.source.members} selfId={d.ctx.memberId} canAssign={hasOrganizationAdminAuthority(d.ctx)||d.ctx.isProductLead}/>}</div><aside className={styles.rail}><h2>Created is the starting point</h2><p>The initiative exists and appears in Initiatives as <strong>Setup incomplete</strong>. Existing checks apply immediately. Setup adds the context Prodwise needs to reason about it.</p><p>Add delivery context, map sources and confirm what you know. The setup review will show what remains.</p><p>Existing checks apply immediately. Setup does not hide open attention or imply release approval.</p></aside></div></div>;
}
