import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { isDemoWriteEnabled, WRITE_DISABLED_MESSAGE } from "@/lib/env";
import { ClaimForm } from "@/components/initiative/ClaimForm";
import { getRepository } from "@/lib/data";
import { updateClaimAction } from "./actions";
import styles from "../../../evidence/evidence-form.module.css";

export const metadata: Metadata = { title: "Edit Claim" };
export const dynamic = "force-dynamic";

export default async function EditClaimPage({
  params,
}: {
  params: Promise<{ slug: string; claimId: string }>;
}) {
  const { slug, claimId } = await params;
  const repo = getRepository();

  const [initiative, claim] = await Promise.all([
    repo.getInitiativeBySlug(slug),
    repo.getClaim(claimId),
  ]);

  // Guard against a claim from another initiative being edited through this
  // route. The mutation boundary re-checks this independently.
  if (!initiative || !claim || claim.initiativeId !== initiative.id) {
    notFound();
  }

  const [evidence, allClaims] = await Promise.all([
    repo.listEvidence(initiative.id),
    repo.listClaims(initiative.id),
  ]);

  if (!isDemoWriteEnabled) {
    return (
      <div className={styles.page}>
        <Link href={`/initiatives/${slug}/memory`} className={styles.back}>
          ← Product Memory
        </Link>
        <h1 className={styles.title}>Edit Claim</h1>
        <p className={styles.notice}>{WRITE_DISABLED_MESSAGE}</p>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <Link href={`/initiatives/${slug}/memory`} className={styles.back}>
        ← Product Memory
      </Link>

      <h1 className={styles.title}>Edit Claim</h1>
      <p className={styles.intro}>
        Knowledge is corrected here, never deleted. If a claim no longer holds,
        give it the status that says so — superseded, rejected or deferred — so
        the history stays inspectable.
      </p>

      <ClaimForm
        slug={slug}
        action={updateClaimAction}
        submitLabel="Save Changes"
        evidence={evidence}
        claim={claim}
        // A claim can never supersede itself, so it is not offered.
        replacementOptions={allClaims.filter((c) => c.id !== claim.id)}
      />
    </div>
  );
}
