import Link from "next/link";
import {notFound} from "next/navigation";
import {readDelivery} from "@/lib/delivery/repository";
import {factFor,ownerFor} from "@/lib/delivery/model";
import {factDate} from "@/lib/delivery/display";
import {isDemoGuestSession} from "@/lib/auth/service";
import {isDemoWriteEnabled} from "@/lib/env";
import {listProjectMetrics} from "@/lib/analysis/metrics";
import {metricCoverage,metricView,periodLabel} from "@/lib/analysis/metric-view";
import {metricSetupDecision} from "@/lib/analysis/metric-authorization";
import {STAGE_LABEL} from "@/lib/domain/labels";
import {BusinessLine} from "@/components/primitives/BusinessLine";
import {SavedNotice} from "@/components/forms/SavedNotice";
import {AnalysisFrame,styles} from "@/components/analysis/AnalysisFrame";
import {Freshness,MetricContract,MetricTile,MetricValue,ObservationTable,TargetStatusMark,TrendChart} from "@/components/analysis/MetricParts";
import {DefineMetric,HelpLink,ObservationForm} from "@/components/analysis/MetricSetup";
import tiles from "@/components/analysis/metrics.module.css";
import {safeProjectBack} from "../../metric-model";

export async function generateMetadata({params}:{params:Promise<{slug:string}>}){const {slug}=await params;const {source}=await readDelivery();const initiative=source.snapshots.find(s=>s.initiative.slug===slug)?.initiative;return {title:initiative?"Analysis · "+initiative.name:"Initiative measurement"};}

