import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { ClaimForm } from "@/components/initiative/ClaimForm";
import { getRepository } from "@/lib/data";
import { isDemoWriteEnabled } from "@/lib/env";
import { createClaimAction } from "./actions";
import styles from "../../evidence/evidence-form.module.css";

export const metadata: Metadata = { title: "Add Claim" };
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

  return (
    <div className={styles.page}>
      <Link href={`/initiatives/${slug}/memory`} className={styles.back}>
        ← Product Memory
      </Link>

      <h1 className={styles.title}>Add Claim</h1>
      <p className={styles.intro}>
        Record something known about {initiative.name} as structured knowledge —
        a subject, the attribute in question, and its value. Linking supporting
        evidence is optional, and a claim can be recorded before any exists.
      </p>

      <ClaimForm
        slug={slug}
        action={createClaimAction}
        submitLabel="Add Claim"
        evidence={evidence}
      />

      {!isDemoWriteEnabled ? (
        <p className={styles.notice}>
          <strong>Writes are currently disabled.</strong> Mutations are gated by
          the <code>DEMO_WRITE_ENABLED</code> environment flag, enforced in the
          data layer. Set <code>DEMO_WRITE_ENABLED=true</code> in{" "}
          <code>.env.local</code> to add claims locally.
        </p>
      ) : null}
    </div>
  );
}
