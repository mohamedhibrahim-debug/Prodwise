import { BusinessLine } from '@/components/primitives/BusinessLine';
import {factDate} from '@/lib/delivery/display';
import Link from "next/link";

import {factFor,referencesFor,changesSince,weeklyDispositionCounts} from "@/lib/delivery/model";

import type {PortfolioInput,WeeklyReview,ReviewSection} from "@/lib/delivery/types";

import {displayDate} from "@/lib/delivery/roadmap";

import {STAGE_LABEL,BUSINESS_LINE_LABEL} from "@/lib/domain/labels";

import {buildPortfolioProjection} from "@/lib/workspace/portfolio";

import {weeklyChangeSentence} from "@/lib/delivery/weekly-copy";

import styles from "./weekly.module.css";

export function SectionRecord({review,section,baseline,returnTo}:{review:WeeklyReview;section:ReviewSection;baseline:PortfolioInput|null;returnTo:string}) {

  const snap=review.input.snapshots.find(s=>s.initiative.id===section.initiativeId);if(!snap)return null;

  const target=factFor(review.input.facts,section.initiativeId,"TARGET_LIVE"),actual=factFor(review.input.facts,section.initiativeId,"ACTUAL_LIVE"),milestone=factFor(review.input.facts,section.initiativeId,"NEXT_MILESTONE"),blocker=factFor(review.input.facts,section.initiativeId,"BLOCKER");

  const dispositions=weeklyDispositionCounts(review.input,baseline,section.initiativeId);

  const differences=referencesFor(review.input,baseline).filter(r=>r.initiativeId===section.initiativeId&&r.id.startsWith("finding:"));

  const changes=changesSince(review.input,baseline).filter(c=>c.initiativeId===section.initiativeId);

  const setup=buildPortfolioProjection({source:{snapshots:review.input.snapshots,members:review.input.members},state:{schema:1,facts:review.input.facts,events:review.input.events,reviews:[]},workspaceId:review.workspaceId,asOf:review.input.asOf}).rows.find(r=>r.initiative.id===section.initiativeId)!.coverage;

  return <section className={`${styles.block} ${styles.record}`}><h2><Link prefetch={false} href={`/initiatives/${snap.initiative.slug}`}>{snap.initiative.name}</Link></h2><p className={styles.meta}><BusinessLine code={snap.initiative.businessLine}/> · {STAGE_LABEL[snap.initiative.stage]} · {factFor(review.input.facts,section.initiativeId,"SCOPE")?.value.text??"Scope not confirmed"}</p><h3>Record at cutoff</h3><p className={styles.meta}>Frozen initiative records. Meeting commentary below does not change these facts.</p><div className={styles.facts}><p><strong>Target Live · planned</strong>{target?.value.unknown?"Explicitly unknown":factDate(target)}</p><p><strong>Actual Live</strong>{actual?.value.date?`${factDate(actual)} · ${actual.value.extent==="FULL"?"Full named scope":`Partial · ${actual.value.text??"scope not described"}`}`:"Not recorded"}</p><p><strong>Next milestone</strong>{milestone?milestone.value.unknown?"Explicitly unknown":`${milestone.value.text} · ${milestone.value.date?factDate(milestone):"Date not recorded"}`:"Not recorded"}</p></div><p className={styles.meta}>Recorded blocker: {blocker?.value.text??"No blocker recorded; this does not confirm there are none."}</p><p className={styles.meta}>Recorded next step: {factFor(review.input.facts,section.initiativeId,"NEXT_STEP")?.value.text??"Not recorded"}</p>

    <h3>{baseline?"Changes since the previous Final":"First review inventory"}</h3>{changes.length?<ul className={styles.changes}>{changes.map(c=><li key={c.id}>{weeklyChangeSentence(c,review.input,baseline)}</li>)}</ul>:<p className={styles.meta}>{baseline?"No recorded changes since the previous Final.":"No previous finalized baseline is assumed."}</p>}

    <h3>Commitments at cutoff</h3>{review.input.commitments===undefined?<p className={styles.meta}>This historical snapshot predates commitment tracking.</p>:<><p className={styles.meta}>Carried forward: {review.input.commitments.filter(a=>a.initiativeId===section.initiativeId&&!['DONE','CANCELLED'].includes(a.status)).length} open · Completed {baseline?'since the previous Final':'in this inventory'}: {review.input.commitments.filter(a=>a.initiativeId===section.initiativeId&&a.status==='DONE'&&(!baseline||a.completedAt&&a.completedAt>baseline.asOf)).length}</p><ul>{review.input.commitments.filter(a=>a.initiativeId===section.initiativeId).map(a=><li key={a.id}><Link prefetch={false} href={`/initiatives/${snap.initiative.slug}/actions?action=${a.id}`}>{a.title}</Link> · {a.status.toLowerCase().replaceAll('_',' ')} · {a.dueDate??'No due date'}</li>)}</ul></>}

    <h3>Decisions set aside this week</h3><p className={styles.meta}>Deferred ({dispositions.deferred}) · Dismissed ({dispositions.dismissed}). As recorded when this review was prepared; later changes do not alter it.</p><h3>Knowledge values that differ</h3>{differences.length?<ul className={styles.changes}>{differences.map(r=><li key={r.id}><Link prefetch={false} href={`/initiatives/${snap.initiative.slug}/decisions?item=${encodeURIComponent(r.id.slice(8))}&returnTo=${encodeURIComponent(returnTo)}`}>{r.texts[0]}</Link></li>)}</ul>:<p className={styles.meta}>{setup.complete?"No open value differences under the current recorded checks. This is not a readiness assessment.":"Setup incomplete. Absence of a value difference does not mean this initiative is checked."}</p>}

  </section>;

}
