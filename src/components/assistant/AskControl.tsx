'use client';
import {forwardRef} from 'react';
import {BrandMark} from '@/components/primitives/BrandMark';
import styles from './ask.module.css';

/**
 * The collapsed control, docked with the other global tools (Search,
 * Notifications, Help): the Prodwise mark and the one label the assistant ever
 * carries. On phones it is the mark alone in the mobile bar. The only thing
 * that can change it is decision D13's single dot, which says a recorded
 * recommendation exists for this screen. It never floats over the page.
 */
export const AskControl=forwardRef<HTMLButtonElement,{open:boolean;dot:boolean;compact?:boolean;onToggle:()=>void}>(function AskControl({open,dot,compact=false,onToggle},ref){
 return <button ref={ref} type="button" className={styles.control} data-compact={compact||undefined} data-keep-size="" data-tip={compact?undefined:'Ask about this screen'} onClick={onToggle} aria-expanded={open} aria-controls={open?'ask-prodwise-panel':undefined} aria-haspopup="dialog" aria-label={open?'Close Ask Prodwise':dot?'Ask Prodwise · a recommendation is available for this screen':'Ask Prodwise'}>
  <span className={styles.controlMark}><BrandMark size={16}/>{dot&&<i className={styles.dot} aria-hidden="true"/>}</span>
  <span className={styles.controlLabel} aria-hidden="true">Ask Prodwise</span>
 </button>;
});
