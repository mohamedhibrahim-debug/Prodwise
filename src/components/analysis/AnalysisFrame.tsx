import Link from "next/link";
import styles from "./analysis.module.css";
export {default as styles} from "./analysis.module.css";
export function AnalysisFrame({active,title,subtitle,organizationName,asOf,synthetic,children}:{active:"portfolio"|"projects";title:string;subtitle?:string;organizationName:string;asOf:string;synthetic:boolean;children:React.ReactNode}){
 const day=new Date(asOf).toLocaleDateString("en-GB",{timeZone:"Africa/Cairo",day:"numeric",month:"short",year:"numeric"});
 return <div className={styles.page}>
  <header className={styles.header}>
   <div className={styles.heading}><p className={styles.eyebrow}>Analysis · {organizationName}</p><h1>{title}</h1><p className={styles.subtitle}>{subtitle??"Recorded measures, with their definitions and evidence."}</p></div>
   <p className={styles.cutoff}><span className={styles.cutoffLabel}>{synthetic?"Scenario date":"As of"}</span><strong>{day}</strong><span>Cairo · {synthetic?"Synthetic data":"Current organization"}</span></p>
  </header>
  <nav className={styles.nav} aria-label="Analysis sections"><Link href="/analysis/portfolio" aria-current={active==="portfolio"?"page":undefined}>Portfolio</Link><Link href="/analysis/projects" aria-current={active==="projects"?"page":undefined}>Initiatives</Link></nav>
  {children}
 </div>;
}
