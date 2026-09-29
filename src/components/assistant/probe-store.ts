'use client';
import {useSyncExternalStore} from 'react';
import type {AssistantScreen} from '@/lib/assistant/types';

/**
 * Decision D13: the quiet dot on the collapsed control lights when the
 * deterministic recommendation engine has at least one action for the current
 * screen. That is learnt with one "next" question per screen per page
 * session — a deterministic answer, never a provider call — and remembered
 * here so revisiting a screen costs nothing. Only the count is kept.
 */
const counts=new Map<string,number|null>();
const pending=new Set<string>();
const listeners=new Set<()=>void>();
const emit=()=>listeners.forEach(l=>l());
function subscribe(l:()=>void){listeners.add(l);return()=>{listeners.delete(l);};}

export async function probeRecommendations(key:string,screen:{screen:AssistantScreen;tab:string|null;initiativeSlug:string|null}):Promise<void>{
 if(counts.has(key)||pending.has(key))return;
 pending.add(key);
 try{
  const r=await fetch('/api/assistant',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({question:'What should I do next?',...screen,preferredLanguage:'en'}),signal:AbortSignal.timeout(15_000)});
  const b=await r.json().catch(()=>null) as {ok?:boolean;answer?:{blocks?:{kind:string;items?:unknown[]}[]}}|null;
  const block=r.ok&&b?.ok?b.answer?.blocks?.find(x=>x.kind==='recommendations'):undefined;
  counts.set(key,r.ok&&b?.ok?(block?.items?.length??0):null);
 }catch{counts.set(key,null);}
 finally{pending.delete(key);emit();}
}

export function useProbe(key:string):number|null{
 return useSyncExternalStore(subscribe,()=>counts.get(key)??null,()=>null);
}
