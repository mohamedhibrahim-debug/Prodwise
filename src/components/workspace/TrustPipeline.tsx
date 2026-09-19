import Link from "next/link";

import type { SetupProgress, SetupStepKey } from "@/lib/workspace/setup";
import styles from "./TrustPipeline.module.css";

const LABEL: Record<SetupStepKey, string> = {
  sources: "Sources",
  memory: "Memory",
  decisions: "Decisions",
  readiness: "Readiness",
  status: "Status",
};

function value(key: SetupStepKey, progress: SetupProgress, compact: boolean): string {
  const f = progress.facts;
  switch (key) {
    case "sources":
      return compact ? String(f.evidenceTotal) : `${f.evidenceTotal} artifacts`;
    case "memory":
      return compact ? String(f.claimsActive) : `${f.claimsActive} ACTIVE`;
    case "decisions":
      return String(f.decisionsOpen);
    case "readiness":
      return "Not assessed";
    case "status":
      return "Not established";
  }
}

function detail(key: SetupStepKey, progress: SetupProgress): string {
  const f = progress.facts;
  switch (key) {
    case "sources":
      return `${f.evidenceInScope} in scope`;
    case "memory":
      return `${f.claimsUnverified} unverified · ${f.claimsSuperseded} superseded`;
    case "decisions":
      return f.decisionsOpen === 1 ? "1 waiting on you" : `${f.decisionsOpen} waiting on you`;
    case "readiness":
      return "Capability not available yet";
    case "status":
      return "Derived state not available yet";
  }
}

export function TrustPipeline({
  progress,
  slug,
  compact = false,
}: {
  progress: SetupProgress;
  slug: string;
  compact?: boolean;
}) {
  const base = `/initiatives/${slug}`;
  const href: Record<SetupStepKey, string> = {
    sources: `${base}/sources`,
    memory: `${base}/memory`,
    decisions: `${base}/decisions#lane-needs-decision`,
    readiness: `${base}/readiness`,
    status: base,
  };

  return (
    <nav
      className={styles.pipeline}
      data-compact={compact || undefined}
      aria-label="Trust Pipeline"
    >
      <ol className={styles.track}>
        {progress.steps.map((step, index) => (
          <li
            key={step.key}
            className={styles.step}
            data-state={step.state}
            data-next={progress.current === step.key || undefined}
          >
            <Link href={href[step.key]} className={styles.link}>
              <span className={styles.index} aria-hidden="true">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className={styles.copy}>
                <span className={styles.label}>{LABEL[step.key]}</span>
                <span className={styles.value}>{value(step.key, progress, compact)}</span>
                {!compact ? (
                  <span className={styles.detail}>{detail(step.key, progress)}</span>
                ) : null}
              </span>
              {progress.current === step.key ? (
                <span className={styles.next}>Next</span>
              ) : null}
            </Link>
          </li>
        ))}
      </ol>
    </nav>
  );
}
