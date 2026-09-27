'use client';
import {useActionState,useEffect,useRef,useState} from 'react';
import {ScopeField} from '@/components/auth/WorkspaceScope';
import {mapSourcesAction} from '@/app/initiatives/[slug]/manage/actions';
import type {SourceProvider} from '@/lib/workspace/source-mapping';
import styles from './source-mapper.module.css';
const providers:[SourceProvider,string,string][]=[['JIRA','Jira','Map epics, stories or tasks by key'],['DOCUMENT','Document','BRD, scope or decision log'],['EMAIL','Email','Approvals and confirmations'],['MEETING_NOTES','Meeting notes','Keep meeting context connected'],['PASTED_EVIDENCE','Pasted evidence','A retained reference for your excerpt'],['OTHER_URL','Other source','An external reference or link']];
type Item={reference:string;name:string;kind:string;url:string|null};
export function SourceMapper({slug,name}:{slug:string;name:string}){
 const dialog=useRef<HTMLDialogElement>(null),trigger=useRef<HTMLButtonElement>(null),heading=useRef<HTMLHeadingElement>(null),error=useRef<HTMLParagraphElement>(null);
 const [provider,setProvider]=useState<SourceProvider|null>(null),[items,setItems]=useState<Item[]>([{reference:'',name:'',kind:'Other',url:null}]);
 const [state,action,pending]=useActionState(mapSourcesAction,{error:null,message:null});
 useEffect(()=>{if(state.error)error.current?.focus();},[state]);
 const close=()=>{if(pending)return;dialog.current?.close();trigger.current?.focus();};
 const patch=(index:number,field:keyof Item,value:string)=>setItems(rows=>rows.map((row,n)=>n===index?{...row,[field]:field==='url'?(value||null):value}:row));
 return <><button type="button" className={styles.trigger} ref={trigger} onClick={()=>{dialog.current?.showModal();heading.current?.focus();}}>Add source</button>
 <dialog ref={dialog} className={styles.dialog} aria-labelledby={`source-heading-${slug}`} onCancel={e=>{if(pending)e.preventDefault();else trigger.current?.focus();}}>
  <header className={styles.header}><div><h3 id={`source-heading-${slug}`} tabIndex={-1} ref={heading}>Map sources to {name}</h3><p>Manual references · no live Jira, Drive or mailbox connection.</p></div><button type="button" aria-label="Close source mapping" disabled={pending} onClick={close}>Close</button></header>
  {!provider?<div className={styles.choices}>{providers.map(([id,label,description])=><button key={id} type="button" onClick={()=>{setProvider(id);setItems([{reference:'',name:'',kind:id==='JIRA'?'Epic':'Other',url:null}]);}}><strong>{label}</strong><span>{description}</span></button>)}</div>:<form action={action} className={styles.form}>
   <ScopeField/><input type="hidden" name="slug" value={slug}/><input type="hidden" name="provider" value={provider}/><input type="hidden" name="items" value={JSON.stringify(items)}/>
   <button type="button" className={styles.back} onClick={()=>setProvider(null)} disabled={pending}>← Change source type</button>
   {state.error&&<p ref={error} role="alert" tabIndex={-1} className={styles.error}>{state.error}</p>}
   {state.message&&<p role="status" className={styles.receipt}>{state.message}</p>}
   <fieldset><legend>{providers.find(p=>p[0]===provider)?.[1]} source</legend><label>Source workspace <input name="providerWorkspace" required maxLength={300} placeholder={provider==='JIRA'?'Example: delivery.example.test':'Example: Product shared drive'}/></label><p className={styles.hint}>Identifies where these references belong. Nothing is fetched from this workspace.</p>
   <div className={styles.pair}><label>{provider==='JIRA'?'Project key':'Container reference'}<input name="containerReference" required maxLength={300} placeholder={provider==='JIRA'?'PAY':'Folder, collection or thread reference'}/></label><label>{provider==='JIRA'?'Project display name':'Source display name'}<input name="containerName" required maxLength={200} placeholder={provider==='JIRA'?'Payments':'A name your team recognizes'}/></label></div></fieldset>
   <fieldset><legend>Mapped items ({items.length})</legend><p className={styles.hint}>Add each reference once. Existing matching references are reused across initiatives.</p>
   <ol className={styles.items}>{items.map((item,index)=><li key={index}><div className={styles.itemHeading}><strong>Item {index+1}</strong>{items.length>1&&<button type="button" aria-label={`Remove ${item.reference||`item ${index+1}`}`} onClick={()=>setItems(rows=>rows.filter((_,n)=>n!==index))}>Remove</button>}</div><div className={styles.pair}><label>{provider==='JIRA'?'Issue key':'Reference'}<input required maxLength={500} value={item.reference} onChange={e=>patch(index,'reference',e.target.value)}/></label><label>Display name<input required maxLength={200} value={item.name} onChange={e=>patch(index,'name',e.target.value)}/></label></div>{provider==='JIRA'&&<label>Work item type<select value={item.kind} onChange={e=>patch(index,'kind',e.target.value)}>{['Epic','Initiative','Story','Task','Other'].map(k=><option key={k}>{k}</option>)}</select></label>}<label>Link <span className={styles.hint}>Optional</span><input type="url" value={item.url??''} onChange={e=>patch(index,'url',e.target.value)}/></label></li>)}</ol>
   <button type="button" className={styles.add} disabled={items.length>=25||pending} onClick={()=>setItems(rows=>[...rows,{reference:'',name:'',kind:provider==='JIRA'?'Story':'Other',url:null}])}>Add another reference</button></fieldset>
   <label>Role in this initiative<select name="role" defaultValue="GENERAL"><option value="GENERAL">General evidence</option><option value="REQUIREMENTS">Requirements</option><option value="DELIVERY">Delivery</option><option value="DECISIONS">Decisions</option></select></label>
   <footer className={styles.footer}><button type="submit" disabled={pending}>{pending?'Linking…':`Link ${items.length} ${items.length===1?'item':'items'}`}</button><button type="button" disabled={pending} onClick={close}>{state.message?'Done':'Cancel'}</button></footer>
  </form>}
 </dialog></>;
}
