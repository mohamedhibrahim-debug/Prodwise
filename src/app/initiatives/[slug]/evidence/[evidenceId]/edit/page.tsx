import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { isDemoWriteEnabled, WRITE_DISABLED_MESSAGE } from "@/lib/env";
import { EvidenceForm } from "@/components/initiative/EvidenceForm";
import { getRepository } from "@/lib/data";
import { updateEvidenceAction } from "./actions";
import styles from "../../evidence-form.module.css";

export const metadata: Metadata = { title: "Edit Evidence" };
export const dynamic = "force-dynamic";

export default async function EditEvidencePage({
  params,
}: {
  params: Promise<{ slug: string; evidenceId: string }>;
}) {
  const { slug, evidenceId } = await params;
  const repo = getRepository();

  const [initiative, evidence] = await Promise.all([
    repo.getInitiativeBySlug(slug),
    repo.getEvidence(evidenceId),
  ]);

  // Guard against an id from another initiative being edited through this route.
  if (!initiative || !evidence || evidence.initiativeId !== initiative.id) {
    notFound();
  }

  if (!isDemoWriteEnabled) {
    return (
      <div className={styles.page}>
        <Link href={`/initiatives/${slug}/evidence`} className={styles.back}>
          ← Evidence
        </Link>
        <h1 className={styles.title}>Edit Evidence</h1>
        <p className={styles.notice}>{WRITE_DISABLED_MESSAGE}</p>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <Link href={`/initiatives/${slug}/evidence`} className={styles.back}>
        ← Evidence
      </Link>

      <h1 className={styles.title}>Edit Evidence</h1>
      <p className={styles.intro}>
        Correcting a record here is the same act as correcting it inline — a
        boundary change is recorded in the initiative&rsquo;s activity either way.
      </p>

      <EvidenceForm
        slug={slug}
        action={updateEvidenceAction}
        submitLabel="Save Changes"
        evidence={evidence}
      />
    </div>
  );
}
