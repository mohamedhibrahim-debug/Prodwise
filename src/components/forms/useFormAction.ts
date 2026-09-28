'use client';
import {useActionState,useCallback,useRef,type FormEvent} from 'react';

import {CONNECTION_LOST,SESSION_ENDED} from '@/lib/errors/messages';
export {CONNECTION_LOST,SESSION_ENDED};

/** After a failed request: was it the session or the connection? Asked, never guessed. */
export async function failureMessage():Promise<string>{
 try{const r=await fetch('/api/session',{cache:'no-store',redirect:'manual'});if(r.status===401)return SESSION_ENDED;}catch{/* offline: the connection message is right */}
 return CONNECTION_LOST;
}

/**
 * useActionState for forms, with two guarantees:
 * - What a person typed is kept whenever the action returns an error. React 19 resets a
 *   form after every action; pass the returned handler as the form's `onReset`.
 * - A failed request becomes an inline, retryable error instead of replacing the page.
 */
export function useFormAction<S>(fn:(state:Awaited<S>,form:FormData)=>S|Promise<S>,initial:Awaited<S>){
 const failed=useRef(false);
 const [state,action,pending]=useActionState<S,FormData>(async(previous,form)=>{
  failed.current=true;
  try{const next=await fn(previous,form);failed.current=Boolean(next&&typeof next==='object'&&'error' in next&&(next as {error?:unknown}).error);return next;}
  catch(error){
   // Navigation (redirect / notFound) is control flow, not a failure.
   const digest=(error as {digest?:unknown})?.digest;if(typeof digest==='string'&&digest.startsWith('NEXT_'))throw error;
   return {...(previous as object),error:await failureMessage(),message:null} as Awaited<S>;
  }
 },initial);
 const keepInput=useCallback((event:FormEvent<HTMLFormElement>)=>{if(failed.current)event.preventDefault();},[]);
 return [state,action,pending,keepInput] as const;
}
