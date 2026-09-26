"use client";

import { usePathname } from "next/navigation";
import { ShellActions } from "./ShellActions";
import styles from "./GlobalCommandBar.module.css";

export function GlobalCommandBar() {
  const pathname = usePathname();
  if (/^\/initiatives\/[^/]+/.test(pathname)) return null;
  const title = pathname === "/" ? "Home" : pathname.startsWith("/initiatives") ? "Initiatives" : pathname.startsWith("/roadmap") ? "Roadmap" : pathname.startsWith("/analysis") ? "Analysis" : pathname.startsWith("/weekly-review") ? "Weekly Review" : "Prodwise";
  return <header className={styles.bar}><strong>{title}</strong><ShellActions /></header>;
}
