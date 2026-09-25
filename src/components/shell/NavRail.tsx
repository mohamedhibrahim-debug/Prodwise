"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { InstrumentIcon } from "./InstrumentIcon";
import { openDemo, openPalette } from "./events";
import styles from "./NavRail.module.css";

interface NavRailProps {
  dataSource: "Supabase" | "Local demo data";
  writesEnabled: boolean;
}

export function NavRail({ dataSource, writesEnabled }: NavRailProps) {
  const pathname = usePathname();
  const [expanded, setExpanded] = useState(true);
  const [preferenceReady, setPreferenceReady] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileTitle, setMobileTitle] = useState("Initiative");
  const drawerRef = useRef<HTMLElement>(null);
  const hamburgerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 1101px)");
    const sync = () => {
      let saved: string | null = null;
      try { saved = localStorage.getItem("prodwise.navigation.expanded"); } catch { /* Storage may be unavailable. */ }
      setExpanded(media.matches && saved !== "false");
      setPreferenceReady(true);
    };
    const frame = requestAnimationFrame(sync);
    media.addEventListener("change", sync);
    return () => { cancelAnimationFrame(frame); media.removeEventListener("change", sync); };
  }, []);

  useEffect(() => {
    if (!preferenceReady) return;
    document.documentElement.style.setProperty("--rail-w", expanded ? "248px" : "76px");
    return () => { document.documentElement.style.removeProperty("--rail-w"); };
  }, [expanded, preferenceReady]);

  const closeDrawer = useCallback(() => {
    setMobileOpen(false);
    requestAnimationFrame(() => hamburgerRef.current?.focus());
  }, []);
  useEffect(() => {
    if (!mobileOpen) return;
    drawerRef.current?.querySelector<HTMLElement>("nav a")?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); closeDrawer(); return; }
      if (event.key !== "Tab") return;
      const focusable = [...(drawerRef.current?.querySelectorAll<HTMLElement>('a[href],button:not([disabled])') ?? [])];
      if (!focusable.length) return;
      const first = focusable[0]!, last = focusable[focusable.length - 1]!;
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [mobileOpen, closeDrawer]);
  useEffect(() => {
    const update = () => {
      const name = document.querySelector("[data-workspace-title]")?.textContent?.trim();
      if (name) setMobileTitle(name);
    };
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [pathname]);

  const links = [
    { href: "/", label: "Home", icon: "home" as const, active: pathname === "/" },
    { href: "/initiatives", label: "Initiatives", icon: "initiatives" as const, active: pathname.startsWith("/initiatives") },
    { href: "/reporting", label: "Reporting", icon: "reporting" as const, active: pathname.startsWith("/reporting") },
  ];

  return <>
    <header className={styles.mobileBar}>
      <button ref={hamburgerRef} type="button" onClick={() => setMobileOpen(true)} aria-label="Open navigation" aria-expanded={mobileOpen}><InstrumentIcon name="menu" /></button>
      <Image src="/assets/prodwise-logo-mark.png" alt="" width={24} height={24} unoptimized />
      <span>{/^\/initiatives\/[^/]+$/.test(pathname) && pathname !== "/initiatives/new" ? "Prodwise" : pathname === "/" ? "Home" : pathname.startsWith("/initiatives/") ? mobileTitle : pathname.startsWith("/initiatives") ? "Initiatives" : "Reporting"}</span>
      <button type="button" onClick={openPalette} aria-label="Search"><InstrumentIcon name="search" /></button>
      <button type="button" onClick={openDemo} aria-label="Open demo scenario"><InstrumentIcon name="demo" /></button>
    </header>
    {mobileOpen && <button className={styles.scrim} aria-label="Close navigation" onClick={closeDrawer} />}
    <aside ref={drawerRef} className={`${styles.rail} ${expanded ? styles.expanded : ""} ${mobileOpen ? styles.mobileOpen : ""}`} role={mobileOpen ? "dialog" : undefined} aria-modal={mobileOpen ? true : undefined} aria-label={mobileOpen ? "Navigation" : undefined}>
      <div className={styles.brand}>
        <Image src="/assets/prodwise-logo-mark.png" alt="" width={32} height={32} unoptimized priority />
        <strong>Prodwise</strong>
      </div>
      <nav aria-label="Primary">
        {links.map(link => <Link key={link.href} href={link.href} onClick={closeDrawer} className={`${styles.navItem} ${link.active ? styles.active : ""}`} aria-current={link.active ? "page" : undefined}>
          <InstrumentIcon name={link.icon} /><span>{link.label}</span>
        </Link>)}
      </nav>
      <div className={styles.footer}>
        <p>{writesEnabled ? `${dataSource} · writes on` : `${dataSource} · read only`}</p>
        <button type="button" className={styles.pin} onClick={() => {
          const next = !expanded;
          setExpanded(next);
          try { localStorage.setItem("prodwise.navigation.expanded", String(next)); } catch { /* Keep the in-session preference. */ }
        }} aria-label={expanded ? "Collapse navigation" : "Pin expanded navigation"} aria-pressed={expanded}>
          <InstrumentIcon name="pin" /><span>{expanded ? "Collapse" : "Expand"}</span>
        </button>
      </div>
    </aside>
  </>;
}
