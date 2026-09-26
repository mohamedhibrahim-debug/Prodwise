import Link from "next/link";
import { notFound } from "next/navigation";
import { readDelivery } from "@/lib/delivery/repository";
import { factFor } from "@/lib/delivery/model";
import { displayDate, targetHistory } from "@/lib/delivery/roadmap";
import { FactEditor } from "@/components/delivery/FactEditor";
import { WriteNotice } from "@/components/delivery/WriteNotice";
import { safeUserLabel } from "@/lib/demo/presentation";
import styles from "@/components/delivery/delivery.module.css";
export default async function InitiativeDelivery({params}:{params:Promise<{slug:string}>}) {
  const {slug}=await params; const {ctx,source,state}=await readDelivery(); const snapshot=source.snapshots.find(s=>s.initiative.slug===slug);
  if (!snapshot) notFound(); const initiative=snapshot.initiative,facts=state.facts.filter(f=>f.workspaceId===ctx.workspaceId),history=targetHistory(state.events,ctx.workspaceId,initiative.id);
  return <div className={styles.page}><header className={styles.header}><div><span className={styles.eyebrow}>{initiative.name}</span><h2>Delivery facts</h2><p>Human-confirmed dates and commitments for the current scope.</p></div><nav className={styles.links}><Link href={`/initiatives/${slug}`}>Initiative Brief</Link><Link href="/roadmap">Roadmap</Link><Link href="/weekly-review">Weekly Review</Link></nav></header>
    <WriteNotice ctx={ctx}/>
    <div className={styles.reviewOverview}><div className={styles.reviewSummary}><span className={styles.eyebrow}>Recorded scope</span><h2>{factFor(facts,initiative.id,"SCOPE")?.value.text ?? "Not confirmed"}</h2><p className={styles.meta}>Confirm scope first. The Roadmap reads these facts automatically.</p></div><div className={styles.reviewBaseline}><strong>Target Live · planned</strong><p>{displayDate(factFor(facts,initiative.id,"TARGET_LIVE")?.value.date)}</p><p className={styles.meta}>Actual Live: {factFor(facts,initiative.id,"ACTUAL_LIVE")?.value.date ? displayDate(factFor(facts,initiative.id,"ACTUAL_LIVE")?.value.date) : "Not recorded"}</p></div></div>
    <FactEditor initiativeId={initiative.id} facts={facts} source={source} ctx={ctx}/>
    <section className={styles.section} id="target-history"><h2>Target movement history</h2><p className={styles.meta}>Each confirmation, revision and withdrawal is retained across scopes. Roadmap movement counts include date revisions within the current scope only.</p>{history.length ? <ol className={styles.history}>{history.slice().reverse().map(event=><li key={event.id}><span className={styles.meta}>{new Date(event.occurredAt).toLocaleString("en-GB",{timeZone:"Africa/Cairo",dateStyle:"medium",timeStyle:"short"})} Cairo<br/>Revision {event.after.revision}</span><div><p><strong>{displayDate(event.before?.value.date)} → {event.after.state === "RETRACTED" ? "Withdrawn · unknown" : displayDate(event.after.value.date)}</strong></p><p>{event.after.note}</p><p className={styles.meta}>{safeUserLabel(event.after)} · {event.after.basis==="EVIDENCE" ? snapshot.evidence.find(e=>e.id===event.after.evidenceId)?.title ?? "Linked source unavailable" : "Direct knowledge"}{event.after.locator && ` · ${event.after.locator}`}</p></div></li>)}</ol> : <p className={styles.unknown}>No Target Live confirmation recorded. The date remains unknown.</p>}</section>
  </div>;
}
