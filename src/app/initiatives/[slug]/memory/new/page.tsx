import {readManagement} from "@/lib/data/management-read";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { ClaimForm } from "@/components/initiative/ClaimForm";
import { getRepository } from "@/lib/data";
import { isDemoWriteEnabled, WRITE_DISABLED_MESSAGE } from "@/lib/env";
import { createClaimAction } from "./actions";
import styles from "../../sources/evidence-form.module.css";

export const metadata: Metadata = { title: "Add Knowledge entry" };
export const dynamic = "force-dynamic";

export default async function NewClaimPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const repo = getRepository();
  const initiative = await repo.getInitiativeBySlug(slug);
  if (!initiative) notFound();

  const evidence = await repo.listEvidence(initiative.id);

  const management=await readManagement();
  if (!isDemoWriteEnabled || initiative.archivedAt) {
    return (
      <div className={styles.page}>
        <Link prefetch={false} href={`/initiatives/${slug}/knowledge`} className={styles.back}>
          ← Knowledge
        </Link>
        <h2 className={styles.title}>Add Knowledge entry</h2>
        <p className={styles.notice}>{initiative.archivedAt ? "This initiative is archived and read-only. An administrator can restore it in Manage initiative." : WRITE_DISABLED_MESSAGE}</p>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <Link prefetch={false} href={`/initiatives/${slug}/knowledge`} className={styles.back}>
        ← Knowledge
      </Link>

      <h2 className={styles.title}>Add Knowledge entry</h2>
      <p className={styles.intro}>
        Record something known about {initiative.name} as structured knowledge —
        a subject, the attribute in question, and its value. Linking a Source
        is optional, and an entry can be recorded before any exists.
      </p>

      <ClaimForm
        contexts={management.contexts.filter(c=>c.initiativeId===initiative.id)} currentContextId={initiative.currentContextId??null}
        slug={slug}
        action={createClaimAction}
        submitLabel="Add Knowledge entry"
        evidence={evidence}
      />
    </div>
  );
}
