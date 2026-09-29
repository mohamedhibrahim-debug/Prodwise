'use client';
import {useRouter} from 'next/navigation';
import {useEffect} from 'react';
import {createShortcutMatcher,isTypingTarget} from './shortcuts';
import {openHelp,toggleSidebar} from './events';

/** Global single-key shortcuts: `[` sidebar, `?` shortcut sheet, `g` then h/i/r/w/a/n to navigate. */
export function ShellShortcuts(){
 const router=useRouter();
 useEffect(()=>{
  const match=createShortcutMatcher();
  const onKey=(e:KeyboardEvent)=>{
   if(e.defaultPrevented||e.repeat)return;
   const target=e.target as HTMLElement|null;
   if(isTypingTarget(target)||target?.closest?.('[contenteditable]:not([contenteditable=false]),dialog[open],[role=menu],[role=dialog]'))return;
   const action=match({key:e.key,metaKey:e.metaKey,ctrlKey:e.ctrlKey,altKey:e.altKey,time:e.timeStamp});
   if(!action)return;
   e.preventDefault();
   if(action.kind==='toggle-sidebar')toggleSidebar();
   else if(action.kind==='show-shortcuts')openHelp('shortcuts');
   else router.push(action.href);
  };
  window.addEventListener('keydown',onKey);
  return()=>window.removeEventListener('keydown',onKey);
 },[router]);
 return null;
}
