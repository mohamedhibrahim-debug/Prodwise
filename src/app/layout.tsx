import type { Metadata } from "next";
import { Inter } from "next/font/google";

import { NavRail } from "@/components/shell/NavRail";
import { ConsultantPanel } from "@/components/shell/ConsultantPanel";
import { isDemoWriteEnabled, isSupabaseConfigured } from "@/lib/env";

import "@/styles/global.css";
import styles from "./layout.module.css";

/* Inter is the reference deck's own typeface: it honours the visual DNA while
   remaining brand-neutral enterprise-standard. */
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

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
    <html lang="en" className={inter.variable}>
      <body>
        <NavRail
          dataSource={isSupabaseConfigured ? "Supabase" : "Local demo data"}
          writesEnabled={isDemoWriteEnabled}
        />
        <div className={styles.canvas}>
          <main className={styles.main}>{children}</main>
        </div>
        <ConsultantPanel />
      </body>
    </html>
  );
}
