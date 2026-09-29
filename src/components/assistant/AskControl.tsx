'use client';
import {forwardRef} from 'react';
import {BrandMark} from '@/components/primitives/BrandMark';
import styles from './ask.module.css';

/**
 * The collapsed control: a quiet 44px pill at the bottom-right with the
 * Prodwise mark and the one label the assistant ever carries. Idle it is a
 * white pill on a hairline; the only thing that can change it is decision
 * D13's single dot, which says a recorded recommendation exists for this
 * screen. It never pulses, glows or floats over the page's primary actions.
 */
export const AskControl=forwardRef<HTMLButtonElement,{open:boolean;dot:boolean;onToggle:()=>void}>(function AskControl({open,dot,onToggle},ref){
 return <button ref={ref} type="button" className={styles.control} data-keep-size="" onClick={onToggle} aria-expanded={open} aria-controls={open?'ask-prodwise-panel':undefined} aria-haspopup="dialog" aria-label={open?'Close Ask Prodwise':dot?'Ask Prodwise · a recommendation is available for this screen':'Ask Prodwise'}>
  <span className={styles.controlMark}><BrandMark size={16}/>{dot&&<i className={styles.dot} aria-hidden="true"/>}</span>
  <span className={styles.controlLabel} aria-hidden="true">Ask Prodwise</span>
 </button>;
});
