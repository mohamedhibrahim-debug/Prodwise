import type { Metadata } from "next";
import { ApplicationShell } from "@/components/shell/ApplicationShell";
import { AccountAccess } from "@/components/auth/AccountAccess";
import { contextForRequest } from "@/lib/auth/service";
import { isDemoWriteEnabled, isSupabaseConfigured } from "@/lib/env";

import "@/styles/global.css";

/* Inter is the reference deck's own typeface: it honours the visual DNA while
   remaining brand-neutral enterprise-standard. */
export const metadata: Metadata = {
  title: {
    default: "Prodwise",
    template: "%s · Prodwise",
  },
  description: "Product Intelligence, from evidence to action.",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Public login/invite entries must render without requesting protected data.
  // The global server proxy and repository guards still authorize every request.
  const access = await contextForRequest().catch(() => null);
  return (
    <html lang="en">
      <body>
        <ApplicationShell
          guideStorageKey={access ? `${access.workspaceId}:${access.actor.id}` : undefined}
          account={access ? <AccountAccess /> : null}
          dataSource={isSupabaseConfigured ? "Supabase" : "Local demo data"}
          writesEnabled={isDemoWriteEnabled}
        >{children}</ApplicationShell>
      </body>
    </html>
  );
}
