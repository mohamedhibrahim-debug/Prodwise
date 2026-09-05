"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./WorkspaceHeader.module.css";

const TABS = [
  { segment: "", label: "Overview" },
  { segment: "review", label: "Review" },
  { segment: "memory", label: "Product Memory" },
  { segment: "evidence", label: "Evidence" },
  { segment: "readiness", label: "Readiness" },
] as const;

export function WorkspaceTabs({ slug }: { slug: string }) {
  const pathname = usePathname();
  const base = `/initiatives/${slug}`;

  return (
    <nav className={styles.tabs} aria-label="Initiative sections">
      {TABS.map(({ segment, label }) => {
        const href = segment ? `${base}/${segment}` : base;
        const active = pathname === href;
        return (
          <Link
            key={label}
            href={href}
            className={`${styles.tab} ${active ? styles.tabActive : ""}`}
            aria-current={active ? "page" : undefined}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
