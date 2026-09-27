/** Supported observations are records, never dashboard defaults. */
export interface MetricObservation {
  id: string;
  periodStart: string;
  periodEnd: string;
  value: number | null;
  capturedAt: string;
  sourceEvidenceId: string | null;
  note: string;
  origin: "SYNTHETIC_DEMO" | "HUMAN_ENTRY";
}
export interface ProjectMetric {
  id: string;
  workspaceId: string;
  initiativeId: string;
  name: string;
  definition: string;
  unit: string;
  formula: string;
  sourceLabel: string;
  sourceEvidenceId: string | null;
  periodGrain: string;
  timezone: string;
  targetValue: number | null;
  targetComparator: "AT_MOST" | "AT_LEAST" | "EQUAL" | null;
  targetOwnerLabel: string | null;
  targetApprovedAt: string | null;
  targetNote: string | null;
  origin: "SYNTHETIC_DEMO" | "HUMAN_ENTRY";
  revision: number;
  updatedAt: string;
  observations: MetricObservation[];
}
