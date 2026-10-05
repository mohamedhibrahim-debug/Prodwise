'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PRODUCT_LABEL, PRODUCTS, type Product, type AggregateEntry, type MetricTarget, type PerformanceImport } from '@/lib/executive/types';
import { comparableGrowth, type MonthlyPerformance } from '@/lib/executive/projection';
import { InstrumentIcon } from '@/components/shell/InstrumentIcon';
import { ImportDialog } from './ImportDialog';
import { AggregateDialog } from './AggregateDialog';
import styles from './Executive.module.css';

const amount=(cents:number|null|undefined)=>cents==null?'Not recorded':new Intl.NumberFormat('en-GB',{style:'currency',currency:'EGP',maximumFractionDigits:2}).format(cents/100);
const compact=(cents:number)=>new Intl.NumberFormat('en-GB',{notation:'compact',maximumFractionDigits:2}).format(cents/100);
const monthLabel=(month:string)=>new Date(month+'-01T12:00:00Z').toLocaleDateString('en-GB',{month:'short',year:'numeric',timeZone:'UTC'});
export function BusinessPerformance({product,series,imports,aggregates,targets,workspaceId,canWrite,isDemo}:{product:Product;series:MonthlyPerformance[];imports:PerformanceImport[];aggregates:AggregateEntry[];targets:MetricTarget[];workspaceId:string;canWrite:boolean;isDemo:boolean}){
  const router=useRouter();const [period,setPeriod]=useState(series.at(-1)?.month??''),[kind,setKind]=useState<'cashIn'|'payments'>('cashIn');
  const [importing,setImporting]=useState(false),[aggregate,setAggregate]=useState(false),[targetOpen,setTargetOpen]=useState(false);
  const [aggregateId,setAggregateId]=useState(aggregates.at(-1)?.id??'');
  const active=series.find(s=>s.month===period), cumulative=period==='all';
  const field=product==='CASH_COLLECTION'?kind:'gross';
  const scoped=cumulative?series:active?[active]:[];
  const volume=scoped.reduce((v,s)=>v+s[field],0), count=scoped.reduce((v,s)=>v+(product==='CASH_COLLECTION'?(kind==='cashIn'?s.cashInCount:s.paymentCount):s.count),0);
  const refunds=scoped.reduce((v,s)=>v+s.refunds,0), max=Math.max(1,...series.map(s=>s[field]));
  const growth=comparableGrowth(active,series[series.findIndex(s=>s.month===period)-1],field);
  const target=targets.find(t=>t.month===period&&t.product===product);
  const canUseTarget=!!active?.complete && (product!=='CASH_COLLECTION'||kind==='cashIn');
  const entry=aggregates.find(a=>a.id===aggregateId);
  const periodName=cumulative?'Available coverage':active?monthLabel(active.month):'No imported period';
  return <>
    <div className={styles.tabs} role="tablist" aria-label="Products">{PRODUCTS.map(p=><button role="tab" key={p} aria-selected={p===product} onClick={()=>router.push('/analysis/business?product='+p)}>{PRODUCT_LABEL[p]}</button>)}</div>
    <div className={styles.toolbar}>
      {product==='SALEFNY'?<label>Report period<select value={aggregateId} onChange={e=>setAggregateId(e.target.value)} aria-label="Report period">{!aggregates.length&&<option value="">No recorded reports</option>}{aggregates.map(a=><option key={a.id} value={a.id}>{a.start} to {a.end}</option>)}</select></label>:<label>Reporting period<select value={period} onChange={e=>setPeriod(e.target.value)} aria-label="Reporting period">{!series.length&&<option value="">No imported periods</option>}{series.map(s=><option key={s.month} value={s.month}>{monthLabel(s.month)}{s.complete?'':' / Partial'}</option>)}{!!series.length&&<option value="all">Cumulative / available periods</option>}</select></label>}
      {product==='CASH_COLLECTION'&&<div role="group" aria-label="Transaction type"><button aria-pressed={kind==='cashIn'} onClick={()=>setKind('cashIn')}>Cash-In</button><button aria-pressed={kind==='payments'} onClick={()=>setKind('payments')}>Payments</button></div>}
      <div className={styles.spacer}/>
      {canWrite&&product!=='SALEFNY'&&active&&!target&&(product!=='CASH_COLLECTION'||kind==='cashIn')&&<button className={styles.button} onClick={()=>setTargetOpen(true)}>Set approved target</button>}
      {canWrite&&<button className={styles.button} data-primary="true" disabled={isDemo&&product!=='SALEFNY'} onClick={()=>product==='SALEFNY'?setAggregate(true):setImporting(true)}><InstrumentIcon name="plus"/>{product==='SALEFNY'?'Record report':'Import data'}</button>}
    </div>
    {product==='SALEFNY'?entry?<>
      <div className={styles.stats}>{[['Principal issued',amount(entry.values.principal)],['Issue fees',amount(entry.values.fees)],['Total collected',amount(entry.values.collected)],['Remaining',amount(entry.values.remaining)]].map(([label,value])=><div className={styles.stat} key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>
      <dl className={styles.facts}><div><dt>Loans issued</dt><dd>{entry.values.issuedCount?.toLocaleString()??'Not recorded'}</dd></div><div><dt>Merchants onboarded</dt><dd>{entry.values.onboarded?.toLocaleString()??'Not recorded'}</dd></div><div><dt>Total issue / principal + fees</dt><dd>{entry.values.principal!==null&&entry.values.fees!==null?amount(entry.values.principal+entry.values.fees):'Not assessed'}</dd></div><div><dt>Collection performance rate</dt><dd>Due/cohort denominator not supplied</dd></div></dl>
      <section><h2>Source record</h2><p>{entry.source}</p><p className={styles.meta}>{entry.start} to {entry.end} / Manually reviewed by {entry.recordedBy} / Recorded {entry.recordedAt.slice(0,10)}</p>{entry.note&&<p className={styles.meta}>{entry.note}</p>}<p className={styles.meta}>Remaining is not classified as overdue. No monthly trend is inferred from this aggregate.</p></section>
    </>:<div className={styles.empty}><h2>No Salefny report recorded</h2><p>Principal, fees and collections have no approved values for this workspace.</p>{canWrite&&<button className={styles.button} onClick={()=>setAggregate(true)}>Record report</button>}</div>:!scoped.length?<div className={styles.empty}><h2>No performance data for {PRODUCT_LABEL[product]}</h2><p>No values have been published for this workspace.</p>{canWrite&&!isDemo&&<button className={styles.button} onClick={()=>setImporting(true)}>Import source file</button>}</div>:<>
      {active&&!active.complete&&<p className={styles.notice}>{periodName} / Partial or filtered coverage. Transactions through {active.lastDate}. Full-month comparison is unavailable.</p>}
      {cumulative&&<p className={styles.meta}>Available imported coverage: {series[0]!.firstDate} to {series.at(-1)!.lastDate}. This is not a full-calendar YTD assertion.</p>}
      <div className={styles.stats}>
        <div className={styles.stat}><span>{product==='CASH_COLLECTION'?(kind==='cashIn'?'Cash-In collected':'Payments collected'):'Gross successful payments'}</span><strong>{amount(volume)}</strong><small>{periodName}</small></div>
        <div className={styles.stat}><span>Successful transactions</span><strong>{count.toLocaleString()}</strong><small>Refunds excluded</small></div>
        <div className={styles.stat}><span>Average transaction</span><strong>{count?amount(volume/count):'Not applicable'}</strong><small>Successful volume / count</small></div>
        <div className={styles.stat}><span>Change vs previous month</span><strong>{growth===null?'Not comparable':`${growth>0?'+':''}${growth.toFixed(1)}%`}</strong><small>{growth===null?'Complete, same-source adjacent periods required':monthLabel(series[series.findIndex(s=>s.month===period)-1]!.month)}</small></div>
      </div>
      <div className={styles.split}><section><div className={styles.sectionHead}><h2>{product==='CASH_COLLECTION'?(kind==='cashIn'?'Cash-In volume':'Payments volume'):'Gross payment volume'}</h2><span className={styles.meta}>EGP / monthly</span></div><div className={styles.chart} role="group" aria-label="Monthly volume chart">{series.map(s=><div className={styles.column} key={s.month}><small>{compact(s[field])}</small><button title={`${monthLabel(s.month)}: ${amount(s[field])}${s.complete?'':' / Partial'}`} aria-label={`${monthLabel(s.month)}: ${amount(s[field])}${s.complete?'':' / Partial'}`} onClick={()=>setPeriod(s.month)} style={{height:`${Math.max(1,s[field]/max*170)}px`}} data-partial={!s.complete}/><span>{monthLabel(s.month)}</span></div>)}</div><p className={styles.meta}>Amber columns: partial or filtered reporting periods.</p></section>
      <section><div className={styles.sectionHead}><h2>Period context</h2></div><dl className={styles.summaryList}><div><dt>Approved target{product==='CASH_COLLECTION'?' / Cash-In':''}</dt><dd>{target?amount(target.amount):'Not recorded'}</dd></div><div><dt>Variance to target</dt><dd>{target&&canUseTarget?amount(volume-target.amount):'Not assessed'}</dd></div>{product==='WALLET'&&<><div><dt>Refunds recorded in this period</dt><dd>{amount(refunds)}</dd></div><div><dt>Receives less period refunds</dt><dd>{amount(volume-refunds)}</dd></div></>}<div><dt>Overall success rate</dt><dd>Not available from success-only reporting</dd></div><div><dt>Sources</dt><dd>{[...new Set(scoped.flatMap(s=>s.sources))].join(', ')}</dd></div></dl></section></div>
      {product==='CASH_COLLECTION'&&active&&<section><div className={styles.sectionHead}><h2>Business units</h2><span className={styles.meta}>Source-assigned classification / all transaction types</span></div><div className={styles.scroll}><table className={styles.table}><thead><tr><th>Business unit</th><th>Successful volume</th><th>Transactions</th></tr></thead><tbody>{active.byUnit.filter(u=>u.count>0).map(u=><tr key={u.unit}><td>{u.unit==='UNASSIGNED'?'Unassigned':u.unit}</td><td>{amount(u.amount)}</td><td>{u.count.toLocaleString()}</td></tr>)}</tbody></table></div><dl className={styles.facts}><div><dt>Active runners / all types</dt><dd>{active.runners}</dd></div><div><dt>Active suppliers / all types</dt><dd>{active.suppliers}</dd></div><div><dt>Active terminals / all types</dt><dd>{active.terminals}</dd></div><div><dt>Active days / all types</dt><dd>{active.days}</dd></div></dl></section>}
      <details><summary>Monthly figures</summary><div className={styles.scroll}><table className={styles.table}><thead><tr><th>Period</th><th>Volume</th><th>Transactions</th><th>Coverage</th></tr></thead><tbody>{series.map(s=><tr key={s.month}><td>{monthLabel(s.month)}</td><td>{amount(s[field])}</td><td>{(product==='CASH_COLLECTION'?(kind==='cashIn'?s.cashInCount:s.paymentCount):s.count).toLocaleString()}</td><td>{s.complete?'Complete':'Partial / filtered'}</td></tr>)}</tbody></table></div></details>
    </>}
    {!!imports.length&&<details><summary>Import history / {imports.filter(i=>!i.digest.startsWith('batch:')).length} files</summary><div className={styles.scroll}><table className={styles.table}><thead><tr><th>Source file / batch approval</th><th>Reporting coverage</th><th>Added / duplicates</th><th>Approved by</th></tr></thead><tbody>{imports.slice().reverse().map(i=><tr key={i.id}><td>{i.fileName}<small>{i.source}</small></td><td>{i.periodStart} to {i.periodEnd}<small>{i.coverage.toLowerCase()}</small></td><td>{i.digest.startsWith('batch:')?'Coverage approval':`${i.added.toLocaleString()} / ${i.duplicates.toLocaleString()}`}</td><td>{i.recordedBy}<small>{i.recordedAt.slice(0,10)}</small></td></tr>)}</tbody></table></div></details>}
    {importing&&<ImportDialog product={product} workspaceId={workspaceId} close={()=>setImporting(false)}/>}
    {aggregate&&<AggregateDialog workspaceId={workspaceId} close={()=>setAggregate(false)}/>}
    {targetOpen&&<AggregateDialog workspaceId={workspaceId} target={{product,month:period}} close={()=>setTargetOpen(false)}/>}
  </>;
}
