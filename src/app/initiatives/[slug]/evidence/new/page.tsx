import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { EvidenceForm } from "@/components/initiative/EvidenceForm";
import { getRepository } from "@/lib/data";
import { isDemoWriteEnabled } from "@/lib/env";
import { createEvidenceAction } from "./actions";
import styles from "../evidence-form.module.css";

export const metadata: Metadata = { title: "Add Evidence" };
export const dynamic = "force-dynamic";

export default async function NewEvidencePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const initiative = await getRepository().getInitiativeBySlug(slug);
  if (!initiative) notFound();

  return (
    <div className={styles.page}>
      <Link href={`/initiatives/${slug}/evidence`} className={styles.back}>
        ← Evidence
      </Link>

      <h1 className={styles.title}>Add Evidence</h1>
      <p className={styles.intro}>
        Record a piece of source material for {initiative.name}. Prodwise stores
        what the evidence is and where it came from — it does not upload, parse
        or interpret the artifact itself.
      </p>

      <EvidenceForm
        slug={slug}
        action={createEvidenceAction}
        submitLabel="Add Evidence"
      />

      {!isDemoWriteEnabled ? (
        <p className={styles.notice}>
          <strong>Writes are currently disabled.</strong> Mutations are gated by
          the <code>DEMO_WRITE_ENABLED</code> environment flag, enforced in the
          data layer. Set <code>DEMO_WRITE_ENABLED=true</code> in{" "}
          <code>.env.local</code> to add evidence locally.
        </p>
      ) : null}
    </div>
  );
}
