import Link from "next/link";
import {BusinessLine} from "@/components/primitives/BusinessLine";
import {Button,ButtonLink} from "@/components/primitives/Button";
import {readDelivery} from "@/lib/delivery/repository";
import {listProjectMetrics} from "@/lib/analysis/metrics";
import {metricCoverage} from "@/lib/analysis/metric-view";
import {STAGE_LABEL,businessLineText,formatDate} from "@/lib/domain/labels";
import {AnalysisFrame,styles} from "@/components/analysis/AnalysisFrame";
import {CoverageMarks} from "@/components/analysis/MetricParts";
import {DataTable} from "@/components/admin/AdminUI";
export const metadata={title:"Initiative Analysis"};
export default async function Projects({searchParams}:{searchParams:Promise<{line?:string;stage?:string;measurement?:string}>}){
 const [data,metrics,query]=await Promise.all([readDelivery(),listProjectMetrics(),searchParams]);
 const {source,presentation}=data,asOf=presentation.scenarioAt??new Date().toISOString();
 // Archived initiatives are history: excluded here exactly as the initiative register excludes them by default.
 const all=source.snapshots.map(s=>s.initiative).filter(i=>!i.archivedAt);
 const coverageFor=new Map(all.map(i=>[i.id,metricCoverage(metrics.filter(m=>m.initiativeId===i.id))]));
 const configured=all.filter(i=>coverageFor.get(i.id)!.configured>0);
 const rows=all.filter(i=>(!query.line||i.businessLine===query.line)&&(!query.stage||i.stage===query.stage)&&(!query.measurement||(query.measurement==="configured"?coverageFor.get(i.id)!.configured>0:coverageFor.get(i.id)!.configured===0)))
  .sort((a,b)=>Number(coverageFor.get(b.id)!.configured>0)-Number(coverageFor.get(a.id)!.configured>0)||a.name.localeCompare(b.name));
 const qs=new URLSearchParams(Object.entries(query).filter(([,v])=>v) as [string,string][]).toString();const back="/analysis/projects"+(qs?"?"+qs:"");
 const synthetic=metrics.some(m=>m.origin==="SYNTHETIC_DEMO");
 return <AnalysisFrame active="projects" title="Initiative Analysis" subtitle="Business metrics by initiative: latest period, target and freshness." organizationName={presentation.organizationName} asOf={asOf} synthetic={presentation.isDemo}>
  <div className={styles.sectionHead}><h2>Measurement coverage</h2><span className={styles.count}>{configured.length} of {all.length} initiatives have metrics configured{synthetic&&" · synthetic demo records"}</span></div>
  <form className={styles.filters} aria-label="Filter initiative analysis">
   <label>Business line<select name="line" defaultValue={query.line??""}><option value="">All lines</option>{[...new Set(all.map(i=>i.businessLine))].map(v=><option value={v} key={v}>{businessLineText(v)}</option>)}</select></label>
   <label>Stage<select name="stage" defaultValue={query.stage??""}><option value="">All stages</option>{[...new Set(all.map(i=>i.stage))].map(v=><option value={v} key={v}>{STAGE_LABEL[v]}</option>)}</select></label>
   <label>Measurement<select name="measurement" defaultValue={query.measurement??""}><option value="">All initiatives</option><option value="configured">Configured</option><option value="missing">Not configured</option></select></label>
   <span className={styles.filterActions}><Button type="submit">Apply</Button>{qs&&<ButtonLink variant="ghost" href="/analysis/projects">Clear</ButtonLink>}</span>
  </form>
  <DataTable caption="Initiative measurement coverage" columns={["Initiative","Business line","Stage","Metrics","Latest vs target","Last captured"]} rows={rows.map(i=>{const c=coverageFor.get(i.id)!;return {key:i.id,cells:[
   <Link prefetch={false} key="open" href={"/analysis/projects/"+i.slug+"?back="+encodeURIComponent(back)}>{i.name}</Link>,
   <BusinessLine key="bl" code={i.businessLine}/>,
   STAGE_LABEL[i.stage],
   c.configured?`${c.configured} configured`:<span key="none" className={styles.muted}>Not configured</span>,
   c.configured?<CoverageMarks key="marks" coverage={c}/>:<span key="none" className={styles.muted}>No metric definitions recorded</span>,
   c.lastCaptured?formatDate(c.lastCaptured):c.configured?"No observations yet":"—",
  ]};})} empty="No initiatives match these filters. Change or clear the filters."/>
 </AnalysisFrame>;
}
