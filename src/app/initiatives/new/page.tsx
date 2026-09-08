import type { Metadata } from "next";
import Link from "next/link";

import { isDemoWriteEnabled, WRITE_DISABLED_MESSAGE } from "@/lib/env";
import { CreateInitiativeForm } from "./CreateInitiativeForm";
import styles from "./new.module.css";

export const metadata: Metadata = { title: "Create Initiative" };

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
        Start with what you know. Prodwise builds the rest from evidence — you
        do not need to describe scope, stakeholders or domains up front.
      </p>

      <CreateInitiativeForm />

      <p className={styles.notice}>
        A new initiative starts with no connected evidence, so its state is
        genuinely <strong>Unknown</strong> until evidence is added. Prodwise
        will not assume a starting position it cannot support.
      </p>
    </div>
  );
}
