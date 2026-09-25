import type { Metadata } from "next";
import Link from "next/link";

import { isDemoWriteEnabled, WRITE_DISABLED_MESSAGE } from "@/lib/env";
import { CreateInitiativeForm } from "./CreateInitiativeForm";
import styles from "./new.module.css";

export const metadata: Metadata = { title: "Create Initiative" };

/* Read-only state below is a runtime value, so this page must not be
   prerendered — a frozen build-time render could show a public visitor the
   create form when writes are disabled. */
export const dynamic = "force-dynamic";

export default function NewInitiativePage() {
  if (!isDemoWriteEnabled) {
    return (
      <div className={styles.page}>
        <Link href="/initiatives" className={styles.back}>
          ← Initiatives
        </Link>
        <h1 className={styles.title}>Create Initiative</h1>
        <p className={styles.notice}>{WRITE_DISABLED_MESSAGE}</p>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <Link href="/initiatives" className={styles.back}>
        ← Initiatives
      </Link>

      <h1 className={styles.title}>Create Initiative</h1>
      <p className={styles.intro}>
        Start with what you know. You can add Sources and Knowledge entries
        after creating the initiative.
      </p>

      <CreateInitiativeForm />

      <p className={styles.notice}>
        A new initiative starts with no Sources or Knowledge entries. Prodwise
        will not assume a starting position it cannot support.
      </p>
    </div>
  );
}
