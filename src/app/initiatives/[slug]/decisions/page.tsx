import Link from "next/link";
import { ButtonLink } from "@/components/primitives/Button";
import { formatDateTime } from "@/lib/domain/labels";
import { Suspense, type ReactNode } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { EmptyState, EMPTY } from "@/components/primitives/EmptyState";
import { DecisionRecord } from "@/components/initiative/DecisionRecord";
import { DecisionDeepLink } from "@/components/initiative/DecisionDeepLink";
import { DecisionWorkbench, type WorkbenchLane } from "@/components/initiative/DecisionWorkbench";
import { FindingRow } from "@/components/initiative/FindingRow";
import { getRepository } from "@/lib/data";
import { businessWritePresentation } from "@/lib/auth/presentation";
import {friendlyDay} from "@/lib/review/dispositions";
import { loadDecisions } from "@/lib/workspace/decisions";
import { DECISION_LANES, type DecisionLaneKey } from "@/lib/workspace/decision-lanes";
import styles from "../workspace.module.css";

export const metadata: Metadata = { title: "Decisions" };
export const dynamic = "force-dynamic";

export default async function DecisionsPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ item?: string }> }) {
  const { enabled: isDemoWriteEnabled, message: WRITE_DISABLED_MESSAGE } = await businessWritePresentation();
  const { slug } = await params;
  const { item } = await searchParams;
  const repo = getRepository();
  const initiative = await repo.getInitiativeBySlug(slug);
  if (!initiative) notFound();
  const { claims, queue } = await loadDecisions(initiative.id);
  // Decisions people recorded (from meetings or by hand) live in Knowledge; they are listed here too.
  const recorded = claims.filter(c => c.type === "DECISION" && (c.status === "ACTIVE" || c.status === "UNVERIFIED"));
  const sourceCount = claims.length === 0 ? (await repo.listEvidence(initiative.id)).length : 0;
  const row=(item:(typeof queue.lanes.open)[number])=><FindingRow key={item.finding.fingerprint} finding={item.finding} slug={slug} canResolve={isDemoWriteEnabled} records={claims} queue={item.effective}/>;
  const historyBody=(entry:(typeof queue.history)[number])=><li key={entry.id}><h3>{entry.reopenReason?`Reopened: ${entry.reopenReason}`:entry.row.kind==='WITHDRAWN'?'Returned to Open':entry.row.kind==='DEFERRED'?'Deferred':'Dismissed'}</h3><p>{entry.row.reason||'No additional reason recorded.'} · {entry.row.actor.label} · {formatDateTime(entry.row.at)}</p><p>Bound to the exact compared claims and supporting evidence.</p>{entry.row.claimIds.map(id=><Link prefetch={false} key={id} href={`/initiatives/${slug}/knowledge?view=all#claim-${id}`}>Knowledge entry → </Link>)}{entry.row.evidenceIds.map(id=><Link prefetch={false} key={id} href={`/initiatives/${slug}/knowledge/sources#source-${id}`}>Supporting source → </Link>)}</li>;
  const emptyOpen=claims.length===0?<EmptyState message={EMPTY.reviewNoClaims} hint={sourceCount===0?'No sources or Knowledge entries have been recorded for comparison.':'Record Knowledge entries before values can be compared.'}/>:<p className={styles.decisionLaneEmpty}>{EMPTY.reviewNothingOpen}</p>;
  const laneItems:Record<DecisionLaneKey,WorkbenchLane['items']>={
    open:queue.lanes.open.map(i=>({id:i.finding.fingerprint,title:i.finding.title,value:i.finding.claims.map(c=>c.value).join(' / '),body:row(i)})),
    deferred:queue.lanes.deferred.map(i=>({id:i.finding.fingerprint,title:i.finding.title,value:i.effective.activeRow?.deferUntil?`Deferred until ${friendlyDay(i.effective.activeRow.deferUntil)}`:'Deferred until next Weekly Review',body:row(i)})),
    dismissed:queue.lanes.dismissed.map(i=>({id:i.finding.fingerprint,title:i.finding.title,value:'Dismissed for these exact claims',body:row(i)})),
    resolved:[...queue.lanes.resolved.map(i=>({id:i.finding.fingerprint,title:i.finding.title,value:'Reviewed — note only',body:row(i)})),...queue.standing.map(state=>({id:state.fingerprint,title:`${state.subject} · ${state.attribute}`,value:state.decidedValue??'',body:<DecisionRecord state={state} slug={slug}/>}))],
    history:[...queue.history.map(e=>({id:e.id,title:e.reopenReason?'Reopened':e.row.kind==='WITHDRAWN'?'Returned to Open':e.row.kind==='DEFERRED'?'Deferred':'Dismissed',value:e.row.reason,body:historyBody(e)})),...queue.replaced.map(f=>({id:f.fingerprint,title:f.title,value:'Replaced information',body:<FindingRow finding={f} slug={slug} canResolve={false} records={claims}/>}))],
  };
  const empty:Record<DecisionLaneKey,ReactNode>={open:emptyOpen,deferred:<p>Nothing deferred.</p>,dismissed:<p>Nothing dismissed.</p>,resolved:<p>No decision records or reviewed notes yet.</p>,history:<p>No queue dispositions or replaced values recorded.</p>};

  return <div className={styles.tabPage}>
    <div className={styles.reviewMain}>
      <Suspense fallback={null}><DecisionDeepLink slug={slug} /></Suspense>
      <DecisionWorkbench initialItem={item} lanes={DECISION_LANES.map(lane => ({ ...lane, items: laneItems[lane.key], empty: empty[lane.key] }))}
        summary={<><strong>{queue.lanes.open.length}</strong> {queue.lanes.open.length === 1 ? "difference needs" : "differences need"} a decision</>}
        actions={<>{!isDemoWriteEnabled ? <span className={styles.contextNotice} title={WRITE_DISABLED_MESSAGE}>Read-only</span> : null}
          <ButtonLink variant="ghost" href={`/initiatives/${slug}/knowledge?view=all`}>{recorded.length ? `Recorded decisions · ${recorded.length}` : "Knowledge"}</ButtonLink></>} />
    </div>
  </div>;
}
