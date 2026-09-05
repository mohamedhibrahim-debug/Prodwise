"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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

  const scroller = useRef<HTMLElement>(null);
  // Edge fades are driven by measurement, not by breakpoint, so the cue only
  // appears when the tab strip genuinely has more to reveal.
  const [edges, setEdges] = useState({ start: false, end: false });

  const measure = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setEdges({
      start: el.scrollLeft > 1,
      end: max > 1 && el.scrollLeft < max - 1,
    });
  }, []);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [measure, pathname]);

  return (
    <div
      className={styles.tabsViewport}
      data-fade-start={edges.start || undefined}
      data-fade-end={edges.end || undefined}
    >
      <nav
        ref={scroller}
        className={styles.tabs}
        onScroll={measure}
        aria-label="Initiative sections"
      >
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
    </div>
  );
}
