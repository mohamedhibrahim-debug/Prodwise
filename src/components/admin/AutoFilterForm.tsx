'use client';
import { useRef, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';

/**
 * Administration filters that apply as you choose them: a select applies
 * immediately and search applies after a short pause, so there is no Apply
 * button. The records are filtered on the server exactly as before; only the
 * round trip is triggered for the person. Other query parameters (such as the
 * Members / Invitations view) are kept.
 */
export function AutoFilterForm({ className, children, clearHref }: { className?: string; children: ReactNode; clearHref?: string }) {
  const router = useRouter(); const pathname = usePathname();
  const form = useRef<HTMLFormElement>(null); const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const apply = () => {
    if (!form.current) return;
    const params = new URLSearchParams(window.location.search);
    for (const [key, value] of new FormData(form.current)) { const text = String(value).trim(); if (text) params.set(key, text); else params.delete(key); }
    const query = params.toString();
    router.replace(`${pathname}${query ? `?${query}` : ''}`, { scroll: false });
  };
  return <form ref={form} className={className} aria-label="Filter records" role="search"
    onSubmit={e => { e.preventDefault(); apply(); }}
    onChange={e => { const target = e.target as HTMLElement; if (timer.current) clearTimeout(timer.current); if (target.tagName === 'SELECT') apply(); else timer.current = setTimeout(apply, 300); }}>
    {children}
    {clearHref ? <a href={clearHref} className="pw-btn" data-variant="ghost" data-size="sm">Clear</a> : null}
  </form>;
}
