"use client";

import { useActionState, useId, useState } from "react";
import { decideAction, confirmerAction } from "@/app/initiatives/[slug]/decisions/actions";
import type { ReviewFinding } from "@/lib/domain/types";
import { DOMAIN_LABEL } from "@/lib/domain/labels";
import { normalise } from "@/lib/review/normalise";
import { CHOOSE_EXISTING_MESSAGE, type DecisionFormState } from "@/lib/decisions/ui";
import styles from "./FindingRow.module.css";

const EMPTY: DecisionFormState = { error: null };

export function DecideConflictForm({ finding, slug }: { finding: ReviewFinding; slug: string }) {
  const [state, action, pending] = useActionState(decideAction, EMPTY);
  const [choice, setChoice] = useState("existing");
  const [chosen, setChosen] = useState("");
  const [corrected, setCorrected] = useState("");
  const [rationale, setRationale] = useState("");
  const [domain, setDomain] = useState("");
  const id = useId();
  const values = [...new Map(finding.claims.map((c) => [normalise(c.value), c])).values()];
  const domains = [...new Set(finding.claims.map((c) => c.domain))];
  const duplicate = choice === "corrected" && values.some((c) => normalise(c.value) === normalise(corrected));
  return <details className={styles.decisionForm}>
    <summary className={styles.resolveTrigger}>Make a decision</summary>
    <form action={action}
      // React resets action forms even when the action returns a refusal.
      // Cancel the native reset so selects/radios retain their controlled values
      // alongside text inputs. Successful decisions disappear via revalidation.
      onReset={(event) => event.preventDefault()}
      onSubmit={(event) => { if (duplicate) event.preventDefault(); }}>
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="fingerprint" value={finding.fingerprint} />
      <input type="hidden" name="contentDigest" value={finding.contentDigest} />
      <fieldset disabled={pending} className={styles.formFields}>
        <legend>How should these values change?</legend>
        <label><input type="radio" name="choice" value="existing" checked={choice === "existing"}
          onChange={() => setChoice("existing")} /> Choose existing value</label>
        <label><input type="radio" name="choice" value="corrected" checked={choice === "corrected"}
          onChange={() => setChoice("corrected")} /> Enter corrected value</label>
        {choice === "existing" ? <>
          <label htmlFor={`${id}-chosen`}>Value to keep</label>
          <select id={`${id}-chosen`} name="chosenClaimId" required value={chosen}
            onChange={(event) => setChosen(event.target.value)} className={styles.resolveInput}>
            <option value="">Select a value</option>
            {values.map((c) => <option key={c.claimId} value={c.claimId}>{c.value}</option>)}
          </select>
          <p className={styles.resolveCaption}>The selected value stays current. Competing values will be replaced. No new Knowledge entry is created.</p>
        </> : <>
          <label htmlFor={`${id}-corrected`}>Corrected value</label>
          <input id={`${id}-corrected`} name="correctedValue" required value={corrected}
            onChange={(event) => setCorrected(event.target.value)} className={styles.resolveInput} />
          {domains.length > 1 ? <>
            <label htmlFor={`${id}-domain`}>Domain for the Decision entry</label>
            <select id={`${id}-domain`} name="decisionDomain" required value={domain}
              onChange={(event) => setDomain(event.target.value)} className={styles.resolveInput}>
              <option value="">Select a domain</option>
              {domains.map((d) => <option key={d} value={d}>{DOMAIN_LABEL[d]}</option>)}
            </select>
          </> : null}
          <p className={styles.resolveCaption}>A new confirmed Decision entry will be created. The existing competing values will be replaced by it.</p>
        </>}
        <label htmlFor={`${id}-rationale`}>Rationale</label>
        <textarea id={`${id}-rationale`} name="rationale" rows={3} required value={rationale}
          onChange={(event) => setRationale(event.target.value)} className={styles.resolveInput} />
        {duplicate ? <p role="alert" className={styles.error}>{CHOOSE_EXISTING_MESSAGE}{" "}
          <button type="button" className={styles.resolveTrigger} onClick={() => {
            setChosen(values.find((c) => normalise(c.value) === normalise(corrected))!.claimId);
            setChoice("existing");
          }}>Choose existing value instead</button></p> : null}
        {state.error ? <p role="alert" className={styles.error}>{state.error}</p> : null}
        <button className={styles.submit} type="submit" disabled={pending || duplicate}>
          {pending ? "Saving…" : "Save decision"}
        </button>
      </fieldset>
    </form>
  </details>;
}

export function ConfirmerForm({ finding, slug }: { finding: ReviewFinding; slug: string }) {
  const [state, action, pending] = useActionState(confirmerAction, EMPTY);
  const [label, setLabel] = useState(finding.confirmerLabel ?? "");
  const id = useId();
  return <details className={styles.decisionForm}>
    <summary className={styles.resolveTrigger}>{finding.confirmerLabel ? "Change confirmer" : "Assign confirmer"}</summary>
    <form action={action}>
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="fingerprint" value={finding.fingerprint} />
      <label htmlFor={id}>Confirm with</label>
      <input id={id} name="label" required maxLength={120} value={label}
        onChange={(event) => setLabel(event.target.value)} disabled={pending} className={styles.resolveInput} />
      {state.error ? <p role="alert" className={styles.error}>{state.error}</p> : null}
      <button className={styles.submit} disabled={pending}>Save confirmer</button>{" "}
      {finding.confirmerLabel ? <button className={styles.submit} name="clear" value="true"
        formNoValidate disabled={pending}>Clear confirmer</button> : null}
      {state.saved && !state.error ? <p role="status">Confirmer saved.</p> : null}
    </form>
  </details>;
}
