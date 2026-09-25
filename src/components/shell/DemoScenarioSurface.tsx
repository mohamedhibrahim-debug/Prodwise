"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { getIntelligence, SEED_INITIATIVES } from "@/lib/data/fixtures";
import { BUSINESS_LINE_LABEL, STAGE_LABEL } from "@/lib/domain/labels";
import { OPEN_DEMO_EVENT } from "./events";
import styles from "./DemoScenarioSurface.module.css";

export function DemoScenarioSurface() {
  const pathname = usePathname();
  const router = useRouter();
  const params = useSearchParams();
  const queryString = params.toString();
  const [open, setOpen] = useState(params.get("demo") === "1");
  const closeRef = useRef<HTMLButtonElement>(null);
  const slug = pathname.match(/^\/initiatives\/([^/]+)/)?.[1];
  const initiative = SEED_INITIATIVES.find(item => item.slug === slug);
  const intelligence = slug ? getIntelligence(slug) : null;

  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener(OPEN_DEMO_EVENT, show);
    return () => window.removeEventListener(OPEN_DEMO_EVENT, show);
  }, []);
  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const close = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [open]);
  useEffect(() => {
    const next = new URLSearchParams(queryString);
    if (open) next.set("demo", "1"); else next.delete("demo");
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [open, pathname, queryString, router]);

  if (!open) return null;
  return <div className={styles.layer}>
    <button className={styles.scrim} aria-label="Close demo scenario" onClick={() => setOpen(false)} />
    <aside className={styles.drawer} role="dialog" aria-modal="true" aria-labelledby="demo-title">
      <header><div><span>Demo scenario</span><h2 id="demo-title">Authored illustration</h2></div><button ref={closeRef} onClick={() => setOpen(false)} aria-label="Close">×</button></header>
      <p className={styles.disclosure}>Demo scenario — authored illustration, not derived</p>
      {initiative && intelligence ? <>
        <div className={styles.meta}><strong>{initiative.name}</strong><span>{STAGE_LABEL[initiative.stage]} · {BUSINESS_LINE_LABEL[initiative.businessLine]}</span></div>
        <section><h3>Illustrative state</h3><strong>{initiative.overallState.replace("_", " ")}</strong><p>{initiative.stateSummary}</p></section>
        <section><h3>Authored attention</h3>{intelligence.attention.map(item => <div className={styles.item} key={item.id}><strong>{item.title}</strong><p>{item.detail}</p></div>)}</section>
        <section><h3>Illustrative readiness</h3><p>This is authored demo content and does not assess this initiative.</p>
          {intelligence.readiness.map(item => <div className={styles.item} key={item.domain}><strong>{item.domain}</strong><p>{item.whatWouldMakeThisReady}</p></div>)}</section>
        {intelligence.nextBestAction && <section><h3>Illustrative next action</h3><p>{intelligence.nextBestAction.action}</p></section>}
      </> : <>
        <p>This surface contains the seeded narrative used to illustrate future product intelligence. It does not describe derived product state.</p>
        <div className={styles.list}>{SEED_INITIATIVES.map(item => <div key={item.id}><strong>{item.name}</strong><span>{STAGE_LABEL[item.stage]} · {BUSINESS_LINE_LABEL[item.businessLine]}</span></div>)}</div>
      </>}
    </aside>
  </div>;
}
