import {factDate} from '@/lib/delivery/display';
import { notFound } from "next/navigation";
import { readDelivery } from "@/lib/delivery/repository";
import { factFor } from "@/lib/delivery/model";
import { displayDate, targetHistory } from "@/lib/delivery/roadmap";
import { FactEditor } from "@/components/delivery/FactEditor";
import { WriteNotice } from "@/components/delivery/WriteNotice";
import { safeUserLabel } from "@/lib/demo/presentation";
import {safeReturnPath} from "@/lib/auth/core";
import {TabToolbar} from '@/components/workspace/TabToolbar';
import {ButtonLink} from '@/components/primitives/Button';
import styles from "@/components/delivery/delivery.module.css";
import factsStyles from "@/components/delivery/facts.module.css";
import type { Metadata } from "next";
export const metadata: Metadata = { title: "Delivery facts" };
export default async function InitiativeDelivery({params,searchParams}:{params:Promise<{slug:string}>;searchParams:Promise<{returnTo?:string}>}) {
  const {slug}=await params;const query=await searchParams,requested=safeReturnPath(query.returnTo),returnTo=["/roadmap","/weekly-review",`/initiatives/${slug}`].some(prefix=>requested===prefix||requested.startsWith(prefix+"?")||requested.startsWith(prefix+"/"))?requested:`/initiatives/${slug}`; const {ctx,source,state}=await readDelivery(); const snapshot=source.snapshots.find(s=>s.initiative.slug===slug);
  if (!snapshot) notFound(); const initiative=snapshot.initiative,facts=state.facts.filter(f=>f.workspaceId===ctx.workspaceId),history=targetHistory(state.events,ctx.workspaceId,initiative.id);
  return <div className={`${styles.page} ${factsStyles.deliveryPage}`}><TabToolbar title="Delivery facts" summary={<><strong>Delivery facts</strong> · human-confirmed dates that feed the Brief and the Roadmap</>} actions={<><ButtonLink variant="ghost" href={returnTo}>← {returnTo.startsWith("/weekly-review")?"Weekly Review":returnTo.startsWith("/roadmap")?"Roadmap":"Brief"}</ButtonLink><ButtonLink variant="ghost" href="/roadmap">Roadmap</ButtonLink><ButtonLink variant="ghost" href={`/weekly-review?initiative=${slug}`}>Weekly Review</ButtonLink></>}/>
    <WriteNotice ctx={ctx}/>
    <div className={styles.reviewOverview}><div className={styles.reviewSummary}><span className={styles.eyebrow}>Recorded scope</span><h2>{factFor(facts,initiative.id,"SCOPE")?.value.text ?? "Not confirmed"}</h2><p className={styles.meta}>The Roadmap reads these facts automatically.</p></div><div className={styles.reviewBaseline}><strong>Target Live · planned</strong><p>{displayDate(factFor(facts,initiative.id,"TARGET_LIVE")?.value.date)}</p><p className={styles.meta}>Actual Live: {factFor(facts,initiative.id,"ACTUAL_LIVE")?.value.date ? displayDate(factFor(facts,initiative.id,"ACTUAL_LIVE")?.value.date) : "Not recorded"}</p></div></div>
    <FactEditor initiativeId={initiative.id} facts={facts} source={source} ctx={ctx}/>
    <section className={styles.section} id="target-history"><h2>Target movement history</h2><p className={styles.meta}>Each confirmation, revision and withdrawal is retained across scopes. Roadmap movement counts include date revisions within the current scope only.</p>{history.length ? <ol className={styles.history}>{history.slice().reverse().map(event=><li key={event.id}><span className={styles.meta}>{new Date(event.occurredAt).toLocaleString("en-GB",{timeZone:"Africa/Cairo",dateStyle:"medium",timeStyle:"short"})} Cairo<br/>Revision {event.after.revision}</span><div><p><strong>{factDate(event.before)} → {event.after.state === "RETRACTED" ? "Withdrawn · unknown" : factDate(event.after)}</strong></p><p>{event.after.note}</p><p className={styles.meta}>{safeUserLabel(event.after)} · {event.after.basis==="EVIDENCE" ? snapshot.evidence.find(e=>e.id===event.after.evidenceId)?.title ?? "Linked source unavailable" : "Direct knowledge"}{event.after.locator && ` · ${event.after.locator}`}</p></div></li>)}</ol> : <p className={styles.unknown}>No Target Live confirmation recorded. The date remains unknown.</p>}</section>
    <section className={styles.section} id="delivery-history"><h2>Assignment history</h2><ol className={styles.history}>{state.events.filter(e=>e.workspaceId===ctx.workspaceId&&e.initiativeId===initiative.id&&e.after.kind==='OWNER').slice().reverse().map(e=><li key={e.id}><span className={styles.meta}>{new Date(e.occurredAt).toLocaleString("en-GB",{timeZone:"Africa/Cairo",dateStyle:"medium",timeStyle:"short"})} Cairo · revision {e.after.revision}</span><div><p><strong>{source.members.find(m=>m.id===e.before?.value.memberId)?.displayName??'No owner'} → {e.after.state==='RETRACTED'?'No owner':source.members.find(m=>m.id===e.after.value.memberId)?.displayName??'Recorded member'}</strong></p><p>{e.after.note}</p><p className={styles.meta}>{safeUserLabel(e.after)}</p></div></li>)}</ol></section>
  </div>;
}
