"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import styles from "./WorkspaceHeader.module.css";
import { PendingHint } from "./PendingHint";

const TABS = [
  { segment: "", label: "Brief" },
  { segment: "decisions", label: "Decisions" },
  { segment: "knowledge", label: "Knowledge" },
  { segment: "sources", label: "Sources" },
  { segment: "actions", label: "Commitments" },
  { segment: "context", label: "Risks & questions" },
  { segment: "history", label: "History" },
] as const;

/**
 * Tabs deliberately carry no counts.
 *
 * A count on Review would be the single best attention signal in the product —
 * but findings are derived in TypeScript from claims and provenance, so there
 * is no cheap count query for them, and computing one here would load the full
 * claim set on every tab including Readiness, which currently issues exactly
 * one query. Badges are not worth multiplying database round trips for.
 * Attention is carried instead by the Initiatives list and by Review's own
 * hierarchy.
 */
export function WorkspaceTabs({ slug }: { slug: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const base = `/initiatives/${slug}`;
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!event.altKey || event.ctrlKey || event.metaKey || !["1", "2", "3", "4"].includes(event.key)) return;
      if (event.target instanceof HTMLElement &&
        event.target.closest("input,textarea,select,[contenteditable]:not([contenteditable=false])")) return;
      event.preventDefault();
      const segment = TABS[Number(event.key) - 1]!.segment;
      router.push(segment ? `${base}/${segment}` : base);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [base, router]);

  const scroller = useRef<HTMLElement>(null);
  // Edge fades are driven by measurement, not by breakpoint, so the cue only
  // appears when the tab strip genuinely has more to reveal.
  const [edges, setEdges] = useState({ start: false, end: false });

  // The sticky header grows when an initiative name or metadata wraps. Anchor
  // offsets must follow its rendered height, not a breakpoint estimate.
  useLayoutEffect(() => {
    const header = scroller.current?.closest("header");
    if (!header) return;
    const root = document.documentElement;
    const measureHeader = () => {
      // The header sticks below the global bar (top bar on desktop, mobile bar on phones).
      const shellTop = Number.parseFloat(
        getComputedStyle(root).getPropertyValue(
          window.matchMedia("(max-width: 780px)").matches ? "--mobile-global-h" : "--command-h",
        ),
      ) || 0;
      root.style.setProperty(
        "--workspace-header-h",
        `${header.getBoundingClientRect().height + shellTop}px`,
      );
    };
    measureHeader();
    const observer = new ResizeObserver(measureHeader);
    observer.observe(header);
    // On a phone the header condenses to title + tabs once the page scrolls,
    // so the working area is not permanently covered.
    const condense = () => {
      const was = header.dataset.condensed === "true";
      // Hysteresis: the header shrinking moves content, so leave it condensed until near the top.
      const on = window.matchMedia("(max-width: 780px)").matches && (was ? window.scrollY > 24 : window.scrollY > 160);
      if (was !== on) header.dataset.condensed = on ? "true" : "false";
    };
    condense();
    window.addEventListener("scroll", condense, { passive: true });
    return () => {
      window.removeEventListener("scroll", condense);
      observer.disconnect();
      root.style.removeProperty("--workspace-header-h");
    };
  }, []);

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

  /**
   * Which tab owns the current URL.
   *
   * Matched by segment, not by exact path: a sub-route like `/sources/new` or
   * `/memory/:id/edit` belongs to its tab, and leaving every tab unlit there
   * stranded the reader exactly when they were deepest in the product.
   * Overview is the fallback, so it lights only when nothing else claims
   * the path.
   */
  const rest = pathname.startsWith(base) ? pathname.slice(base.length) : "";
  const currentSegment = rest.replace(/^\//, "").split("/")[0] ?? "";
  const activeSegment =
    rest.startsWith('/knowledge/sources') ? 'sources' : TABS.find((t) => t.segment && t.segment === currentSegment)?.segment ?? (currentSegment ? null : "");

  return (
    <div
      className={styles.tabsViewport}
      data-fade-start={edges.start || undefined}
      data-fade-end={edges.end || undefined}
    >
      <nav
        ref={scroller}
        className={styles.tabs}
        aria-label="Initiative sections"
        onScroll={measure}
      >
        {TABS.map(({ segment, label }) => {
          const href = segment ? `${base}/${segment}` : base;
          const active = segment === activeSegment;
          return (
            <Link
              key={label}
              href={href}
              className={`${styles.tab} ${active ? styles.tabActive : ""}`}
              aria-current={active ? "page" : undefined}
            >
              {label}
              <PendingHint />
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
