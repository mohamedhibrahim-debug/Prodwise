"use client";
import Link from "next/link";
import { Fragment, useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { BusinessLine } from "@/components/primitives/BusinessLine";
import { Button } from "@/components/primitives/Button";
import { displayDate } from "@/lib/delivery/display";
import type { BusinessLine as BusinessLineCode } from "@/lib/domain/types";
import { axis, computeWindow, monthCount, rowMarks, xOf, type RoadmapGroup, type RoadmapGrouping, type RoadmapItem, type RoadmapWindow } from "@/lib/workspace/roadmap-layout";
import { ATTENTION_MARK, shortDate } from "./attention";
import styles from "./RoadmapTimeline.module.css";

interface Props {
  groups: RoadmapGroup[];
  unscheduled: RoadmapItem[];
  grouping: RoadmapGrouping;
  cutoff: string;
  cutoffLabel: string;
  /** Scenario date (Demo) or today; drawn separately when a different cutoff is chosen. */
  reference: { date: string; label: string };
}
interface Open { id: string; top: number; bottom: number; left: number; }

const pct = (n: number) => `${n}%`;
export const deliveryHref = (slug: string) => `/initiatives/${slug}/delivery?returnTo=${encodeURIComponent("/roadmap")}`;
const signed = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n)} d`;

export function AttentionChips({ item, max = 2 }: { item: RoadmapItem; max?: number }) {
  if (!item.attention.length) return null;
  const kinds = [...new Set(item.attention.map(a => a.kind))];
  const shown = kinds.slice(0, max), rest = item.attention.length - item.attention.filter(a => shown.includes(a.kind)).length;
  return <span className={styles.chips}>
    {shown.map(k => { const m = ATTENTION_MARK[k]; const n = item.attention.filter(a => a.kind === k).length;
      return <span key={k} className={styles.chip} data-tone={m.tone}><span aria-hidden="true" className={styles.glyph}>{m.glyph}</span>{m.short}{n > 1 ? ` ×${n}` : ""}</span>; })}
    {rest > 0 && <span className={styles.more}>+{rest} more</span>}
  </span>;
}

function Marks({ item, w, onOpen, onClose, describedBy }: { item: RoadmapItem; w: RoadmapWindow; onOpen: (id: string, el: HTMLElement) => void; onClose: () => void; describedBy?: string }) {
  const m = rowMarks(item, w);
  if (!m) return null;
  const targetLabel = item.target && !item.actual
    ? (m.target!.past ? `▲ ${shortDate(item.target)} · past target` : shortDate(item.target)) : null;
  const liveLabel = item.actual ? `${item.actualExtent === "PARTIAL" ? "Partial live" : "Live"} ${shortDate(item.actual)}` : null;
  const summary = [`${item.name}.`, `Target Live ${item.targetText}.`, item.actual ? `${liveLabel}.` : "Actual Live not recorded.",
    item.attention.length ? `${item.attention.length} attention ${item.attention.length === 1 ? "reason" : "reasons"}.` : "", "Open delivery."].filter(Boolean).join(" ");
  return <>
    <div className={styles.marks} aria-hidden="true">
      {m.planned && <span className={styles.planned} style={{ left: pct(m.planned.x), width: pct(m.planned.width) }} />}
      {m.delivered && <span className={styles.delivered} style={{ left: pct(m.delivered.x), width: pct(m.delivered.width) }} />}
      {m.ghost && <>
        <span className={styles.ghostLine} style={{ left: pct(Math.min(m.ghost.x, m.ghost.toX)), width: pct(Math.abs(m.ghost.toX - m.ghost.x)) }} />
        <span className={styles.ghost} style={{ left: pct(m.ghost.x) }} />
        <span className={styles.moveLabel} style={{ left: pct((m.ghost.x + m.ghost.toX) / 2) }}>Target {signed(m.ghost.days)}</span>
      </>}
      {m.milestone && <span className={styles.milestone} style={{ left: pct(m.milestone.x) }} />}
      {m.dependencies.map(d => <Fragment key={d.id}>
        <span className={styles.depLine} style={{ left: pct(Math.min(d.fromX, d.toX)), width: pct(Math.abs(d.toX - d.fromX)) }} />
        <span className={styles.depStart} style={{ left: pct(d.fromX) }} />
        <span className={styles.depEnd} style={{ left: pct(d.toX) }} />
        <span className={styles.depLabel} data-side={d.toX > 60 ? "left" : "right"} style={{ left: pct(d.toX > 60 ? d.toX : d.fromX) }}>⇢ Needs {d.name} · lands {d.days !== null ? `${signed(d.days)} after needed` : "after needed"}</span>
      </Fragment>)}
      <span className={m.target!.past ? `${styles.target} ${styles.targetPast}` : styles.target} style={{ left: pct(m.target!.x) }} />
      {m.live && <span className={m.live.partial ? `${styles.live} ${styles.partial}` : styles.live} style={{ left: pct(m.live.x) }} />}
      {targetLabel && <span className={styles.label} data-side={m.labelSide} data-past={m.target!.past || undefined} style={{ left: pct(m.target!.x) }}>{targetLabel}</span>}
      {liveLabel && m.live && <span className={`${styles.label} ${styles.liveLabel}`} data-side={m.live.x > 86 ? "left" : "right"} style={{ left: pct(m.live.x) }}>{liveLabel}</span>}
    </div>
    <Link prefetch={false} href={deliveryHref(item.slug)} className={styles.hit} aria-label={summary} aria-describedby={describedBy}
      style={{ left: `calc(${pct(m.hit.x)} - var(--s-3))`, width: `calc(${pct(m.hit.width)} + var(--s-6))` }}
      onMouseEnter={e => onOpen(item.id, e.currentTarget)} onMouseLeave={onClose} onFocus={e => onOpen(item.id, e.currentTarget)} onBlur={onClose} />
  </>;
}

function Popover({ item, open, id }: { item: RoadmapItem; open: Open; id: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [top, setTop] = useState<number | null>(null);
  // Measure, then sit below the bar, above it, or pinned inside the viewport — never off-screen.
  useLayoutEffect(() => {
    const h = ref.current?.offsetHeight ?? 0, vh = window.innerHeight;
    setTop(open.bottom + 8 + h <= vh - 8 ? open.bottom + 8 : open.top - 8 - h >= 8 ? open.top - 8 - h : Math.max(8, vh - h - 8));
  }, [open]);
  const style: CSSProperties = { top: top ?? open.bottom + 8, left: open.left, visibility: top === null ? "hidden" : undefined };
  return <div id={id} ref={ref} role="tooltip" className={styles.popover} style={style}>
    <p className={styles.popName}>{item.name}</p>
    <p className={styles.popMeta}>{item.stage} · {item.ownerLabel}</p>
    <dl className={styles.popFacts}>
      <dt>Target Live</dt><dd>{item.target ? displayDate(item.target) : item.targetText}{item.targetContext ? ` · ${item.targetContext}` : ""}</dd>
      {item.movement && <><dt>Target moved</dt><dd>{signed(item.movement.days)} from {displayDate(item.movement.from)}</dd></>}
      <dt>Actual Live</dt><dd>{item.actual ? `${displayDate(item.actual)} (${item.actualExtent === "PARTIAL" ? "partial" : "full"})` : "Not recorded"}</dd>
      <dt>Development start</dt><dd>{item.devStart ? displayDate(item.devStart) : "Not recorded"}</dd>
      <dt>Next milestone</dt><dd>{item.milestone ? `${item.milestone.text} · ${item.milestone.dateText}` : "Not recorded"}</dd>
    </dl>
    {item.attention.length > 0 && <ul className={styles.popAttention}>
      {item.attention.map((a, n) => { const m = ATTENTION_MARK[a.kind]; return <li key={n} data-tone={m.tone}><span aria-hidden="true" className={styles.glyph}>{m.glyph}</span><span><strong>{a.label}</strong> {a.detail}</span></li>; })}
    </ul>}
    {!item.attention.length && <p className={styles.popQuiet}>No attention reasons recorded as of this cutoff.</p>}
    <p className={styles.popHint}>Select to open delivery</p>
  </div>;
}

/**
 * The visual roadmap. Not a Gantt editor: nothing is draggable or editable,
 * and every mark sits on a recorded date. Initiatives without a Target Live
 * are listed in their own lane and never placed on time.
 */
export function RoadmapTimeline({ groups, unscheduled, grouping, cutoff, cutoffLabel, reference }: Props) {
  const scheduled = useMemo(() => groups.flatMap(g => g.items), [groups]);
  const showReference = reference.date !== cutoff;
  const w = useMemo(() => computeWindow(scheduled, cutoff, showReference ? [reference.date] : []), [scheduled, cutoff, showReference, reference.date]);
  const { months, quarters } = useMemo(() => axis(w), [w]);
  const today = xOf(cutoff, w);
  const [open, setOpen] = useState<Open | null>(null);
  const popId = useId();
  const closeTimer = useRef<number | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const [laneOpen, setLaneOpen] = useState(true);
  const all = useMemo(() => new Map([...scheduled, ...unscheduled].map(i => [i.id, i])), [scheduled, unscheduled]);

  const close = useCallback(() => { setOpen(null); }, []);
  const openFor = useCallback((id: string, el: HTMLElement) => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    const r = el.getBoundingClientRect(), vw = window.innerWidth, width = Math.min(320, vw - 16);
    const left = Math.max(8, Math.min(vw - width - 8, r.left));
    setOpen({ id, left, top: r.top, bottom: r.bottom });
  }, []);
  const scheduleClose = useCallback(() => { closeTimer.current = window.setTimeout(close, 60); }, [close]);

  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    const down = (e: PointerEvent) => { if (!(e.target as Element | null)?.closest?.(`.${styles.hit}`)) close(); };
    document.addEventListener("keydown", key);
    document.addEventListener("pointerdown", down);
    document.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => { document.removeEventListener("keydown", key); document.removeEventListener("pointerdown", down); document.removeEventListener("scroll", close, true); window.removeEventListener("resize", close); };
  }, [open, close]);
  useEffect(() => () => { if (closeTimer.current) window.clearTimeout(closeTimer.current); }, []);
  // When the timeline is wider than its container, open it with the cutoff in view.
  const toCutoff = useCallback((smooth: boolean) => {
    const el = scroller.current; if (!el || el.scrollWidth <= el.clientWidth) return;
    const nameW = (el.querySelector(`.${styles.corner}`) as HTMLElement | null)?.offsetWidth ?? 0;
    const trackW = el.scrollWidth - nameW, visible = el.clientWidth - nameW;
    el.scrollTo({ left: Math.max(0, today / 100 * trackW - visible * 0.4), behavior: smooth ? "smooth" : "auto" });
  }, [today]);
  const [overflowing, setOverflowing] = useState(false);
  useEffect(() => {
    const el = scroller.current; if (!el) return;
    const check = () => setOverflowing(el.scrollWidth > el.clientWidth + 1);
    check(); toCutoff(false);
    const ro = new ResizeObserver(check); ro.observe(el);
    return () => ro.disconnect();
  }, [toCutoff]);

  const flagX = Math.max(7, Math.min(93, today));
  const refX = xOf(reference.date, w), refFlagX = Math.max(7, Math.min(93, refX));
  const canvasStyle = { "--rm-months": monthCount(w) } as CSSProperties;
  const openItem = open ? all.get(open.id) : undefined;

  const row = (i: RoadmapItem) => <li key={i.id} className={styles.row}>
    <div className={styles.name}>
      <Link prefetch={false} href={deliveryHref(i.slug)} className={styles.nameLink} title={i.name}>{i.name}</Link>
      <span className={styles.meta}>{i.stage} · {grouping === "owner" ? i.businessLineLabel : i.ownerLabel}</span>
      <AttentionChips item={i} />
    </div>
    <div className={styles.track}>
      <Marks item={i} w={w} onOpen={openFor} onClose={scheduleClose} describedBy={open?.id === i.id ? popId : undefined} />
    </div>
  </li>;

  return <div className={styles.frame}>
    <div className={styles.frameBar}>
      <span>{months[0] ? `${months[0].label} ${months[0].year} – ${months.at(-1)!.label} ${months.at(-1)!.year}` : ""} · window from recorded dates</span>
      {overflowing && <Button type="button" variant="ghost" className={styles.jump} onClick={() => toCutoff(true)}>Go to {cutoffLabel.toLowerCase()}</Button>}
    </div>
    <div className={styles.scroller} ref={scroller} tabIndex={-1}>
      <div className={styles.canvas} style={canvasStyle}>
        <div className={styles.head}>
          <div className={styles.corner}>Initiative</div>
          <div className={styles.axis} aria-hidden="true">
            <div className={styles.quarters}>{quarters.map(q => <span key={q.key} style={{ left: pct(q.x), width: pct(q.width) }}>{q.label}</span>)}</div>
            <div className={styles.months}>{months.map(m => <span key={m.key} style={{ left: pct(m.x), width: pct(m.width) }}>{m.label}{m.label === "Jan" || m === months[0] ? <small> {m.year}</small> : null}</span>)}</div>
            {showReference && <span className={`${styles.flag} ${styles.refFlag}`} data-lower={Math.abs(refFlagX - flagX) < 14 || undefined} style={{ left: pct(refFlagX) }}>{reference.label} · {shortDate(reference.date)}</span>}
            <span className={styles.flag} data-cutoff={showReference || undefined} style={{ left: pct(flagX) }}>{cutoffLabel} · {shortDate(cutoff)}</span>
          </div>
        </div>
        <div className={styles.body}>
          <div className={styles.grid} aria-hidden="true">
            {months.map(m => <span key={m.key} className={m.label === "Jan" || m.label === "Apr" || m.label === "Jul" || m.label === "Oct" ? styles.quarterLine : styles.monthLine} style={{ left: pct(m.x) }} />)}
            {showReference && <span className={styles.reference} style={{ left: pct(refX) }} />}
            <span className={showReference ? `${styles.today} ${styles.cutoffLine}` : styles.today} style={{ left: pct(today) }} />
          </div>
          {groups.map(g => <section key={g.key} className={styles.group} aria-label={`${grouping === "owner" ? "Owner" : "Business line"} ${g.label}`}>
            <h3 className={styles.groupHead}><span className={styles.groupLabel}>
              {grouping === "businessLine" ? <BusinessLine code={g.key as BusinessLineCode} detailed /> : g.label}
              <span className={styles.groupCount}>{g.items.length} {g.items.length === 1 ? "initiative" : "initiatives"}</span>
            </span></h3>
            <ul className={styles.rows}>{g.items.map(row)}</ul>
          </section>)}
          {groups.length === 0 && <p className={styles.noneScheduled}>No initiative in this view has a confirmed Target Live, so nothing is placed on the timeline yet.</p>}
          {unscheduled.length > 0 && <section className={`${styles.group} ${styles.unscheduled}`} aria-label="Not scheduled">
            <h3 className={styles.groupHead}><span className={styles.groupLabel}>
              <button type="button" className={styles.laneToggle} aria-expanded={laneOpen} aria-controls="roadmap-unscheduled" onClick={() => setLaneOpen(v => !v)}>
                <span aria-hidden="true" className={styles.caret} data-open={laneOpen || undefined}>▸</span>Not scheduled — no Target Live recorded
              </button>
              <span className={styles.groupCount}>{unscheduled.length} {unscheduled.length === 1 ? "initiative" : "initiatives"} · not placed on the timeline; no date is assumed</span></span></h3>
            <ul className={styles.rows} id="roadmap-unscheduled" hidden={!laneOpen}>{unscheduled.map(i => <li key={i.id} className={styles.row}>
              <div className={styles.name}>
                <Link prefetch={false} href={deliveryHref(i.slug)} className={styles.nameLink} title={i.name}>{i.name}</Link>
                <span className={styles.meta}>{i.stage} · {i.ownerLabel}</span>
                <AttentionChips item={i} />
              </div>
              <div className={styles.offTrack}>
                <p><strong>Target Live {i.targetText === "Unknown" ? "recorded as Unknown" : "not recorded"}</strong></p>
                <p className={styles.offMilestone}>Next milestone · {i.milestone ? `${i.milestone.text} · ${i.milestone.dateText}` : "Not recorded"} · <Link prefetch={false} href={deliveryHref(i.slug)}>Open delivery facts</Link></p>
              </div>
            </li>)}</ul>
          </section>}
        </div>
      </div>
    </div>
    <ul className={styles.legend} aria-label="Legend">
      <li><span className={`${styles.key} ${styles.keyPlanned}`} aria-hidden="true" />Planned · development start → Target Live</li>
      <li><span className={`${styles.key} ${styles.keyDelivered}`} aria-hidden="true" />Delivered · development start → Actual Live</li>
      <li><span className={`${styles.keyMark} ${styles.target}`} aria-hidden="true" />Target Live</li>
      <li><span className={`${styles.keyMark} ${styles.target} ${styles.targetPast}`} aria-hidden="true" />▲ Past target · update requested</li>
      <li><span className={`${styles.keyMark} ${styles.live}`} aria-hidden="true" />Actual Live</li>
      <li><span className={`${styles.keyMark} ${styles.live} ${styles.partial}`} aria-hidden="true" />Partial live</li>
      <li><span className={`${styles.keyMark} ${styles.ghost}`} aria-hidden="true" />Previous target</li>
      <li><span className={`${styles.keyMark} ${styles.milestone}`} aria-hidden="true" />Next milestone</li>
      <li><span className={`${styles.key} ${styles.keyDep}`} aria-hidden="true" />⇢ Dependency lands after it is needed</li>
      {showReference && <li><span className={`${styles.key} ${styles.keyReference}`} aria-hidden="true" />{reference.label}</li>}
      <li><span className={showReference ? `${styles.key} ${styles.keyToday} ${styles.keyCutoff}` : `${styles.key} ${styles.keyToday}`} aria-hidden="true" />{cutoffLabel}</li>
    </ul>
    {open && openItem && <Popover item={openItem} open={open} id={popId} />}
  </div>;
}
