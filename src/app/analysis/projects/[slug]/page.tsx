import Link from "next/link";
import {notFound} from "next/navigation";
import {readDelivery} from "@/lib/delivery/repository";
import {factFor} from "@/lib/delivery/model";
import {factDate} from "@/lib/delivery/display";
import {listProjectMetrics} from "@/lib/analysis/metrics";
import {metricCoverage,metricView,periodLabel} from "@/lib/analysis/metric-view";
import {STAGE_LABEL,formatDate} from "@/lib/domain/labels";
import {BusinessLine} from "@/components/primitives/BusinessLine";
import {AnalysisFrame,styles} from "@/components/analysis/AnalysisFrame";
import {MetricContract,MetricTile,MetricValue,ObservationTable,TargetStatusMark,TrendChart} from "@/components/analysis/MetricParts";
import tiles from "@/components/analysis/metrics.module.css";
import {safeProjectBack} from "../../metric-model";

export async function generateMetadata({params}:{params:Promise<{slug:string}>}){const {slug}=await params;const {source}=await readDelivery();const initiative=source.snapshots.find(s=>s.initiative.slug===slug)?.initiative;return {title:initiative?"Analysis · "+initiative.name:"Initiative measurement"};}

/** What a metric must record before Prodwise shows it. Mirrors the metric_definitions contract. */
const REQUIREMENTS=[
  ["Definition","What is measured and for which population — for example, accepted card transactions at onboarded merchants."],
  ["Source","The dataset or report the values come from, ideally linked to an evidence record on this initiative."],
  ["Period","The reporting grain (daily, weekly, monthly) and the timezone the periods close in."],
  ["Formula","A reproducible calculation, including exclusions — so two people get the same number."],
  ["Target","An approved target with its comparator (at least, at most), or an explicit statement that none is set."],
  ["Owner · approval","Who approved the target and when. An unapproved target is never compared."],
] as const;

