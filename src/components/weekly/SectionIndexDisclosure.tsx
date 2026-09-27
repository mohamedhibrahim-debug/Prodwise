"use client";
import {useEffect,useRef,type ReactNode} from "react";
/** Desktop shows the whole index. On smaller screens an explicitly selected section
 * leaves a native, keyboard-operable disclosure with its count and current identity. */
export function SectionIndexDisclosure({explicitSelection,count,currentName,children}:{explicitSelection:boolean;count:number;currentName:string;children:ReactNode}) {
 const details=useRef<HTMLDetailsElement>(null);
 useEffect(()=>{const desktop=window.matchMedia("(min-width:1024px)");const sync=()=>{if(details.current)details.current.open=desktop.matches||!explicitSelection;};sync();desktop.addEventListener("change",sync);return()=>desktop.removeEventListener("change",sync);},[explicitSelection,currentName]);
 return <details ref={details} open><summary>Sections ({count})<small>Current: {currentName}</small></summary>{children}</details>;
}
