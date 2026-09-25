import Link from "next/link";
import { notFound } from "next/navigation";
import { getRepository } from "@/lib/data";
import { isDemoWriteEnabled, WRITE_DISABLED_MESSAGE } from "@/lib/env";
import { VerifyClaimForm } from "@/components/initiative/VerifyClaimForm";
import { verifyClaimAction } from "./actions";
import styles from "@/app/initiatives/[slug]/sources/evidence-form.module.css";

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
      <Link href={`/initiatives/${slug}/knowledge?view=all#claim-${claim.id}`} className={styles.back}>← Knowledge</Link>
      <h1 className={styles.title}>Confirm Knowledge</h1>
      <p className={styles.intro}><b>{claim.subject} · {claim.attribute}</b><br />{claim.value}</p>
      {!isDemoWriteEnabled ? (
        <p className={styles.notice}>{WRITE_DISABLED_MESSAGE}</p>
      ) : (
        <VerifyClaimForm action={verifyClaimAction} slug={slug} claimId={claim.id} expectedUpdatedAt={claim.updatedAt} />
      )}
    </div>
  );
}
