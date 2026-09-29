import { jiraTypeBadge, STATUS_CATEGORY_LABEL, statusTone } from "@/lib/connectors/import-view";
import type { JiraStatusCategory } from "@/lib/connectors/types";
import { Glyph, TypeGlyph } from "./icons";
import styles from "./import.module.css";

/** The issue type exactly as Jira named it, with a glyph; standard types get their own tint. */
export function TypeBadge({ type, subtask }: { type: string | null; subtask: boolean }) {
  const b = jiraTypeBadge(type, subtask);
  return <span className={styles.typeBadge} data-tone={b.tone} title={`Jira issue type: ${b.label}`}><TypeGlyph tone={b.tone} /><span>{b.label}</span></span>;
}

/**
 * Jira's status name, styled by Jira's own status category. It is delivery evidence:
 * "Done" here is deliberately not the READY green (CLAUDE.md Rule 1).
 */
export function StatusChip({ status, category }: { status: string | null; category: JiraStatusCategory | null }) {
  const tone = statusTone(category);
  return <span className={styles.statusChip} data-tone={tone} title={category ? `Jira status category: ${STATUS_CATEGORY_LABEL[category]}` : "Jira returned no status category"}>
    <Glyph name={tone === "done" ? "check" : tone === "progress" ? "clock" : tone === "todo" ? "dot" : "minus"} size={11} />
    <span>{status ?? "Status not returned"}</span>
  </span>;
}
