"use client";
import Link from "next/link";
import { BusinessLine } from "@/components/primitives/BusinessLine";
import { displayDate } from "@/lib/delivery/display";
import type { BusinessLine as BusinessLineCode } from "@/lib/domain/types";
import type { RoadmapGroup, RoadmapGrouping, RoadmapItem } from "@/lib/workspace/roadmap-layout";
import { ATTENTION_MARK } from "./attention";
import { deliveryHref } from "./RoadmapTimeline";
import styles from "./RoadmapDetails.module.css";

function Row({ i }: { i: RoadmapItem }) {
  return <article className={styles.row}>
    <div className={styles.identity}>
      <Link prefetch={false} href={deliveryHref(i.slug)}>{i.name}</Link>
      <span>{i.stage} · {i.ownerLabel}</span>
      <p>{i.scope ?? "Scope not confirmed"}</p>
    </div>
    <div className={styles.schedule}>
      <p><strong>{i.target ? `Target ${i.targetText}` : i.targetText === "Unknown" ? "Target Live Unknown" : "Target Live not recorded"}</strong>{i.targetContext && <> · <Link prefetch={false} href={`/initiatives/${i.slug}/delivery#target-history`}>{i.targetContext}</Link></>}</p>
      <p>Live {i.actual ? `${i.actualText} (${i.actualExtent === "PARTIAL" ? "partial" : "full"})` : "not recorded"}</p>
      {i.movement && <Link prefetch={false} href={`/initiatives/${i.slug}/delivery#target-history`}>Moved {i.movement.days > 0 ? "+" : ""}{i.movement.days} d from {displayDate(i.movement.from)}</Link>}
      <small>Development start · {i.devStart ? displayDate(i.devStart) : "Not recorded"}</small>
    </div>
    <div className={styles.context}>
      <strong>{i.milestone?.text ?? "Next milestone not recorded"}</strong>
      <p>{i.milestone ? i.milestone.dateText : "Date not recorded"}</p>
      {i.attention.map((a, n) => { const m = ATTENTION_MARK[a.kind];
        return <p className={styles.attention} data-tone={m.tone} key={n}><span aria-hidden="true">{m.glyph}</span> {a.label} · <Link prefetch={false} href={a.href}>Inspect</Link></p>; })}
      {i.dependencies.map(d => <p key={d.id} className={d.late ? styles.attention : styles.dependency}>{d.late && <span aria-hidden="true">⇢ </span>}Depends on {d.otherSlug ? <Link prefetch={false} href={`/initiatives/${d.otherSlug}`}>{d.otherName}</Link> : d.otherName} · {d.text}</p>)}
      <small>{i.nextStep ? `Next step: ${i.nextStep}` : "No next step recorded."}</small>
    </div>
  </article>;
}

/** The secondary view: every recorded fact behind the timeline, in the same order. */
export function RoadmapDetails({ groups, unscheduled, grouping }: { groups: RoadmapGroup[]; unscheduled: RoadmapItem[]; grouping: RoadmapGrouping }) {
  return <div className={styles.list}>
    <div className={styles.columns} aria-hidden="true"><span>Initiative · scope</span><span>Schedule</span><span>Next milestone · attention</span></div>
    {groups.map(g => <section key={g.key}>
      <h3 className={styles.group}>{grouping === "businessLine" ? <><span>Business line</span> <BusinessLine code={g.key as BusinessLineCode} detailed /></> : <><span>Owner</span> {g.label}</>}</h3>
      {g.items.map(i => <Row key={i.id} i={i} />)}
    </section>)}
    {unscheduled.length > 0 && <section><h3 className={styles.group}>Not scheduled — no Target Live recorded ({unscheduled.length})</h3>{unscheduled.map(i => <Row key={i.id} i={i} />)}</section>}
  </div>;
}
