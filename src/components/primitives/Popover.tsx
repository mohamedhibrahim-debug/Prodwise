'use client';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {createContext,useCallback,useContext,useEffect,useId,useLayoutEffect,useRef,useState,type CSSProperties,type KeyboardEvent as ReactKeyboardEvent,type ReactNode} from 'react';
import {createPortal} from 'react-dom';
import {computePosition,type Placement,type Side} from './popover-position';
import styles from './Popover.module.css';

/**
 * The one floating-layer behaviour contract (audit §E4), shared by every menu
 * and popover in the product:
 * - one open at a time: opening another closes this one;
 * - closes on outside pointerdown, Escape, route change, item selection,
 *   window blur (menus) and a second press of the trigger;
 * - focus moves into the layer on open and returns to the trigger on Escape
 *   or selection (not after navigation or an outside click);
 * - rendered in a portal with fixed, collision-aware positioning, so no
 *   overflow-hidden ancestor can clip it and it never pushes layout;
 * - trigger carries aria-haspopup, aria-expanded and aria-controls;
 * - on phones (≤780px) it becomes a bottom sheet over a scrim.
 */
const OPEN_EVENT='prodwise:floating-open';
const SHEET_QUERY='(max-width: 780px)';
export type PopoverKind='menu'|'dialog'|'listbox';
type CloseOptions={returnFocus?:boolean};

export interface PopoverOptions{
 placement?:Placement;
 offset?:number;
 kind?:PopoverKind;
 /** Render as a bottom sheet on phones. Default true. */
 sheetOnMobile?:boolean;
 onOpenChange?:(open:boolean)=>void;
}

function portalTarget(trigger:HTMLElement|null):HTMLElement{
 // A modal <dialog> makes everything outside it inert, so a layer opened from
 // inside one (the mobile drawer) must live inside it.
 return (trigger?.closest('dialog[open]') as HTMLElement|null)??document.body;
}

export function usePopover({placement='bottom-start',offset=6,kind='menu',sheetOnMobile=true,onOpenChange}:PopoverOptions={}){
 const id=useId();const floatingId=`${id}-layer`;
 const [open,setOpenState]=useState(false);
 const [position,setPosition]=useState<{style:CSSProperties;side:Side}|null>(null);
 const [sheet,setSheet]=useState(false);
 const triggerRef=useRef<HTMLButtonElement|null>(null);
 const floatingRef=useRef<HTMLDivElement|null>(null);
 const openRef=useRef(false);
 const changeRef=useRef(onOpenChange);useEffect(()=>{changeRef.current=onOpenChange;});

 const setOpen=useCallback((next:boolean,{returnFocus=false}:CloseOptions={})=>{
  if(openRef.current===next)return;
  openRef.current=next;setOpenState(next);changeRef.current?.(next);
  if(next){setSheet(sheetOnMobile&&window.matchMedia(SHEET_QUERY).matches);window.dispatchEvent(new CustomEvent(OPEN_EVENT,{detail:id}));}
  else{setPosition(null);if(returnFocus)triggerRef.current?.focus({preventScroll:true});}
 },[id,sheetOnMobile]);
 const close=useCallback((options?:CloseOptions)=>setOpen(false,options),[setOpen]);
 const toggle=useCallback(()=>setOpen(!openRef.current,{returnFocus:true}),[setOpen]);

 // One floating layer at a time.
 useEffect(()=>{const other=(e:Event)=>{if((e as CustomEvent).detail!==id)close();};window.addEventListener(OPEN_EVENT,other);return()=>window.removeEventListener(OPEN_EVENT,other);},[id,close]);
 // Route change closes without stealing focus back.
 const path=usePathname();
 const lastPath=useRef(path);
 useEffect(()=>{if(lastPath.current!==path){lastPath.current=path;close();}},[path,close]);

 useEffect(()=>{
  if(!open)return;
  const inside=(node:EventTarget|null)=>node instanceof Node&&(!!triggerRef.current?.contains(node)||!!floatingRef.current?.contains(node));
  const onPointer=(e:PointerEvent)=>{if(!inside(e.target))close();};
  const onKey=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close({returnFocus:true});}};
  const onBlur=()=>{if(kind==='menu')close();};
  document.addEventListener('pointerdown',onPointer,true);
  document.addEventListener('keydown',onKey,true);
  window.addEventListener('blur',onBlur);
  return()=>{document.removeEventListener('pointerdown',onPointer,true);document.removeEventListener('keydown',onKey,true);window.removeEventListener('blur',onBlur);};
 },[open,close,kind]);

 const place=useCallback(()=>{
  const trigger=triggerRef.current,floating=floatingRef.current;
  if(!trigger||!floating)return;
  if(sheet){setPosition({style:{},side:'bottom'});return;}
  const a=trigger.getBoundingClientRect();
  const r=computePosition({anchor:{top:a.top,left:a.left,width:a.width,height:a.height},floating:{width:floating.offsetWidth,height:floating.scrollHeight},viewport:{width:window.innerWidth,height:window.innerHeight},placement,offset});
  setPosition({side:r.side,style:{top:Math.round(r.top),left:Math.round(r.left),maxHeight:Math.floor(r.maxHeight),maxWidth:Math.floor(r.maxWidth)}});
 },[placement,offset,sheet]);

 useLayoutEffect(()=>{
  if(!open)return;
  // Placement is measured from the DOM, so it can only be computed after layout.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  place();
  let frame=0;const again=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(place);};
  window.addEventListener('resize',again);window.addEventListener('scroll',again,true);
  const observer=new ResizeObserver(again);if(floatingRef.current)observer.observe(floatingRef.current);
  return()=>{cancelAnimationFrame(frame);window.removeEventListener('resize',again);window.removeEventListener('scroll',again,true);observer.disconnect();};
 },[open,place]);

 // Focus moves into the layer once it is placed.
 const focused=useRef(false);
 useEffect(()=>{
  if(!open){focused.current=false;return;}
  if(!position||focused.current)return;
  focused.current=true;
  const layer=floatingRef.current;if(!layer)return;
  const target=kind==='menu'?layer.querySelector<HTMLElement>('[role^="menuitem"][aria-checked="true"]:not(:disabled),[role^="menuitem"]:not(:disabled):not([aria-disabled="true"])'):layer.querySelector<HTMLElement>('[data-autofocus],input,select,textarea,button:not(:disabled),a[href]');
  (target??layer).focus({preventScroll:true});
 },[open,position,kind]);

 const triggerProps={
  ref:triggerRef,
  'aria-haspopup':kind==='listbox'?'listbox' as const:kind==='dialog'?'dialog' as const:'menu' as const,
  'aria-expanded':open,
  'aria-controls':open?floatingId:undefined,
  onClick:toggle,
  onKeyDown:(e:ReactKeyboardEvent<HTMLButtonElement>)=>{if(kind==='menu'&&(e.key==='ArrowDown'||e.key==='ArrowUp')&&!openRef.current){e.preventDefault();setOpen(true);}},
 };
 const floatingProps={
  ref:floatingRef,
  id:floatingId,
  tabIndex:-1,
  'data-side':position?.side,
  'data-sheet':sheet||undefined,
  style:{...position?.style,visibility:position?'visible':'hidden'} as CSSProperties,
 };
 return {open,setOpen,close,toggle,triggerRef,floatingRef,triggerProps,floatingProps,sheet};
}

