'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PRODUCT_LABEL, type Product } from '@/lib/executive/types';
import { Dialog } from './Dialog';
import styles from './Executive.module.css';
interface Preview { source:string; rows:number; added:number; duplicates:number; excluded:number; gross:number; refunds:number; firstDate:string; lastDate:string; digest:string; alreadyImported:boolean; files:{name:string;rows:number;firstDate:string;lastDate:string;alreadyImported:boolean}[]; }
export function ImportDialog({ product, workspaceId, close }: { product:Product; workspaceId:string; close:()=>void }) {
  const form = useRef<HTMLFormElement>(null), router=useRouter();
  const [preview,setPreview]=useState<Preview|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const upload=useRef<{id:string;key:string}|null>(null);
  async function discardUpload() {
    const current=upload.current;upload.current=null;
    if(current)await fetch('/api/executive/uploads',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:current.id,workspaceId})}).catch(()=>undefined);
  }
  function dismiss(){if(busy)return;void discardUpload();close();}
  async function send(publish:boolean) {
    if(!form.current?.reportValidity())return;
    setBusy(true);setError('');
    try {
      const data=new FormData(form.current);data.set('product',product);data.set('workspaceId',workspaceId);data.set('mode',publish?'publish':'preview');data.set('sourceConfirmed','true');
      const files=data.getAll('file') as File[];
      if(!files.length||files.length>12||files.some(file=>!file.size)||files.reduce((total,file)=>total+file.size,0)>25_000_000)throw Error('Select 1 to 12 non-empty files, up to 25 MB total.');
      const key=JSON.stringify(files.map(file=>[file.name,file.size,file.lastModified]));
      if(upload.current?.key!==key){
        await discardUpload();
        const preparation=await fetch('/api/executive/uploads',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({workspaceId,files:files.map(file=>({name:file.name,size:file.size}))})});
        const prepared=await preparation.json();
        if(!preparation.ok)throw Error(prepared.error??'Could not prepare upload.');
        if(!prepared.local){
          upload.current={id:prepared.id,key};
          try {
            for(let index=0;index<files.length;index++){
              const sent=await fetch(prepared.urls[index],{method:'PUT',headers:{'Content-Type':'application/octet-stream','x-upsert':'false'},body:files[index]});
              if(!sent.ok)throw Error(`Could not upload ${files[index]!.name}. Retry the import.`);
            }
          }catch(e){await discardUpload();throw e;}
        }
      }
      if(upload.current){data.delete('file');data.set('uploadId',upload.current.id);}
      if(publish&&preview)data.set('digest',preview.digest);
      const response=await fetch('/api/executive/import',{method:'POST',body:data});
      if(!response.headers.get('content-type')?.includes('application/json'))throw Error('The import service could not finish. Retry; no success has been confirmed.');
      const result=await response.json();
      if(!response.ok)throw Error(result.error??'Import failed.');
      if(publish){upload.current=null;router.refresh();close();}else setPreview(result);
    }catch(e){setError(e instanceof Error?e.message:'Import failed.');}finally{setBusy(false);}
  }
  return <Dialog title={`Import ${PRODUCT_LABEL[product]}`} close={dismiss}>
    <form ref={form} className={styles.form} onChange={()=>setPreview(null)} onSubmit={e=>{e.preventDefault();void send(false);}}>
      <label className={`${styles.field} ${styles.full}`}>Source files / up to 12, 25 MB total<input name="file" type="file" accept=".csv,.xlsx" multiple required disabled={busy} /></label>
      <label className={styles.field}>Combined reporting period from<input name="periodStart" type="date" required /></label><label className={styles.field}>Combined reporting period to<input name="periodEnd" type="date" required /></label>
      <label className={styles.field}>Coverage<select name="coverage" defaultValue="PARTIAL"><option value="PARTIAL">Partial / filtered export</option><option value="COMPLETE">Complete for this source and period</option></select></label>
      <label className={styles.field}>Business unit<select name="businessUnit" defaultValue="UNASSIGNED"><option value="UNASSIGNED">Unassigned / mixed</option><option value="BP">BP</option><option value="FS">FS</option></select></label>
      <label className={`${styles.field} ${styles.full}`}>Source or approval note<input name="note" maxLength={2000} /></label>
      <label className={styles.full}><input type="checkbox" required /> Amounts are EGP{product==='CASH_COLLECTION'?', and this export contains successful transactions only with no tests or refunds':''}.</label>
      {preview&&<div className={styles.full}><h3>Import preview</h3><dl className={styles.facts}>{[['Transactions',preview.rows.toLocaleString()],['New',preview.added.toLocaleString()],['Already recorded',preview.duplicates.toLocaleString()],['Excluded report / non-success rows',preview.excluded.toLocaleString()],['Gross amount',`EGP ${preview.gross.toLocaleString('en-GB',{maximumFractionDigits:2})}`],['Refund amount',product==='WALLET'?`EGP ${preview.refunds.toLocaleString()}`:'Not supplied']].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl><p className={styles.meta}>{preview.source} / Transactions dated {preview.firstDate} to {preview.lastDate}</p>{preview.alreadyImported&&<p className={styles.notice}>This file has already been imported.</p>}</div>}
      {preview&&<div className={`${styles.scroll} ${styles.full}`}><table className={styles.table}><thead><tr><th>File</th><th>Transactions</th><th>Transaction dates</th><th>Import status</th></tr></thead><tbody>{preview.files.map((file,index)=><tr key={index}><td>{file.name}</td><td>{file.rows.toLocaleString()}</td><td>{file.firstDate} to {file.lastDate}</td><td>{file.alreadyImported?'Already imported / skipped':'Ready'}</td></tr>)}</tbody></table></div>}
      {error&&<p role="alert" className={`${styles.error} ${styles.full}`}>{error}</p>}
      <div className={styles.actions}><button type="button" className={styles.button} disabled={busy} onClick={dismiss}>Cancel</button><button type="submit" className={styles.button} disabled={busy}>{busy?'Processing...':'Preview import'}</button>{preview&&<button type="button" className={styles.button} data-primary="true" disabled={busy||preview.alreadyImported} onClick={()=>void send(true)}>Approve and import</button>}</div>
    </form>
  </Dialog>;
}
