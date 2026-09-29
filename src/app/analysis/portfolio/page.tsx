import Link from "next/link";
import {formatDate,STAGE_LABEL} from "@/lib/domain/labels";
import {factDate} from "@/lib/delivery/display";
import {readRelationships} from "@/lib/data/relationships";
import {readManagement} from "@/lib/data/management-read";
import {readDelivery} from "@/lib/delivery/repository";
import {buildPortfolioProjection,filterPortfolioRows} from "@/lib/workspace/portfolio";
import {STAGES} from "@/lib/domain/types";
import {dayDifference} from "@/lib/delivery/model";
import {safeUserLabel} from "@/lib/demo/presentation";
import {displayDate} from "@/lib/delivery/roadmap";
import {listProjectMetrics} from "@/lib/analysis/metrics";
import {metricCoverage} from "@/lib/analysis/metric-view";
import {AnalysisFrame,styles} from "@/components/analysis/AnalysisFrame";
import {CoverageBar,Freshness} from "@/components/analysis/MetricParts";
import {DataTable} from "@/components/admin/AdminUI";
import {StatStrip,type StatTone} from "@/components/workspace/StatStrip";
import { cairoDay } from "@/lib/delivery/model";
export const metadata={title:"Portfolio Analysis"};

const REASONS=[["decision","Decision needed"],["blocker","Recorded blocker"],["past-target","Past target · update needed"],["past-milestone","Past milestone · update needed"],["dependency","Dependency date impact"],["support-changed","Supporting evidence changed"]] as const;

