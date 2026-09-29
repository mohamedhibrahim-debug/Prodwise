'use client';
import {useEffect,useSyncExternalStore} from 'react';

/**
 * The open initiative's name, published by the initiative header so the top
 * bar breadcrumb and the rail's context item can show it without re-reading
 * data or observing the DOM.
 */
let current:{slug:string;name:string}|null=null;
const listeners=new Set<()=>void>();
function subscribe(listener:()=>void){listeners.add(listener);return()=>{listeners.delete(listener);};}

export function useInitiativeTitle(slug:string|null):string|null{
 const value=useSyncExternalStore(subscribe,()=>current,()=>null);
 return slug&&value?.slug===slug?value.name:null;
}

/** Rendered by the initiative header (server) to publish its title. */
export function PublishInitiativeTitle({slug,name}:{slug:string;name:string}){
 useEffect(()=>{current={slug,name};listeners.forEach(l=>l());},[slug,name]);
 return null;
}
