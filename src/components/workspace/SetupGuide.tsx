import Link from "next/link";
import type { SetupProgress, SetupStepKey } from "@/lib/workspace/setup";
import styles from "./SetupGuide.module.css";

const labels: Record<SetupStepKey, string> = {
  sources: "Add sources",
  record: "Record what the sources say",
  confirm: "Confirm Knowledge",
  checking: "Checking starts",
};

export function SetupGuide({ progress, slug }: { progress: SetupProgress; slug: string }) {
  const links: Record<SetupStepKey, string> = {
    sources: `/initiatives/${slug}/knowledge/sources/new`,
    record: `/initiatives/${slug}/knowledge/new`,
    confirm: `/initiatives/${slug}/knowledge?view=all`,
    checking: `/initiatives/${slug}/decisions`,
  };
  return <section className={styles.guide} aria-label="Setup guide">
    <h2>Set up this initiative</h2>
    <p>Checking starts when an in-scope source, a Knowledge entry, and a sourced Confirmed entry are recorded.</p>
    <ol className={styles.track}>{progress.steps.map((step, index) => <li key={step.key} data-state={step.state}>
      <span className={styles.number}>{String(index + 1).padStart(2, "0")}</span>
      {step.key === "checking" ? <span>{labels[step.key]}<small>Available after setup</small></span> :
        <Link href={links[step.key]}>{labels[step.key]}<small>{step.state === "done" ? "Done" : step.state === "current" ? "Next" : "Waiting"}</small></Link>}
    </li>)}</ol>
  </section>;
}
