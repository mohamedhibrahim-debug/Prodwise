'use client';
import dynamic from 'next/dynamic';
import {usePathname} from 'next/navigation';
import {useCallback,useEffect,useRef,useState,useSyncExternalStore} from 'react';
import type {ShellIdentity} from '@/components/shell/ShellIdentity';
import {useInitiativeContext} from '@/components/shell/shell-title';
import {answerLanguage} from '@/lib/assistant/language';
import {contextLine,historyFor,initialOpen,resultFromResponse,screenFromPath,showsDot,startersFor,writeOpenState,type Turn} from '@/lib/assistant/panel-model';
import {FAILURE_MESSAGE,QUESTION_LIMIT} from '@/lib/assistant/types';
import type {AssistantPreferences} from '@/lib/assistant/preferences-model';
import {AskControl} from './AskControl';
import styles from './ask.module.css';
import {loadPreferences,usePreferenceState} from './preferences-store';
import {probeRecommendations,useProbe} from './probe-store';

/** The panel's code is fetched on first open, never with the page. */
const AskPanel=dynamic(()=>import('./AskPanel').then(m=>m.AskPanel),{ssr:false,loading:()=>null});

/**
 * Ask Prodwise, mounted once by the application shell. It renders nothing on
 * the server and nothing until the person's preferences are known (one small
 * GET after hydration; defaults if it fails), so the page never waits for it.
 * `show: false` mounts nothing at all — no control, no listener.
 */
export function AskProdwise({identity}:{identity:ShellIdentity}){
 const hydrated=useSyncExternalStore(()=>()=>{},()=>true,()=>false);
 const actorId=identity.access.actor.id;
 useEffect(()=>{void loadPreferences(actorId);},[actorId]);
 const prefs=usePreferenceState();
 if(!hydrated||prefs.status!=='ready'||prefs.actorId!==actorId||!prefs.preferences.show)return null;
 return <AskSurface identity={identity} preferences={prefs.preferences} configured={prefs.configured}/>;
}

const newId=()=>(typeof crypto!=='undefined'&&'randomUUID' in crypto?crypto.randomUUID():`${Date.now()}-${Math.random()}`);
/** The panel keeps the last turns only; the thread lives in memory and is cleared on reload. */
const THREAD_LIMIT=40;
/** The route bounds the provider at 25s; the panel gives the whole round trip a little more, then reports a timeout. */
const REQUEST_TIMEOUT_MS=40_000;
const SHEET_QUERY='(max-width: 780px)';
const subscribeSheet=(cb:()=>void)=>{const m=window.matchMedia(SHEET_QUERY);m.addEventListener('change',cb);return()=>m.removeEventListener('change',cb);};

function AskSurface({identity,preferences,configured}:{identity:ShellIdentity;preferences:AssistantPreferences;configured:boolean|null}){
 const path=usePathname();
 const screen=screenFromPath(path);
 const initiative=useInitiativeContext(screen.initiativeSlug);
 const sheet=useSyncExternalStore(subscribeSheet,()=>window.matchMedia(SHEET_QUERY).matches,()=>false);
 const [open,setOpenState]=useState(()=>initialOpen(preferences.openBehaviour,typeof localStorage==='undefined'?null:localStorage));
 const [turns,setTurns]=useState<Turn[]>([]);
 const controlRef=useRef<HTMLButtonElement>(null);
 const setOpen=useCallback((next:boolean)=>{setOpenState(next);writeOpenState(typeof localStorage==='undefined'?null:localStorage,next);},[]);
 const close=useCallback(()=>{setOpen(false);requestAnimationFrame(()=>controlRef.current?.focus({preventScroll:true}));},[setOpen]);

 // Decision D13: one deterministic "next" per screen when the person asked for proactive suggestions; nothing otherwise.
 const probeKey=`${screen.screen}|${screen.tab??''}|${screen.initiativeSlug??''}`;
 useEffect(()=>{if(preferences.proactive)void probeRecommendations(probeKey,{screen:screen.screen,tab:screen.tab,initiativeSlug:screen.initiativeSlug});},[preferences.proactive,probeKey,screen.screen,screen.tab,screen.initiativeSlug]);
 const recommendations=useProbe(probeKey);
 const dot=showsDot(preferences.proactive,recommendations);

 const busy=turns.some(t=>t.role==='pending');
 const send=useCallback(async(question:string,replaceId?:string)=>{
  const text=question.trim().slice(0,QUESTION_LIMIT);
  if(!text||busy)return;
  const id=newId();
  const sent={screen:screen.screen,tab:screen.tab,initiativeSlug:screen.initiativeSlug};
  let history:ReturnType<typeof historyFor>=[];
  setTurns(prev=>{
   if(replaceId){
    const at=prev.findIndex(t=>t.id===replaceId);
    if(at<0)return prev;
    const before=prev[at-1]?.role==='user'?prev.slice(0,at-1):prev.slice(0,at);
    history=historyFor(before);
    const waiting:Turn={id,role:'pending',question:text};
    return [...prev.slice(0,at),waiting,...prev.slice(at+1)];
   }
   history=historyFor(prev);
   const user:Turn={id:newId(),role:'user',text,sentInitiativeSlug:sent.initiativeSlug};
   const waiting:Turn={id,role:'pending',question:text};
   return [...prev,user,waiting].slice(-THREAD_LIMIT);
  });
  let result:Turn;
  try{
   const r=await fetch('/api/assistant',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({question:text,...sent,preferredLanguage:preferences.language,history}),signal:AbortSignal.timeout(REQUEST_TIMEOUT_MS)});
   const body=await r.json().catch(()=>null);
   result=resultFromResponse(r.status,body,text,id,sent.initiativeSlug);
  }catch(error){
   const language=answerLanguage(text,preferences.language);
   const timedOut=error instanceof Error&&error.name==='TimeoutError';
   result={id,role:'failure',question:text,code:timedOut?'TIMED_OUT':'PROVIDER_FAILED',language,message:FAILURE_MESSAGE[timedOut?'TIMED_OUT':'PROVIDER_FAILED'][language]};
  }
  setTurns(prev=>prev.map(t=>t.id===id?result:t));
 },[busy,screen.screen,screen.tab,screen.initiativeSlug,preferences.language]);
 const retry=useCallback((turnId:string)=>{const t=turns.find(x=>x.id===turnId);if(t&&t.role==='failure')void send(t.question,turnId);},[turns,send]);

 const terms=[initiative?.name,identity.presentation.organizationName].filter((t):t is string=>Boolean(t));
 return <>
  <div className={styles.spacer} aria-hidden="true"/>
  <AskControl ref={controlRef} open={open} dot={dot} onToggle={()=>open?close():setOpen(true)}/>
  {open&&<AskPanel
   sheet={sheet}
   contextLine={contextLine(screen,initiative)}
   starters={startersFor(screen,preferences.language)}
   turns={turns}
   busy={busy}
   terms={terms}
   configured={configured}
   language={preferences.language}
   onSend={q=>{void send(q);}}
   onRetry={retry}
   onClose={close}
  />}
 </>;
}
