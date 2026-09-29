'use client';
import {useEffect,useRef,useState,type CSSProperties} from 'react';
import {createPortal} from 'react-dom';
import {computePosition,type Side} from './popover-position';
import styles from './TooltipLayer.module.css';

/**
 * One tooltip for the whole app. Any element with `data-tip="Label"`
 * (optionally `data-tip-kbd="G R"` and `data-tip-side="right"`) gets a
 * custom tooltip after a short hover, or at once on keyboard focus. Works for
 * server-rendered markup too. The element must still carry its own accessible
 * name (aria-label or text); the tooltip is visual and hidden from assistive tech.
 */
const DELAY=300;
export function TooltipLayer(){
 const [tip,setTip]=useState<{label:string;kbd?:string;el:HTMLElement}|null>(null);
 const [style,setStyle]=useState<CSSProperties>({visibility:'hidden'});
 const ref=useRef<HTMLDivElement>(null);
 useEffect(()=>{
  let timer:ReturnType<typeof setTimeout>|undefined;let current:HTMLElement|null=null;
  const find=(t:EventTarget|null)=>t instanceof Element?t.closest<HTMLElement>('[data-tip]'):null;
  const show=(el:HTMLElement,delay:number)=>{clearTimeout(timer);current=el;timer=setTimeout(()=>{if(current===el&&el.isConnected&&el.dataset.tip)setTip({label:el.dataset.tip,kbd:el.dataset.tipKbd,el});},delay);};
  const hide=()=>{clearTimeout(timer);current=null;setTip(null);};
  const over=(e:PointerEvent)=>{if(e.pointerType==='touch')return;const el=find(e.target);if(el&&el!==current)show(el,DELAY);else if(!el&&current)hide();};
  const focus=(e:FocusEvent)=>{const el=find(e.target);if(el&&(e.target as HTMLElement).matches(':focus-visible'))show(el,80);};
  const blur=()=>hide();
  const key=(e:KeyboardEvent)=>{if(e.key==='Escape')hide();};
  document.addEventListener('pointerover',over);document.addEventListener('focusin',focus);document.addEventListener('focusout',blur);
  document.addEventListener('pointerdown',hide,true);document.addEventListener('keydown',key);window.addEventListener('scroll',hide,true);
  return()=>{clearTimeout(timer);document.removeEventListener('pointerover',over);document.removeEventListener('focusin',focus);document.removeEventListener('focusout',blur);document.removeEventListener('pointerdown',hide,true);document.removeEventListener('keydown',key);window.removeEventListener('scroll',hide,true);};
 },[]);
 useEffect(()=>{
  if(!tip||!ref.current){setStyle({visibility:'hidden'});return;}
  const a=tip.el.getBoundingClientRect();const side=(tip.el.dataset.tipSide as Side|undefined)??'bottom';
  const r=computePosition({anchor:{top:a.top,left:a.left,width:a.width,height:a.height},floating:{width:ref.current.offsetWidth,height:ref.current.offsetHeight},viewport:{width:window.innerWidth,height:window.innerHeight},placement:side,offset:8,margin:6});
  setStyle({top:Math.round(r.top),left:Math.round(r.left),visibility:'visible'});
 },[tip]);
 if(!tip)return null;
 return createPortal(<div ref={ref} className={styles.tip} style={style} aria-hidden="true">{tip.label}{tip.kbd&&<span className={styles.keys}>{tip.kbd.split(' ').map(k=><kbd key={k}>{k}</kbd>)}</span>}</div>,(tip.el.closest('dialog[open]') as HTMLElement|null)??document.body);
}
