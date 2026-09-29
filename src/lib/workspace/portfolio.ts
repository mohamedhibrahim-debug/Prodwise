import {projectQueue} from "../review/dispositions.ts";
import type { ActivityEntry, Initiative, InitiativeSnapshot } from '../domain/types.ts';
import type { DeliveryFact, DeliveryState, PortfolioSource, WeeklyReview } from '../delivery/types.ts';
import { cairoDay, changesSince, dayDifference, factFor, freezeInput, ownerFor, supportChanged } from '../delivery/model.ts';
import { deliveryTiming, displayDate, targetMovements } from '../delivery/roadmap.ts';
import { runReview } from '../review/engine.ts';
import { applyFindingStates } from '../review/merge.ts';
import {deriveReadiness,type InitiativeContext} from './readiness.ts';
import type {SourceMapping} from './source-mapping.ts';
import { deriveSetup } from './setup.ts';
import { activitySummary, clipSentence, isReadinessBaseline } from './copy.ts';
import { STAGE_LABEL } from '../domain/labels.ts';
import { relationshipsFor } from './relationship-view.ts';
import type { InitiativeRelationship } from './relationships.ts';

export type AttentionKind = 'DECISION' | 'BLOCKER' | 'PAST_TARGET' | 'PAST_MILESTONE' | 'DEPENDENCY' | 'SUPPORT_CHANGED';
export interface PortfolioAttention { kind: AttentionKind; label: string; detail: string; href: string; date: string|null; }
export interface ProjectionChange { id:string; initiativeId:string; slug:string; name:string; sentence:string; actorLabel:string; occurredAt:string; href:string; }
export interface PortfolioRow {
  snapshot:InitiativeSnapshot; initiative:Initiative; ownerId:string|null; ownerLabel:string;
  setup:ReturnType<typeof deriveReadiness>;
  coverage:{complete:boolean;label:string;unconfirmed:number}; attention:PortfolioAttention[];
  target:DeliveryFact|undefined; actual:DeliveryFact|undefined; milestone:DeliveryFact|undefined; nextStep:DeliveryFact|undefined;
  timing:ReturnType<typeof deliveryTiming>; targetMovement:{from:string;to:string;days:number;occurredAt:string}|null;
  latestChange:ProjectionChange|null;
}
export interface PortfolioProjection {
  asOf:string; today:string; rows:PortfolioRow[]; attentionRows:PortfolioRow[];
  upcoming:{initiativeId:string;slug:string;name:string;kind:'TARGET_LIVE'|'NEXT_MILESTONE';date:string;label:string}[];
  changes:ProjectionChange[]; baseline:WeeklyReview|undefined;
  summary:{total:number;attentionInitiatives:number;attentionReasons:number;setupIncomplete:number;upcomingTargets:number;unknownTargets:number};
}
const order:AttentionKind[]=['DECISION','BLOCKER','PAST_TARGET','PAST_MILESTONE','DEPENDENCY','SUPPORT_CHANGED'];
const factNames:Record<string,string>={TARGET_LIVE:'Target Live',ACTUAL_LIVE:'Actual Live',BLOCKER:'Blocker',NEXT_STEP:'Next step',NEXT_MILESTONE:'Next milestone',OWNER:'Owner',SCOPE:'Scope',DEV_STARTED:'Development start',SOLUTION_DEFINED:'Solution defined'};
export function buildPortfolioProjection({source,state,workspaceId,activity=[],asOf,management,relationships=[]}:{source:PortfolioSource;state:DeliveryState;workspaceId:string;activity?:ActivityEntry[];asOf:string;management?:{contexts:InitiativeContext[];mappings:SourceMapping[]};relationships?:InitiativeRelationship[]}):PortfolioProjection {
  const ends=source.snapshots.map(x=>({id:x.initiative.id,name:x.initiative.name,slug:x.initiative.slug,archived:Boolean(x.initiative.archivedAt)}));
  const today=cairoDay(asOf); const facts=state.facts.filter(f=>f.workspaceId===workspaceId);
  const baseline=state.reviews.filter(r=>r.workspaceId===workspaceId&&r.status==='FINAL').sort((a,b)=>b.week.localeCompare(a.week)).at(0);
  const changes:ProjectionChange[]=[];
  const allowed=new Map(source.snapshots.map(s=>[s.initiative.id,s.initiative]));
  // Scenario time anchors the commitment window, not the timestamps of new
  // human actions. These are current records, never a reconstructed past view.
  const inWindow=(at:string)=>baseline ? at>baseline.input.asOf : dayDifference(cairoDay(at),today)<=28;
  for(const event of state.events.filter(e=>e.workspaceId===workspaceId&&allowed.has(e.initiativeId)&&inWindow(e.occurredAt))) {
    const i=allowed.get(event.initiativeId)!; const f=event.after; const delta=event.before?.value.date&&f.value.date?dayDifference(event.before.value.date,f.value.date):null;
    const sentence=f.state==='RETRACTED'?`${factNames[f.kind]} withdrawn · current status unknown`:f.kind==='TARGET_LIVE'&&delta!==null&&delta!==0?`Target Live moved ${displayDate(event.before!.value.date)} → ${displayDate(f.value.date)} (${delta>0?'+':''}${delta} days)`:f.kind==='OWNER'?`Owner assignment recorded`:`${factNames[f.kind]} confirmed: ${f.value.date?displayDate(f.value.date):f.value.text??'Recorded assignment'}`;
    changes.push({id:event.id,initiativeId:i.id,slug:i.slug,name:i.name,sentence,actorLabel:f.preparedAsFixture?'Prodwise demo setup':event.actor.label,occurredAt:event.occurredAt,href:`/initiatives/${i.slug}/delivery`});
  }
  // A rejected proposal changed nothing in the product, so it is not a change.
  for(const entry of activity.filter(e=>allowed.has(e.initiativeId)&&inWindow(e.occurredAt)&&e.eventType!=='AI_PROPOSAL_REJECTED'&&!isReadinessBaseline(e))) {
    const i=allowed.get(entry.initiativeId)!;
    changes.push({id:entry.id,initiativeId:i.id,slug:i.slug,name:i.name,sentence:entry.eventType==='INITIATIVE_CREATED'?'Added to Prodwise':clipSentence(activitySummary(entry)),actorLabel:entry.actorLabel??'Actor not recorded',occurredAt:entry.occurredAt,href:`/initiatives/${i.slug}`});
  }
  if(baseline) {
    const compared=changesSince(freezeInput(source,state,workspaceId,asOf),baseline.input);
    for(const c of compared) {
      if(c.kind!=='STAGE'&&baseline.input.snapshots.some(s=>s.initiative.id===c.initiativeId))continue;
      const i=allowed.get(c.initiativeId);if(!i)continue;
      const previous=baseline.input.snapshots.find(s=>s.initiative.id===i.id);
      const id=`projection:${i.id}:${c.kind}`;if(changes.some(x=>x.id===id||!previous&&x.initiativeId===i.id&&x.sentence==='Added to Prodwise'))continue;
      changes.push({id,initiativeId:i.id,slug:i.slug,name:i.name,sentence:previous?`Stage changed: ${STAGE_LABEL[previous.initiative.stage]} → ${STAGE_LABEL[i.stage]}`:'Added to Prodwise',actorLabel:'Recorded initiative history',occurredAt:i.updatedAt,href:`/initiatives/${i.slug}`});
    }
  }
  changes.sort((a,b)=>b.occurredAt.localeCompare(a.occurredAt)||a.id.localeCompare(b.id));
  const rows:PortfolioRow[]=source.snapshots.map(snapshot=>{
    const i=snapshot.initiative; const base=`/initiatives/${i.slug}`;
    const findings=applyFindingStates(runReview(i.id,snapshot.claims),snapshot.findingStates);
    const open=projectQueue(findings,(source.findingDispositions??[]).filter(d=>d.initiativeId===i.id),source.queueFinalizations??[],asOf,snapshot.findingStates).lanes.open.map(item=>item.finding);
    const setup=deriveSetup({evidence:snapshot.evidence,claims:snapshot.claims,findings});
    const unconfirmed=snapshot.claims.filter(c=>['UNVERIFIED','DRAFT','UNKNOWN'].includes(c.status)).length;
    const coverageLabel=!setup.complete?`Evidence coverage incomplete · ${setup.current==='sources'?'no in-scope source':setup.current==='record'?'no Knowledge recorded':'nothing confirmed'}`:`Knowledge value check · ${open.length?`${open.length} ${open.length===1?'value differs':'values differ'}`:'no differing values'}`;
    const target=factFor(facts,i.id,'TARGET_LIVE'),actual=factFor(facts,i.id,'ACTUAL_LIVE'),milestone=factFor(facts,i.id,'NEXT_MILESTONE'),nextStep=factFor(facts,i.id,'NEXT_STEP'),blocker=factFor(facts,i.id,'BLOCKER');
    const timing=deliveryTiming(facts,i.id,today); const attention:PortfolioAttention[]=open.map(f=>({kind:'DECISION',label:'Decision needed',detail:`${f.subject} · ${f.claims[0]?.attribute??'Recorded values'}: ${f.claims.map(c=>c.value).join(' vs ')}`,href:`${base}/decisions?item=${encodeURIComponent(f.fingerprint)}`,date:f.detectedOn?cairoDay(f.detectedOn):null}));
    if(blocker)attention.push({kind:'BLOCKER',label:'Recorded blocker',detail:blocker.value.text??'Recorded blocker',href:`${base}/delivery`,date:null});
    if(timing.kind==='NEEDS_UPDATE')attention.push({kind:'PAST_TARGET',label:'Past target · update needed',detail:timing.detail,href:`${base}/delivery`,date:target?.value.date??null});
    if(milestone?.value.date&&milestone.value.date<today)attention.push({kind:'PAST_MILESTONE',label:'Past milestone · update needed',detail:`${milestone.value.text} · ${displayDate(milestone.value.date)}. Completion is not inferred.`,href:`${base}/delivery`,date:milestone.value.date});
    // A dependency counts once, everywhere, only when both recorded dates show it landing late.
    for(const x of relationshipsFor(i.id,relationships,ends,facts,'ACTIVE',today).filter(x=>x.late))attention.push({kind:'DEPENDENCY',label:'Dependency date impact',detail:x.impactText??'A dependency lands after the date it is needed.',href:`${base}/manage?section=relationships#relationships`,date:null});
    for(const f of [target,actual])if(f&&supportChanged(f,source))attention.push({kind:'SUPPORT_CHANGED',label:'Supporting evidence changed',detail:`Inspect support for ${factNames[f.kind]}. The recorded value is unchanged.`,href:`${base}/delivery`,date:cairoDay(f.updatedAt)});
    const move=targetMovements(state.events,workspaceId,i.id).at(-1);
    const ownerId=ownerFor(facts,i.id);const member=source.members.find(m=>m.id===ownerId);
    const readiness=deriveReadiness({initiative:{...i,workspaceId},facts,members:source.members,claims:snapshot.claims,currentContext:management?.contexts.find(c=>c.id===i.currentContextId)??null,activeSourceLinks:management?.mappings.filter(m=>m.initiativeId===i.id&&!m.unlinkedAt).length??0,previouslyReady:activity.some(a=>a.initiativeId===i.id&&a.eventType==='READINESS_REACHED')});
    return {snapshot,initiative:i,setup:readiness,ownerId,ownerLabel:ownerId?member?.displayName??'Recorded owner unavailable':'Unassigned',coverage:{complete:setup.complete,label:coverageLabel+(unconfirmed?` · ${unconfirmed} ${unconfirmed===1?'entry':'entries'} not yet confirmed`:''),unconfirmed},attention,target,actual,milestone,nextStep,timing,targetMovement:move?{from:move.before!.value.date!,to:move.after.value.date!,days:dayDifference(move.before!.value.date!,move.after.value.date!),occurredAt:move.occurredAt}:null,latestChange:changes.find(c=>c.initiativeId===i.id)??null};
  });
  const activeRows=rows.filter(r=>!r.initiative.archivedAt);
  const upcoming=activeRows.flatMap(r=>(['TARGET_LIVE','NEXT_MILESTONE'] as const).flatMap(kind=>{const f=kind==='TARGET_LIVE'?r.target:r.milestone;if(kind==='TARGET_LIVE'&&r.actual?.value.extent==='FULL')return [];return f?.value.date&&dayDifference(today,f.value.date)>=0&&dayDifference(today,f.value.date)<=28?[{initiativeId:r.initiative.id,slug:r.initiative.slug,name:r.initiative.name,kind,date:f.value.date,label:kind==='TARGET_LIVE'?'Target Live':f.value.text??'Next milestone'}]:[];})).sort((a,b)=>a.date.localeCompare(b.date)||a.name.localeCompare(b.name));
  const attentionRows=activeRows.filter(r=>r.attention.length).sort((a,b)=>order.indexOf(a.attention[0]!.kind)-order.indexOf(b.attention[0]!.kind)||(a.attention[0]!.date??'9999').localeCompare(b.attention[0]!.date??'9999')||a.initiative.name.localeCompare(b.initiative.name));
  return {asOf,today,rows,attentionRows,upcoming,changes,baseline,summary:{total:activeRows.length,attentionInitiatives:attentionRows.length,attentionReasons:activeRows.reduce((n,r)=>n+r.attention.length,0),setupIncomplete:activeRows.filter(r=>!r.setup.ready).length,upcomingTargets:upcoming.filter(u=>u.kind==='TARGET_LIVE').length,unknownTargets:activeRows.filter(r=>!r.target?.value.date).length}};
}
export interface PortfolioFilters {record?:string;setup?:string;q?:string;line?:string;businessLine?:string;stage?:string;owner?:string;coverage?:string;attention?:string;target?:string;sort?:string;}
export function filterPortfolioRows(rows:PortfolioRow[],f:PortfolioFilters,today:string):PortfolioRow[] {
  const attentionKinds:Record<string,AttentionKind>={decision:'DECISION',blocker:'BLOCKER','past-target':'PAST_TARGET','past-milestone':'PAST_MILESTONE',dependency:'DEPENDENCY','support-changed':'SUPPORT_CHANGED'};
  const result=rows.filter(r=>(f.record==='archived'?Boolean(r.initiative.archivedAt):f.record==='all'?true:!r.initiative.archivedAt)&&(!f.setup||(f.setup==='ready'?r.setup.ready:!r.setup.ready))&&(!f.q||r.initiative.name.toLowerCase().includes(f.q.toLowerCase()))&&(!(f.line||f.businessLine)||r.initiative.businessLine===(f.line||f.businessLine))&&(!f.stage||r.initiative.stage===f.stage)&&(!f.owner||(f.owner==='unassigned'?!r.ownerId:r.ownerId===f.owner))&&(!f.coverage||(f.coverage==='incomplete'?!r.coverage.complete:r.coverage.complete))&&(!f.attention||(f.attention==='any'?r.attention.length>0:r.attention.some(a=>a.kind===attentionKinds[f.attention!])))&&(!f.target||(f.target==='unknown'?!r.target?.value.date:f.target==='past'?r.timing.kind==='NEEDS_UPDATE':f.target==='moved'?Boolean(r.targetMovement&&dayDifference(cairoDay(r.targetMovement.occurredAt),today)<=28):Boolean(r.target?.value.date&&r.actual?.value.extent!=='FULL'&&dayDifference(today,r.target.value.date)>=0&&dayDifference(today,r.target.value.date)<=28))));
  return result.sort((a,b)=>f.sort==='target'?(a.target?.value.date??'9999').localeCompare(b.target?.value.date??'9999'):f.sort==='updated'?(b.latestChange?.occurredAt??'').localeCompare(a.latestChange?.occurredAt??''):f.sort==='attention'?Number(Boolean(b.attention.length))-Number(Boolean(a.attention.length))||a.initiative.name.localeCompare(b.initiative.name):a.initiative.name.localeCompare(b.initiative.name));
}
