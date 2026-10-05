'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { PlanDate, RoadmapPlan } from '@/lib/executive/types';
import { Dialog } from './Dialog';
import styles from './Executive.module.css';

function DateField({ name, label, initial }: { name: string; label: string; initial: PlanDate | null }) {
  const [precision, setPrecision] = useState(initial?.precision ?? 'MONTH');
  const [value, setValue] = useState(initial?.value ?? '');
  return <label className={styles.field}>{label}<span className={styles.dateInput}><select name={name + 'Precision'} aria-label={label + ' precision'} value={precision} onChange={e => { setPrecision(e.target.value as PlanDate['precision']); setValue(''); }}><option value="DAY">Day</option><option value="MONTH">Month</option><option value="QUARTER">Quarter</option></select><input name={name} aria-label={label} type={precision === 'DAY' ? 'date' : precision === 'MONTH' ? 'month' : 'text'} placeholder="2027-Q1" value={value} onChange={e => setValue(e.target.value)} /></span></label>;
}
export function PlanEditor({ plan, workspaceId, close }: { plan: RoadmapPlan | null; workspaceId: string; close: () => void }) {
  const [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const router = useRouter();
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('');
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch('/api/executive/plan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...Object.fromEntries(form), id: plan?.id ?? '', initiativeId:plan?.initiativeId??null, revision: plan?.revision ?? 0, workspaceId }) });
      const result = await response.json(); if (!response.ok) throw Error(result.error ?? 'Could not save the plan.');
      router.refresh(); close();
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not save.'); } finally { setBusy(false); }
  }
  return <Dialog title={plan ? 'Edit plan' : 'Add planning initiative'} close={close}><form onSubmit={submit} className={styles.form}>
    <label className={`${styles.field} ${styles.full}`}>Initiative or release<input name="name" required maxLength={160} defaultValue={plan?.name} /></label>
    <label className={styles.field}>Lead squad<input name="squad" defaultValue={plan?.squad} maxLength={120} /></label>
    <label className={styles.field}>Workstream<input name="workstream" defaultValue={plan?.workstream} maxLength={120} /></label>
    <label className={styles.field}>Accountable owner<input name="owner" defaultValue={plan?.owner} maxLength={120} readOnly={!!plan?.initiativeId} /></label>
    <label className={styles.field}>Commitment<select name="status" defaultValue={plan?.status ?? 'PROPOSED'}><option value="PROPOSED">Proposed</option><option value="COMMITTED">Committed</option><option value="ON_HOLD">On hold</option></select></label>
    <label className={`${styles.field} ${styles.full}`}>Intended outcome<textarea name="outcome" defaultValue={plan?.outcome} maxLength={2000} /></label>
    <DateField name="start" label="Solution start" initial={plan?.start ?? null} />{plan?.initiativeId?<p className={styles.meta}>Target and Actual Live are maintained in the initiative delivery record.</p>:<DateField name="target" label="Target Live" initial={plan?.target ?? null} />}
    {!plan?.initiativeId&&<label className={styles.field}>Actual Live<input name="actual" type="date" defaultValue={plan?.actual ?? ''} /></label>}
    <label className={styles.field}>Forecast Live<input name="forecast" type="date" defaultValue={plan?.forecast ?? ''} /></label>
    <label className={`${styles.field} ${styles.full}`}>Delay or target-change reason<textarea name="delayReason" defaultValue={plan?.delayReason} maxLength={2000} /></label>
    <label className={styles.field}>Next action<input name="nextAction" defaultValue={plan?.nextAction} maxLength={1000} /></label>
    <label className={styles.field}>Next-action owner<input name="nextActionOwner" defaultValue={plan?.nextActionOwner} maxLength={120} /></label>
    <label className={`${styles.field} ${styles.full}`}>Source / approval note<textarea name="source" required defaultValue={plan?.source} maxLength={2000} /></label>
    <label className={styles.full}><input type="checkbox" name="carryover" defaultChecked={plan?.carryover} /> Carried over from a previous year</label>
    {error && <p role="alert" className={`${styles.error} ${styles.full}`}>{error}</p>}
    <div className={styles.actions}><button type="button" className={styles.button} onClick={close}>Cancel</button><button type="submit" className={styles.button} data-primary="true" disabled={busy}>{busy ? 'Saving...' : 'Save plan'}</button></div>
  </form></Dialog>;
}
