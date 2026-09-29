'use client';
import {useEffect,useSyncExternalStore} from 'react';

/**
 * The open initiative's name, published by the initiative header so the top
 * bar breadcrumb and the rail's context item can show it without re-reading
 * data or observing the DOM.
 */
let current:{slug:string;name:string;stage?:string}|null=null;
const listeners=new Set<()=>void>();
function subscribe(listener:()=>void){listeners.add(listener);return()=>{listeners.delete(listener);};}

export function useInitiativeTitle(slug:string|null):string|null{
 const value=useSyncExternalStore(subscribe,()=>current,()=>null);
 return slug&&value?.slug===slug?value.name:null;
}

/** Name and stage label together, for the Ask Prodwise context line. */
export function useInitiativeContext(slug:string|null):{name:string;stage:string|null}|null{
 const value=useSyncExternalStore(subscribe,()=>current,()=>null);
 return slug&&value?.slug===slug?{name:value.name,stage:value.stage??null}:null;
}

/** Rendered by the initiative header (server) to publish its title (and stage label, when given). */
export function PublishInitiativeTitle({slug,name,stage}:{slug:string;name:string;stage?:string}){
 useEffect(()=>{current={slug,name,stage};listeners.forEach(l=>l());},[slug,name,stage]);
 return null;
}