/** Renders a floating layer in the right portal, with the scrim used on phones. */
export function FloatingLayer({popover,className,children,label,role,onKeyDown,width}:{popover:ReturnType<typeof usePopover>;className?:string;children:ReactNode;label:string;role?:'menu'|'dialog'|'listbox';onKeyDown?:(e:ReactKeyboardEvent<HTMLDivElement>)=>void;width?:number}){
 if(!popover.open||typeof document==='undefined')return null;
 const {style,...rest}=popover.floatingProps;
 return createPortal(<>
  {popover.sheet&&<div className={styles.scrim} aria-hidden="true"/>}
  <div {...rest} style={{...style,...(width&&!popover.sheet?{width}:{})}} role={role} aria-label={label} aria-modal={role==='dialog'&&popover.sheet?true:undefined} className={`${styles.layer} ${className??''}`} onKeyDown={onKeyDown}>
   {popover.sheet&&<span className={styles.grabber} aria-hidden="true"/>}
   {children}
  </div>
 </>,portalTarget(popover.triggerRef.current));
}

/* ── Menu ─────────────────────────────────────────────────────────────── */
const MenuContext=createContext<{close:(o?:CloseOptions)=>void}|null>(null);
function items(layer:HTMLElement){return [...layer.querySelectorAll<HTMLElement>('[role^="menuitem"]')].filter(el=>!el.hasAttribute('disabled')&&el.getAttribute('aria-disabled')!=='true');}

/** Arrow keys, Home/End, type-ahead, Space activation, Tab closes. */
export function menuKeyDown(close:(o?:CloseOptions)=>void){
 return (e:ReactKeyboardEvent<HTMLDivElement>)=>{
  const list=items(e.currentTarget);if(!list.length)return;
  const index=list.indexOf(document.activeElement as HTMLElement);
  const move=(i:number)=>{e.preventDefault();list[(i+list.length)%list.length]?.focus();};
  if(e.key==='ArrowDown')move(index+1);
  else if(e.key==='ArrowUp')move(index<0?list.length-1:index-1);
  else if(e.key==='Home')move(0);
  else if(e.key==='End')move(list.length-1);
  else if(e.key==='Tab')close();
  else if(e.key===' '&&index>=0){e.preventDefault();list[index]!.click();}
  else if(e.key.length===1&&/\S/.test(e.key)&&!e.metaKey&&!e.ctrlKey&&!e.altKey){
   const key=e.key.toLowerCase();const order=[...list.slice(index+1),...list.slice(0,index+1)];
   const hit=order.find(el=>(el.dataset.typeahead??el.textContent??'').trim().toLowerCase().startsWith(key));if(hit){e.preventDefault();hit.focus();}
  }
 };
}

