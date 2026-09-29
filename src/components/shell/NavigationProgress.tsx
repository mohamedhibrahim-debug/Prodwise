"use client";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * Immediate, app-wide acknowledgement that a link click registered: a thin bar at
 * the top from the click until the new route renders. Only same-origin, same-tab,
 * unmodified navigations to a different URL start it; a safety timeout clears it.
 * The bar belongs to the URL it started on, so arriving anywhere else ends it.
 */
export function NavigationProgress() {
  const path = usePathname(), search = useSearchParams()?.toString() ?? "";
  const here = `${path}?${search}`;
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const active = startedAt === here;
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onClick = (e: MouseEvent) => {
      // Capture phase: next/link prevents default before the event bubbles, so a bubbling listener never sees it.
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || (a.target && a.target !== "_self") || a.hasAttribute("download")) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin || url.pathname.startsWith("/api/")) return;
      if (url.pathname === location.pathname && url.search === location.search) return; // same page or hash jump
      setStartedAt(`${location.pathname}?${location.search.replace(/^\?/, "")}`);
      clearTimeout(timer); timer = setTimeout(() => setStartedAt(null), 10000);
    };
    document.addEventListener("click", onClick, true);
    return () => { document.removeEventListener("click", onClick, true); clearTimeout(timer); };
  }, []);
  return <div className="nav-progress" data-active={active || undefined} aria-hidden="true" />;
}
