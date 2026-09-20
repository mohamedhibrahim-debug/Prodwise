import type { Metadata } from "next";
import { DemoWriteLink } from "@/components/primitives/DemoWriteLink";
import { EmptyState } from "@/components/primitives/EmptyState";
import { InitiativeRow } from "@/components/initiative/InitiativeRow";
import { BusinessLineFilter, countByBusinessLine, parseBusinessLine } from "@/components/initiative/BusinessLineFilter";
import { getRepository } from "@/lib/data";
import { BUSINESS_LINE_LABEL } from "@/lib/domain/labels";
import { deriveInstrumentSnapshot } from "@/lib/workspace/instrument";
import styles from "./initiatives.module.css";

export const metadata: Metadata = { title: "Initiatives" };
export const dynamic = "force-dynamic";

export default async function InitiativesPage({ searchParams }: { searchParams: Promise<{ line?: string }> }) {
  const { line } = await searchParams;
  const selectedLine = parseBusinessLine(line);
  const snapshots = (await getRepository().listInitiativeSnapshots()).map(deriveInstrumentSnapshot);
  const counts = countByBusinessLine(snapshots.map(row => row.initiative.businessLine));
  const rows = snapshots.filter(row => selectedLine === null || row.initiative.businessLine === selectedLine);
  return <div className={styles.page}>
    <header className={styles.head}><div><h1 className={styles.title}>Initiatives</h1><p className={styles.subtitle}>Recorded stage, foundation and current derived decision pressure.</p></div><DemoWriteLink href="/initiatives/new" variant="primary">Create Initiative</DemoWriteLink></header>
    <BusinessLineFilter basePath="/initiatives" selected={selectedLine} counts={counts} total={snapshots.length} />
    {rows.length === 0 ? <EmptyState message={selectedLine ? `No initiatives in ${BUSINESS_LINE_LABEL[selectedLine]}.` : "No initiatives yet."} /> : <>
      <div className={styles.columnHead}><span>Code</span><span>Initiative</span><span>Recorded stage</span><span>Business line</span><span>Decision pressure</span><span>Scenario</span></div>
      <ul className={styles.list}>{rows.map(row => <InitiativeRow key={row.initiative.id} snapshot={row} />)}</ul>
    </>}
  </div>;
}
