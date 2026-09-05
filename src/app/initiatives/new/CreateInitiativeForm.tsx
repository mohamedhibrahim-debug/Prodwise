"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";

import { Button } from "@/components/primitives/Button";
import {
  createInitiativeAction,
  type CreateInitiativeState,
} from "./actions";
import styles from "./new.module.css";

const initialState: CreateInitiativeState = { error: null };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" disabled={pending}>
      {pending ? "Creating…" : "Create Initiative"}
    </Button>
  );
}

export function CreateInitiativeForm() {
  const [state, formAction] = useActionState(
    createInitiativeAction,
    initialState,
  );

  return (
    <form action={formAction} className={styles.form}>
      {state.error ? (
        <p className={styles.error} role="alert">
          {state.error}
        </p>
      ) : null}

      <div className={styles.field}>
        <label className={styles.label} htmlFor="name">
          Initiative Name
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          maxLength={160}
          autoComplete="off"
          className={styles.input}
          placeholder="e.g. Merchant Flex Finance"
        />
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="description">
          Short Description <span className={styles.optional}>Optional</span>
        </label>
        <textarea
          id="description"
          name="description"
          rows={3}
          className={styles.textarea}
          placeholder="One or two sentences describing what this initiative delivers."
        />
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="knownReferences">
          Known References <span className={styles.optional}>Optional</span>
        </label>
        <textarea
          id="knownReferences"
          name="knownReferences"
          rows={4}
          className={styles.textarea}
          placeholder={"MFF-104\nProduct Requirements v2.3"}
        />
        <p className={styles.hint}>
          Anything you already know points at this initiative — Jira keys,
          document names, epic references. One per line. These become starting
          points for evidence discovery in a later phase.
        </p>
      </div>

      <div className={styles.actions}>
        <SubmitButton />
        <Link href="/initiatives">
          <Button type="button" variant="ghost">
            Cancel
          </Button>
        </Link>
      </div>
    </form>
  );
}
