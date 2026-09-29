'use client';
import {useSyncExternalStore} from 'react';
import {MenuButton,MenuLabel} from '@/components/primitives/Popover';
import {InstrumentIcon} from './InstrumentIcon';
import {applyTheme,THEMES,writeTheme,type Theme} from './theme-preference';
import styles from './ThemeToggle.module.css';

const CHANGE='prodwise:appearance';
const subscribe=(cb:()=>void)=>{window.addEventListener(CHANGE,cb);window.addEventListener('storage',cb);return()=>{window.removeEventListener(CHANGE,cb);window.removeEventListener('storage',cb);};};
// The boot script applied the remembered choice before paint; the root attribute is the source of truth after that.
const current=():Theme=>document.documentElement.dataset.theme==='dark'?'dark':'light';
function useTheme(){
 const theme=useSyncExternalStore(subscribe,current,()=>'light' as Theme);
 const choose=(next:Theme)=>{applyTheme(document.documentElement,next);writeTheme(localStorage,next);window.dispatchEvent(new Event(CHANGE));};
 return {theme,choose};
}

/** Account-menu items: one radio per appearance. */
export function ThemeMenuItems(){
 const {theme,choose}=useTheme();
 return <>
  <MenuLabel>Appearance</MenuLabel>
  {THEMES.map(t=><MenuButton key={t.value} icon={<InstrumentIcon name={t.value==='dark'?'moon':'sun'}/>} checked={theme===t.value} onSelect={()=>choose(t.value)}>{t.label}</MenuButton>)}
 </>;
}

/** The My account control: a segmented choice with a description of the remembered scope. */
export function ThemeChoice(){
 const {theme,choose}=useTheme();
 // A radio group: one tab stop, arrow keys move and select (Devil R1-M9).
 const onKeyDown=(e:React.KeyboardEvent<HTMLDivElement>)=>{
  const step=e.key==='ArrowRight'||e.key==='ArrowDown'?1:e.key==='ArrowLeft'||e.key==='ArrowUp'?-1:0;if(!step)return;
  e.preventDefault();const i=THEMES.findIndex(t=>t.value===theme),next=THEMES[(i+step+THEMES.length)%THEMES.length]!;choose(next.value);
  requestAnimationFrame(()=>e.currentTarget?.querySelector<HTMLButtonElement>(`[data-value="${next.value}"]`)?.focus());
 };
 return <div className={styles.choice} role="radiogroup" aria-label="Appearance" onKeyDown={onKeyDown}>
  {THEMES.map(t=><button key={t.value} type="button" role="radio" data-value={t.value} tabIndex={theme===t.value?0:-1} aria-checked={theme===t.value} className={styles.option} onClick={()=>choose(t.value)}>
   <span className={styles.swatch} data-theme={t.value} aria-hidden="true"><i/><i/><i/></span>
   <span className={styles.text}><strong>{t.label}</strong><small>{t.description}</small></span>
  </button>)}
 </div>;
}
