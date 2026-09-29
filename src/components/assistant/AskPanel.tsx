'use client';
import {useCallback,useEffect,useId,useRef,useState,type FormEvent,type KeyboardEvent} from 'react';
import {BrandMark} from '@/components/primitives/BrandMark';
import {Button} from '@/components/primitives/Button';
import {InstrumentIcon} from '@/components/shell/InstrumentIcon';
import {QUESTION_LIMIT,type LanguagePreference} from '@/lib/assistant/types';
import type {Starter} from '@/lib/assistant/starters';
import {answerView,failureView,userView,type Turn} from '@/lib/assistant/panel-model';
import {AnswerBody,Runs} from './AnswerBlocks';
import styles from './ask.module.css';

export interface AskPanelProps{
 sheet:boolean;
 contextLine:string;
 starters:Starter[];
 turns:Turn[];
 busy:boolean;
 terms:string[];
 configured:boolean|null;
 language:LanguagePreference;
 onSend:(question:string)=>void;
 onRetry:(turnId:string)=>void;
 onClose:()=>void;
}

/** The composer grows to four lines, then scrolls. */
const COMPOSER_LINES=4;

/**
 * The open Ask Prodwise surface: a floating panel above the control on
 * desktop, a bottom sheet on phones. Non-modal on desktop — the page stays
 * usable and scrollable beside it — with focus moved in on open and returned
 * on close. The panel itself never changes direction; only message bodies do.
 */
