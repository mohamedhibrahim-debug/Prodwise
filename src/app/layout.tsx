import type { Metadata } from "next";
import { Suspense } from "react";

import { NavRail } from "@/components/shell/NavRail";
import { CommandPalette } from "@/components/shell/CommandPalette";
import { DemoScenarioSurface } from "@/components/shell/DemoScenarioSurface";
import { isDemoWriteEnabled, isSupabaseConfigured } from "@/lib/env";

import "@/styles/global.css";
import styles from "./layout.module.css";

/* Inter is the reference deck's own typeface: it honours the visual DNA while
   remaining brand-neutral enterprise-standard. */
export const metadata: Metadata = {
  title: {
    default: "Prodwise",
    template: "%s · Prodwise",
  },
  description: "Product Intelligence, from evidence to action.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <NavRail
          dataSource={isSupabaseConfigured ? "Supabase" : "Local demo data"}
          writesEnabled={isDemoWriteEnabled}
        />
        <div className={styles.canvas}>
          <main className={styles.main}>{children}</main>
        </div>
        {/* Renders nothing until opened; its data loads on first open only. */}
        <CommandPalette />
        <Suspense fallback={null}><DemoScenarioSurface /></Suspense>
      </body>
    </html>
  );
}
