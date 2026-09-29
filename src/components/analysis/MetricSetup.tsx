"use client";
import { useId, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/primitives/Button";
import { DateField } from "@/components/forms/DateField";
import { useFormAction } from "@/components/forms/useFormAction";
import { announceSaved } from "@/components/forms/SavedNotice";
import { recordMetricDefinitionAction, recordMetricObservationAction, type MetricActionState } from "@/lib/analysis/metric-actions";
import { COMPARATOR_LABEL, DEFAULT_TIMEZONE, METRIC_COMPARATORS, PERIOD_GRAINS, parseDefinitionInput, parseObservationInput, type FieldErrors, type MetricDefinitionInput } from "@/lib/analysis/metric-input";
import type { MetricSetupDecision } from "@/lib/analysis/metric-authorization";
import { formatMetricValue } from "@/lib/analysis/metric-view";
import { formatDate, formatDateTime } from "@/lib/domain/labels";
import { openHelp } from "@/components/shell/events";
import styles from "./setup.module.css";

/* Metric setup in the product: define → review and confirm → record periods.
   The server actions decide who may do this; these forms only mirror that decision
   and keep what a person typed when a refusal comes back. */

export interface EvidenceOption { id: string; title: string }
interface Common { slug: string; initiativeId: string; scopeWorkspaceId: string; evidence: EvidenceOption[] }
const INITIAL: MetricActionState = { error: null, message: null };
const cairoToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
/** A datetime-local default: now, on the organization's clock. */
function cairoNowLocal() {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Cairo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date());
  const get = (type: string) => parts.find(p => p.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}
const formRecord = (form: HTMLFormElement) => Object.fromEntries([...new FormData(form).entries()].map(([k, v]) => [k, String(v)]));

function Field({ label, help, error, children, wide = false }: { label: string; help?: string; error?: string; children: ReactNode; wide?: boolean }) {
  const id = useId();
  return <div className={styles.field} data-wide={wide || undefined} data-invalid={error ? "" : undefined}>
    <label htmlFor={id}>{label}</label>
    <div className={styles.control}>{typeof children === "function" ? null : children}</div>
    {error ? <p className={styles.fieldError} role="alert">{error}</p> : help ? <p className={styles.help}>{help}</p> : null}
  </div>;
}

/** Opens the Help panel, which explains what a metric needs. */
export function HelpLink() { return <button type="button" className={styles.helpLink} onClick={() => openHelp()}>What a metric needs →</button>; }

/** "Define a metric": the primary action for people the server will accept; a quiet reason for everyone else. */
export function DefineMetric({ decision, actorLabel, ...common }: Common & { decision: MetricSetupDecision; actorLabel: string }) {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  if (!decision.allowed) return <p className={styles.denied}>{decision.message}</p>;
  return <div className={styles.define} data-open={open || undefined}>
    {!open && <Button variant="primary" onClick={() => { setOpen(true); setDone(null); }} aria-expanded={open}>Define a metric</Button>}
    {done && !open && <p className={styles.done} role="status">{done}</p>}
    {open && <DefinitionForm {...common} actorLabel={actorLabel} onClose={() => setOpen(false)} onDone={message => { setDone(message); setOpen(false); }} />}
  </div>;
}

function DefinitionForm({ slug, initiativeId, scopeWorkspaceId, evidence, actorLabel, onClose, onDone }: Common & { actorLabel: string; onClose: () => void; onDone: (message: string) => void }) {
  const router = useRouter();
  const editForm = useRef<HTMLFormElement>(null);
  const [step, setStep] = useState<"edit" | "review">("edit");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [draft, setDraft] = useState<{ raw: Record<string, string>; input: MetricDefinitionInput } | null>(null);
  const [hasTarget, setHasTarget] = useState(false);
  const [customGrain, setCustomGrain] = useState(false);
  const headingId = useId();
  const [state, formAction, pending, keepInput] = useFormAction(async (previous: MetricActionState, form: FormData) => {
    const result = await recordMetricDefinitionAction(previous, form);
    if (result.errors) { setErrors(result.errors); setStep("edit"); }
    if (!result.error && result.message) { announceSaved(result.message); onDone(result.message); router.refresh(); }
    return result;
  }, INITIAL);
  const review = () => {
    const form = editForm.current; if (!form) return;
    const raw = formRecord(form);
    const parsed = parseDefinitionInput(raw, cairoToday());
    if (!parsed.ok) { setErrors(parsed.errors); const first = Object.keys(parsed.errors)[0]; (form.elements.namedItem(first ?? "") as HTMLElement | null)?.focus?.(); return; }
    setErrors({}); setDraft({ raw, input: parsed.input }); setStep("review");
  };
  const e = (key: string) => errors[key];
  const evidenceTitle = (id: string | null) => evidence.find(x => x.id === id)?.title ?? null;
  return <section className={styles.panel} aria-labelledby={headingId}>
    <div className={styles.panelHead}>
      <div><h3 id={headingId}>{step === "edit" ? "Define a metric" : "Review and confirm"}</h3>
        <p className={styles.lede}>{step === "edit" ? "Describe what is measured, where the numbers come from and how they are calculated. A target is compared only once it is approved by a named person on a date." : "Nothing is recorded yet. Check what will be stored, then confirm."}</p></div>
      <Button variant="ghost" onClick={onClose} disabled={pending}>Cancel</Button>
    </div>
    <form ref={editForm} hidden={step !== "edit"} className={styles.form} onSubmit={ev => { ev.preventDefault(); review(); }} noValidate>
      <input type="hidden" name="initiativeId" value={initiativeId} />
      <div className={styles.grid}>
        <Field label="Metric name" error={e("name")} help="As people say it in reviews, for example “Active Tap-to-Pay merchants”."><input name="name" maxLength={160} required /></Field>
        <Field label="Unit" error={e("unit")} help="%, EGP, merchants, days, hours…"><input name="unit" maxLength={40} required /></Field>
        <Field label="Definition" wide error={e("definition")} help="What is counted and for which population, including what is excluded."><textarea name="definition" maxLength={2000} rows={3} required /></Field>
        <Field label="Formula" wide error={e("formula")} help="A calculation two people would reproduce the same way."><textarea name="formula" maxLength={2000} rows={2} required /></Field>
        <Field label="Source" error={e("sourceLabel")} help="The dataset or report the values come from."><input name="sourceLabel" maxLength={160} required /></Field>
        <Field label="Evidence record (optional)" error={e("sourceEvidenceId")} help="A record on this initiative that holds or describes the source.">
          <select name="sourceEvidenceId" defaultValue=""><option value="">No evidence record linked</option>{evidence.map(x => <option key={x.id} value={x.id}>{x.title}</option>)}</select>
        </Field>
        <Field label="Reporting period" error={e("periodGrain")} help="How often a value is recorded and how the period closes.">
          <select name="periodGrain" defaultValue={PERIOD_GRAINS[1]} onChange={ev => setCustomGrain(ev.target.value === "custom")}>{PERIOD_GRAINS.map(g => <option key={g} value={g}>{g}</option>)}<option value="custom">Other…</option></select>
          {customGrain && <input name="periodGrainCustom" maxLength={80} placeholder="Describe the period" aria-label="Reporting period, described" className={styles.stacked} />}
        </Field>
        <Field label="Timezone" error={e("timezone")} help="The timezone the periods close in."><input name="timezone" defaultValue={DEFAULT_TIMEZONE} maxLength={64} /></Field>
      </div>
      <fieldset className={styles.targetBlock}>
        <legend className={styles.choice}><input type="checkbox" name="hasTarget" value="yes" checked={hasTarget} onChange={ev => setHasTarget(ev.target.checked)} /> Record an approved target</legend>
        <p className={styles.help}>A target exists only with all four: value, comparison, approver and approval date. Without them the metric is monitored for context and never shown as met or missed.</p>
        {hasTarget && <div className={styles.grid}>
          <Field label="Target value" error={e("targetValue")}><input name="targetValue" inputMode="decimal" required /></Field>
          <Field label="Comparison" error={e("targetComparator")} help="At least: higher is better. At most: lower is better.">
            <select name="targetComparator" defaultValue="AT_LEAST">{METRIC_COMPARATORS.map(c => <option key={c} value={c}>{COMPARATOR_LABEL[c]}</option>)}</select>
          </Field>
          <Field label="Approved by" error={e("targetOwnerLabel")} help="The person or role who approved it, as they should be named."><input name="targetOwnerLabel" maxLength={160} required /></Field>
          <Field label="Approval date" error={e("targetApprovedAt")}><DateField name="targetApprovedAt" warnPast={false} required /></Field>
          <Field label="Approval note (optional)" wide error={e("targetNote")}><input name="targetNote" maxLength={1000} /></Field>
        </div>}
      </fieldset>
      <div className={styles.actions}>
        <Button type="submit" variant="primary">Review before recording</Button>
        <span className={styles.who}>Recorded by {actorLabel}</span>
      </div>
    </form>
    {step === "review" && draft && <form action={formAction} onReset={keepInput} className={styles.form}>
      <input type="hidden" name="scopeWorkspaceId" value={scopeWorkspaceId} />
      <input type="hidden" name="confirmed" value="yes" />
      {Object.entries(draft.raw).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <dl className={styles.summary}>
        <div><dt>Metric</dt><dd>{draft.input.name} <span>{draft.input.unit} · {draft.input.periodGrain} · {draft.input.timezone}</span></dd></div>
        <div><dt>Definition</dt><dd>{draft.input.definition}</dd></div>
        <div><dt>Formula</dt><dd>{draft.input.formula}</dd></div>
        <div><dt>Source</dt><dd>{draft.input.sourceLabel} <span>{evidenceTitle(draft.input.sourceEvidenceId) ? `Linked to “${evidenceTitle(draft.input.sourceEvidenceId)}”` : "No evidence record linked"}</span></dd></div>
        <div><dt>Target</dt><dd>{draft.input.target ? <>{COMPARATOR_LABEL[draft.input.target.comparator]} {formatMetricValue(draft.input.target.value, draft.input.unit)} <span>Approved by {draft.input.target.ownerLabel} on {formatDate(draft.input.target.approvedAt)}{draft.input.target.note ? ` · ${draft.input.target.note}` : ""}</span></> : <>No approved target <span>Monitored for context; never shown as met or missed.</span></>}</dd></div>
        <div><dt>Recorded as</dt><dd>Defined by {actorLabel} · {formatDateTime(new Date().toISOString())} Cairo <span>Origin: recorded by a person · revision 1 · no periods recorded yet. This is written to the initiative’s history.</span></dd></div>
      </dl>
      <div className={styles.actions}>
        <Button type="submit" variant="primary" pending={pending}>Confirm and record</Button>
        <Button variant="secondary" onClick={() => setStep("edit")} disabled={pending}>Back to edit</Button>
      </div>
      {state.error && <p role="alert" className={styles.error}>{state.error}</p>}
    </form>}
    {step === "edit" && state.error && <p role="alert" className={styles.error}>{state.error}</p>}
    <p className={styles.footnote}>On <a href={`/initiatives/${slug}/history`}>History</a> this appears as “Metric defined”. Definitions are never deleted; a later revision records what changed.</p>
  </section>;
}

/** "Record a period" under a metric defined in Prodwise. */
export function ObservationForm({ initiativeId, scopeWorkspaceId, evidence, metric, decision }: Omit<Common, "slug"> & { metric: { id: string; name: string; unit: string; periodGrain: string }; decision: MetricSetupDecision }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [notRecorded, setNotRecorded] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [done, setDone] = useState<string | null>(null);
  const form = useRef<HTMLFormElement>(null);
  const [state, formAction, pending, keepInput] = useFormAction(async (previous: MetricActionState, data: FormData) => {
    const result = await recordMetricObservationAction(previous, data);
    if (result.errors) setErrors(result.errors);
    if (!result.error && result.message) { announceSaved(result.message); setDone(result.message); setOpen(false); setNotRecorded(false); router.refresh(); }
    return result;
  }, INITIAL);
  if (!decision.allowed) return null;
  const e = (key: string) => errors[key];
  return <div className={styles.observe}>
    {!open && <Button variant="secondary" size="sm" onClick={() => { setOpen(true); setDone(null); setErrors({}); setNotRecorded(false); }} aria-expanded={open}>Record a period</Button>}
    {done && !open && <p className={styles.done} role="status">{done}</p>}
    {open && <form ref={form} action={formAction} onReset={keepInput} className={`${styles.form} ${styles.observeForm}`} noValidate
      onSubmit={ev => { const parsed = parseObservationInput(formRecord(ev.currentTarget)); if (!parsed.ok) { ev.preventDefault(); setErrors(parsed.errors); } else setErrors({}); }}>
      <input type="hidden" name="scopeWorkspaceId" value={scopeWorkspaceId} />
      <input type="hidden" name="initiativeId" value={initiativeId} />
      <input type="hidden" name="metricId" value={metric.id} />
      <input type="hidden" name="metricName" value={metric.name} />
      <p className={styles.lede}><strong>Record a period for {metric.name}</strong> · {metric.periodGrain}. One row per period; a period is never overwritten.</p>
      <div className={styles.grid}>
        <Field label="Period start" error={e("periodStart")}><DateField name="periodStart" warnPast={false} required /></Field>
        <Field label="Period end" error={e("periodEnd")}><DateField name="periodEnd" warnPast={false} required /></Field>
        <Field label={`Value (${metric.unit})`} error={e("value")} help={notRecorded ? "Marked as not recorded: the period is shown as a gap, never as zero." : "The observed value for the period."}>
          <input name="value" inputMode="decimal" disabled={notRecorded} />
          <label className={`${styles.choice} ${styles.stacked}`}><input type="checkbox" name="notRecorded" value="yes" checked={notRecorded} onChange={ev => setNotRecorded(ev.target.checked)} /> Not recorded for this period</label>
        </Field>
        <Field label="Captured at" error={e("capturedAt")} help="When the value was taken from the source."><input type="datetime-local" name="capturedAt" defaultValue={cairoNowLocal()} required /></Field>
        <Field label={notRecorded ? "Why it was not recorded" : "Note (optional)"} wide error={e("note")}><textarea name="note" rows={2} maxLength={2000} required={notRecorded} /></Field>
        <Field label="Evidence record (optional)" error={e("sourceEvidenceId")}>
          <select name="sourceEvidenceId" defaultValue=""><option value="">No evidence record linked</option>{evidence.map(x => <option key={x.id} value={x.id}>{x.title}</option>)}</select>
        </Field>
      </div>
      <div className={styles.actions}>
        <Button type="submit" variant="primary" pending={pending}>Record period</Button>
        <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>Cancel</Button>
      </div>
      {state.error && <p role="alert" className={styles.error}>{state.error}</p>}
    </form>}
  </div>;
}
