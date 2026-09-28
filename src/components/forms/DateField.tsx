"use client";
import { useState, type InputHTMLAttributes } from "react";

const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

/**
 * A date input that notes — never blocks — a planned date already in the past.
 * Actual dates (development started, went live) are expected to be in the past and pass warnPast={false}.
 */
export function DateField({ warnPast = true, ...props }: InputHTMLAttributes<HTMLInputElement> & { warnPast?: boolean }) {
  const initial = typeof props.defaultValue === "string" ? props.defaultValue : typeof props.value === "string" ? props.value : "";
  const [value, setValue] = useState(initial);
  const past = warnPast && /^\d{4}-\d{2}-\d{2}$/.test(value) && value < today() && value !== initial;
  return <>
    <input type="date" {...props} onInput={e => { setValue((e.target as HTMLInputElement).value); props.onInput?.(e); }} />
    {past && <span className="disabled-reason" role="status">This date is already past. Save it only if it is the recorded plan.</span>}
  </>;
}
