import type { ReactNode } from "react";
import type { Confidence } from "@/lib/domain/types";
import { formatDate, formatDateTime } from "@/lib/domain/labels";
import styles from "./Meta.module.css";

/** The deck's 6pt label device, reinterpreted as our micro-label signature. */
export function MicroLabel({
  children,
  as: Tag = "span",
}: {
  children: ReactNode;
  as?: "span" | "div" | "dt" | "h3";
}) {
  return <Tag className={styles.microLabel}>{children}</Tag>;
}

/** Evidence freshness. Real timestamps only — never a faked "live" indicator. */
export function Timestamp({
  iso,
  prefix,
  withTime = false,
}: {
  iso: string;
  prefix?: string;
  withTime?: boolean;
}) {
  const formatted = withTime ? formatDateTime(iso) : formatDate(iso);
  return (
    <time className={styles.timestamp} dateTime={iso}>
      {prefix ? `${prefix} ` : ""}
      {formatted}
    </time>
  );
}

/** A source reference such as a Jira key or document version. */
export function Reference({ children }: { children: ReactNode }) {
  return <span className={styles.reference}>{children}</span>;
}

/** A neutral category chip. Category never carries colour — severity does. */
export function CategoryTag({ children }: { children: ReactNode }) {
  return <span className={styles.categoryTag}>{children}</span>;
}

export function ConfidenceNote({ confidence }: { confidence: Confidence }) {
  const label =
    confidence === "HIGH" ? "High" : confidence === "MEDIUM" ? "Medium" : "Low";
  return (
    <span className={styles.confidence}>
      Confidence <strong>{label}</strong>
    </span>
  );
}

export function DemoBadge({ children = "Demo data" }: { children?: ReactNode }) {
  return <span className={styles.demoBadge}>{children}</span>;
}
