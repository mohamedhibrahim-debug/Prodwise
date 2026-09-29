'use client';
import Link from 'next/link';
import type {RecommendationKind} from '@/lib/assistant/recommend';
import type {AnswerView,Paragraph,Run} from '@/lib/assistant/panel-model';
import styles from './ask.module.css';

/**
 * An answer's blocks in the product's own grammar: prose paragraphs; labelled
 * lists for what is recorded, not recorded and pending (each a hue plus a
 * glyph, so the kind reads without colour); numbered recommendation rows in
 * the same action · why · go form as Home's "Prodwise recommends"; link chips.
 * Every run carries its own direction and technical tokens are isolated, so
 * an Arabic sentence keeps a Jira key or a date intact.
 */
/** One glyph per recommendation kind — the same set Home uses, so the two lists read as one. */
const REC_GLYPH:Record<RecommendationKind,string>={decision:'?',blocker:'■',commitment:'✓',question:'?',schedule:'◆',proposal:'≡',review:'▣',setup:'○',metric:'▮'};
/** Filled = recorded · hollow = not recorded · half = awaiting confirmation. */
const LIST_GLYPH={facts:'▪',missing:'○',pending:'◐'} as const;

export function Runs({runs}:{runs:Run[]}){
 return <>{runs.map(r=>r.kind==='token'
  ?<span key={r.key} className={styles.token} data-token={r.token} dir="ltr">{r.text}</span>
  :<span key={r.key} dir={r.dir}>{r.text}</span>)}</>;
}
const Para=({p,className}:{p:Paragraph;className?:string})=><p className={className} dir={p.dir}><Runs runs={p.runs}/></p>;

export function AnswerBody({view}:{view:AnswerView}){
 return <div className={styles.blocks}>
  {view.blocks.map((b,i)=>{
   if(b.kind==='text')return <div key={i} className={styles.prose}>{b.paragraphs.map((p,j)=><Para key={j} p={p}/>)}</div>;
   if(b.kind==='recommendations')return <section key={i} className={styles.list} data-kind="recommendations">
    <h3 className={styles.listTitle} dir={b.titleDir}>{b.title}</h3>
    <ol className={styles.recs}>{b.items.map((r,n)=><li key={r.key}>
     <span className={styles.recNumeral} aria-hidden="true">{String(n+1).padStart(2,'0')}</span>
     <span className={styles.recGlyph} data-kind={r.kind} aria-hidden="true">{REC_GLYPH[r.kind]}</span>
     <span className={styles.recBody}><Para p={r.actionView} className={styles.recAction}/><Para p={r.whyView} className={styles.recWhy}/><Link prefetch={false} href={r.href} className={styles.recGo}>{r.go} <span aria-hidden="true">→</span></Link></span>
    </li>)}</ol>
   </section>;
   return <section key={i} className={styles.list} data-kind={b.kind}>
    <h3 className={styles.listTitle} dir={b.titleDir}><span className={styles.listGlyph} aria-hidden="true">{LIST_GLYPH[b.kind]}</span>{b.title}</h3>
    <ul className={styles.items}>{b.items.map((it,j)=><li key={j} dir={it.dir}>{it.href?<Link prefetch={false} href={it.href} className={styles.itemLink}><Runs runs={it.runs}/> <span aria-hidden="true">→</span></Link>:<Runs runs={it.runs}/>}</li>)}</ul>
   </section>;
  })}
  {view.links.length>0&&<nav className={styles.links} aria-label="Open in Prodwise">{view.links.map(l=><Link prefetch={false} key={l.href} href={l.href} className={styles.chip}><span dir={l.dir}>{l.label}</span> <span aria-hidden="true">→</span></Link>)}</nav>}
 </div>;
}
