"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { DecisionLaneKey } from "@/lib/workspace/decision-lanes";
import { Segmented, TabToolbar } from "@/components/workspace/TabToolbar";
import styles from "./DecisionWorkbench.module.css";

export interface WorkbenchLane {
  key: DecisionLaneKey;
  title: string;
  description: string;
  items: { id: string; title: string; value: string; body: ReactNode }[];
  empty: ReactNode;
}

/**
 * Presentation only: server-rendered records and existing action forms remain
 * intact. The lanes are a segmented control in the tab toolbar; a lane with
 * several items shows a compact list beside the selected item.
 */
export function DecisionWorkbench({ lanes, initialItem, summary, actions }: {
  lanes: WorkbenchLane[]; initialItem?: string; summary?: ReactNode; actions?: ReactNode;
}) {
  const [selection, setSelection] = useState<{ lane: DecisionLaneKey; id?: string } | null>(null);
  const requested = selection ? selection.id : initialItem;
  const containing = requested ? lanes.find(lane => lane.items.some(item => item.id === requested)) : undefined;
  const current = containing ?? (selection && !selection.id ? lanes.find(lane => lane.key === selection.lane) : undefined)
    ?? lanes.find(lane => lane.items.length > 0) ?? lanes[0]!;
  const activeId = current.items.find(item => item.id === requested)?.id ?? current.items[0]?.id;

  useEffect(() => {
    const reveal = (event: Event) => {
      const id = (event as CustomEvent<string>).detail;
      const lane = lanes.find(candidate => candidate.items.some(item => item.id === id));
      if (lane) setSelection({ lane: lane.key, id });
    };
    const revealHash = () => {
      const lane = lanes.find(candidate => `#lane-${candidate.key}` === window.location.hash);
      if (lane) setSelection({ lane: lane.key, id: lane.items[0]?.id });
    };
    const frame = requestAnimationFrame(revealHash);
    window.addEventListener("prodwise:reveal-decision", reveal);
    window.addEventListener("hashchange", revealHash);
    return () => { cancelAnimationFrame(frame); window.removeEventListener("prodwise:reveal-decision", reveal); window.removeEventListener("hashchange", revealHash); };
  }, [lanes]);

  return <div className={styles.workbench}>
    <TabToolbar title="Decisions" summary={summary}
      controls={<Segmented label="Decision lanes" items={lanes.map(lane => ({ key: lane.key, label: lane.title, count: lane.items.length, current: current.key === lane.key, onSelect: () => setSelection({ lane: lane.key, id: lane.items[0]?.id }) }))} />}
      actions={actions} />
    {lanes.map(lane => <section id={`lane-${lane.key}`} key={lane.key} hidden={current.key !== lane.key} aria-label={lane.title}>
      <p className={styles.laneNote}>{lane.description}</p>
      {!lane.items.length ? <div className={styles.empty}>{lane.empty}</div>
        : <div className={lane.items.length > 1 ? styles.split : undefined}>
          {lane.items.length > 1 ? <ul className={styles.items} aria-label={`${lane.title} items`}>{lane.items.map(item => <li key={item.id}>
            <button type="button" aria-pressed={activeId === item.id} onClick={() => {
              setSelection({ lane: lane.key, id: item.id });
              requestAnimationFrame(() => document.getElementById(`item-${item.id}`)?.focus());
            }}><strong>{item.title}</strong><span>{item.value}</span></button>
          </li>)}</ul> : null}
          <div className={styles.detail}>{lane.items.map(item => <div key={item.id} hidden={activeId !== item.id}><ul className={styles.bodyList}>{item.body}</ul></div>)}</div>
        </div>}
    </section>)}
  </div>;
}