export function AskPanel({sheet,contextLine,starters,turns,busy,terms,configured,language,onSend,onRetry,onClose}:AskPanelProps){
 const panel=useRef<HTMLDivElement>(null);const heading=useRef<HTMLHeadingElement>(null);const composer=useRef<HTMLTextAreaElement>(null);const thread=useRef<HTMLDivElement>(null);
 const [draft,setDraft]=useState('');
 const hintId=useId();

 // Focus moves in on open: the composer on desktop; the heading on a phone, so the keyboard does not pop before the person reads.
 useEffect(()=>{(sheet?heading.current:composer.current)?.focus({preventScroll:true});},[sheet]);
 // Escape closes when the panel, the page body or the main region has focus; menus and dialogs keep their own Escape.
 useEffect(()=>{
  const key=(e:globalThis.KeyboardEvent)=>{
   if(e.key!=='Escape'||document.querySelector('[role="menu"],dialog[open]'))return;
   const active=document.activeElement;
   if(panel.current?.contains(active)||active===document.body||active?.id==='main-content'){e.preventDefault();onClose();}
  };
  document.addEventListener('keydown',key);return()=>document.removeEventListener('keydown',key);
 },[onClose]);
 // The newest turn scrolls into view.
 useEffect(()=>{const el=thread.current;if(el)el.scrollTop=el.scrollHeight;},[turns.length,busy]);

 const grow=useCallback(()=>{
  const el=composer.current;if(!el)return;
  el.style.height='auto';
  const line=parseFloat(getComputedStyle(el).lineHeight)||20;
  const pad=parseFloat(getComputedStyle(el).paddingTop)+parseFloat(getComputedStyle(el).paddingBottom);
  el.style.height=`${Math.min(el.scrollHeight,line*COMPOSER_LINES+pad)}px`;
 },[]);
 const submit=useCallback(()=>{
  const q=draft.trim();if(!q||busy)return;
  onSend(q);setDraft('');
  requestAnimationFrame(()=>{grow();composer.current?.focus({preventScroll:true});});
 },[draft,busy,onSend,grow]);
 const onKey=(e:KeyboardEvent<HTMLTextAreaElement>)=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();submit();}};
 const onSubmit=(e:FormEvent)=>{e.preventDefault();submit();};

 const last=turns.at(-1);
 const askNext=!busy&&turns.length>0&&(last?.role==='answer'||(last?.role==='failure'&&failureView(last).showStarters));
 const starterDir=language==='ar'?'rtl':'ltr';
 const starterRow=(compact:boolean)=><div className={styles.starters} data-compact={compact||undefined} role="group" aria-label={compact?'Ask next':'Suggested questions'}>
  {compact&&<span className={styles.startersLabel}>Ask next</span>}
  {starters.map(s=><button key={s.key} type="button" className={styles.starter} disabled={busy} onClick={()=>onSend(s.question)} title={s.question}><span dir={starterDir} lang={language==='ar'?'ar':'en'}>{s.label}</span></button>)}
 </div>;

 return <>
  {sheet&&<div className={styles.scrim} aria-hidden="true" onPointerDown={onClose}/>}
  <div ref={panel} id="ask-prodwise-panel" className={styles.panel} data-sheet={sheet||undefined} role="dialog" aria-label="Ask Prodwise" aria-modal={sheet?true:undefined} aria-describedby={hintId}>
   {sheet&&<span className={styles.grabber} aria-hidden="true"/>}
   <header className={styles.head}>
    <BrandMark size={16} className={styles.headMark}/>
    <div className={styles.headText}><h2 ref={heading} tabIndex={-1} className={styles.title}>Ask Prodwise</h2><p className={styles.context}>{contextLine}</p></div>
    <button type="button" className="pw-btn" data-variant="ghost" data-size="sm" data-icon-only="" onClick={onClose} aria-label="Close Ask Prodwise" data-tip="Close" data-tip-kbd="Esc"><InstrumentIcon name="close"/></button>
   </header>

   <div ref={thread} className={styles.thread} aria-live="polite">
    {turns.length===0&&<div className={styles.intro}>
     <p>Ask about this screen, your initiatives and how to use Prodwise. Answers cite the recorded state; what is not recorded is said so, never guessed.</p>
     {starterRow(false)}
     {configured===false&&<p className={styles.quiet}>Answers that need the model are unavailable in this environment. Questions that read the recorded state — what to do next, what is not recorded, where to find things — still work.</p>}
    </div>}
    {turns.map(t=>{
     if(t.role==='user'){const v=userView(t.text,terms);return <div key={t.id} className={styles.user} dir={v.dir} lang={v.lang}><Runs runs={v.runs}/></div>;}
     if(t.role==='pending')return <div key={t.id} className={styles.pending} role="status"><span className="pw-spinner" aria-hidden="true"/>Reading the recorded state…</div>;
     if(t.role==='failure')return <Failure key={t.id} turn={t} onRetry={()=>onRetry(t.id)}/>;
     const v=answerView(t.answer,{terms,sentInitiativeSlug:t.sentInitiativeSlug});
     return <article key={t.id} className={styles.answer} lang={v.lang}>
      {v.scopeNote&&<p className={styles.scopeNote}>{v.scopeNote}</p>}
      <AnswerBody view={v}/>
      <footer className={styles.basedOn}><span>{v.basedOn}</span><span className={styles.sep} aria-hidden="true">·</span><span>{v.provenance}</span>{v.synthetic&&<span className={styles.synthetic}>Synthetic data</span>}</footer>
     </article>;
    })}
    {askNext&&starterRow(true)}
   </div>

   <form className={styles.composer} onSubmit={onSubmit}>
    <label className="visually-hidden" htmlFor={`${hintId}-q`}>Your question</label>
    <div className={styles.inputRow}>
     <textarea ref={composer} id={`${hintId}-q`} className={styles.textarea} rows={1} value={draft} maxLength={QUESTION_LIMIT} placeholder="Ask about this screen…" onChange={e=>{setDraft(e.target.value);grow();}} onKeyDown={onKey} onFocus={()=>{if(sheet)requestAnimationFrame(()=>composer.current?.scrollIntoView({block:'nearest'}));}} aria-describedby={hintId} enterKeyHint="send"/>
     <Button type="submit" variant="primary" size="sm" disabled={!draft.trim()||busy} pending={busy} aria-label="Ask">Ask</Button>
    </div>
    <p id={hintId} className={styles.hint}><span>Advisory only — nothing changes until you confirm it in Prodwise.</span>{draft.length>QUESTION_LIMIT-200&&<span className={styles.counter}>{draft.length}/{QUESTION_LIMIT}</span>}</p>
   </form>
  </div>
 </>;
}

/** A failed turn: the plain sentence for its code, then the one thing to do about it. */
function Failure({turn,onRetry}:{turn:Extract<Turn,{role:'failure'}>;onRetry:()=>void}){
 const v=failureView(turn);
 const [wait,setWait]=useState(v.retryAfterSeconds??0);
 useEffect(()=>{
  if(!v.retryAfterSeconds)return;
  const timer=setInterval(()=>setWait(w=>{if(w<=1){clearInterval(timer);return 0;}return w-1;}),1000);
  return()=>clearInterval(timer);
 },[v.retryAfterSeconds]);
 return <div className={styles.failure} role="alert">
  <p dir={v.dir} lang={v.lang}>{v.message}</p>
  <div className={styles.failureActions}>
   {v.retry&&<Button variant="secondary" size="sm" onClick={onRetry} disabled={wait>0}>{wait>0?`Retry in ${wait>=60?`${Math.ceil(wait/60)} min`:`${wait}s`}`:'Retry'}</Button>}
   {v.signIn&&<a className="pw-btn" data-variant="secondary" data-size="sm" href="/login">Sign in</a>}
  </div>
 </div>;
}
