import Link from "next/link";
import {factFor,referencesFor} from "@/lib/delivery/model";
import type {PortfolioInput,WeeklyReview,ReviewSection} from "@/lib/delivery/types";
import {buildPortfolioProjection} from "@/lib/workspace/portfolio";
import type {WeeklyContextLine} from "@/lib/workspace/weekly-context";
import styles from "./weekly.module.css";

const CONTEXT_GLYPH:Record<WeeklyContextLine['kind'],string>={RISK:'▲',QUESTION:'?',DEPENDENCY:'⇢',OVERDUE:'▲'};

/**
 * Zone 3 of a section: decisions and unresolved attention, gathered in one
 * block with the attention rule — Knowledge values that differ, the recorded
 * blocker, and the risk / question / dependency delta of the review window.
 * Everything here is derived from records; nothing is written into a Final.
 */
export function SectionAttention({review,section,baseline,baselineLabel,returnTo,context}:{review:WeeklyReview;section:ReviewSection;baseline:PortfolioInput|null;baselineLabel?:string;returnTo:string;context:WeeklyContextLine[]}) {
  const snap=review.input.snapshots.find(s=>s.initiative.id===section.initiativeId);if(!snap)return null;
  const slug=snap.initiative.slug;
  const differences=referencesFor(review.input,baseline).filter(r=>r.initiativeId===section.initiativeId&&r.id.startsWith("finding:"));
  const blocker=factFor(review.input.facts,section.initiativeId,"BLOCKER");
  const coverage=buildPortfolioProjection({source:{snapshots:review.input.snapshots,members:review.input.members},state:{schema:1,facts:review.input.facts,events:review.input.events,reviews:[]},workspaceId:review.workspaceId,asOf:review.input.asOf}).rows.find(r=>r.initiative.id===section.initiativeId)!.coverage;
  const count=differences.length+(blocker?1:0)+context.length;
  const windowLabel=baselineLabel?`since ${baselineLabel}`:"this period";
  return <section className={`${styles.block} ${styles.attentionBlock}`} aria-labelledby={`attention-${section.initiativeId}`} data-empty={count===0||undefined}>
    <div className={styles.zoneHead}><h3 id={`attention-${section.initiativeId}`}><span className={styles.zoneGlyph} data-tone="attention" aria-hidden="true">▲</span>Decisions & unresolved attention</h3><span className={styles.zoneCount}>{count?`${count} ${count===1?'item':'items'}`:'Nothing open under the current checks'}</span></div>
    {count>0?<ul className={styles.attentionList}>
      {differences.map(r=><li key={r.id} data-kind="decision"><span className={styles.attentionGlyph} data-kind="decision" aria-hidden="true">?</span><span className={styles.attentionLabel}>Values differ</span><Link prefetch={false} href={`/initiatives/${slug}/decisions?item=${encodeURIComponent(r.id.slice(8))}&returnTo=${encodeURIComponent(returnTo)}`}>{r.texts[0]}</Link></li>)}
      {blocker&&<li data-kind="blocker"><span className={styles.attentionGlyph} data-kind="blocker" aria-hidden="true">■</span><span className={styles.attentionLabel}>Recorded blocker</span><Link prefetch={false} href={`/initiatives/${slug}/delivery?returnTo=${encodeURIComponent(returnTo)}`}>{blocker.value.text??"Recorded blocker"}</Link></li>}
      {context.map(l=><li key={l.id} data-kind={l.kind.toLowerCase()}><span className={styles.attentionGlyph} data-kind={l.kind.toLowerCase()} aria-hidden="true">{CONTEXT_GLYPH[l.kind]}</span><span className={styles.attentionLabel}>{l.kind==='OVERDUE'?'Overdue question':l.kind==='RISK'?'Risk':l.kind==='QUESTION'?'Question':'Dependency'}</span><Link prefetch={false} href={l.href}>{l.text}</Link></li>)}
    </ul>:<p className={styles.meta}>{coverage.complete?"No open value differences, no recorded blocker, and no risk, question or dependency change in this window. This is not a readiness assessment.":"Setup incomplete. Absence of a value difference or blocker does not mean this initiative is checked."}</p>}
    <p className={styles.zoneNote}>Values and the blocker are from the frozen record; risks, questions and dependencies from recorded events {windowLabel}. {review.status==="FINAL"?"Derived up to finalization; not part of the stored Final.":"Record changes in the initiative; this list follows."}</p>
  </section>;
}
