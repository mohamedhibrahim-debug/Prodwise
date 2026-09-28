import Link from "next/link";
import { notFound } from "next/navigation";
import { getRepository } from "@/lib/data";
import { isDemoWriteEnabled, WRITE_DISABLED_MESSAGE } from "@/lib/env";
import { VerifyClaimForm } from "@/components/initiative/VerifyClaimForm";
import { verifyClaimAction } from "./actions";
import styles from "@/app/initiatives/[slug]/sources/evidence-form.module.css";
import type { Metadata } from "next";
export const metadata: Metadata = { title: "Confirm Knowledge entry" };

export const dynamic = "force-dynamic";

export default async function VerifyClaimPage({ params }: {
  params: Promise<{ slug: string; claimId: string }>;
}) {
  const { slug, claimId } = await params;
  const repo = getRepository();
  const [initiative, claim] = await Promise.all([
    repo.getInitiativeBySlug(slug),
    repo.getClaim(claimId),
  ]);
  if (!initiative || !claim || claim.initiativeId !== initiative.id) notFound();
  return (
    <div className={styles.page}>
      <Link prefetch={false} href={`/initiatives/${slug}/knowledge?view=all#claim-${claim.id}`} className={styles.back}>← Knowledge</Link>
      <h2 className={styles.title}>Confirm Knowledge</h2>
      <p className={styles.intro}><b>{claim.subject} · {claim.attribute}</b><br />{claim.value}</p>
      {!isDemoWriteEnabled ? (
        <p className={styles.notice}>{WRITE_DISABLED_MESSAGE}</p>
      ) : (
        <VerifyClaimForm action={verifyClaimAction} slug={slug} claimId={claim.id} expectedUpdatedAt={claim.updatedAt} />
      )}
    </div>
  );
}
