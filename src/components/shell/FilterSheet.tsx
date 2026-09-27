'use client';
import {useRef} from 'react';
import styles from './FilterSheet.module.css';
export function FilterSheet({children,count=0}:{children:React.ReactNode;count?:number}){const dialog=useRef<HTMLDialogElement>(null);const trigger=useRef<HTMLButtonElement>(null);return <><div className={styles.desktop}>{children}</div><button ref={trigger} className={styles.trigger} type="button" onClick={()=>dialog.current?.showModal()}>Filters{count?` (${count})`:''}</button><dialog ref={dialog} className={styles.dialog} aria-label="Initiative filters" onCancel={()=>trigger.current?.focus()}><header><h2>Filters</h2><button type="button" onClick={()=>{dialog.current?.close();trigger.current?.focus();}} aria-label="Close filters">Close ×</button></header>{children}</dialog></>;}
