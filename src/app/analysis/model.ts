import { STAGES } from "../../lib/domain/types.ts";
import type { PortfolioSource, DeliveryState } from "../../lib/delivery/types.ts";
import { factFor, cairoDay, dayDifference } from "../../lib/delivery/model.ts";
import { runReview } from "../../lib/review/engine.ts";
import { applyFindingStates } from "../../lib/review/merge.ts";

/** Operational counts only. Missing observations never become business results. */
export function portfolioAnalysis(source:PortfolioSource,state:DeliveryState,workspaceId:string,asOf:string) {
  const today=cairoDay(asOf);
  const ids=new Set(source.snapshots.map(s=>s.initiative.id));
  const facts=state.facts.filter(f=>f.workspaceId===workspaceId && ids.has(f.initiativeId));
  const rows=source.snapshots.map(snapshot=>{
    const id=snapshot.initiative.id;
    const target=factFor(facts,id,"TARGET_LIVE");
    const actual=factFor(facts,id,"ACTUAL_LIVE");
    const days=target?.value.date ? dayDifference(today,target.value.date) : null;
    const fullActual=actual?.value.extent==="FULL";
    const decisions=applyFindingStates(runReview(id,snapshot.claims),snapshot.findingStates).filter(f=>f.actionable && f.status==="OPEN").length;
    return {initiative:snapshot.initiative,targetDate:target?.value.date ?? null,actualDate:actual?.value.date ?? null,
      targetNeedsConfirmation:days!==null && days<0 && !fullActual,
      upcoming:days!==null && days>=0 && days<=28 && !fullActual,
      decisions,blocker:factFor(facts,id,"BLOCKER")?.value.text ?? null};
  });
  const movements=state.events.filter(e=>e.workspaceId===workspaceId && ids.has(e.initiativeId) && e.after.kind==="TARGET_LIVE" && e.before?.state==="SET" && e.after.state==="SET" && e.before.value.date && e.after.value.date && e.before.value.date!==e.after.value.date && e.occurredAt<=asOf && dayDifference(cairoDay(e.occurredAt),today)>=0 && dayDifference(cairoDay(e.occurredAt),today)<28);
  return {today,rows,stages:STAGES.map(stage=>({stage,count:rows.filter(r=>r.initiative.stage===stage).length})),
    total:rows.length,upcoming:rows.filter(r=>r.upcoming).length,pastTarget:rows.filter(r=>r.targetNeedsConfirmation).length,
    unknownTargets:rows.filter(r=>!r.targetDate).length,withDecisions:rows.filter(r=>r.decisions>0).length,
    withBlockers:rows.filter(r=>Boolean(r.blocker)).length,targetMovements:movements.length};
}
