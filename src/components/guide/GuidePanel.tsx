"use client";
import Link from "next/link";
import { useRef, useState, useSyncExternalStore } from "react";
import styles from "./GuidePanel.module.css";

const chapters=[
  {title:"Your product workspace",eyebrow:"Start here",body:"Prodwise connects product evidence to a current initiative record, the decisions people need to make, delivery dates and a shared weekly review.",points:[["Home","See what needs attention and what changed across the portfolio."],["Initiatives","Open an initiative: a product change with its own scope, evidence and delivery facts."]],href:"/",link:"Open Home"},
  {title:"Understand an initiative",eyebrow:"Current state",body:"Start with Brief to orient yourself before making a change. It brings together the current record, open decisions and delivery context.",points:[["Brief","What is happening now, and what needs attention?"],["Delivery facts","Record scope, dates, the next milestone and the next step. Unknown dates stay unknown."]],href:"/initiatives",link:"Open Initiatives"},
  {title:"Trace the record",eyebrow:"Evidence & knowledge",body:"Knowledge shows what is recorded and how it was confirmed. Sources holds the documents, meetings and other evidence behind it.",points:[["Knowledge","Inspect the current value, its context, confirmation and replacement history."],["Sources","Read the source summary, reference and supporting excerpt. A source link is not automatic approval."]],href:"/initiatives",link:"Choose an initiative"},
  {title:"Resolve a decision",eyebrow:"Human judgement",body:"Decisions puts differing recorded values together with their evidence. Check the scope and sources, then record the human decision.",points:[["Values differ","A deterministic check compares recorded values. It does not assess business impact."],["Replacement history","An explicitly replaced requirement stays visible as history; it is not an open conflict."]],href:"/initiatives",link:"Choose an initiative"},
  {title:"Review delivery together",eyebrow:"Weekly management rhythm",body:"Roadmap reads confirmed delivery facts. The Weekly Review is one shared portfolio document, compared with the previous finalized week.",points:[["Claude drafts","AI proposes wording supported by the current record and changes. A template remains available if AI is unavailable."],["People finalize","Review and save each section before finalizing. Final freezes a review snapshot; it does not approve a release."]],href:"/weekly-review",link:"Open Weekly Review"},
  {title:"Measure what is known",eyebrow:"Analysis",body:"Portfolio Analysis counts recorded stages, delivery targets and attention. Project Analysis needs approved metric definitions and observations before it can show business results.",points:[["Missing is not zero","No observations means no performance conclusion."],["Return whenever useful","This guide saves your place in this browser. Close it and continue your work."]],href:"/analysis",link:"Open Analysis"},
];
const eventName="prodwise-guide-change";
function subscribe(callback:()=>void) { window.addEventListener("storage",callback);window.addEventListener(eventName,callback);return ()=>{window.removeEventListener("storage",callback);window.removeEventListener(eventName,callback);}; }
export function GuidePanel({storageKey="workspace"}:{storageKey?:string}) {
  const key=`prodwise.guide.v1:${storageKey}`;
  const serialized=useSyncExternalStore(subscribe,()=>{try{return window.localStorage.getItem(key) ?? "";}catch{return "";}},()=>null);
  const saved=(()=>{try{const value:unknown=JSON.parse(serialized || "{}");return value && typeof value==="object" && !Array.isArray(value) ? value as {dismissed?:boolean;step?:number} : {};}catch{return {};}})();
  const [current,setCurrent]=useState<number|null>(null);
  const step=Math.min(chapters.length-1,Math.max(0,current ?? (Number.isInteger(saved.step)?saved.step!:0)));
  const chapter=chapters[step]!;
  const dialog=useRef<HTMLDialogElement>(null);
  function save(nextStep=step) {try{window.localStorage.setItem(key,JSON.stringify({dismissed:true,step:nextStep}));window.dispatchEvent(new Event(eventName));}catch{/* Guidance remains usable if browser storage is unavailable. */} }
  function open(){save();dialog.current?.showModal();}
  function close(){save();dialog.current?.close();}
  function move(next:number){setCurrent(next);save(next);}
  return <>
    {serialized!==null && !saved.dismissed && <aside className={styles.welcome} aria-labelledby="guide-welcome-heading"><div><p className={styles.eyebrow}>Welcome to Prodwise</p><h2 id="guide-welcome-heading">Evidence to decisions. A clearer product week.</h2><p>Start with Home for attention, or take a short look around.</p></div><div className={styles.welcomeActions}><button className={styles.primary} onClick={open}>Quick guide</button><button className={styles.dismiss} onClick={()=>save()} aria-label="Dismiss welcome">Continue working</button></div></aside>}
    <button className={styles.trigger} onClick={open} aria-haspopup="dialog"><span aria-hidden="true">?</span>Guide</button>
    <dialog ref={dialog} className={styles.dialog} aria-labelledby="guide-title" onCancel={()=>save()} onClick={event=>{if(event.target===event.currentTarget){const bounds=event.currentTarget.getBoundingClientRect();if(event.clientX<bounds.left||event.clientX>bounds.right||event.clientY<bounds.top||event.clientY>bounds.bottom)close();}}}>
      <header className={styles.header}><span>Prodwise guide</span><button onClick={close} aria-label="Close guide">Close ×</button></header>
      <div className={styles.content}><p className={styles.eyebrow}>{chapter.eyebrow} · {step+1} of {chapters.length}</p><h2 id="guide-title">{chapter.title}</h2><p className={styles.intro}>{chapter.body}</p><dl>{chapter.points.map(([term,body])=><div key={term}><dt>{term}</dt><dd>{body}</dd></div>)}</dl><Link href={chapter.href} onClick={close}>{chapter.link} →</Link></div>
      <footer className={styles.footer}><button onClick={()=>move(step-1)} disabled={step===0}>← Back</button><span>Your place is saved</span>{step<chapters.length-1?<button className={styles.primary} onClick={()=>move(step+1)}>Next →</button>:<button className={styles.primary} onClick={close}>Done</button>}</footer>
    </dialog>
  </>;
}
