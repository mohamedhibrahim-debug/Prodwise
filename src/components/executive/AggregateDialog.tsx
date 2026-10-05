'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog } from './Dialog';
import type { Product } from '@/lib/executive/types';
import styles from './Executive.module.css';
export function AggregateDialog({workspaceId,close,target}:{workspaceId:string;close:()=>void;target?:{product:Product;month:string}}){
  const [busy,setBusy]=useState(false),[error,setError]=useState('');const router=useRouter();
  async function submit(e:React.FormEvent<HTMLFormElement>){e.preventDefault();setBusy(true);setError('');try{const data=Object.fromEntries(new FormData(e.currentTarget));const result=await fetch('/api/executive/aggregate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...data,workspaceId,...(target?{mode:'target',product:target.product,month:target.month,start:target.month+'-01',end:target.month+'-01'}:{})})});const json=await result.json();if(!result.ok)throw Error(json.error);router.refresh();close();}catch(e){setError(e instanceof Error?e.message:'Could not save.');}finally{setBusy(false);}}
  return <Dialog title={target?'Record approved monthly target':'Record Salefny report'} close={close}><form className={styles.form} onSubmit={submit}>
    {target?<label className={`${styles.field} ${styles.full}`}>Target amount / EGP / {target.month}<input name="amount" type="number" min="0" step="0.01" required /></label>:<>
      <label className={styles.field}>Period from<input name="start" type="date" required /></label><label className={styles.field}>Period to<input name="end" type="date" required /></label>
      {([['principal','Principal issued / EGP'],['fees','Issue fees / EGP'],['collected','Collected / EGP'],['remaining','Remaining / EGP'],['issuedCount','Loans issued'],['onboarded','Merchants onboarded']] as const).map(([name,label])=><label className={styles.field} key={name}>{label}<input name={name} type="number" min="0" step={['issuedCount','onboarded'].includes(name)?'1':'0.01'} /></label>)}</>}
    <label className={`${styles.field} ${styles.full}`}>{target?'Approval reference':'Source report / screenshot reference'}<textarea name="source" required maxLength={2000} /></label>
    <label className={`${styles.field} ${styles.full}`}>Notes<input name="note" maxLength={2000}/></label>
    <label className={styles.full}><input type="checkbox" required /> I have reviewed these values against the source.</label>
    {error&&<p className={`${styles.error} ${styles.full}`} role="alert">{error}</p>}<div className={styles.actions}><button className={styles.button} type="button" onClick={close}>Cancel</button><button className={styles.button} data-primary="true" disabled={busy}>{busy?'Saving...':'Approve and save'}</button></div>
  </form></Dialog>;
}
