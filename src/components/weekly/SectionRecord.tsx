import { BusinessLine } from '@/components/primitives/BusinessLine';
import {factDate} from '@/lib/delivery/display';
import Link from "next/link";
import {factFor,changesSince,weeklyDispositionCounts} from "@/lib/delivery/model";
import type {PortfolioInput,WeeklyReview,ReviewSection} from "@/lib/delivery/types";
import {displayDate} from "@/lib/delivery/roadmap";
import {STAGE_LABEL} from "@/lib/domain/labels";
import {weeklyChangeSentence} from "@/lib/delivery/weekly-copy";
import {cairoStamp} from "./format";
import styles from "./weekly.module.css";

/**
 * Zone 2 of a section: the record at cutoff. A compact facts strip on the
 * evidence tint, labelled with the cutoff it was frozen at, then the history
 * lists (changes since the previous Final, commitments, decisions set aside).
 * Meeting commentary never changes these facts.
 */
export function SectionRecord({review,section,baseline}:{review:WeeklyReview;section:ReviewSection;baseline:PortfolioInput|null}) {
  const snap=review.input.snapshots.find(s=>s.initiative.id===section.initiativeId);if(!snap)return null;
  const target=factFor(review.input.facts,section.initiativeId,"TARGET_LIVE"),actual=factFor(review.input.facts,section.initiativeId,"ACTUAL_LIVE"),milestone=factFor(review.input.facts,section.initiativeId,"NEXT_MILESTONE"),blocker=factFor(review.input.facts,section.initiativeId,"BLOCKER"),nextStep=factFor(review.input.facts,section.initiativeId,"NEXT_STEP");
  const dispositions=weeklyDispositionCounts(review.input,baseline,section.initiativeId);
  const changes=changesSince(review.input,baseline).filter(c=>c.initiativeId===section.initiativeId);
  const open=review.input.commitments?.filter(a=>a.initiativeId===section.initiativeId&&!['DONE','CANCELLED'].includes(a.status))??[];
  const completed=review.input.commitments?.filter(a=>a.initiativeId===section.initiativeId&&a.status==='DONE'&&(!baseline||a.completedAt&&a.completedAt>baseline.asOf))??[];
  return <section className={`${styles.block} ${styles.record}`} aria-labelledby={`section-${section.initiativeId}`}>
    <div className={styles.recordHead}><h2 id={`section-${section.initiativeId}`}><Link prefetch={false} href={`/initiatives/${snap.initiative.slug}`}>{snap.initiative.name}</Link></h2><p className={styles.meta}><BusinessLine code={snap.initiative.businessLine}/> · {STAGE_LABEL[snap.initiative.stage]} · {factFor(review.input.facts,section.initiativeId,"SCOPE")?.value.text??"Scope not confirmed"}</p></div>
    <div className={styles.frozen}>
      <p className={styles.frozenLabel}><span className={styles.zoneGlyph} aria-hidden="true">≡</span>Frozen record · data as of {cairoStamp(review.input.asOf)} Cairo<span className={styles.frozenNote}>Meeting commentary does not change these facts.</span></p>
      <dl className={styles.factsStrip}>
        <div><dt>Target Live · planned</dt><dd>{target?.value.unknown?"Explicitly unknown":factDate(target)}</dd></div>
        <div><dt>Actual Live</dt><dd>{actual?.value.date?factDate(actual):"Not recorded"}{actual?.value.date&&<small>{actual.value.extent==="FULL"?"Full named scope":`Partial · ${actual.value.text??"scope not described"}`}</small>}</dd></div>
        <div><dt>Next milestone</dt><dd>{milestone?milestone.value.unknown?"Explicitly unknown":milestone.value.text:"Not recorded"}{milestone&&!milestone.value.unknown&&<small>{milestone.value.date?factDate(milestone):"Date not recorded"}</small>}</dd></div>
        <div data-set={blocker?true:undefined}><dt>Blocker</dt><dd>{blocker?.value.text??<span className={styles.factQuiet}>None recorded — this does not confirm there are none</span>}</dd></div>
        <div><dt>Next step</dt><dd>{nextStep?.value.text??<span className={styles.factQuiet}>Not recorded</span>}</dd></div>
      </dl>
    </div>
    <div className={styles.history}>
      <div><h3>{baseline?"Changes since the previous Final":"First review inventory"}</h3>{changes.length?<ul className={styles.changes}>{changes.map(c=><li key={c.id}>{weeklyChangeSentence(c,review.input,baseline)}</li>)}</ul>:<p className={styles.meta}>{baseline?"No recorded changes since the previous Final.":"No previous finalized baseline is assumed."}</p>}</div>
      <div><h3>Commitments at cutoff</h3>{review.input.commitments===undefined?<p className={styles.meta}>This historical snapshot predates commitment tracking.</p>:<><p className={styles.meta}>Carried forward: {open.length} open · Completed {baseline?'since the previous Final':'in this inventory'}: {completed.length}</p>{review.input.commitments.filter(a=>a.initiativeId===section.initiativeId).length>0&&<ul className={styles.changes}>{review.input.commitments.filter(a=>a.initiativeId===section.initiativeId).map(a=><li key={a.id}><Link prefetch={false} href={`/initiatives/${snap.initiative.slug}/actions?action=${a.id}`}>{a.title}</Link> · {a.status.toLowerCase().replaceAll('_',' ')} · {a.dueDate?`due ${displayDate(a.dueDate)}`:'No due date'}</li>)}</ul>}</>}</div>
      <div><h3>Decisions set aside this week</h3><p className={styles.meta}>Deferred ({dispositions.deferred}) · Dismissed ({dispositions.dismissed}). As recorded when this review was prepared; later changes do not alter it.</p></div>
    </div>
  </section>;
}
