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
 return <div className={styles.page}><Link prefetch={false} className={styles.back} href="/initiatives">← Initiatives</Link>
  <div className={styles.sheet}><header className={styles.header}><h1 className={styles.title}>Create an initiative</h1><p className={styles.intro}>Four essentials create the record. The Brief then shows what setup remains, one step at a time.</p></header>
  {!allowed?<p className={styles.notice}>Your Viewer role can read initiatives. A Member or administrator can create one.</p>:!isDemoWriteEnabled?<p className={styles.notice}>{WRITE_DISABLED_MESSAGE}</p>:<CreateInitiativeForm requestId={randomUUID()} members={d.source.members} selfId={d.ctx.memberId} canAssign={hasOrganizationAdminAuthority(d.ctx)||d.ctx.isProductLead}/>}
  </div></div>;
}
