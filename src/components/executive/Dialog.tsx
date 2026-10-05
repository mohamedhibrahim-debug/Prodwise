'use client';
import { useEffect, useRef } from 'react';
import { InstrumentIcon } from '@/components/shell/InstrumentIcon';
import styles from './Executive.module.css';
export function Dialog({ title, close, children }: { title: string; close: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const dialog = ref.current; dialog?.showModal(); return () => dialog?.close(); }, []);
  return <dialog ref={ref} className={styles.dialog} onCancel={close} aria-label={title}>
    <div className={styles.sectionHead}><h2>{title}</h2><button className={styles.button} onClick={close} type="button" aria-label="Close" title="Close"><InstrumentIcon name="close" /></button></div>
    {children}
  </dialog>;
}
