import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";
import type { MetricObservation, ProjectMetric } from "./metric-types.ts";

/* LOCAL DEMO PERSISTENCE ONLY for metric definitions and observations:
   `.data/metrics-<workspaceId>.json`, the file `listProjectMetrics` reads under
   local auth. Whole-file replace through a temporary file, serialised per path in
   this process. Not distributed, not multi-instance safe; the hosted path is the
   `record_metric_*` database functions (migration 0045). */

export function localMetricsPath(root: string, workspaceId: string): string {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(workspaceId)) throw new Error("A verified workspace is required.");
  return `${root}/.data/metrics-${workspaceId}.json`;
}

export function readLocalMetrics(path: string): ProjectMetric[] {
  if (!existsSync(path)) return [];
  const data: unknown = JSON.parse(readFileSync(path, "utf8"));
  if (!Array.isArray(data)) throw new Error("Project metrics are unavailable.");
  return data as ProjectMetric[];
}

const queues = new Map<string, Promise<unknown>>();
/** Read, change and replace the file as one step; concurrent changes to the same file wait their turn. */
export function changeLocalMetrics<T>(path: string, change: (metrics: ProjectMetric[]) => T): Promise<T> {
  const run = async () => {
    const metrics = readLocalMetrics(path);
    const result = change(metrics);
    mkdirSync(dirname(path), { recursive: true });
    const temporary = `${path}.${randomUUID()}.tmp`;
    try { writeFileSync(temporary, JSON.stringify(metrics, null, 2), { flag: "wx", mode: 0o600 }); renameSync(temporary, path); }
    finally { if (existsSync(temporary)) rmSync(temporary); }
    return result;
  };
  const next = (queues.get(path) ?? Promise.resolve()).then(run, run);
  queues.set(path, next.catch(() => undefined));
  return next;
}

export function appendLocalMetric(path: string, metric: ProjectMetric): Promise<ProjectMetric> {
  return changeLocalMetrics(path, metrics => {
    if (metrics.some(m => m.id === metric.id)) throw new Error("This metric was already recorded.");
    metrics.push(metric); return metric;
  });
}

/** Adds one observation to a metric this person may extend; an existing period is refused, never overwritten. */
export function appendLocalObservation(path: string, metricId: string, workspaceId: string, observation: MetricObservation, at: string): Promise<MetricObservation> {
  return changeLocalMetrics(path, metrics => {
    const metric = metrics.find(m => m.id === metricId && m.workspaceId === workspaceId);
    if (!metric) throw new Error("This metric is no longer available. Reload and try again.");
    if (metric.origin !== "HUMAN_ENTRY") throw new Error("Synthetic demo metrics are read-only. Define a metric of your own to record observations.");
    if (metric.observations.some(o => o.periodStart === observation.periodStart && o.periodEnd === observation.periodEnd)) throw new Error("This period is already recorded. Choose a different period; recorded values are never overwritten.");
    metric.observations.push(observation);
    metric.observations.sort((a, b) => a.periodStart.localeCompare(b.periodStart));
    metric.updatedAt = at;
    return observation;
  });
}
