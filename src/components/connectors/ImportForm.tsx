"use client";
import {useFormAction} from '@/components/forms/useFormAction';
import { ScopeField } from '@/components/auth/WorkspaceScope';
import Link from "next/link";
import { useState } from "react";
import type { ImportState } from "@/app/initiatives/[slug]/sources/import/actions";
import styles from "./connectors.module.css";

export interface ImportRow { reference: string; name: string; kind: string; url: string | null; detail: string; updated: string | null; imported: boolean; group?: string }
const ROLE_LABEL = { REQUIREMENTS: "Requirements source", DELIVERY: "Delivery source", DECISIONS: "Decisions source", GENERAL: "General reference" } as const;

/** Explicit multi-select. Selection survives a failed import; results link to each saved snapshot. */
export function ImportForm({ action, rows, slug, connector, label, defaultRole, site, figma }: { action: (s: ImportState, f: FormData) => Promise<ImportState>; rows: ImportRow[]; slug: string; connector: string; label: string; defaultRole: keyof typeof ROLE_LABEL; site?: string | null; figma?: boolean }) {
  const [state, formAction, pending, keepFormAction] = useFormAction(action, { error: null, outcomes: [] });
  const [selected, setSelected] = useState<string[]>([]);
  const toggle = (r: string) => setSelected(s => s.includes(r) ? s.filter(x => x !== r) : s.length >= 10 ? s : [...s, r]);
  const groups = [...new Set(rows.map(r => r.group ?? ""))];
  return <form action={formAction} onReset={keepFormAction} className={styles.importForm} aria-busy={pending}><ScopeField/>
    <input type="hidden" name="slug" value={slug} /><input type="hidden" name="connector" value={connector} />{site && <input type="hidden" name="site" value={site} />}
    {selected.map(r => <input key={r} type="hidden" name="ref" value={r} />)}
    {groups.map(g => <fieldset key={g} className={styles.results}><legend className={g ? styles.groupLegend : "visually-hidden"}>{g || `${label} results`}</legend>
      <ul>{rows.filter(r => (r.group ?? "") === g).map(r => <li key={r.reference} className={styles.result} data-selected={selected.includes(r.reference) || undefined}>
        <label><input type="checkbox" checked={selected.includes(r.reference)} onChange={() => toggle(r.reference)} disabled={pending || (!selected.includes(r.reference) && selected.length >= 10)} />
          <span className={styles.resultBody}><strong>{r.name}</strong><span className={styles.resultMeta}>{[r.kind, r.detail, r.updated ? `Updated ${r.updated}` : null].filter(Boolean).join(" · ")}</span>{r.imported && <span className={styles.imported}>Already a source here — importing again saves a snapshot only if it changed</span>}</span></label>
        {r.url && <a className={styles.open} href={r.url} target="_blank" rel="noreferrer" aria-label={`Open ${r.name} in ${label}`}>Open ↗</a>}
      </li>)}</ul></fieldset>)}
    <div className={styles.importBar}>
      <label className={styles.role}>What is this source for?<select name="role" defaultValue={defaultRole} disabled={pending}>{Object.entries(ROLE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
      {figma && <label className={styles.check}><input type="checkbox" name="includeComments" defaultChecked disabled={pending} /> Include open comments pinned in the selected frames</label>}
      <button className={styles.primary} disabled={pending || !selected.length}>{pending ? `Importing ${selected.length}…` : selected.length ? `Import ${selected.length} as evidence` : "Select items to import"}</button>
      <p className={styles.hint}>{selected.length}/10 selected. Imports save a snapshot as evidence. Nothing becomes Knowledge until someone confirms it.</p>
    </div>
    {state.error && <p role="alert" className={styles.error}>{state.error} Your selection is kept.</p>}
    {state.outcomes.length > 0 && <div role="status" className={styles.outcomes}><h3>Import results</h3><ul>{state.outcomes.map(o => <li key={o.reference} data-ok={o.ok || undefined}>
      {o.ok ? <>✓ <strong>{o.name}</strong> — {o.changed ? "saved as evidence." : o.message} {o.submissionId && <Link href={`/initiatives/${slug}/evidence/${o.submissionId}`}>Review the snapshot →</Link>}</> : <>✕ <strong>{o.reference}</strong> — {o.message}</>}
    </li>)}</ul></div>}
  </form>;
}
