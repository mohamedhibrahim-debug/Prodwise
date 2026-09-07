"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { InitiativeArc } from "@/components/primitives/InitiativeArc";
import styles from "./NavRail.module.css";

interface NavRailProps {
  /** Where the data is actually coming from — stated plainly, never faked. */
  dataSource: "Supabase" | "Local demo data";
  writesEnabled: boolean;
}

function InitiativesIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      className={styles.navIcon}
    >
      <path
        d="M2.5 3.75h11M2.5 8h11M2.5 12.25h7"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ReportingIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      className={styles.navIcon}
    >
      <path
        d="M2.75 2.5v11h10.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5.5 10.5h6M5.5 7.5h3.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function NavRail({ dataSource, writesEnabled }: NavRailProps) {
  const pathname = usePathname();
  const onInitiatives = pathname === "/" || pathname.startsWith("/initiatives");
  const onReporting = pathname.startsWith("/reporting");

  return (
    <aside className={styles.rail}>
      <div className={styles.brand}>
        <InitiativeArc mark size={26} className={styles.mark} />
        <div className={styles.wordmarkGroup}>
          <div className={styles.wordmark}>Prodwise</div>
          <div className={styles.tagline}>
            Product Intelligence, from evidence to action
          </div>
        </div>
      </div>

      <nav className={styles.nav} aria-label="Primary">
        <div className={styles.navLabel}>Workspace</div>
        <ul>
          <li>
            <Link
              href="/initiatives"
              className={`${styles.navItem} ${onInitiatives ? styles.navItemActive : ""}`}
              aria-current={onInitiatives ? "page" : undefined}
            >
              <InitiativesIcon />
              <span className={styles.navText}>Initiatives</span>
            </Link>
          </li>
          <li>
            {/* Secondary executive view. Initiatives stays the PM home and the
                default landing destination. */}
            <Link
              href="/reporting"
              className={`${styles.navItem} ${onReporting ? styles.navItemActive : ""}`}
              aria-current={onReporting ? "page" : undefined}
            >
              <ReportingIcon />
              <span className={styles.navText}>Reporting</span>
            </Link>
          </li>
        </ul>
      </nav>

      <div className={styles.footer}>
        <InitiativeArc mark size={150} className={styles.arcBleed} />
        <div className={styles.envLabel}>Phase 3</div>
        <p className={styles.envValue}>
          Source: <b>{dataSource}</b>
          <br />
          Writes: <b>{writesEnabled ? "enabled" : "disabled"}</b>
        </p>
      </div>
    </aside>
  );
}
