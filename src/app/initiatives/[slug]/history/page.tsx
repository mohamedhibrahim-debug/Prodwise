import Link from 'next/link';
import {notFound} from 'next/navigation';
import {readDelivery} from '@/lib/delivery/repository';
import {getRepository} from '@/lib/data';
import {readCommitments} from '@/lib/data/commitments';
import {readQuestions} from '@/lib/data/questions';
import {readRelationships} from '@/lib/data/relationships';
import {readRisks} from '@/lib/data/risks';
import {readEvidence} from '@/lib/evidence/service';
import {buildInitiativeHistory,pageHistory,weekOf,HISTORY_CATEGORIES,CATEGORY_LABEL,type HistoryCategory,type HistoryEvent} from '@/lib/workspace/history';
import {TabToolbar} from '@/components/workspace/TabToolbar';
import styles from './history.module.css';
import { cairoDay } from "@/lib/delivery/model";
export const metadata={title:'History'};export const dynamic='force-dynamic';
const time=(at:string)=>new Date(at).toLocaleString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit',timeZone:'Africa/Cairo'});
const GLYPH:Record<HistoryCategory,string>={DELIVERY:'◷',DECISIONS:'⚖',KNOWLEDGE:'≡',COMMITMENTS:'✓',RISKS_QUESTIONS:'?',SOURCES:'❏',RELATIONSHIPS:'⇄',LIFECYCLE:'◆'};
export default async function History({params,searchParams}:{params:Promise<{slug:string}>;searchParams:Promise<{c?:string;q?:string;before?:string}>}){
 const [{slug},f,d,cs,qs,rel,rs]=await Promise.all([params,searchParams,readDelivery(),readCommitments(),readQuestions(),readRelationships(),readRisks()]);
 const snap=d.source.snapshots.find(s=>s.initiative.slug===slug);if(!snap)notFound();const i=snap.initiative;const base=`/initiatives/${slug}`;
 const [activity,ev]=await Promise.all([getRepository().listActivity(i.id,1000),readEvidence(i.id)]);
 const all=buildInitiativeHistory({initiativeId:i.id,slug,names:Object.fromEntries(d.source.snapshots.map(s=>[s.initiative.id,s.initiative.name])),members:d.source.members,activity,deliveryEvents:d.state.events.filter(e=>e.workspaceId===d.ctx.workspaceId),commitmentEvents:cs.events,questionEvents:qs.events,relationshipEvents:rel.events,riskEvents:rs.events,reviews:d.state.reviews.filter(r=>r.workspaceId===d.ctx.workspaceId),
  evidence:ev.submissions.map(s=>({evidenceId:s.evidenceId,submissionId:s.id,title:ev.meetings?.find(m=>m.submissionId===s.id)?.title??s.title,date:ev.meetings?.find(m=>m.submissionId===s.id)?.meetingDate??cairoDay(s.createdAt)}))});
 const selected=(f.c??'').split(',').filter((c):c is HistoryCategory=>HISTORY_CATEGORIES.includes(c as HistoryCategory));const text=(f.q??'').slice(0,100);
 const page=pageHistory(all,{categories:selected,text},f.before??null);
 const counts=Object.fromEntries(HISTORY_CATEGORIES.map(c=>[c,all.filter(e=>e.category===c).length]));
 const href=(o:{c?:HistoryCategory[];q?:string;before?:string|null})=>{const p=new URLSearchParams();const c=o.c??selected;if(c.length)p.set('c',c.join(','));const q=o.q??text;if(q)p.set('q',q);if(o.before)p.set('before',o.before);const s=p.toString();return `${base}/history${s?`?${s}`:''}`;};
 const toggle=(c:HistoryCategory)=>href({c:selected.includes(c)?selected.filter(x=>x!==c):[...selected,c]});
 const weeks:{key:string;label:string;events:HistoryEvent[]}[]=[];for(const e of page.events){const w=weekOf(e.at);const last=weeks.at(-1);if(last?.key===w.key)last.events.push(e);else weeks.push({...w,events:[e]});}
 const created=all.find(e=>e.label==='Created');
 return <div className={styles.page}>
  <TabToolbar title="History" summary={<><strong>{all.length}</strong> recorded {all.length===1?'event':'events'} · times in Cairo</>}
   actions={<form className={styles.search} action={`${base}/history`}>{selected.length>0&&<input type="hidden" name="c" value={selected.join(',')}/>}<label><span className={styles.srOnly}>Search history</span><input type="search" name="q" defaultValue={text} placeholder="Search history…"/></label></form>}/>
  <div className={styles.chips} role="group" aria-label="Filter by kind"><Link prefetch={false} href={href({c:[]})} className={styles.chip} aria-pressed={selected.length===0}>All<span className={styles.chipCount}>{all.length}</span></Link>{HISTORY_CATEGORIES.filter(c=>counts[c]).map(c=><Link key={c} prefetch={false} href={toggle(c)} className={styles.chip} aria-pressed={selected.includes(c)}><span aria-hidden="true">{GLYPH[c]}</span>{CATEGORY_LABEL[c]}<span className={styles.chipCount}>{counts[c]}</span></Link>)}{(selected.length>0||text)&&<Link prefetch={false} className={styles.clear} href={`${base}/history`}>Clear</Link>}{(selected.length>0||text)&&<span className={styles.chipCount}>{page.total} matching</span>}</div>
  {!all.length?<p className={styles.empty}>{created?`Created by ${created.actor}, ${time(created.at)}. Changes will appear here.`:'Nothing has been recorded for this initiative yet. Changes will appear here as people confirm facts, decisions and commitments.'}</p>
  :!page.events.length?<p className={styles.empty}>No events match these filters. <Link prefetch={false} href={`${base}/history`}>Clear filters</Link></p>
  :<ol className={styles.timeline} aria-label={`History of ${i.name}, newest first`}>{weeks.map(w=><li key={w.key} className={styles.week}><h3 className={styles.weekHead}>{w.label}</h3><ol>{w.events.map(e=><li key={e.id} className={styles.event} data-category={e.category.toLowerCase()}>
   <span className={styles.marker} aria-hidden="true">{GLYPH[e.category]}</span>
   <div className={styles.body}><p className={styles.sentence}>{e.sentence}</p>
    <p className={styles.meta}><span className={styles.kind}>{e.label}</span><span>{e.actor}</span><time dateTime={e.at}>{time(e.at)}</time></p>
    {e.rationale&&<blockquote className={styles.rationale}>{e.rationale}</blockquote>}
    {(e.href||e.provenance)&&<p className={styles.links}>{e.href&&<Link prefetch={false} href={e.href}>{e.hrefLabel??'Open'} →</Link>}{e.provenance&&(e.provenance.href?<Link prefetch={false} href={e.provenance.href}>{e.provenance.label}</Link>:<span>{e.provenance.label}</span>)}</p>}
   </div></li>)}</ol></li>)}</ol>}
  {page.next&&<p className={styles.more}><Link prefetch={false} className={styles.loadEarlier} href={href({before:page.next})}>Load earlier events</Link><span>Showing {page.events.length} of {page.total}</span></p>}
  {f.before&&<p className={styles.more}><Link prefetch={false} href={href({before:null})}>← Back to latest</Link></p>}
 </div>;
}
