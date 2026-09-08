import type { Metadata } from "next";
import Link from "next/link";

import { isDemoWriteEnabled } from "@/lib/env";
import { CreateInitiativeForm } from "./CreateInitiativeForm";
import styles from "./new.module.css";

export const metadata: Metadata = { title: "Create Initiative" };

export default function NewInitiativePage() {
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

      {!isDemoWriteEnabled ? (
        <p className={styles.notice}>
          <strong>Writes are currently disabled.</strong> There is no
          authentication yet, so mutations are gated by the{" "}
          <code>DEMO_WRITE_ENABLED</code> environment flag, enforced in the data
          layer. Set <code>DEMO_WRITE_ENABLED=true</code> in{" "}
          <code>.env.local</code> to create initiatives locally.
        </p>
      ) : (
        <p className={styles.notice}>
          A new initiative starts with no connected evidence, so its state is
          genuinely <strong>Unknown</strong> until evidence is added. Prodwise
          will not assume a starting position it cannot support.
        </p>
      )}
    </div>
  );
}
