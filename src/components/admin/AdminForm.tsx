"use client";
import {useActionState,useId,useState,useRef,useEffect} from "react";
import Link from "next/link";
import type {AuthFormState} from "@/components/auth/AuthForm";
import styles from "./admin.module.css";
export type AdminField={name:string;label:string;type?:"text"|"email"|"password"|"textarea"|"select"|"checkbox";value?:string;required?:boolean;hint?:string;options?:{value:string;label:string}[];minLength?:number;maxLength?:number;autoComplete?:string;previousLabel?:string;showPrevious?:boolean};
export function AdminForm({action,fields,hidden={},scopeWorkspaceId,submit,disabled=false,consequence,cancelHref}:{action:(state:AuthFormState,form:FormData)=>Promise<AuthFormState>;fields:AdminField[];hidden?:Record<string,string>;scopeWorkspaceId:string;submit:string;disabled?:boolean;consequence?:string;cancelHref?:string}){
 const id=useId();
 const [values,setValues]=useState<Record<string,string>>(()=>Object.fromEntries(fields.map(f=>[f.name,f.value??""])));
 const [reviewing,setReviewing]=useState(false); const reviewHeading=useRef<HTMLHeadingElement>(null); useEffect(()=>{if(reviewing)reviewHeading.current?.focus();},[reviewing]);
 const [state,formAction,pending]=useActionState(async(previous:AuthFormState,form:FormData)=>{const result=await action(previous,form);if(!result.error){setReviewing(false);setValues(current=>({...current,...Object.fromEntries(fields.filter(f=>f.type==="password").map(f=>[f.name,""]))}));}return result;},{error:null});
 const invitationLink=state.link&&typeof window!=="undefined"?new URL(state.link,window.location.origin).href:state.link;
 const change=(name:string,value:string)=>{setValues(v=>({...v,[name]:value}));setReviewing(false);};
 return <form action={formAction} className={styles.form} aria-busy={pending} onSubmit={e=>{if(consequence&&!reviewing){e.preventDefault();setReviewing(true);}}}>
  <input type="hidden" name="reviewConfirmed" value={consequence&&reviewing?"yes":""}/><input type="hidden" name="scopeWorkspaceId" value={scopeWorkspaceId}/>{Object.entries(hidden).map(([name,value])=><input key={name} type="hidden" name={name} value={value}/>)}
  {state.error&&<p id={id+"-error"} role="alert" className={styles.error}>{state.error} Review the fields below; your entries have been kept.</p>}
  {state.message&&<p role="status" className={styles.success}>{state.message}</p>}
  {invitationLink&&<div className={styles.notice}><strong>Private invitation link</strong><p>Share only with the intended person. Expires in seven days.</p><a href={invitationLink}>{invitationLink}</a></div>}
  <fieldset disabled={disabled||pending}><legend className="visually-hidden">{submit}</legend>{fields.map(field=>{
   const fid=id+"-"+field.name,described=[field.hint?fid+"-hint":"",state.error?id+"-error":""].filter(Boolean).join(" ")||undefined;
   return <div className={styles.field} key={field.name}><label htmlFor={fid}>{field.label}{field.required&&<span aria-hidden="true"> *</span>}</label>
   {field.type==="textarea"?<textarea id={fid} name={field.name} value={values[field.name]} onChange={e=>change(field.name,e.target.value)} required={field.required} maxLength={field.maxLength??4000} aria-describedby={described}/>:
    field.type==="select"?<select id={fid} name={field.name} value={values[field.name]} onChange={e=>change(field.name,e.target.value)} required={field.required} aria-describedby={described}>{field.options?.map(option=><option key={option.value} value={option.value}>{option.label}</option>)}</select>:
    field.type==="checkbox"?<input id={fid} name={field.name} type="checkbox" checked={values[field.name]==="on"} onChange={e=>change(field.name,e.target.checked?"on":"")} aria-describedby={described}/>:
    <input id={fid} name={field.name} type={field.type??"text"} value={values[field.name]} onChange={e=>change(field.name,e.target.value)} required={field.required} minLength={field.minLength} maxLength={field.maxLength??256} autoComplete={field.autoComplete} aria-describedby={described}/>}
   {field.hint&&<p id={fid+"-hint"} className={styles.meta}>{field.hint}</p>}</div>;
  })}</fieldset>
  {consequence&&reviewing&&<section className={styles.confirmation} aria-labelledby={id+"-review"}><h3 ref={reviewHeading} tabIndex={-1} id={id+"-review"}>Review this change</h3><p>{consequence}</p><dl>{fields.filter(f=>f.type!=="password").map(f=><div key={f.name}><dt>{f.label}</dt><dd>{f.type==="checkbox"?(values[f.name]==="on"?"Yes — deliberately override":"No override"):f.options?.find(o=>o.value===values[f.name])?.label||values[f.name]||"None"}{f.showPrevious!==false&&f.type!=="checkbox"&&(f.previousLabel!==undefined||(f.value!==undefined&&f.value!==values[f.name]))&&<small>Previously: {f.previousLabel??(f.options?.find(o=>o.value===f.value)?.label||f.value||"None")}</small>}</dd></div>)}</dl></section>}
  <div className={styles.actions}><button type={consequence&&!reviewing?"button":"submit"} onClick={event=>{if(consequence&&!reviewing){event.preventDefault();if(event.currentTarget.form?.reportValidity())setReviewing(true);}}} className={consequence&&reviewing&&submit.startsWith("Replace")?styles.danger:consequence&&!reviewing?styles.secondary:styles.primary} disabled={disabled||pending}>{pending?"Saving…":consequence&&!reviewing?"Review changes":submit}</button>{reviewing&&<button type="button" className={styles.secondary} onClick={()=>setReviewing(false)} disabled={pending}>Keep editing</button>}{cancelHref&&<Link prefetch={false} className={styles.secondary} href={cancelHref}>Cancel</Link>}</div>
 </form>;
}