export default async function ProjectDetail({params,searchParams}:{params:Promise<{slug:string}>;searchParams:Promise<{back?:string}>}){
 const [{slug},query,{source,state,ctx,presentation}]=await Promise.all([params,searchParams,readDelivery()]);
 const snapshot=source.snapshots.find(s=>s.initiative.slug===slug);if(!snapshot)notFound();
 const initiative=snapshot.initiative,[metrics,demoGuest]=await Promise.all([listProjectMetrics(initiative.id),isDemoGuestSession()]),asOf=presentation.scenarioAt??new Date().toISOString();
 const facts=state.facts.filter(f=>f.workspaceId===ctx.workspaceId);
 const actual=factFor(facts,initiative.id,"ACTUAL_LIVE"),target=factFor(facts,initiative.id,"TARGET_LIVE");
 const views=metrics.map(metric=>({metric,view:metricView(metric)}));
 const coverage=metricCoverage(metrics);
 const sourceHref=(id:string|null)=>id&&snapshot.evidence.some(e=>e.id===id)?`/initiatives/${slug}/sources#source-${id}`:null;
 const live=actual?.value.date??null;
 // Decision D2, decided on the server; the same function refuses inside the actions.
 const decision=metricSetupDecision(ctx,{ownerMemberId:ownerFor(state.facts,initiative.id),archived:Boolean(initiative.archivedAt)},{writesEnabled:isDemoWriteEnabled,demoGuest});
 const setup={slug,initiativeId:initiative.id,scopeWorkspaceId:ctx.workspaceId,evidence:snapshot.evidence.filter(e=>e.boundary!=="EXCLUDED").map(e=>({id:e.id,title:e.title}))};
 return <AnalysisFrame active="projects" title={initiative.name} organizationName={presentation.organizationName} asOf={asOf} synthetic={presentation.isDemo}>
  <nav className={styles.crumbs} aria-label="Initiative analysis navigation"><Link prefetch={false} href={safeProjectBack(query.back)}>← All initiatives</Link><Link prefetch={false} href={`/initiatives/${slug}`}>Open initiative Brief →</Link></nav>
  <dl className={styles.facts}>
   <div><dt>Stage</dt><dd>{STAGE_LABEL[initiative.stage]}</dd></div>
   <div><dt>Business line</dt><dd><BusinessLine code={initiative.businessLine}/></dd></div>
   <div><dt>Actual Live</dt><dd>{factDate(actual)}{actual?.value.extent&&<span className={styles.factNote}>{actual.value.extent==="FULL"?"Full scope":"Partial scope"}</span>}</dd></div>
   <div><dt>Target Live</dt><dd>{factDate(target)}</dd></div>
   <div><dt>Metrics</dt><dd>{metrics.length?`${metrics.length} configured`:"None configured"}<span className={styles.factNote}><Freshness captured={coverage.lastCaptured} asOf={asOf} configured={metrics.length>0}/></span></dd></div>
  </dl>
  <SavedNotice className={styles.saved}/>
  {!metrics.length?<NotConfigured live={Boolean(live)} setup={setup} decision={decision} actorLabel={ctx.actor.label}/>:<>
   <section className={styles.section} aria-labelledby="kpi-heading">
    <div className={styles.sectionHead}><div><h2 id="kpi-heading">Latest period</h2><p className={styles.summaryLine}>{[coverage.met&&`${coverage.met} meeting target`,coverage.notMet&&`${coverage.notMet} below target`,coverage.notAssessed&&`${coverage.notAssessed} not assessed`,coverage.noTarget&&`${coverage.noTarget} without an approved target`].filter(Boolean).join(" · ")} · select a tile to open its detail</p></div><DefineMetric {...setup} decision={decision} actorLabel={ctx.actor.label}/></div>
    {coverage.synthetic&&<p className={styles.synthetic}><strong>Synthetic demo measurements.</strong> Fictional values prepared for the walkthrough — no live business results are represented.</p>}
    {!live&&views.some(v=>v.view.recordedCount>0)&&<p className={styles.note}>No Actual Live is recorded for this initiative, so these values describe the product area it changes, not results of the initiative.</p>}
    <ul className={tiles.tiles} aria-label="Metric summary">{views.map(({metric,view})=><MetricTile key={metric.id} metric={metric} view={view} asOf={asOf}/>)}</ul>
   </section>
   {views.map(({metric,view})=><section key={metric.id} id={`metric-${metric.id}`} className={styles.metric} aria-labelledby={`metric-${metric.id}-name`}>
    <header className={styles.metricHead}>
     <div><h2 id={`metric-${metric.id}-name`}>{metric.name}</h2><p>{metric.unit} · {metric.periodGrain} · {metric.origin==="SYNTHETIC_DEMO"?"synthetic demo record":"recorded by a person"}</p></div>
     <div className={styles.metricLatest}>
      <MetricValue value={view.latest?view.latest.value:null} unit={metric.unit} size="hero" missingLabel={view.latest?"Not recorded":"No observations yet"}/>
      <span>{view.latest?`Latest period · ${periodLabel(view.latest.periodStart,view.latest.periodEnd)}`:"No period recorded yet"}</span>
      {view.captured&&<Freshness captured={view.captured} asOf={asOf}/>}
     </div>
    </header>
    <div className={styles.metricStatus}><TargetStatusMark status={view.status} withDetail/></div>
    <div className={styles.metricBody}>
     <TrendChart metric={metric} view={view} actualLive={live}/>
     {metric.origin==="HUMAN_ENTRY"&&<ObservationForm {...setup} metric={{id:metric.id,name:metric.name,unit:metric.unit,periodGrain:metric.periodGrain}} decision={decision}/>}
     <ObservationTable metric={metric} view={view}/>
     <MetricContract metric={metric} view={view} sourceHref={sourceHref(metric.sourceEvidenceId)} asOf={asOf}/>
    </div>
   </section>)}
  </>}
 </AnalysisFrame>;
}

/** m7: two honest lines and the way to add a metric; the six-item essay is now the form's own help text. */
function NotConfigured({live,setup,decision,actorLabel}:{live:boolean;setup:{slug:string;initiativeId:string;scopeWorkspaceId:string;evidence:{id:string;title:string}[]};decision:ReturnType<typeof metricSetupDecision>;actorLabel:string}){
 return <section className={styles.unconfigured} aria-labelledby="unconfigured-heading">
  <h2 id="unconfigured-heading">No business metrics are recorded for this initiative</h2>
  <p>Performance is shown only from recorded metric definitions and observations; a missing value is never shown as zero, and delivery dates are not performance.{!live&&" A metric can be defined before Actual Live so the first live period is measured against an approved target."} <HelpLink/></p>
  <DefineMetric {...setup} decision={decision} actorLabel={actorLabel}/>
 </section>;
}
