import {BusinessLine} from "@/components/primitives/BusinessLine";
import {ProjectsTable} from "@/components/analysis/ProjectsTable";
import {parseListState} from "@/lib/workspace/list-filter";
import {STAGES} from "@/lib/domain/types";
import {readDelivery} from "@/lib/delivery/repository";
import {listProjectMetrics} from "@/lib/analysis/metrics";
import {metricCoverage} from "@/lib/analysis/metric-view";
import {STAGE_LABEL,businessLineText} from "@/lib/domain/labels";
import {AnalysisFrame,styles} from "@/components/analysis/AnalysisFrame";
import {CoverageBar,Freshness} from "@/components/analysis/MetricParts";
export const metadata={title:"Initiative Analysis"};
export default async function Projects({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const [data,metrics,query]=await Promise.all([readDelivery(),listProjectMetrics(),searchParams]);
 const {source,presentation}=data,asOf=presentation.scenarioAt??new Date().toISOString();
 // Archived initiatives are history: excluded here exactly as the initiative register excludes them by default.
 const all=source.snapshots.map(s=>s.initiative).filter(i=>!i.archivedAt);
 const coverageFor=new Map(all.map(i=>[i.id,metricCoverage(metrics.filter(m=>m.initiativeId===i.id))]));
 const configured=all.filter(i=>coverageFor.get(i.id)!.configured>0);
 all.sort((a,b)=>Number(coverageFor.get(b.id)!.configured>0)-Number(coverageFor.get(a.id)!.configured>0)||a.name.localeCompare(b.name));
 // Filters apply instantly in the browser, in the register's grammar; Stage options follow the lifecycle.
 const lines=[...new Set(all.map(i=>i.businessLine))].sort().map(v=>({value:v,label:businessLineText(v)}));
 const stages=STAGES.filter(s=>all.some(i=>i.stage===s)).map(s=>({value:s,label:STAGE_LABEL[s]}));
 const synthetic=metrics.some(m=>m.origin==="SYNTHETIC_DEMO");
 return <AnalysisFrame active="projects" title="Initiative Analysis" organizationName={presentation.organizationName} asOf={asOf} synthetic={presentation.isDemo}>
  <div className={styles.sectionHead}><h2>Measurement coverage</h2><span className={styles.count}>{configured.length} of {all.length} initiatives have metrics configured{synthetic&&" · synthetic demo records"}</span></div>
  <ProjectsTable initial={parseListState(query,["line","stage","measurement"])} lines={lines} stages={stages} rows={all.map(i=>{const c=coverageFor.get(i.id)!;return {id:i.id,slug:i.slug,name:i.name,line:i.businessLine,stage:i.stage,measurement:c.configured>0?"configured":"missing",cells:[
   <BusinessLine key="bl" code={i.businessLine}/>,
   STAGE_LABEL[i.stage],
   c.configured?`${c.configured} configured`:<span key="none" className={styles.muted}>Not configured</span>,
   c.configured?<CoverageBar key="marks" coverage={c}/>:<span key="none" className={styles.muted}>No metric definitions recorded</span>,
   <Freshness key="fresh" captured={c.lastCaptured} asOf={asOf} configured={c.configured>0} compact/>,
  ]};})}/>
 </AnalysisFrame>;
}
