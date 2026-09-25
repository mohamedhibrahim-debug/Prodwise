"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { DecisionLaneKey } from "@/lib/workspace/decision-lanes";
import styles from "./DecisionWorkbench.module.css";

export interface WorkbenchLane {
  key: DecisionLaneKey;
  title: string;
  description: string;
  items: { id: string; title: string; value: string; body: ReactNode }[];
  empty: ReactNode;
}

/** Presentation only: server-rendered records and existing action forms remain intact. */
export function DecisionWorkbench({ lanes, initialItem, children }: {
  lanes: WorkbenchLane[]; initialItem?: string; children: ReactNode;
}) {
  const [selection, setSelection] = useState<{ lane: DecisionLaneKey; id?: string } | null>(null);
  const requested = selection?.id ?? initialItem;
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
    <nav className={styles.queue} aria-label="Decision lanes">
      <p className={styles.label}>Decision queue</p>
      {lanes.map(lane => <div key={lane.key}>
        <button type="button" className={styles.lane} aria-current={current.key === lane.key ? "true" : undefined}
          aria-controls={`lane-${lane.key}`} onClick={() => setSelection({ lane: lane.key, id: lane.items[0]?.id })}>
          <strong>{lane.title}</strong><b>{lane.key === "not-checked" ? "—" : lane.items.length}</b><span>{lane.description}</span>
        </button>
        {current.key === lane.key && lane.items.length > 1 ? <ul className={styles.items}>{lane.items.map(item => <li key={item.id}>
          <button type="button" aria-pressed={activeId === item.id} onClick={() => {
            setSelection({ lane: lane.key, id: item.id });
            requestAnimationFrame(() => document.getElementById(`item-${item.id}`)?.focus());
          }}><strong>{item.title}</strong><span>{item.value}</span></button>
        </li>)}</ul> : null}
      </div>)}
      {children}
    </nav>
    <div className={styles.panes}>
      {lanes.map(lane => <section id={`lane-${lane.key}`} key={lane.key} hidden={current.key !== lane.key} aria-label={lane.title}>
        <div className={styles.heading}><h2>{lane.title}</h2><p>{lane.description}</p></div>
        {lane.items.length ? lane.items.map(item => <div key={item.id} hidden={activeId !== item.id}><ul>{item.body}</ul></div>) : <div className={styles.empty}>{lane.empty}</div>}
      </section>)}
    </div>
  </div>;
}