export default async function PortfolioAnalysis(){
 const [{ctx,source,state,presentation},management,relationships,metrics]=await Promise.all([readDelivery(),readManagement(),readRelationships(),listProjectMetrics()]);
 const asOf=presentation.scenarioAt??new Date().toISOString();
 // The same shared projection as Home, Initiatives and Roadmap: counts are never recomputed here.
 const p=buildPortfolioProjection({source,state,workspaceId:ctx.workspaceId,asOf,management,relationships:relationships.relationships});
 const active=filterPortfolioRows(p.rows,{},p.today);
 const counts:[string,number,string,string,StatTone][]=[
  ["Initiatives",p.summary.total,"","Active records in this workspace","neutral"],
  ["Need attention",p.summary.attentionInitiatives,"attention=any","With at least one recorded reason","attention"],
  ["Setup incomplete",p.summary.setupIncomplete,"setup=incomplete","One or more setup requirements unrecorded","neutral"],
  ["Targets in 28 days",p.summary.upcomingTargets,"target=upcoming","Target Live today through day 28","schedule"],
  ["No Target Live",p.summary.unknownTargets,"target=unknown","Planned date not recorded","unknown"],
  ["Target revised",filterPortfolioRows(p.rows,{target:"moved"},p.today).length,"target=moved","Target Live moved in the last 28 days","schedule"],
 ];
 const upcoming=filterPortfolioRows(p.rows,{target:"upcoming",sort:"target"},p.today);
 const allowed=new Map(p.rows.map(r=>[r.initiative.id,r.initiative]));
 const revisions=state.events.filter(e=>e.workspaceId===ctx.workspaceId&&allowed.has(e.initiativeId)&&e.after.kind==="TARGET_LIVE"&&e.before?.state==="SET"&&e.after.state==="SET"&&e.before.value.date&&e.after.value.date&&e.before.value.date!==e.after.value.date&&dayDifference(cairoDay(e.occurredAt),p.today)<=28).sort((a,b)=>b.occurredAt.localeCompare(a.occurredAt));
 const stages=STAGES.map(stage=>({stage,count:active.filter(r=>r.initiative.stage===stage).length}));
 const reasons=REASONS.map(([key,label])=>({key,label,count:filterPortfolioRows(p.rows,{attention:key},p.today).length}));
 const maxReason=Math.max(1,...reasons.map(r=>r.count));
 const coverageRows=active.map(r=>{const own=metrics.filter(m=>m.initiativeId===r.initiative.id);return {row:r,coverage:metricCoverage(own)};}).sort((a,b)=>Number(b.coverage.configured>0)-Number(a.coverage.configured>0)||a.row.initiative.name.localeCompare(b.row.initiative.name));
 const configured=coverageRows.filter(c=>c.coverage.configured>0).length;
 const synthetic=metrics.some(m=>m.origin==="SYNTHETIC_DEMO");
 return <AnalysisFrame active="portfolio" title="Portfolio Analysis" organizationName={presentation.organizationName} asOf={asOf} synthetic={presentation.isDemo}>
  <StatStrip label="Portfolio summary" dense items={counts.map(([label,count,filter,hint,tone])=>({key:label,value:count,label,hint,tone,href:"/initiatives"+(filter?"?"+filter:"")}))}/>
  <div className={styles.split}>
   <section className={styles.panel} aria-labelledby="lifecycle-heading">
    <div className={styles.sectionHead}><h2 id="lifecycle-heading">Lifecycle distribution</h2><span className={styles.count}>{p.summary.total} initiatives</span></div>
    <div className={styles.stack} role="img" aria-label={stages.filter(s=>s.count).map(s=>`${STAGE_LABEL[s.stage]} ${s.count}`).join(", ")}>{stages.filter(s=>s.count).map(s=><span key={s.stage} data-stage={s.stage} style={{flexGrow:s.count}} title={`${STAGE_LABEL[s.stage]}: ${s.count}`}/>)}</div>
    <ol className={styles.stageLegend}>{stages.map(s=><li key={s.stage} data-empty={s.count===0||undefined}><Link prefetch={false} href={"/initiatives?stage="+s.stage}><i data-stage={s.stage} aria-hidden="true"/><span>{STAGE_LABEL[s.stage]}</span><b>{s.count}</b></Link></li>)}</ol>
    <p className={styles.meta}>Recorded stage only. Position in the lifecycle does not establish readiness or business success.</p>
   </section>
   <section className={styles.panel} aria-labelledby="attention-heading">
    <div className={styles.sectionHead}><h2 id="attention-heading">Attention by recorded reason</h2><Link prefetch={false} href="/initiatives?attention=any">{p.summary.attentionInitiatives} {p.summary.attentionInitiatives===1?"initiative":"initiatives"} →</Link></div>
    <ul className={styles.reasons}>{reasons.map(r=><li key={r.key} data-empty={r.count===0||undefined}><Link prefetch={false} href={"/initiatives?attention="+r.key}><span>{r.label}</span><span className={styles.reasonBar} aria-hidden="true"><i style={{width:`${(r.count/maxReason)*100}%`}}/></span><b>{r.count}</b></Link></li>)}</ul>
    <p className={styles.meta}>Counts are initiatives; one initiative can have several reasons. A missing Actual Live asks for an update — it does not establish a missed launch.</p>
   </section>
  </div>
  <section className={styles.section} aria-labelledby="upcoming-heading">
   <div className={styles.sectionHead}><h2 id="upcoming-heading">Upcoming Target Live</h2><span className={styles.count}>Today through the next 28 days</span></div>
   <DataTable caption="Upcoming confirmed Target Live dates" columns={["Initiative","Stage","Target Live","In","Owner"]} rows={upcoming.map(r=>({key:r.initiative.id,cells:[<Link prefetch={false} key="name" href={"/initiatives/"+r.initiative.slug}>{r.initiative.name}</Link>,STAGE_LABEL[r.initiative.stage],factDate(r.target),r.target?.value.date?(()=>{const d=dayDifference(p.today,r.target!.value.date!);return d===0?"Today":`${d} ${d===1?"day":"days"}`;})():"—",r.ownerLabel]}))} empty="No confirmed Target Live dates in the next 28 days."/>
  </section>
  <section className={styles.section} aria-labelledby="coverage-heading">
   <div className={styles.sectionHead}><h2 id="coverage-heading">Business metrics coverage</h2><span className={styles.count}>{configured} of {active.length} initiatives measured</span></div>
   {configured>0&&<p className={styles.lead}>Status is each metric’s latest recorded period against its approved target. An unrecorded period is not assessed, and a metric without an approved target is never counted as missed.{synthetic&&" Metric values in this workspace are synthetic demo records."}</p>}
   {configured===0?<p className={styles.emptyLine}>No business metrics are recorded for any initiative yet. A metric is defined on an initiative’s analysis page; nothing is shown as zero in the meantime. <Link prefetch={false} href="/analysis/projects">Open Initiative Analysis →</Link></p>:
   <DataTable caption="Business metrics coverage by initiative" columns={["Initiative","Stage","Metrics","Latest vs target","Last captured"]} rows={coverageRows.map(({row,coverage})=>({key:row.initiative.id,cells:[
    <Link prefetch={false} key="name" href={`/analysis/projects/${row.initiative.slug}?back=${encodeURIComponent("/analysis/portfolio")}`} className={styles.wrapName}>{row.initiative.name}</Link>,
    STAGE_LABEL[row.initiative.stage],
    coverage.configured?`${coverage.configured} configured`:<span key="none" className={styles.muted}>Not configured</span>,
    coverage.configured?<CoverageBar key="marks" coverage={coverage}/>:<span key="none" className={styles.muted}>No metric definitions recorded</span>,
    <Freshness key="fresh" captured={coverage.lastCaptured} asOf={asOf} configured={coverage.configured>0} compact/>,
   ]}))} empty="No active initiatives are recorded."/>}
  </section>
  <section className={styles.section} aria-labelledby="revisions-heading">
   <div className={styles.sectionHead}><h2 id="revisions-heading">Target Live revisions</h2><span className={styles.count}>Recorded in the past 28 days</span></div>
   <DataTable caption="Recorded Target Live revisions" columns={["Initiative","Previous → current","Movement","Recorded by","Recorded on"]} rows={revisions.map(e=>({key:e.id,cells:[<Link prefetch={false} key="name" href={"/initiatives/"+allowed.get(e.initiativeId)!.slug+"/delivery"}>{allowed.get(e.initiativeId)!.name}</Link>,displayDate(e.before!.value.date)+" → "+factDate(e.after),(dayDifference(e.before!.value.date!,e.after.value.date!)>0?"+":"")+dayDifference(e.before!.value.date!,e.after.value.date!)+" days",safeUserLabel({preparedAsFixture:e.after.preparedAsFixture,confirmedByLabel:e.actor.label}),formatDate(e.occurredAt)]}))} empty="No known-to-known Target Live revisions recorded in this window."/>
  </section>
  <details className={styles.definitions}><summary>How these counts are calculated</summary><dl>
   <div><dt>Scope</dt><dd>Active initiative records in the current workspace; archived records are excluded. No health status is inferred.</dd></div>
   <div><dt>Targets</dt><dd>Current human-confirmed planned dates. Unknown dates are counted separately. Upcoming uses today through day 28 inclusive; revisions use recorded changes in the last 28 days.</dd></div>
   <div><dt>Attention and setup</dt><dd>The same shared calculation as Home and the initiative register. Each count opens the register with that filter.</dd></div>
   <div><dt>Metrics</dt><dd>Only recorded metric definitions and observations. Missing observations are not zero, and delivery dates are not performance measures.</dd></div>
  </dl></details>
 </AnalysisFrame>;
}
