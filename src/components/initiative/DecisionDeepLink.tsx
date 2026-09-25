"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

const editable = (target: EventTarget | null) =>
  target instanceof HTMLElement && !!target.closest("input,textarea,select,[contenteditable]:not([contenteditable=false])");

export function DecisionDeepLink({ slug }: { slug: string }) {
  const item = useSearchParams().get("item");
  const [missing, setMissing] = useState(false);
  useEffect(() => {
    if (!item) { requestAnimationFrame(() => setMissing(false)); return; }
    const element = document.getElementById(`item-${item}`);
    window.dispatchEvent(new CustomEvent("prodwise:reveal-decision", { detail: item }));
    requestAnimationFrame(() => {
      if (!element) { setMissing(true); return; }
      setMissing(false);
      element.closest("details")?.setAttribute("open", "");
      element.scrollIntoView({ block: "start" });
      element.focus({ preventScroll: true });
    });
  }, [item]);

  useEffect(() => {
    let current = -1;
    const rows = () => [...document.querySelectorAll<HTMLElement>('[id^="item-"]')];
    const onKey = (event: KeyboardEvent) => {
      if (editable(event.target) || event.altKey || event.ctrlKey || event.metaKey) return;
      const items = rows();
      if (!items.length) return;
      if (event.key === "j" || event.key === "k") {
        event.preventDefault();
        current = current < 0 ? (event.key === "j" ? 0 : items.length - 1) :
          (current + (event.key === "j" ? 1 : -1) + items.length) % items.length;
        const row = items[current]!;
        window.dispatchEvent(new CustomEvent("prodwise:reveal-decision", { detail: row.id.slice(5) }));
        row.closest("details")?.setAttribute("open", "");
        requestAnimationFrame(() => { row.focus(); row.scrollIntoView({ block: "nearest" }); });
      } else if (event.key === "Enter") {
        const focused = document.activeElement?.closest<HTMLElement>('[id^="item-"]');
        if (focused && document.activeElement === focused) {
          const detail = focused.querySelector("details");
          if (detail) { event.preventDefault(); detail.open = true; detail.querySelector("summary")?.focus(); }
        }
      } else if (event.key === "Escape") {
        const focused = document.activeElement?.closest<HTMLElement>('[id^="item-"]');
        const detail = focused?.querySelector<HTMLDetailsElement>("details[open]");
        if (detail) { event.preventDefault(); detail.open = false; focused?.focus(); }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return missing ? <p role="status">
    This item is no longer open. It may have been decided, or the Knowledge behind it changed.{" "}
    <Link href={`/initiatives/${slug}/decisions`}>See all decisions</Link>
  </p> : null;
}
