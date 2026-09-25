"use client";

import { usePathname } from "next/navigation";
import { ShellActions } from "./ShellActions";
import styles from "./GlobalCommandBar.module.css";

export function GlobalCommandBar() {
  const pathname = usePathname();
  if (/^\/initiatives\/[^/]+/.test(pathname)) return null;
  const title = pathname === "/" ? "Home" : pathname.startsWith("/initiatives") ? "Initiatives" : "Reporting";
  return <header className={styles.bar}><strong>{title}</strong><ShellActions /></header>;
}
