"use client";

import { useState, useTransition } from "react";

import { EVIDENCE_RELATION_LABEL } from "@/lib/domain/labels";
import { EVIDENCE_RELATIONS, type EvidenceRelation } from "@/lib/domain/types";
import {
  excludeEvidenceAction,
  reclassifyEvidenceAction,
} from "@/app/initiatives/[slug]/evidence/actions";
import styles from "./EvidenceRow.module.css";

interface EvidenceControlsProps {
  evidenceId: string;
  slug: string;
  boundary: EvidenceRelation;
  title: string;
}

/**
 * Boundary classification control for one evidence item.
 *
 * The classification is the whole point of the Evidence workspace, so changing
 * it is one interaction: pick the target and it persists. Excluding gets its own
 * one-click button because it is a frequent, deliberate act.
 *
 * There is no "include" button. Bringing evidence back requires choosing which
 * boundary it belongs to — the select does that, explicitly.
 */
export function EvidenceControls({
  evidenceId,
  slug,
  boundary,
  title,
}: EvidenceControlsProps) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // Optimistic local value so the select does not snap back while the server
  // action is in flight.
  const [value, setValue] = useState<EvidenceRelation>(boundary);

  function run(next: EvidenceRelation) {
    const previous = value;
    setValue(next);
    setError(null);
    startTransition(async () => {
      const result =
        next === "EXCLUDED"
          ? await excludeEvidenceAction(evidenceId, slug)
          : await reclassifyEvidenceAction(evidenceId, slug, next);
      if (result.error) {
        setValue(previous);
        setError(result.error);
      }
    });
  }

  return (
    <div className={styles.controls}>
      <label className={styles.selectLabel}>
        <span className="visually-hidden">Boundary classification for {title}</span>
        <select
          className={styles.select}
          value={value}
          disabled={pending}
          onChange={(e) => run(e.target.value as EvidenceRelation)}
        >
          {EVIDENCE_RELATIONS.map((relation) => (
            <option key={relation} value={relation}>
              {EVIDENCE_RELATION_LABEL[relation]}
            </option>
          ))}
        </select>
      </label>

      {value !== "EXCLUDED" ? (
        <button
          type="button"
          className={styles.exclude}
          disabled={pending}
          onClick={() => run("EXCLUDED")}
        >
          Exclude
        </button>
      ) : null}

      {error ? (
        <p className={styles.controlError} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
