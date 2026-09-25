"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
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
  const [expanded, setExpanded] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    document.documentElement.style.setProperty("--rail-w", expanded ? "212px" : "76px");
    return () => { document.documentElement.style.removeProperty("--rail-w"); };
  }, [expanded]);

  useEffect(() => {
    if (!mobileOpen) return;
    const close = (event: KeyboardEvent) => event.key === "Escape" && setMobileOpen(false);
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [mobileOpen]);

  const links = [
    { href: "/", label: "Home", icon: "home" as const, active: pathname === "/" },
    { href: "/initiatives", label: "Initiatives", icon: "initiatives" as const, active: pathname.startsWith("/initiatives") },
    { href: "/reporting", label: "Reporting", icon: "reporting" as const, active: pathname.startsWith("/reporting") },
  ];

  return <>
    <header className={styles.mobileBar}>
      <button type="button" onClick={() => setMobileOpen(true)} aria-label="Open navigation"><InstrumentIcon name="menu" /></button>
      <Image src="/assets/prodwise-logo-mark.png" alt="" width={24} height={24} unoptimized />
      <span>{pathname === "/" ? "Home" : pathname.startsWith("/initiatives/") ? "Initiative" : pathname.startsWith("/initiatives") ? "Initiatives" : "Reporting"}</span>
      <button type="button" onClick={openPalette} aria-label="Search"><InstrumentIcon name="search" /></button>
      <button type="button" onClick={openDemo} aria-label="Open demo scenario"><InstrumentIcon name="demo" /></button>
    </header>
    {mobileOpen && <button className={styles.scrim} aria-label="Close navigation" onClick={() => setMobileOpen(false)} />}
    <aside className={`${styles.rail} ${expanded ? styles.expanded : ""} ${mobileOpen ? styles.mobileOpen : ""}`}>
      <div className={styles.brand}>
        <Image src="/assets/prodwise-logo-mark.png" alt="" width={32} height={32} unoptimized priority />
        <strong>Prodwise</strong>
      </div>
      <nav aria-label="Primary">
        {links.map(link => <Link key={link.href} href={link.href} onClick={() => setMobileOpen(false)} className={`${styles.navItem} ${link.active ? styles.active : ""}`} aria-current={link.active ? "page" : undefined}>
          <InstrumentIcon name={link.icon} /><span>{link.label}</span>
        </Link>)}
      </nav>
      <div className={styles.footer}>
        <p>{writesEnabled ? `${dataSource} · writes on` : `${dataSource} · read only`}</p>
        <button type="button" className={styles.pin} onClick={() => setExpanded(value => !value)} aria-label={expanded ? "Collapse navigation" : "Pin expanded navigation"} aria-pressed={expanded}>
          <InstrumentIcon name="pin" /><span>{expanded ? "Collapse" : "Expand"}</span>
        </button>
      </div>
    </aside>
  </>;
}