export interface MenuProps{
 /** Accessible name of the menu itself. */
 label:string;
 /** Content of the trigger button. */
 trigger:ReactNode;
 /** Accessible name of the trigger when its content is not text. */
 triggerLabel?:string;
 triggerClassName?:string;
 /** Extra attributes for the trigger, e.g. the pw-btn look or data-tip. */
 triggerAttributes?:Record<string,string|undefined>;
 placement?:Placement;
 width?:number;
 className?:string;
 children:ReactNode;
 onOpenChange?:(open:boolean)=>void;
}

export function Menu({label,trigger,triggerLabel,triggerClassName,triggerAttributes,placement='bottom-start',width=260,className,children,onOpenChange}:MenuProps){
 const popover=usePopover({placement,kind:'menu',onOpenChange});
 return <MenuContext.Provider value={{close:popover.close}}>
  <button type="button" className={triggerClassName} aria-label={triggerLabel} {...triggerAttributes} {...popover.triggerProps}>{trigger}</button>
  <FloatingLayer popover={popover} role="menu" label={label} width={width} className={className} onKeyDown={menuKeyDown(popover.close)}>{children}</FloatingLayer>
 </MenuContext.Provider>;
}

/** For menus that manage their own popover (usePopover + FloatingLayer). */
export function MenuScope({close,children}:{close:(o?:CloseOptions)=>void;children:ReactNode}){return <MenuContext.Provider value={{close}}>{children}</MenuContext.Provider>;}

function useMenu(){return useContext(MenuContext);}

function ItemBody({icon,children,description,trailing}:{icon?:ReactNode;children:ReactNode;description?:ReactNode;trailing?:ReactNode}){
 return <>{icon!==undefined&&<span className={styles.icon} aria-hidden="true">{icon}</span>}<span className={styles.text}><span className={styles.title}>{children}</span>{description&&<small>{description}</small>}</span>{trailing&&<span className={styles.trailing}>{trailing}</span>}</>;
}

export function MenuLink({href,icon,description,trailing,children,prefetch=false,tone}:{href:string;icon?:ReactNode;description?:ReactNode;trailing?:ReactNode;children:ReactNode;prefetch?:boolean;tone?:'danger'}){
 const menu=useMenu();
 return <Link href={href} prefetch={prefetch} role="menuitem" tabIndex={-1} className={styles.item} data-menu-tone={tone} data-typeahead={typeof children==='string'?children:undefined} onClick={()=>menu?.close()}><ItemBody icon={icon} description={description} trailing={trailing}>{children}</ItemBody></Link>;
}

export function MenuButton({onSelect,icon,description,trailing,children,disabled,tone,checked,keepOpen}:{onSelect?:()=>void;icon?:ReactNode;description?:ReactNode;trailing?:ReactNode;children:ReactNode;disabled?:boolean;tone?:'danger';checked?:boolean;keepOpen?:boolean}){
 const menu=useMenu();
 return <button type="button" role={checked===undefined?'menuitem':'menuitemradio'} aria-checked={checked} tabIndex={-1} className={styles.item} data-menu-tone={tone} disabled={disabled} onClick={()=>{if(!keepOpen)menu?.close({returnFocus:true});onSelect?.();}}><ItemBody icon={icon} description={description} trailing={trailing}>{children}</ItemBody></button>;
}

/**
 * A menu item that submits its enclosing <form>. It does NOT close the menu on
 * click: unmounting the form before the browser submits it would cancel the
 * submission. The action's navigation closes the menu instead.
 */
export function MenuSubmit({icon,description,trailing,children,disabled,tone,checked,name,value,pending}:{icon?:ReactNode;description?:ReactNode;trailing?:ReactNode;children:ReactNode;disabled?:boolean;tone?:'danger';checked?:boolean;name?:string;value?:string;pending?:boolean}){
 return <button type="submit" name={name} value={value} role={checked===undefined?'menuitem':'menuitemradio'} aria-checked={checked} aria-busy={pending||undefined} tabIndex={-1} className={styles.item} data-menu-tone={tone} disabled={disabled}><ItemBody icon={pending?<span className="pw-spinner"/>:icon} description={description} trailing={trailing}>{children}</ItemBody></button>;
}

export function MenuSeparator(){return <div role="separator" className={styles.separator}/>;}
export function MenuLabel({children}:{children:ReactNode}){return <div role="presentation" className={styles.label}>{children}</div>;}
/** Non-interactive content at the top of a menu (identity, context). */
export function MenuHeader({children}:{children:ReactNode}){return <div role="presentation" className={styles.header}>{children}</div>;}
