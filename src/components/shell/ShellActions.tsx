"use client";
import { InstrumentIcon } from "./InstrumentIcon";
import { openDemo, openPalette } from "./events";
import styles from "./WorkspaceHeader.module.css";
export function ShellActions() {
  return <div className={styles.actions}>
    <button type="button" onClick={openPalette}><InstrumentIcon name="search" /> <span>Search</span><kbd>⌘K</kbd></button>
    <button type="button" onClick={openDemo}><InstrumentIcon name="demo" /> <span>Demo</span></button>
  </div>;
}
