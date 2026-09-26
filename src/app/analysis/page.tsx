import Link from "next/link";
import type { Metadata } from "next";
import { readDelivery } from "@/lib/delivery/repository";
import { STAGE_LABEL, BUSINESS_LINE_LABEL } from "@/lib/domain/labels";
import { portfolioAnalysis } from "./model";
import styles from "./analysis.module.css";

export const metadata: Metadata = { title: "Analysis" };
export const dynamic = "force-dynamic";
const definitionFields=[
  ["Definition","The outcome being measured and its eligible population."],
  ["Source","An approved dataset and the person responsible for it."],
  ["Period","The observation window, timezone and comparison period."],
  ["Formula","A reproducible calculation, including exclusions."],
  ["Target","The agreed target, or an explicit statement that none is approved."],
  ["Target owner / approval","Who owns the target and when it was agreed."],
  ["Freshness","When observations were captured and last updated."],
] as const;

export default async function AnalysisPage({searchParams}:{searchParams:Promise<{initiative?:string}>}) {
  const {ctx,source,state,presentation}=await readDelivery();
  const {initiative:selection}=await searchParams;
  const summary=portfolioAnalysis(source,state,ctx.workspaceId,presentation.scenarioAt ?? new Date().toISOString());
  const selected=source.snapshots.find(s=>s.initiative.id===selection)?.initiative ?? source.snapshots[0]?.initiative;
  return <div className={styles.page}>
    <header className={styles.header}><div><p className={styles.eyebrow}>Portfolio & outcomes</p><h1>Analysis</h1><p>Definitions and counts you can cite.</p></div><span className={styles.cutoff}>{presentation.scenarioAt ? "Scenario date" : "As of"} · {summary.today}<small>Cairo · {presentation.organizationName}</small></span></header>
    <nav className={styles.tabs} aria-label="Analysis sections"><a href="#portfolio">Portfolio analysis</a><a href="#project">Project analysis</a></nav>
    <section id="portfolio" className={styles.section} aria-labelledby="portfolio-heading">
      <div className={styles.sectionHeader}><div><p className={styles.eyebrow}>Recorded activity</p><h2 id="portfolio-heading">Portfolio analysis</h2></div><Link href="/roadmap">Inspect delivery facts →</Link></div>
      <div className={styles.summary}>
        <div><strong>{summary.total}</strong><span>Initiatives in portfolio</span></div>
        <div><strong>{summary.upcoming}</strong><span>Targets in the next 28 days</span></div>
        <div><strong>{summary.targetMovements}</strong><span>Target date revisions in 28 days</span></div>
        <div><strong>{summary.unknownTargets}</strong><span>Target Live unknown</span></div>
      </div>
      {source.snapshots.some(s=>s.initiative.isDemo) && <p className={styles.synthetic}>Synthetic initiatives are included and labelled in the register. These counts describe their records, not real business performance.</p>}
      <div className={styles.columns}>
        <div className={styles.stagePane}><h3>Recorded lifecycle stages</h3><p className={styles.meta}>Stage describes position in the product lifecycle. It does not establish readiness or success.</p>
          <ol className={styles.stageList}>{summary.stages.map(row=><li key={row.stage}><span>{STAGE_LABEL[row.stage]}</span><span className={styles.track} aria-hidden="true"><i style={{width:`${summary.total ? row.count/summary.total*100 : 0}%`}}/></span><b>{row.count}</b></li>)}</ol>
        </div>
        <aside className={styles.attentionPane}><h3>Recorded attention</h3><dl><div><dt>Initiatives with open decisions</dt><dd>{summary.withDecisions}</dd></div><div><dt>Initiatives with a recorded blocker</dt><dd>{summary.withBlockers}</dd></div><div><dt>Past Target Live · confirmation needed</dt><dd>{summary.pastTarget}</dd></div></dl><p>A past target with no confirmed full launch calls for an update. It does not prove a missed launch. Categories may overlap.</p><Link href="/">Open attention on Home →</Link></aside>
      </div>
      <details className={styles.definitions}><summary>How these portfolio counts are calculated</summary><dl><div><dt>Initiatives</dt><dd>All initiative records in the current workspace. No active/inactive flag is inferred.</dd></div><div><dt>Upcoming targets</dt><dd>Confirmed Target Live from today through day 28, excluding a recorded full launch for the scope. Unknown targets are excluded and counted separately.</dd></div><div><dt>Target date revisions</dt><dd>Recorded changes from one known Target Live date to another in the last 28 calendar days, including today. Multiple changes to one initiative count separately.</dd></div><div><dt>Attention</dt><dd>Open actionable decisions from recorded values, explicit delivery blocker notes, and past targets awaiting full-launch confirmation. No automated risk or business-impact score.</dd></div></dl></details>
    </section>
    <section id="project" className={styles.section} aria-labelledby="project-heading">
      <div className={styles.sectionHeader}><div><p className={styles.eyebrow}>Business outcomes</p><h2 id="project-heading">Project analysis</h2></div><span className={styles.unconfigured}>Measurement not configured</span></div>
      <form className={styles.selector} action="/analysis#project"><label htmlFor="analysis-initiative">Initiative</label><select id="analysis-initiative" name="initiative" defaultValue={selected?.id ?? ""}>{!selected && <option value="">No initiatives recorded</option>}{source.snapshots.map(({initiative})=><option key={initiative.id} value={initiative.id}>{initiative.name}</option>)}</select><button disabled={!selected}>View initiative</button></form>
      <div className={styles.measurement}>
        <div className={styles.empty}><p className={styles.eyebrow}>{selected ? BUSINESS_LINE_LABEL[selected.businessLine] : "No initiative selected"}</p><h3>{selected?.name ?? "Define a measure when an initiative is ready"}</h3><p>No approved metric definitions or performance observations are recorded for this initiative.</p><p>Missing data is not zero performance. Delivery timing alone does not establish business impact.</p>{selected && <Link href={`/initiatives/${selected.slug}`}>Review initiative context →</Link>}</div>
        <div className={styles.metricDefinition}><h3>A measure needs an agreed definition</h3><p className={styles.meta}>Configuration checklist · no values inferred</p><dl>{definitionFields.map(([label,description])=><div key={label}><dt>{label}</dt><dd>{description}<span>Not configured</span></dd></div>)}</dl></div>
      </div>
    </section>
  </div>;
}
