"use client";

import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { NavRail } from "./NavRail";
import { GlobalCommandBar } from "./GlobalCommandBar";
import { CommandPalette } from "./CommandPalette";
import { DemoScenarioSurface } from "./DemoScenarioSurface";
import styles from "@/app/layout.module.css";

/** Public account entry pages have their own working surface. Authorization
 * remains in server repositories/actions; this controls presentation only. */
export function ApplicationShell({ children, account, dataSource, writesEnabled }: {
  children: React.ReactNode;
  account: React.ReactNode;
  dataSource: "Supabase" | "Local demo data";
  writesEnabled: boolean;
}) {
  const pathname = usePathname();
  if (/^\/(login|invite)(\/|$)/.test(pathname)) {
    return <main>{children}</main>;
  }
  return <>
    <NavRail dataSource={dataSource} writesEnabled={writesEnabled} />
    <div className={styles.canvas}>
      <GlobalCommandBar />
      {pathname !== "/account" && account}
      <main className={styles.main}>{children}</main>
    </div>
    <CommandPalette />
    <Suspense fallback={null}><DemoScenarioSurface /></Suspense>
  </>;
}