export default async function ProjectDetail({params,searchParams}:{params:Promise<{slug:string}>;searchParams:Promise<{back?:string}>}){
 const [{slug},query,{source,state,ctx,presentation}]=await Promise.all([params,searchParams,readDelivery()]);
 const snapshot=source.snapshots.find(s=>s.initiative.slug===slug);if(!snapshot)notFound();
 const initiative=snapshot.initiative,metrics=await listProjectMetrics(initiative.id),asOf=presentation.scenarioAt??new Date().toISOString();
 const facts=state.facts.filter(f=>f.workspaceId===ctx.workspaceId);
 const actual=factFor(facts,initiative.id,"ACTUAL_LIVE"),target=factFor(facts,initiative.id,"TARGET_LIVE");
 const views=metrics.map(metric=>({metric,view:metricView(metric)}));
 const coverage=metricCoverage(metrics);
 const sourceHref=(id:string|null)=>id&&snapshot.evidence.some(e=>e.id===id)?`/initiatives/${slug}/sources#source-${id}`:null;
 const live=actual?.value.date??null;
 return <AnalysisFrame active="projects" title={initiative.name} organizationName={presentation.organizationName} asOf={asOf} synthetic={presentation.isDemo} subtitle="Business performance from recorded metrics and their contracts.">
  <nav className={styles.crumbs} aria-label="Initiative analysis navigation"><Link prefetch={false} href={safeProjectBack(query.back)}>← All initiatives</Link><Link prefetch={false} href={`/initiatives/${slug}`}>Open initiative Brief →</Link></nav>
  <dl className={styles.facts}>
   <div><dt>Stage</dt><dd>{STAGE_LABEL[initiative.stage]}</dd></div>
   <div><dt>Business line</dt><dd><BusinessLine code={initiative.businessLine}/></dd></div>
   <div><dt>Actual Live</dt><dd>{factDate(actual)}{actual?.value.extent&&<span className={styles.factNote}>{actual.value.extent==="FULL"?"Full scope":"Partial scope"}</span>}</dd></div>
   <div><dt>Target Live</dt><dd>{factDate(target)}</dd></div>
   <div><dt>Metrics</dt><dd>{metrics.length?`${metrics.length} configured`:"None configured"}{coverage.lastCaptured&&<span className={styles.factNote}>Last captured {formatDate(coverage.lastCaptured)}</span>}</dd></div>
  </dl>
  {!metrics.length?<NotConfigured live={Boolean(live)}/>:<>
   <section className={styles.section} aria-labelledby="kpi-heading">
    <div className={styles.sectionHead}><h2 id="kpi-heading">Latest period</h2><p className={styles.summaryLine}>{[coverage.met&&`${coverage.met} meeting target`,coverage.notMet&&`${coverage.notMet} below target`,coverage.notAssessed&&`${coverage.notAssessed} not assessed`,coverage.noTarget&&`${coverage.noTarget} without an approved target`].filter(Boolean).join(" · ")}</p></div>
    {coverage.synthetic&&<p className={styles.synthetic}><strong>Synthetic demo measurements.</strong> Fictional values prepared for the walkthrough — no live business results are represented.</p>}
    {!live&&views.some(v=>v.view.recordedCount>0)&&<p className={styles.note}>No Actual Live is recorded for this initiative, so these values describe the product area it changes, not results of the initiative.</p>}
    <ul className={tiles.tiles} aria-label="Metric summary">{views.map(({metric,view})=><MetricTile key={metric.id} metric={metric} view={view}/>)}</ul>
   </section>
   {views.map(({metric,view})=><section key={metric.id} id={`metric-${metric.id}`} className={styles.metric} aria-labelledby={`metric-${metric.id}-name`}>
    <header className={styles.metricHead}>
     <div><h2 id={`metric-${metric.id}-name`}>{metric.name}</h2><p>{metric.unit} · {metric.periodGrain}</p></div>
     <div className={styles.metricLatest}>
      <MetricValue value={view.latest?view.latest.value:null} unit={metric.unit} size="hero" missingLabel={view.latest?"Not recorded":"No observations yet"}/>
      <span>{view.latest?`Latest period · ${periodLabel(view.latest.periodStart,view.latest.periodEnd)}`:"No period recorded yet"}</span>
     </div>
    </header>
    <div className={styles.metricStatus}><TargetStatusMark status={view.status} withDetail/></div>
    <div className={styles.metricBody}>
     <div className={styles.metricTrend}><TrendChart metric={metric} view={view} actualLive={live}/><ObservationTable metric={metric} view={view}/></div>
     <MetricContract metric={metric} view={view} sourceHref={sourceHref(metric.sourceEvidenceId)}/>
    </div>
   </section>)}
  </>}
 </AnalysisFrame>;
}

function NotConfigured({live}:{live:boolean}){
 return <section className={styles.unconfigured} aria-labelledby="unconfigured-heading">
  <div className={styles.unconfiguredIntro}>
   <p className={styles.kicker}>Business metrics</p>
   <h2 id="unconfigured-heading">No business metrics are configured for this initiative</h2>
   <p>Prodwise shows performance only from recorded metric definitions and their observations. Until one is recorded this page stays empty — a missing value is never shown as zero, and delivery dates are not performance.</p>
   {!live&&<p>No Actual Live is recorded yet. A metric can still be defined now so the first live period is measured against an approved target.</p>}
   <h3>Who can add one</h3>
   <p>Metric definitions and observations are recorded for your organization by its Prodwise operator; there is no in-product editor yet. Send them the six items listed here, and name the evidence record that holds the source.</p>
  </div>
  <div className={styles.requirements}>
   <h3>A metric needs</h3>
   <ol>{REQUIREMENTS.map(([label,text],index)=><li key={label}><span className={styles.reqIndex} aria-hidden="true">{String(index+1).padStart(2,"0")}</span><div><strong>{label}</strong><p>{text}</p></div></li>)}</ol>
  </div>
 </section>;
}
