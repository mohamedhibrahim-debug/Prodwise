"use client";
import { InstrumentIcon } from "./InstrumentIcon";
import { openPalette } from "./events";
import styles from "./WorkspaceHeader.module.css";
export function ShellActions() {
  return <div className={styles.actions}>
    <button type="button" onClick={openPalette}><InstrumentIcon name="search" /> <span>Search</span><kbd>⌘K</kbd></button>
  </div>;
}
