import "server-only";
import { cache } from "react";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { requireWorkspaceAccess } from "@/lib/auth/access";
import { adminClient, isLocalAuth } from "@/lib/auth/service";
import type { ProjectMetric } from "./metric-types";
export type { ProjectMetric, MetricObservation } from "./metric-types";
/** Read-only, scoped observations. Missing data never receives a numeric default. */
export const listProjectMetrics=cache(async (initiativeId?:string):Promise<ProjectMetric[]>=>{
  const ctx=await requireWorkspaceAccess();
  if(isLocalAuth()) {
    try {
      const data=JSON.parse(await readFile(join(process.cwd(),".data",`metrics-${ctx.workspaceId}.json`),"utf8")) as ProjectMetric[];
      return data.filter(metric=>metric.workspaceId===ctx.workspaceId&&(!initiativeId||metric.initiativeId===initiativeId));
    } catch(error) { if((error as NodeJS.ErrnoException).code==="ENOENT")return [];throw new Error("Project metrics are unavailable."); }
  }
  let query=adminClient().from("metric_definitions").select("*,metric_observations(*)").eq("workspace_id",ctx.workspaceId).eq("organization_id",ctx.organizationId).order("name");
  if(initiativeId)query=query.eq("initiative_id",initiativeId);
  const {data,error}=await query;
  if(error)throw new Error("Project metrics are unavailable.");
  return data.map(row=>({
    id:row.id,workspaceId:row.workspace_id,initiativeId:row.initiative_id,name:row.name,definition:row.definition,unit:row.unit,formula:row.formula,
    sourceLabel:row.source_label,sourceEvidenceId:row.source_evidence_id,periodGrain:row.period_grain,timezone:row.timezone,
    targetValue:row.target_value===null?null:Number(row.target_value),targetComparator:row.target_comparator,targetOwnerLabel:row.target_owner_label,
    targetApprovedAt:row.target_approved_at,targetNote:row.target_note,origin:row.origin,revision:row.revision,updatedAt:row.updated_at,
    observations:(row.metric_observations as Record<string,unknown>[]).filter(o=>o.workspace_id===ctx.workspaceId).map(o=>({
      id:o.id as string,periodStart:o.period_start as string,periodEnd:o.period_end as string,value:o.value===null?null:Number(o.value),
      capturedAt:o.captured_at as string,sourceEvidenceId:o.source_evidence_id as string|null,note:o.note as string,origin:o.origin as "SYNTHETIC_DEMO"|"HUMAN_ENTRY",
    })).sort((a,b)=>a.periodStart.localeCompare(b.periodStart)),
  }));
});
