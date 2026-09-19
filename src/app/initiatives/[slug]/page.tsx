import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Section } from "@/components/primitives/Section";
import { RecentChanges } from "@/components/initiative/OverviewBlocks";
import { OpenDecisions } from "@/components/workspace/OpenDecisions";
import { TrustPipeline } from "@/components/workspace/TrustPipeline";
import { getRepository } from "@/lib/data";
import { compareFindings } from "@/lib/review/engine";
import { deriveInstrumentSnapshot } from "@/lib/workspace/instrument";
import styles from "./workspace.module.css";

export const metadata: Metadata = { title: "Status" };
export const dynamic = "force-dynamic";

export default async function StatusPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const repo = getRepository();
  const initiative = await repo.getInitiativeBySlug(slug);
  if (!initiative) notFound();
  const [snapshot, activity] = await Promise.all([
    repo.getInitiativeSnapshot(initiative.id),
    repo.listActivity(initiative.id, 8),
  ]);
  if (!snapshot) notFound();
  const instrument = deriveInstrumentSnapshot(snapshot);
  const open = instrument.findings.filter(f => f.status === "OPEN" && f.actionable).sort(compareFindings);
  return <div className={styles.page}>
    <TrustPipeline progress={instrument.progress} slug={slug} />
    <div className={styles.statusColumns}>
      <Section title="Waiting on You" aside={open.length ? `${open.length} open` : undefined} className={styles.statusMain}>
        <OpenDecisions findings={open} slug={slug} />
      </Section>
      <Section title="Changes" className={styles.statusSide}>
        <RecentChanges entries={activity} />
      </Section>
    </div>
  </div>;
}
