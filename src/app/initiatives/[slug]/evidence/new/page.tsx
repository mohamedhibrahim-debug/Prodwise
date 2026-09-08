import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { EvidenceForm } from "@/components/initiative/EvidenceForm";
import { getRepository } from "@/lib/data";
import { isDemoWriteEnabled, WRITE_DISABLED_MESSAGE } from "@/lib/env";
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

  if (!isDemoWriteEnabled) {
    return (
      <div className={styles.page}>
        <Link href={`/initiatives/${slug}/evidence`} className={styles.back}>
          ← Evidence
        </Link>
        <h1 className={styles.title}>Add Evidence</h1>
        <p className={styles.notice}>{WRITE_DISABLED_MESSAGE}</p>
      </div>
    );
  }

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
    </div>
  );
}
