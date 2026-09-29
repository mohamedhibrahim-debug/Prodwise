'use client';
import {useSyncExternalStore} from 'react';
import {DEFAULT_PREFERENCES,normalizePreferences,type AssistantPreferences} from '@/lib/assistant/preferences-model';

/**
 * The person's Ask Prodwise preferences, held once per page session and shared
 * by the shell mount and the My account section, so a change on the Account
 * page reaches the control immediately (Show assistant Off removes it with no
 * reload). One GET after hydration, never blocking a render; defaults on any
 * failure. Writes go through PUT; a shared Demo guest session keeps the change
 * in memory only (decision D14) and says so.
 */
export interface PreferenceState {
 status:'idle'|'loading'|'ready';
 preferences:AssistantPreferences;
 /** False for a Demo guest or when the store could not be read: the values apply, but only here. */
 persisted:boolean;
 /** Whether model answers are possible in this environment; deterministic starters work either way. Null until read. */
 configured:boolean|null;
 /** Whose preferences these are, so a different sign-in never inherits them. */
 actorId:string|null;
}
const SERVER_STATE:PreferenceState={status:'idle',preferences:DEFAULT_PREFERENCES,persisted:false,configured:null,actorId:null};
let state:PreferenceState=SERVER_STATE;
const listeners=new Set<()=>void>();
const set=(patch:Partial<PreferenceState>)=>{state={...state,...patch};listeners.forEach(l=>l());};
function subscribe(l:()=>void){listeners.add(l);return()=>{listeners.delete(l);};}

let inFlight:Promise<void>|null=null;
/** Reads once per actor; concurrent callers share the request. Resolves to a ready state whatever happened. */
export function loadPreferences(actorId:string):Promise<void>{
 if(state.actorId===actorId&&state.status==='ready')return Promise.resolve();
 if(state.actorId===actorId&&inFlight)return inFlight;
 set({status:'loading',actorId,preferences:DEFAULT_PREFERENCES,persisted:false,configured:null});
 inFlight=fetch('/api/assistant/preferences',{credentials:'same-origin',cache:'no-store'})
  .then(async r=>{
   const b=await r.json().catch(()=>null) as {ok?:boolean;preferences?:unknown;persisted?:unknown;configured?:unknown}|null;
   if(state.actorId!==actorId)return;
   if(r.ok&&b?.ok)set({status:'ready',preferences:normalizePreferences(b.preferences),persisted:b.persisted===true,configured:typeof b.configured==='boolean'?b.configured:null});
   else set({status:'ready'});
  })
  .catch(()=>{if(state.actorId===actorId)set({status:'ready'});})
  .finally(()=>{inFlight=null;});
 return inFlight;
}

export type SaveOutcome='saved'|'demo'|'failed';
/** Applies the change at once, then confirms it; a failed save restores the previous value and says so. */
export async function savePreferences(patch:Partial<AssistantPreferences>):Promise<SaveOutcome>{
 const before=state.preferences;
 set({preferences:normalizePreferences({...before,...patch})});
 try{
  const r=await fetch('/api/assistant/preferences',{method:'PUT',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify(patch)});
  const b=await r.json().catch(()=>null) as {ok?:boolean;code?:string;preferences?:unknown}|null;
  if(r.ok&&b?.ok){set({preferences:normalizePreferences(b.preferences),persisted:true});return 'saved';}
  if(r.status===403&&b?.code==='DEMO_GUEST'){set({persisted:false});return 'demo';}
  set({preferences:before});return 'failed';
 }catch{set({preferences:before});return 'failed';}
}

export function usePreferenceState():PreferenceState{return useSyncExternalStore(subscribe,()=>state,()=>SERVER_STATE);}
