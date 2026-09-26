import Link from "next/link";
import { notFound } from "next/navigation";
import { readDelivery } from "@/lib/delivery/repository";
import { FactEditor } from "@/components/delivery/FactEditor";
import { WriteNotice } from "@/components/delivery/WriteNotice";
import styles from "@/components/delivery/delivery.module.css";
export default async function InitiativeDelivery({params}:{params:Promise<{slug:string}>}) {
  const {slug}=await params; const {ctx,source,state}=await readDelivery(); const snapshot=source.snapshots.find(s=>s.initiative.slug===slug);
  if (!snapshot) notFound(); const initiative=snapshot.initiative;
  return <div className={styles.page}><header className={styles.header}><div><h2>Delivery facts</h2><p>Confirmed milestones for the current delivery scope.{initiative.isDemo?" · Demo initiative":""}</p></div><nav className={styles.links}><Link href={`/initiatives/${slug}`}>Initiative Brief</Link><Link href="/roadmap">Roadmap</Link><Link href="/weekly-review">Weekly Review</Link></nav></header>
    <WriteNotice ctx={ctx}/>
    <p className={styles.notice}>Confirm the delivery phase or scope, then record dates for that scope. Planned dates and actual milestones are separate. Unknown dates stay unknown.</p>
    <FactEditor initiativeId={initiative.id} facts={state.facts.filter(f=>f.workspaceId===ctx.workspaceId)} source={source} ctx={ctx}/>
    <section className={styles.section}><h2>Target movement history</h2>{state.events.filter(e=>e.workspaceId===ctx.workspaceId && e.initiativeId===initiative.id && e.after.kind === "TARGET_LIVE").map(event=><p key={event.id}>{event.before?.value.date ?? "Not recorded"} → {event.after.state === "RETRACTED" ? "Withdrawn" : event.after.value.date} · {event.after.confirmedByLabel}<span className={styles.meta}> · {event.occurredAt}<br/>{event.after.note}</span></p>)}{!state.events.some(e=>e.initiativeId===initiative.id && e.after.kind === "TARGET_LIVE") && <p className={styles.unknown}>No target movement recorded.</p>}</section>
  </div>;
}
