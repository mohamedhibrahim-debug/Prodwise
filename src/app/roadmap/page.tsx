import Link from "next/link";
import { readDelivery } from "@/lib/delivery/repository";
import { cairoDay, dateValid, factFor, ownerFor, supportChanged } from "@/lib/delivery/model";
import { deliveryTiming, displayDate, targetMovements, timelinePosition } from "@/lib/delivery/roadmap";
import { memberLabel } from "@/components/delivery/FactEditor";
import { WriteNotice } from "@/components/delivery/WriteNotice";
import { BUSINESS_LINE_LABEL, STAGE_LABEL } from "@/lib/domain/labels";
import { safeUserLabel } from "@/lib/demo/presentation";
import styles from "@/components/delivery/delivery.module.css";

export default async function Roadmap({searchParams}:{searchParams:Promise<{businessLine?:string;owner?:string;cutoff?:string;view?:string}>}) {
  const filters=await searchParams; const {ctx,source,state,presentation}=await readDelivery();
  const facts=state.facts.filter(f=>f.workspaceId===ctx.workspaceId);
  const today=cairoDay(presentation.scenarioAt ?? new Date().toISOString()); const cutoff=filters.cutoff && dateValid(filters.cutoff) ? filters.cutoff : today;
  const pastMilestone=(id:string)=>{const date=factFor(facts,id,"NEXT_MILESTONE")?.value.date;return Boolean(date && date<cutoff);};
  const snapshots=source.snapshots.filter(s=>(!filters.businessLine || s.initiative.businessLine===filters.businessLine) && (!filters.owner || ownerFor(facts,s.initiative.id)===filters.owner))
    .filter(s=>filters.view!=="attention" || deliveryTiming(facts,s.initiative.id,cutoff).kind==="NEEDS_UPDATE" || pastMilestone(s.initiative.id) || Boolean(factFor(facts,s.initiative.id,"BLOCKER")))
    .sort((a,b)=>(factFor(facts,a.initiative.id,"TARGET_LIVE")?.value.date ?? "9999").localeCompare(factFor(facts,b.initiative.id,"TARGET_LIVE")?.value.date ?? "9999") || a.initiative.name.localeCompare(b.initiative.name));
  const groups=[...new Set(snapshots.map(s=>s.initiative.businessLine))].sort();
  const dates=[cutoff,...snapshots.flatMap(s=>["DEV_STARTED","TARGET_LIVE","ACTUAL_LIVE"].flatMap(kind=>facts.find(f=>f.initiativeId===s.initiative.id && f.kind===kind && f.state==="SET")?.value.date ?? []))].sort();
  const start=dates[0]!,end=dates.at(-1)!;
  const needsUpdate=snapshots.filter(s=>deliveryTiming(facts,s.initiative.id,cutoff).kind==="NEEDS_UPDATE").length;
  const unscheduled=snapshots.filter(s=>!factFor(facts,s.initiative.id,"TARGET_LIVE")?.value.date).length;
  const moved=snapshots.filter(s=>targetMovements(state.events,ctx.workspaceId,s.initiative.id).length>0).length;
  return <div className={styles.page}>
    <header className={styles.header}><div><span className={styles.eyebrow}>Delivery outlook</span><h1>Roadmap</h1><p>Every date comes from a confirmed initiative fact.</p></div><nav className={styles.links}><Link href="/initiatives">Initiatives</Link><Link href="/weekly-review">Weekly Review →</Link></nav></header>
    <WriteNotice ctx={ctx}/>
    <div className={styles.pulse}><span><strong>{snapshots.length}</strong> initiatives</span><span><strong>{needsUpdate}</strong> past target · need update</span><span><strong>{moved}</strong> with target changes</span><span><strong>{unscheduled}</strong> without a target</span></div>
    <form className={styles.filters}>
      <label className={styles.field}>Business line<select name="businessLine" defaultValue={filters.businessLine ?? ""}><option value="">All business lines</option>{[...new Set(source.snapshots.map(s=>s.initiative.businessLine))].sort().map(line=><option key={line} value={line}>{BUSINESS_LINE_LABEL[line]}</option>)}</select></label>
      <label className={styles.field}>Owner<select name="owner" defaultValue={filters.owner ?? ""}><option value="">All owners</option>{source.members.filter(m=>m.active).map(m=><option key={m.id} value={m.id}>{m.displayName}</option>)}</select></label>
      <label className={styles.field}>Review cutoff<input type="date" name="cutoff" defaultValue={cutoff}/></label>
      <label className={styles.field}>Show<select name="view" defaultValue={filters.view ?? ""}><option value="">All initiatives</option><option value="attention">Needs attention</option></select></label>
      <button className={styles.button}>Apply filters</button>
    </form>
    <div className={styles.scheduleLegend}><span><i className={styles.targetKey}/> Target · planned</span><span><i className={styles.actualKey}/> Live · actual</span><span>│ Cutoff {displayDate(cutoff)}{cutoff===today?(presentation.isDemo?" · scenario date":" · today"):""}</span>{presentation.isDemo && cutoff!==today && <span>Scenario date · {displayDate(today)}</span>}<span className={styles.meta}>Current facts; changing cutoff does not reconstruct history.</span></div>
    {groups.map(group=><section className={styles.scheduleGroup} key={group}>
      <div className={styles.groupHeading}><h2>{BUSINESS_LINE_LABEL[group]}</h2><span>{snapshots.filter(s=>s.initiative.businessLine===group).length} initiatives</span></div>
      <div className={styles.scheduleHead}><span>Initiative / current scope</span><span>Recorded schedule <small>{displayDate(start)} — {displayDate(end)}</small></span><span>Next milestone / attention</span></div>
      {snapshots.filter(s=>s.initiative.businessLine===group).map(({initiative,evidence})=>{
        const id=initiative.id,target=factFor(facts,id,"TARGET_LIVE"),actual=factFor(facts,id,"ACTUAL_LIVE"),dev=factFor(facts,id,"DEV_STARTED"),milestone=factFor(facts,id,"NEXT_MILESTONE"),blocker=factFor(facts,id,"BLOCKER"),scope=factFor(facts,id,"SCOPE");
        const timing=deliveryTiming(facts,id,cutoff),moves=targetMovements(state.events,ctx.workspaceId,id),lastMove=moves.at(-1);
        return <article className={styles.scheduleRow} key={id}>
          <div className={styles.scheduleIdentity}><Link href={`/initiatives/${initiative.slug}/delivery`}>{initiative.name}</Link><span className={styles.stage}>{STAGE_LABEL[initiative.stage]}</span><p>{scope?.value.text ?? "Scope not confirmed"}</p><small>{memberLabel(source.members,ownerFor(facts,id))}</small></div>
          <div className={styles.scheduleDates}>
            <div className={styles.timeline} aria-hidden="true"><span className={styles.cutoffMarker} style={{left:`${timelinePosition(cutoff,start,end)}%`}}/>{dev?.value.date && target?.value.date && dev.value.date<=target.value.date && <span className={styles.durationLine} style={{left:`${timelinePosition(dev.value.date,start,end)}%`,width:`${timelinePosition(target.value.date,start,end)-timelinePosition(dev.value.date,start,end)}%`}}/>}{dev?.value.date && <span className={styles.devMarker} style={{left:`${timelinePosition(dev.value.date,start,end)}%`}}/>}{target?.value.date && <span className={styles.targetMarker} style={{left:`${timelinePosition(target.value.date,start,end)}%`}}/>}{actual?.value.date && <span className={styles.actualMarker} style={{left:`${timelinePosition(actual.value.date,start,end)}%`}}/>}{!target?.value.date && !actual?.value.date && <span className={styles.unscheduledText}>Target not recorded</span>}</div>
            <dl className={styles.dateLedger}><div><dt>Development start</dt><dd>{displayDate(dev?.value.date)}</dd></div><div><dt>Target Live · planned</dt><dd>{displayDate(target?.value.date)}</dd></div><div><dt>Actual Live</dt><dd>{actual?.value.date ? displayDate(actual.value.date) : "Not recorded"}{actual && <small>{actual.value.extent==="PARTIAL"?`Partial · ${actual.value.text}`:"Full named scope"}</small>}</dd></div></dl>
            {lastMove && <Link className={styles.movement} href={`/initiatives/${initiative.slug}/delivery#target-history`}>{displayDate(lastMove.before?.value.date)} → {displayDate(lastMove.after.value.date)} · {moves.length} target {moves.length===1?"change":"changes"} in current scope</Link>}
            <details className={styles.inlineDetails}><summary>Confirmation details</summary>{target ? <p>{target.basis==="EVIDENCE" ? evidence.find(e=>e.id===target.evidenceId)?.title ?? "Source unavailable" : "Direct knowledge"}<br/>{safeUserLabel(target)} · {displayDate(target.updatedAt.slice(0,10))}{target.locator && <><br/>{target.locator}</>}{supportChanged(target,source) && <span className={styles.warning}> · Supporting evidence changed</span>}</p> : <p>No target confirmation recorded.</p>}</details>
          </div>
          <div className={styles.scheduleContext}><span className={timing.kind==="NEEDS_UPDATE"?styles.attentionTag:styles.quietTag}>{timing.label}</span><p className={styles.meta}>{timing.detail}</p><strong>{milestone?.value.text ?? "Next milestone not recorded"}</strong>{milestone && <span>{milestone.value.date ? displayDate(milestone.value.date) : "Planned date unknown"}</span>}{pastMilestone(id) && <p className={styles.blocker}>Past milestone · update needed. Confirm the current position; completion is not inferred.</p>}{blocker && <p className={styles.blocker}>{blocker.value.text}</p>}<small>Next step: {factFor(facts,id,"NEXT_STEP")?.value.text ?? "Not recorded"}</small></div>
        </article>;
      })}
    </section>)}
    {!snapshots.length && <div className={styles.emptyState}><h2>No initiatives in this view</h2><p>Change the filters or record delivery facts from an initiative.</p><Link href="/roadmap">Clear filters</Link></div>}
    <p className={styles.meta}>Missing Actual Live does not mean a launch failed or has not happened. A past target asks for a human update. Bars connect recorded dates and never represent estimated progress.</p>
  </div>;
}
