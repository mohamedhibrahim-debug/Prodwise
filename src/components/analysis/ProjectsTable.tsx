"use client";
import Link from "next/link";
import { useMemo, type ReactNode } from "react";
import { DataTable } from "@/components/admin/AdminUI";
import { FilterBar, type FilterFacet } from "@/components/workspace/FilterBar";
import { useListState } from "@/components/workspace/useListState";
import { applyListFilters, facetCounts, serializeListState, type FacetAccessors, type ListFilterState } from "@/lib/workspace/list-filter";
import styles from "./analysis.module.css";

export interface ProjectRow {
  id: string; slug: string; name: string;
  line: string; stage: string; measurement: "configured" | "missing";
  /** Every cell after the initiative name, rendered by the server. */
  cells: ReactNode[];
}
const PROJECT_FACETS = ["line", "stage", "measurement"] as const;
const accessors: FacetAccessors<ProjectRow> = { line: r => [r.line], stage: r => [r.stage], measurement: r => [r.measurement] };
const searchText = (r: ProjectRow) => r.name;
const MEASUREMENT = [{ value: "configured", label: "Metrics configured" }, { value: "missing", label: "Not configured" }];

/**
 * Initiative Analysis filters in the register's grammar: instant chips over
 * rows the server already rendered, mirrored into the URL, no Apply step.
 */
export function ProjectsTable({ rows, initial, lines, stages }: {
  rows: ProjectRow[]; initial: ListFilterState;
  lines: { value: string; label: string }[];
  /** Lifecycle order. */
  stages: { value: string; label: string }[];
}) {
  const [state, setState] = useListState(initial, PROJECT_FACETS);
  const visible = useMemo(() => applyListFilters(rows, state, accessors, searchText), [rows, state]);
  const counts = (facet: string) => facetCounts(rows, state, accessors, searchText, facet);
  const facets: FilterFacet[] = [
    ...(lines.length > 1 ? [{ key: "line", label: "Business line", options: lines, counts: counts("line") }] : []),
    { key: "stage", label: "Stage", options: stages, counts: counts("stage") },
    { key: "measurement", label: "Measurement", options: MEASUREMENT, counts: counts("measurement"), single: true },
  ];
  const qs = serializeListState(state, PROJECT_FACETS);
  const back = "/analysis/projects" + (qs ? "?" + qs : "");
  return <>
    <FilterBar state={state} onChange={setState} facets={facets} searchLabel="Filter initiative analysis" searchPlaceholder="Search initiative"
      result={`${visible.length} of ${rows.length} ${rows.length === 1 ? "initiative" : "initiatives"}`} />
    <DataTable caption="Initiative measurement coverage" columns={["Initiative", "Business line", "Stage", "Metrics", "Latest vs target", "Last captured"]}
      rows={visible.map(r => ({ key: r.id, cells: [<Link prefetch={false} key="open" href={"/analysis/projects/" + r.slug + "?back=" + encodeURIComponent(back)} className={styles.wrapName}>{r.name}</Link>, ...r.cells] }))}
      empty="No initiatives match these filters. Change or clear the filters." />
  </>;
}
