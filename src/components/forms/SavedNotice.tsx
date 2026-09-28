"use client";
import { useEffect, useState } from "react";

/** Event a form fires after a successful save whose own subtree is about to remount. */
export const SAVED_EVENT = "prodwise:saved";
export function announceSaved(message: string) { window.dispatchEvent(new CustomEvent(SAVED_EVENT, { detail: message })); }

/** Page-level confirmation that survives the form being replaced by its refreshed version. */
export function SavedNotice({ className }: { className?: string }) {
  const [message, setMessage] = useState("");
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const on = (e: Event) => { setMessage(String((e as CustomEvent).detail ?? "")); clearTimeout(timer); timer = setTimeout(() => setMessage(""), 10000); };
    window.addEventListener(SAVED_EVENT, on);
    return () => { window.removeEventListener(SAVED_EVENT, on); clearTimeout(timer); };
  }, []);
  return <p role="status" className={className ?? "saved-notice"}>{message}</p>;
}
