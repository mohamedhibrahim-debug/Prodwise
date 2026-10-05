import Link from "next/link";
import {PageHeader} from "@/components/workspace/PageHeader";
import {formatDate} from "@/lib/domain/labels";
import styles from "./analysis.module.css";
export {default as styles} from "./analysis.module.css";
/** Portfolio Analysis and Initiative Analysis share one frame: the page header grammar, then the two-tab nav. */
export function AnalysisFrame({active,title,organizationName,asOf,synthetic,children}:{active:"portfolio"|"projects";title:string;organizationName:string;asOf:string;synthetic:boolean;children:React.ReactNode}){
 return <div className={styles.page}>
  <PageHeader title={title} meta={<>{organizationName} · {synthetic?"scenario date":"as of"} {formatDate(asOf)} · Cairo{synthetic?" · synthetic demo records":""}</>}/>
  <nav className={styles.nav} aria-label="Analysis sections"><Link href="/analysis/business">Business performance</Link><Link href="/analysis/portfolio" aria-current={active==="portfolio"?"page":undefined}>Delivery portfolio</Link><Link href="/analysis/projects" aria-current={active==="projects"?"page":undefined}>Initiatives</Link></nav>
  {children}
 </div>;
}
