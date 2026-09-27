import Link from 'next/link';
import type {OwnerAttentionRow} from '@/lib/workspace/owner-attention';
import styles from './waiting.module.css';
/** Capped, owner-routed rows. Never a score; each row names the recorded fact behind it. */
export function WaitingOnYou({rows,cap=5}:{rows:OwnerAttentionRow[];cap?:number}){
 if(!rows.length)return null;
 return <section className={styles.waiting} aria-labelledby="waiting-heading"><div className={styles.head}><h2 id="waiting-heading">Waiting on you</h2><span>{rows.length} {rows.length===1?'item':'items'} routed to you as owner</span></div>
  <ul>{rows.slice(0,cap).map(r=><li key={r.key} data-kind={r.kind.toLowerCase()}><span className={styles.kind} aria-hidden="true">{r.kind==='DEPENDENCY'?'▲':'?'}</span><div><p className={styles.label}><strong>{r.label}</strong> · <Link prefetch={false} href={`/initiatives/${r.initiative.slug}`}>{r.initiative.name}</Link></p><p className={styles.detail}>{r.detail}</p></div><Link prefetch={false} className={styles.go} href={r.href}>{r.kind==='DEPENDENCY'?'Review dependency':'Answer question'} →</Link></li>)}</ul>
  {rows.length>cap&&<p className={styles.more}>and {rows.length-cap} more in <Link prefetch={false} href="/initiatives">Initiatives</Link></p>}</section>;
}
