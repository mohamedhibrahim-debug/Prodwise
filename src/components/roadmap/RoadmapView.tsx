"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/primitives/Button";
import { DateChip, FilterBar, type FilterFacet } from "@/components/workspace/FilterBar";
import { formatDate } from "@/lib/domain/labels";
import type { ListFilterState } from "@/lib/workspace/list-filter";
import { applyFilters, filtersToQuery, hasDependencyImpact, groupItems, type RoadmapFilters, type RoadmapItem, type RoadmapView as ViewKey } from "@/lib/workspace/roadmap-layout";
import { RoadmapTimeline } from "./RoadmapTimeline";
import { RoadmapDetails } from "./RoadmapDetails";
import styles from "./RoadmapView.module.css";

interface Option { value: string; label: string; }
interface Props {
  items: RoadmapItem[];
  lines: (Option & { short: string })[];
  owners: Option[];
  initial: RoadmapFilters;
  cutoff: string;
  explicitCutoff: string | null;
  cutoffLabel: string;
  reference: { date: string; label: string };
  note: string;
}

const VIEWS: { value: ViewKey; label: string; count: (items: RoadmapItem[]) => number }[] = [
  { value: "", label: "All initiatives", count: i => i.length },
  { value: "attention", label: "Needs attention", count: i => i.filter(x => x.attention.length).length },
  { value: "moved", label: "Target changes", count: i => i.filter(x => x.movement).length },
  { value: "dependency", label: "Dependency date impact", count: i => i.filter(hasDependencyImpact).length },
  { value: "unknown", label: "No Target Live", count: i => i.filter(x => !x.target).length },
];

/**
 * Filters apply instantly over the server-provided rows and stay in the URL so
 * a filtered roadmap is a shareable link. Only the cutoff goes back to the
 * server, because attention and timing are computed as of that date.
 */
export function RoadmapView({ items, lines, owners, initial, cutoff, explicitCutoff, cutoffLabel, reference, note }: Props) {
  const [filters, setFilters] = useState<RoadmapFilters>(initial);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const update = (next: Partial<RoadmapFilters>) => {
    const merged = { ...filters, ...next };
    setFilters(merged);
    try { window.history.replaceState(null, "", `/roadmap${filtersToQuery(merged, explicitCutoff)}`); } catch { /* URL sync is a convenience */ }
  };
  const changeCutoff = (value: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value) && value !== "") return;
    startTransition(() => router.replace(`/roadmap${filtersToQuery(filters, value || null)}`, { scroll: false }));
  };

  const scoped = useMemo(() => applyFilters(items, { ...filters, view: "" }), [items, filters]);
  const visible = useMemo(() => applyFilters(items, filters), [items, filters]);
  const grouped = useMemo(() => groupItems(visible, filters.group), [visible, filters.group]);
  const filtered = Boolean(filters.businessLine || filters.owner || filters.view);
  // The register's filter grammar: single-choice chips over the same rows, counted given the other filters.
  const listState: ListFilterState = { q: "", sort: null, filters: { ...(filters.businessLine ? { businessLine: [filters.businessLine] } : {}), ...(filters.owner ? { owner: [filters.owner] } : {}) } };
  const countFor = (key: "businessLine" | "owner", value: string) => applyFilters(items, { ...filters, [key]: value }).length;
  const facets: FilterFacet[] = [
    ...(lines.length > 1 ? [{ key: "businessLine", label: "Business line", single: true, options: lines.map(l => ({ value: l.value, label: l.label })), counts: new Map(lines.map(l => [l.value, countFor("businessLine", l.value)])) }] : []),
    { key: "owner", label: "Owner", single: true, options: [...owners, { value: "unassigned", label: "Unassigned" }], counts: new Map([...owners.map(o => o.value), "unassigned"].map(v => [v, countFor("owner", v)])) },
  ];

  return <div className={styles.root}>
    <div className={styles.toolbar}>
      <div className={styles.views} role="group" aria-label="Show">
        {VIEWS.map(v => {
          const n = v.count(scoped);
          return <button key={v.value || "all"} type="button" className={styles.view} aria-pressed={filters.view === v.value} onClick={() => update({ view: v.value })}>
            {v.label}<span className={styles.count}>{n}</span>
          </button>;
        })}
      </div>
      <FilterBar state={listState} onChange={next => update({ businessLine: next.filters.businessLine?.[0] ?? "", owner: next.filters.owner?.[0] ?? "" })}
        facets={facets} search={false} searchLabel="Filter the roadmap" result={`${visible.length} of ${items.length} ${items.length === 1 ? "initiative" : "initiatives"}`}>
        <div className={styles.trailing}>
          <DateChip label={cutoffLabel} value={cutoff} display={formatDate(cutoff)} active={Boolean(explicitCutoff)}
            onChange={changeCutoff} onReset={() => changeCutoff("")} resetLabel={`Return to the ${reference.label.toLowerCase()}`} />
          <div className={styles.segment} role="group" aria-label="Group by">
            <button type="button" aria-pressed={filters.group === "businessLine"} onClick={() => update({ group: "businessLine" })}>By business line</button>
            <button type="button" aria-pressed={filters.group === "owner"} onClick={() => update({ group: "owner" })}>By owner</button>
          </div>
        </div>
      </FilterBar>
    </div>
    <p id="roadmap-cutoff-note" className={styles.note} aria-live="polite">{pending ? "Updating to the selected cutoff…" : note}</p>

    <section aria-labelledby="roadmap-timeline-title" className={styles.section} data-pending={pending || undefined}>
      <div className={styles.sectionHead}>
        <h2 id="roadmap-timeline-title">Timeline</h2>
        <p>{visible.length} {visible.length === 1 ? "initiative" : "initiatives"}{filtered ? " match these filters" : ""} · {grouped.unscheduled.length} without a Target Live</p>
      </div>
      {items.length === 0
        ? <div className={styles.empty}><h3>No initiatives recorded yet.</h3><p>Once an initiative has a confirmed Target Live, it appears here on the timeline.</p></div>
        : visible.length === 0
          ? <div className={styles.empty}><h3>No initiatives match these filters.</h3><Button type="button" variant="secondary" onClick={() => update({ businessLine: "", owner: "", view: "" })}>Clear filters</Button></div>
          : <RoadmapTimeline groups={grouped.groups} unscheduled={grouped.unscheduled} grouping={filters.group} cutoff={cutoff} cutoffLabel={cutoffLabel} reference={reference} />}
    </section>

    {visible.length > 0 && <section aria-labelledby="roadmap-details-title" className={styles.section}>
      <div className={styles.sectionHead}>
        <h2 id="roadmap-details-title">Details</h2>
        <p>The recorded facts behind every mark, per initiative.</p>
      </div>
      <RoadmapDetails groups={grouped.groups} unscheduled={grouped.unscheduled} grouping={filters.group} />
    </section>}
  </div>;
}
