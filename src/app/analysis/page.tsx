import Link from "next/link";
import type { Metadata } from "next";
import styles from "../home.module.css";
export const metadata: Metadata = { title: "Analysis" };
export default function AnalysisPage() {
  return <div className={styles.page}><header className={styles.head}><div>
    <p className={styles.eyebrow}>Product outcomes</p><h1>Analysis</h1>
    <p className={styles.subtitle}>Understand results against agreed measures.</p>
  </div></header><section className={styles.attention} aria-labelledby="analysis-empty" style={{marginTop:"var(--s-8)"}}>
    <h2 id="analysis-empty">Outcome data is not connected yet</h2>
    <p className={styles.support}>No performance observations, metric definitions or approved targets are recorded in Prodwise yet. Initiative stages and decision counts do not establish business outcomes.</p>
    <p className={styles.support}>Analysis will separate recorded results, calculations, interpretation and suggested actions for a selected reporting period. Pre-launch, unavailable data and an unapproved target are different states.</p>
    <Link className={styles.allLink} href="/initiatives">Open initiative register →</Link>
  </section></div>;
}
