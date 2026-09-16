import Link from "next/link";

import { ButtonLink } from "@/components/primitives/Button";
import { DemoWriteLink } from "@/components/primitives/DemoWriteLink";
import type {
  SetupFacts,
  SetupProgress,
  SetupStep,
  SetupStepKey,
} from "@/lib/workspace/setup";
import styles from "./SetupRail.module.css";

const TITLE: Record<SetupStepKey, string> = {
  sources: "Connect Sources",
  memory: "Build Memory",
  decisions: "Review Decisions",
  readiness: "Assess Readiness",
  status: "Establish Status",
};

const PURPOSE: Record<SetupStepKey, string> = {
  sources:
    "Add the evidence this initiative rests on, and confirm which of it is in scope.",
  memory:
    "Record what is known — requirements, decisions, rules — as claims backed by that evidence.",
  decisions:
    "Settle the conflicts Prodwise finds between active claims. Only conflicts and supersessions are checked today.",
  readiness:
    "Coming later. Readiness criteria and domain assessments are not available yet.",
  status:
    "Coming later. Derived Current State depends on readiness assessment.",
};

const STATE_LABEL: Record<SetupStep["state"], string> = {
  done: "Done",
  current: "Next",
  waiting: "Waiting",
  not_assessed: "Coming later",
};

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

/** One factual line per step. Counts only — never a judgement. */
function fact(key: SetupStepKey, f: SetupFacts): string {
  switch (key) {
    case "sources":
      if (f.evidenceInScope > 0)
        return `${f.evidenceInScope} artifacts in scope · ${f.evidenceTotal} recorded`;
      return f.evidenceTotal > 0
        ? `${plural(f.evidenceTotal, "record", "records")}, none confirmed in scope`
        : "No evidence recorded";
    case "memory":
      if (f.claimsActive > 0)
        return `${plural(f.claimsActive, "active claim", "active claims")}`;
      return f.claimsTotal > 0
        ? `${plural(f.claimsTotal, "claim", "claims")} recorded, none active`
        : "No claims recorded";
    case "decisions":
      if (f.claimsActive === 0) return "Waits on active claims";
      return f.decisionsOpen > 0
        ? plural(f.decisionsOpen, "open decision", "open decisions")
        : "Nothing waiting";
    case "readiness":
    case "status":
      return "Not available yet";
  }
}

/** The single primary action for the current step. */
function PrimaryAction({
  step,
  facts,
  slug,
}: {
  step: SetupStepKey;
  facts: SetupFacts;
  slug: string;
}) {
  const base = `/initiatives/${slug}`;
  switch (step) {
    case "sources":
      return (
        <DemoWriteLink href={`${base}/sources/new`} variant="primary">
          Add evidence
        </DemoWriteLink>
      );
    case "memory":
      // Verifying what already exists beats adding more alongside it.
      return facts.claimsUnverified > 0 ? (
        <ButtonLink href={`${base}/memory?view=claims`} variant="primary">
          Review {plural(facts.claimsUnverified, "unverified claim", "unverified claims")}
        </ButtonLink>
      ) : (
        <DemoWriteLink href={`${base}/memory/new`} variant="primary">
          Add a claim
        </DemoWriteLink>
      );
    case "decisions":
      return (
        <ButtonLink href={`${base}/decisions#lane-open`} variant="primary">
          Open {plural(facts.decisionsOpen, "decision", "decisions")}
        </ButtonLink>
      );
    default:
      return null;
  }
}

function Node({ step, index }: { step: SetupStep; index: number }) {
  return (
    <span className={styles.node} data-state={step.state} aria-hidden="true">
      {step.state === "done" ? (
        <svg viewBox="0 0 12 12" width="10" height="10">
          <path
            d="M2.5 6.2l2.3 2.3 4.7-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : (
        index + 1
      )}
    </span>
  );
}

/**
 * The setup progress rail.
 *
 * `full` is the Status page in setup mode: every step laid out as a pipeline,
 * the first unfinished step carrying the one primary action. `condensed` stays
 * on the operating view until every step is genuinely done — which cannot
 * happen yet, because readiness and status are not built. It never collapses
 * to imply that setup is finished.
 */
export function SetupRail({
  progress,
  slug,
  variant,
}: {
  progress: SetupProgress;
  slug: string;
  variant: "full" | "condensed";
}) {
  const { steps, facts, current } = progress;

  if (variant === "condensed") {
    return (
      <nav className={styles.strip} aria-label="Setup progress">
        <div className={styles.stripHead}>
          <span className={styles.stripLabel}>Setup</span>
          <span className={styles.stripCount}>
            {progress.doneCount} of 3 available steps done
          </span>
          {current ? (
            <Link
              href={
                current === "decisions"
                  ? `/initiatives/${slug}/decisions#lane-open`
                  : current === "memory"
                    ? `/initiatives/${slug}/memory`
                    : `/initiatives/${slug}/sources`
              }
              className={styles.stripNext}
            >
              Next: {TITLE[current]} — {fact(current, facts)} →
            </Link>
          ) : (
            <span className={styles.stripNote}>
              Readiness and derived Status are coming later.
            </span>
          )}
        </div>
        <ol className={styles.stripSegments}>
          {steps.map((step) => (
            <li
              key={step.key}
              className={styles.segment}
              data-state={step.state}
            >
              <span className={styles.segmentBar} aria-hidden="true" />
              <span className={styles.segmentLabel} aria-hidden="true">
                {TITLE[step.key]}
              </span>
              {/* Separate from the visible label, which is hidden on narrow
                  screens — the state must still be announced there. */}
              <span className="visually-hidden">
                {TITLE[step.key]} — {STATE_LABEL[step.state]}
              </span>
            </li>
          ))}
        </ol>
      </nav>
    );
  }

  return (
    <section className={styles.rail} aria-labelledby="setup-rail-title">
      <header className={styles.railHead}>
        <h2 id="setup-rail-title" className={styles.railTitle}>
          Set up this initiative
        </h2>
        <p className={styles.railLead}>
          Connect evidence and record knowledge now. Readiness and derived
          status are later capabilities, shown here for orientation.
        </p>
        <p className={styles.railCount}>
          {progress.doneCount} of 3 available steps done
        </p>
      </header>

      <ol className={styles.steps}>
        {steps.map((step, i) => (
          <li
            key={step.key}
            className={styles.step}
            data-state={step.state}
            aria-current={step.state === "current" ? "step" : undefined}
          >
            <div className={styles.track}>
              <Node step={step} index={i} />
              <span className={styles.connector} aria-hidden="true" />
            </div>
            <div className={styles.body}>
              <span className={styles.stepState}>{STATE_LABEL[step.state]}</span>
              <h3 className={styles.stepTitle}>{TITLE[step.key]}</h3>
              <p className={styles.stepFact}>{fact(step.key, facts)}</p>
              {step.state === "current" ||
              step.state === "not_assessed" ? (
                <p className={styles.stepPurpose}>{PURPOSE[step.key]}</p>
              ) : null}
              {step.state === "current" ? (
                <div className={styles.stepAction}>
                  <PrimaryAction step={step.key} facts={facts} slug={slug} />
                </div>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
