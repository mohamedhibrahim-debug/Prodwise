import Link from "next/link";

import { BUSINESS_LINE_LABEL } from "@/lib/domain/labels";
import { BUSINESS_LINES, type BusinessLine } from "@/lib/domain/types";
import styles from "./BusinessLineFilter.module.css";

interface BusinessLineFilterProps {
  /** Route the filter links point at, e.g. "/initiatives" or "/reporting". */
  basePath: string;
  /** Currently selected line, or null for All. */
  selected: BusinessLine | null;
  /** How many initiatives sit in each line, for the counts. */
  counts: Record<BusinessLine, number>;
  total: number;
}

/**
 * Business Line filter.
 *
 * Plain links carrying a query parameter — no client state, so it works
 * identically in the read-only public demo and never becomes a mutation path.
 */
export function BusinessLineFilter({
  basePath,
  selected,
  counts,
  total,
}: BusinessLineFilterProps) {
  return (
    <nav className={styles.filter} aria-label="Filter by business line">
      <span className={styles.label}>Business line</span>

      <Link
        href={basePath}
        className={`${styles.option} ${selected === null ? styles.optionActive : ""}`}
        aria-current={selected === null ? "true" : undefined}
      >
        All
        <span className={styles.count}>{total}</span>
      </Link>

      {BUSINESS_LINES.map((line) => (
        <Link
          key={line}
          href={`${basePath}?line=${line}`}
          className={`${styles.option} ${selected === line ? styles.optionActive : ""}`}
          aria-current={selected === line ? "true" : undefined}
        >
          {BUSINESS_LINE_LABEL[line]}
          <span className={styles.count}>{counts[line]}</span>
        </Link>
      ))}
    </nav>
  );
}

/** Parses the `line` query parameter into a valid Business Line, or null. */
export function parseBusinessLine(raw: string | undefined): BusinessLine | null {
  if (!raw) return null;
  return (BUSINESS_LINES as readonly string[]).includes(raw)
    ? (raw as BusinessLine)
    : null;
}

/** Counts initiatives per line, for the filter chips. */
export function countByBusinessLine(
  lines: BusinessLine[],
): Record<BusinessLine, number> {
  const counts = Object.fromEntries(
    BUSINESS_LINES.map((l) => [l, 0]),
  ) as Record<BusinessLine, number>;
  for (const line of lines) counts[line] += 1;
  return counts;
}
