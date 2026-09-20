import Link from "next/link";
import type { Metadata } from "next";
import { BusinessLineFilter, countByBusinessLine, parseBusinessLine } from "@/components/initiative/BusinessLineFilter";
import { getRepository } from "@/lib/data";
import { BUSINESS_LINE_LABEL, STAGE_LABEL } from "@/lib/domain/labels";
import type { Stage } from "@/lib/domain/types";
import { deriveInstrumentSnapshot, initiativeCode } from "@/lib/workspace/instrument";
import styles from "./reporting.module.css";

export const metadata: Metadata = { title: "Reporting" };
export const dynamic = "force-dynamic";
const STAGES: Stage[] = ["DISCOVERY","DEFINITION","ALIGNMENT","DELIVERY","VALIDATION","RELEASE_PREPARATION","LIVE_VALIDATION","MONITORING"];

export default async function ReportingPage({ searchParams }: { searchParams: Promise<{ line?: string }> }) {
  const { line } = await searchParams;
  const selected = parseBusinessLine(line);
  const all = (await getRepository().listInitiativeSnapshots()).map(deriveInstrumentSnapshot);
  const rows = all.filter(row => selected === null || row.initiative.businessLine === selected);
  const counts = countByBusinessLine(all.map(row => row.initiative.businessLine));
  const emptyCount = STAGES.filter(stage => !rows.some(row => row.initiative.stage === stage)).length;
  const stats = (row: typeof rows[number]) => ({
    open: row.findings.filter(f => f.type === "CONFLICT" && f.status === "OPEN" && f.actionable).length,
    history: row.findings.filter(f => f.type === "SUPERSEDED").length,
    inScope: row.evidence.filter(e => e.boundary === "CURRENT_SCOPE" || e.boundary === "FUTURE_PHASE").length,
    active: row.claims.filter(c => c.status === "ACTIVE").length,
    unverified: row.claims.filter(c => c.status === "UNVERIFIED").length,
  });
  return <div className={styles.page}>
    <header className={styles.head}><h1>Portfolio intelligence</h1><p>Recorded foundation and deterministic Review output only. Stage is shown exactly as recorded.</p></header>
    <BusinessLineFilter basePath="/reporting" selected={selected} counts={counts} total={all.length} />
    <section className={styles.section}><div className={styles.sectionHead}><h2>Lifecycle Track</h2><span>Stage as recorded</span></div>
      <div className={styles.lifecycle}>{STAGES.map(stage => {
        const stageRows = rows.filter(row => row.initiative.stage === stage);
        return <div key={stage} className={stageRows.length ? styles.stage : styles.emptyStage}><h3>{STAGE_LABEL[stage]}</h3>{stageRows.map(row => {
          const s=stats(row); return <Link href={`/initiatives/${row.initiative.slug}`} key={row.initiative.id}><strong>{initiativeCode(row.initiative.knownReferences)} · {row.initiative.name}</strong><span>{BUSINESS_LINE_LABEL[row.initiative.businessLine]} · {s.open} open conflict{s.open===1?"":"s"}</span></Link>;
        })}</div>;
      })}</div>
      {emptyCount > 0 && <details className={styles.emptySummary}><summary>{emptyCount} lifecycle stages have no initiatives</summary>{STAGES.filter(stage => !rows.some(row => row.initiative.stage === stage)).map(stage => <span key={stage}>{STAGE_LABEL[stage]}</span>)}</details>}
    </section>
    <section className={styles.section}><div className={styles.sectionHead}><h2>Decision Pressure</h2><span>Current deterministic Review output</span></div>
      <div className={styles.pressure}>{rows.map(row => {const s=stats(row); return <div key={row.initiative.id}><strong>{row.initiative.name}</strong>{row.claims.length===0?<span>no claims recorded</span>:<><span>{s.open ? `${s.open} open conflict${s.open===1?"":"s"}` : "No open conflict is derived under the current rules"}</span><span>{s.history} superseded histor{s.history===1?"y":"ies"}</span></>}</div>})}</div>
    </section>
    <section className={styles.section}><div className={styles.sectionHead}><h2>Knowledge Foundation</h2><span>Recorded foundation coverage</span></div>
      <div className={styles.matrixHead}><span>Initiative</span><span>In-scope evidence</span><span>ACTIVE claims</span><span>UNVERIFIED claims</span><span>Open conflicts</span></div>
      <div className={styles.matrix}>{rows.map(row=>{const s=stats(row);return <div key={row.initiative.id} className={styles.matrixRow} data-founded={row.claims.length>0||undefined}><strong>{row.initiative.name}</strong>{[s.inScope,s.active,s.unverified,s.open].map((value,index)=><span key={index} data-populated={value>0||undefined}><i>{["In-scope evidence","ACTIVE claims","UNVERIFIED claims","Open conflicts"][index]}</i>{value}</span>)}</div>})}</div>
    </section>
  </div>;
}
