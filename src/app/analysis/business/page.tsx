import Link from 'next/link';
import { readExecutiveView } from '@/lib/executive/repository';
import { PRODUCTS, type Product } from '@/lib/executive/types';
import { workspacePresentation } from '@/lib/workspace/context';
import { canApprovePerformance } from '@/lib/executive/access';
import { isDemoWriteEnabled } from '@/lib/env';
import { PageHeader } from '@/components/workspace/PageHeader';
import { BusinessPerformance } from '@/components/executive/BusinessPerformance';
import styles from '@/components/executive/Executive.module.css';
export const metadata={title:'Business Analysis'};
export default async function BusinessAnalysis({searchParams}:{searchParams:Promise<{product?:string}>}){
  const query=await searchParams;
  const product:Product=(PRODUCTS as readonly string[]).includes(query.product??'')?query.product as Product:'PGW';
  const {ctx,state,series,available}=await readExecutiveView(product);
  const presentation=await workspacePresentation(ctx);
  return <main className={styles.page}>
    <PageHeader title="Business Analysis" meta={<>{presentation.organizationName} / Product performance{presentation.isDemo?' / Synthetic demo workspace':''}</>}/>
    <nav className={styles.tabs} aria-label="Analysis sections"><Link href="/analysis/business" aria-current="page">Business performance</Link><Link href="/analysis/portfolio">Delivery portfolio</Link><Link href="/analysis/projects">Initiatives</Link></nav>
    {!available&&<p className={styles.notice}>Business reporting storage is awaiting the database update. No performance values have been loaded.</p>}
    {presentation.isDemo&&<p className={styles.notice}>Synthetic demo workspace. Real business files are not accepted here.</p>}
    <BusinessPerformance key={`${product}-${state.revision}`} product={product} series={series} imports={state.imports.filter(i=>i.product===product)} aggregates={state.aggregates.filter(a=>a.product===product)} targets={state.targets.filter(t=>t.product===product)} workspaceId={ctx.workspaceId} canWrite={available&&canApprovePerformance(ctx)&&isDemoWriteEnabled} isDemo={presentation.isDemo}/>
  </main>;
}
