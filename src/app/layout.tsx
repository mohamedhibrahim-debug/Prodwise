import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { ApplicationShell } from "@/components/shell/ApplicationShell";
import { RAIL_BOOT_SCRIPT } from "@/components/shell/rail-preference";
import { THEME_BOOT_SCRIPT } from "@/components/shell/theme-preference";
import { contextForRequest, currentIdentityPresentation, isDemoGuestSession, listAuthorizedContexts } from "@/lib/auth/service";
import { workspacePresentation } from "@/lib/workspace/context";
import { isDemoWriteEnabled } from "@/lib/env";
import { DEMO_DATASET_LABEL } from "@/lib/demo/canonical";

import "@/styles/global.css";

/* Inter is the reference deck's own typeface: it honours the visual DNA while
   remaining brand-neutral enterprise-standard. Self-hosted by next/font. */
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: {
    default: "Prodwise",
    template: "%s · Prodwise",
  },
  description: "Product Intelligence, from evidence to action.",
};

export const viewport: Viewport = { themeColor: "#061a2c" };

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Public login/invite entries must render without requesting protected data.
  // The global server proxy and repository guards still authorize every request.
  const access = await contextForRequest().catch(() => null);
  let identity = null;
  if (access) {
    const guest = await isDemoGuestSession();
    // Email and switchable organizations feed the account menu and the
    // workspace switcher. Both are optional: a failure hides them, never the shell.
    const [presentation, email, contexts] = await Promise.all([
      workspacePresentation(access),
      currentIdentityPresentation().then(i => i.email).catch(() => null),
      guest ? Promise.resolve(null) : listAuthorizedContexts().catch(() => null),
    ]);
    identity = { access, presentation, guest, email, contexts, datasetLabel: presentation.isDemo ? DEMO_DATASET_LABEL : null };
  }
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        {/* Applies a remembered collapsed sidebar and appearance before first paint. */}
        <script dangerouslySetInnerHTML={{ __html: RAIL_BOOT_SCRIPT + THEME_BOOT_SCRIPT }} />
      </head>
      <body>
        <ApplicationShell
          identity={identity}
          writesEnabled={isDemoWriteEnabled}
        >{children}</ApplicationShell>
      </body>
    </html>
  );
}
