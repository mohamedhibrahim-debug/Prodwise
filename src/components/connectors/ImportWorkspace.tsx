"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useMemo, useReducer, useRef, useState, type FormEvent, type MouseEvent } from "react";
import { Button } from "@/components/primitives/Button";
import { useWorkspaceScope } from "@/components/auth/WorkspaceScope";
import { failureMessage } from "@/components/forms/useFormAction";
import { jiraProjectsAction, searchAction, type SearchState } from "@/app/initiatives/[slug]/sources/import/actions";
import { facets, filterRows, IMPORT_BATCH_LIMIT, selectVisible, STATUS_CATEGORY_LABEL, toggleSelection, typeOptions, type ImportRow } from "@/lib/connectors/import-view";
import { canRetry, createWatchdog, DEADLINES, EMPTY_PROGRESS, isActive, nextQueued, PHASE_LABEL, progressReducer, summarize, type ItemProgress, type ProgressEvent, type ProgressState, type Watchdog } from "@/lib/connectors/import-progress";
import type { Connector, ConnectorSite, JiraStatusCategory } from "@/lib/connectors/types";
import { formatDate } from "@/lib/domain/labels";
import { Glyph, ProviderIcon } from "./icons";
import { StatusChip, TypeBadge } from "./JiraBadges";
import styles from "./import.module.css";

type Role = "REQUIREMENTS" | "DELIVERY" | "DECISIONS" | "GENERAL";
const ROLES: { value: Role; label: string; hint: string }[] = [
  { value: "DELIVERY", label: "Delivery", hint: "Work that builds or ships the initiative" },
  { value: "REQUIREMENTS", label: "Requirements", hint: "What the initiative must do" },
  { value: "DECISIONS", label: "Decisions", hint: "Where choices were made or confirmed" },
  { value: "GENERAL", label: "General", hint: "Background and reference" },
];
const PROMPT: Record<Connector, { label: string; placeholder: string; idle: string; empty: string }> = {
  JIRA: { label: "Search Jira", placeholder: "Key such as LEND-10, or words from the summary", idle: "Search by key or words, or choose a project to browse its work items. Filter by type to see only epics or stories.", empty: "No Jira work items match this search in what your account can see." },
  GMAIL: { label: "Search your mailbox", placeholder: "e.g. repayment divisor  ·  from:finance  ·  subject:pilot", idle: "A search is required — Prodwise never lists your whole mailbox. Gmail search operators work.", empty: "No email threads match this search in your mailbox." },
  GOOGLE_DRIVE: { label: "Search Drive", placeholder: "Document name or words in it", idle: "Only files your Google account can open are listed. Docs, Sheets and Slides are imported as text; other files by link and details only.", empty: "No Drive files match this search in what your account can open." },
  FIGMA: { label: "Figma file or frame link", placeholder: "https://www.figma.com/design/…", idle: "Paste a link to a Figma file to list its frames, or copy a frame’s link to select it directly.", empty: "No frames were found on this file’s pages." },
};
const RECONNECT = new Set(["NEEDS_RECONNECT", "NOT_CONNECTED"]);
interface ItemResult { ok: boolean; changed: boolean; submissionId: string | null; name: string; message: string | null; code: string | null }

type SearchPhase = { kind: "idle" } | { kind: "searching"; slow: boolean } | { kind: "error"; message: string; code: string | null } | { kind: "done"; result: SearchState };
interface Query { q: string; project: string; site: string; type: string; status: string; link: string }

export interface ImportWorkspaceProps {
  slug: string; initiativeName: string; connector: Connector; connectorSlug: string; label: string;
  sites: ConnectorSite[]; importedRefs: string[]; defaultRole: Role; initial: Partial<Query>;
}

export function ImportWorkspace(p: ImportWorkspaceProps) {
  const router = useRouter(), scope = useWorkspaceScope(), uid = useId();
  const isJira = p.connector === "JIRA", isFigma = p.connector === "FIGMA", prompt = PROMPT[p.connector];
  const [query, setQuery] = useState<Query>({ q: p.initial.q ?? "", project: p.initial.project ?? "", site: p.initial.site ?? p.sites[0]?.id ?? "", type: p.initial.type ?? "", status: p.initial.status ?? "", link: p.initial.link ?? "" });
  const [phase, setPhase] = useState<SearchPhase>({ kind: "idle" });
  const [projects, setProjects] = useState<{ key: string; name: string }[] | null>(isJira ? null : []);
  const [selected, setSelected] = useState<string[]>([]);
  const [limitNote, setLimitNote] = useState(false);
  const [role, setRole] = useState<Role>(p.defaultRole);
  const [comments, setComments] = useState(true);
  const [narrow, setNarrow] = useState<{ text: string; type: string | null; status: JiraStatusCategory | "unknown" | null }>({ text: "", type: null, status: null });
  const [localImported, setLocalImported] = useState<string[]>([]);

  // ── Search, bounded ────────────────────────────────────────────────────────
  const searchToken = useRef(0), searchDog = useRef<Watchdog | null>(null);
  const runSearch = useCallback(async (q: Query) => {
    const token = ++searchToken.current;
    searchDog.current?.stop();
    setPhase({ kind: "searching", slow: false }); setNarrow({ text: "", type: null, status: null });
    const params = new URLSearchParams({ from: p.connectorSlug });
    for (const [k, v] of Object.entries(isFigma ? { link: q.link } : { q: q.q, project: q.project, site: p.sites.length > 1 ? q.site : "", type: q.type, status: q.status })) if (v) params.set(k, v);
    try { window.history.replaceState(window.history.state, "", `?${params}`); } catch { /* address bar only */ }
    searchDog.current = createWatchdog({ ...DEADLINES.search,
      onSlow: () => { if (token === searchToken.current) setPhase(s => (s.kind === "searching" ? { kind: "searching", slow: true } : s)); },
      onTimeout: () => { if (token === searchToken.current) { searchToken.current++; setPhase({ kind: "error", message: `${p.label} didn’t answer within a minute. Nothing was saved. Try again, or narrow the search.`, code: null }); } } });
    try {
      const result = await searchAction({ from: p.connectorSlug, ...(isFigma ? { link: q.link } : { q: q.q, project: q.project, site: q.site, type: q.type, status: q.status }) });
      if (token !== searchToken.current) return;
      setPhase(result.error ? { kind: "error", message: result.error, code: result.code } : { kind: "done", result });
    } catch {
      if (token === searchToken.current) setPhase({ kind: "error", message: await failureMessage(), code: null });
    } finally { if (token === searchToken.current) searchDog.current?.stop(); }
  }, [isFigma, p.connectorSlug, p.label, p.sites.length]);
  const cancelSearch = () => { searchToken.current++; searchDog.current?.stop(); setPhase({ kind: "idle" }); };
  const keepWaiting = () => { searchDog.current?.extend(); setPhase({ kind: "searching", slow: false }); };

  const canSearch = isFigma ? query.link.trim().length >= 20 : isJira ? Boolean(query.q.trim() || query.project) : query.q.trim().length >= (p.connector === "GMAIL" ? 3 : 2);
  const submit = (e: FormEvent) => { e.preventDefault(); if (canSearch) void runSearch(query); };

  // First render: repeat the search in the address bar (reload / back), and load Jira projects.
  const initialQuery = useRef(query);
  useEffect(() => {
    const q = initialQuery.current;
    if (isJira) void jiraProjectsAction(q.site || null).then(setProjects, () => setProjects([]));
    if (isFigma ? q.link : isJira ? q.q || q.project : q.q) void runSearch(q);
    const token = searchToken, dog = searchDog;
    return () => { token.current++; dog.current?.stop(); };
  }, [isFigma, isJira, runSearch]);

  const rows = useMemo(() => (phase.kind === "done" ? phase.result.rows : []), [phase]);
  const imported = useMemo(() => new Set([...p.importedRefs, ...localImported].map(r => r.toLowerCase())), [p.importedRefs, localImported]);
  const visible = useMemo(() => filterRows(rows, narrow), [rows, narrow]);
  const f = useMemo(() => facets(rows), [rows]);
  const nameOf = (ref: string) => rows.find(r => r.reference === ref)?.name ?? ref;

  // ── Import, one item at a time, each bounded ────────────────────────────────
  const store = useRef<ProgressState>(EMPTY_PROGRESS);
  const [, render] = useReducer((n: number) => n + 1, 0);
  const send = useCallback((e: ProgressEvent) => { store.current = progressReducer(store.current, e); render(); }, []);
  const inflight = useRef(new Map<string, { ctl: AbortController; dog: Watchdog; why: "cancel" | "timeout" | null }>());
  const draining = useRef(false);
  const progressRef = useRef<HTMLElement>(null);

  const importOne = useCallback(async (item: ItemProgress) => {
    const { reference, attempt } = item;
    const ctl = new AbortController(), entry = { ctl, dog: null as unknown as Watchdog, why: null as "cancel" | "timeout" | null };
    entry.dog = createWatchdog({ ...DEADLINES.item, onSlow: () => send({ type: "SLOW", reference, attempt }), onTimeout: () => { entry.why = "timeout"; ctl.abort(); } });
    inflight.current.set(reference, entry);
    send({ type: "STAGE", reference, attempt, stage: "IMPORTING" });
    try {
      const res = await fetch(`/api/connectors/${p.connectorSlug}/import`, { method: "POST", signal: ctl.signal, headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug: p.slug, reference, role, site: isJira ? query.site : null, includeComments: isFigma && comments, scopeWorkspaceId: scope }) });
      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => null) as { error?: string } | null;
        send({ type: "FAIL", reference, attempt, message: body?.error ?? (res.status === 401 ? await failureMessage() : "The import was refused. Nothing was saved.") }); return;
      }
      const reader = res.body.getReader(), dec = new TextDecoder();
      let buf = "", result = null as ItemResult | null;
      for (;;) {
        const { value, done } = await reader.read(); if (done) break;
        buf += dec.decode(value, { stream: true });
        for (let nl = buf.indexOf("\n"); nl >= 0; nl = buf.indexOf("\n")) {
          const line = buf.slice(0, nl).trim(); buf = buf.slice(nl + 1); if (!line) continue;
          const msg = JSON.parse(line) as { stage?: string; result?: ItemResult };
          if (msg.stage === "SAVING") send({ type: "STAGE", reference, attempt, stage: "SAVING" });
          if (msg.result) result = msg.result;
        }
      }
      if (!result) send({ type: "FAIL", reference, attempt, message: "The connection closed before Prodwise confirmed this import. It may still have been saved — retrying is safe: an unchanged item saves nothing new." });
      else if (result.ok) { send({ type: "DONE", reference, attempt, changed: result.changed, submissionId: result.submissionId, name: result.name, message: result.message }); setLocalImported(l => [...l, reference]); }
      else send({ type: "FAIL", reference, attempt, message: result.message ?? "The item could not be imported.", code: result.code });
    } catch {
      if (entry.why === "timeout") send({ type: "FAIL", reference, attempt, message: `No answer after ${DEADLINES.item.hardMs / 1000} seconds. It may still finish — retrying is safe: an unchanged item saves nothing new.` });
      else if (entry.why !== "cancel") send({ type: "FAIL", reference, attempt, message: await failureMessage() });
    } finally { entry.dog.stop(); inflight.current.delete(reference); }
  }, [comments, isFigma, isJira, p.connectorSlug, p.slug, query.site, role, scope, send]);

  const drain = useCallback(async () => {
    if (draining.current) return; draining.current = true;
    try {
      for (let next = nextQueued(store.current); next; next = nextQueued(store.current)) {
        await importOne(next);
        const failed = store.current.items.find(i => i.reference === next!.reference);
        if (failed?.code && RECONNECT.has(failed.code)) send({ type: "STOP_QUEUED", message: `Not started — reconnect ${p.label} first.` });
      }
    } finally { draining.current = false; }
    if (store.current.items.some(i => i.phase === "IMPORTED" || i.phase === "UNCHANGED")) router.refresh();
  }, [importOne, p.label, router, send]);

  const startImport = () => {
    if (!selected.length) return;
    send({ type: "QUEUE", items: selected.map(r => ({ reference: r, name: nameOf(r) })) });
    setSelected([]); setLimitNote(false);
    void drain();
    requestAnimationFrame(() => progressRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
  };
  const retry = (refs: string[]) => { send({ type: "RETRY", references: refs }); void drain(); };
  const cancelItem = (ref: string) => { const e = inflight.current.get(ref); send({ type: "CANCEL", reference: ref, message: "Cancelled. If it had already been read, the snapshot may still have been saved — retrying is safe." }); if (e) { e.why = "cancel"; e.ctl.abort(); } };
  const keepItem = (ref: string) => { inflight.current.get(ref)?.dog.extend(); send({ type: "KEEP_WAITING", reference: ref }); };
  const stopAll = () => { send({ type: "STOP_QUEUED", message: "Not started — you stopped the import." }); for (const i of store.current.items) if (isActive(i)) cancelItem(i.reference); };
  useEffect(() => () => { for (const e of inflight.current.values()) { e.dog.stop(); } }, []);

  const progress = store.current, summary = summarize(progress), running = summary.running, current = progress.items.find(isActive) ?? null;
  const toggle = (ref: string) => { const r = toggleSelection(selected, ref); setSelected(r.selected); setLimitNote(r.refused); };
  const rowClick = (e: MouseEvent<HTMLLIElement>, ref: string) => { if (running) return; if ((e.target as HTMLElement).closest("a,button,input,label,select")) return; toggle(ref); };
  const visibleRefs = visible.map(r => r.reference);
  const allVisibleSelected = visibleRefs.length > 0 && visibleRefs.slice(0, IMPORT_BATCH_LIMIT).every(r => selected.includes(r));
  const reconnectHref = `/account/connections?connect=${p.connectorSlug}&returnTo=${encodeURIComponent(`/initiatives/${p.slug}/sources/import?from=${p.connectorSlug}`)}`;

  return <div className={styles.workspace}>
    <form role="search" className={styles.queryBar} onSubmit={submit} aria-label={`${prompt.label} for ${p.initiativeName}`}>
      <div className={styles.queryMain}>
        <label className={styles.searchField}>
          <span className="visually-hidden">{prompt.label}</span>
          <span className={styles.searchIcon}><Glyph name="search" size={16} /></span>
          <input type={isFigma ? "url" : "search"} value={isFigma ? query.link : query.q} onChange={e => setQuery(q => (isFigma ? { ...q, link: e.target.value } : { ...q, q: e.target.value }))}
            placeholder={prompt.placeholder} maxLength={isFigma ? 500 : 200} aria-describedby={`${uid}-hint`} autoComplete="off" spellCheck={false} />
        </label>
        <Button type="submit" variant="primary" disabled={!canSearch || phase.kind === "searching"}>{isFigma ? "Show frames" : "Search"}</Button>
      </div>
      {isJira && <div className={styles.filters}>
        {p.sites.length > 1 && <label className={styles.filter}><span>Site</span><select value={query.site} onChange={e => setQuery(q => ({ ...q, site: e.target.value, project: "" }))}>{p.sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>}
        <label className={styles.filter}><span>Project</span><select value={query.project} onChange={e => { const next = { ...query, project: e.target.value }; setQuery(next); if (next.q.trim() || next.project) void runSearch(next); }} disabled={projects === null}>
          <option value="">{projects === null ? "Loading projects…" : "All projects you can see"}</option>
          {(projects ?? []).map(pr => <option key={pr.key} value={pr.key}>{pr.name} ({pr.key})</option>)}
          {query.project && projects && !projects.some(pr => pr.key === query.project) && <option value={query.project}>{query.project}</option>}
        </select></label>
        <label className={styles.filter}><span>Type</span><select value={query.type} onChange={e => { const next = { ...query, type: e.target.value }; setQuery(next); if (next.q.trim() || next.project) void runSearch(next); }}>
          <option value="">Any type</option>{typeOptions(rows, query.type || null).map(o => <option key={o.value} value={o.value}>{o.label}{o.value === "subtask" ? " (all sub-task types)" : ""}</option>)}
        </select></label>
        <label className={styles.filter}><span>Status</span><select value={query.status} onChange={e => { const next = { ...query, status: e.target.value }; setQuery(next); if (next.q.trim() || next.project) void runSearch(next); }}>
          <option value="">Any status</option>{(Object.keys(STATUS_CATEGORY_LABEL) as JiraStatusCategory[]).map(k => <option key={k} value={k}>{STATUS_CATEGORY_LABEL[k]}</option>)}
        </select></label>
      </div>}
      <p id={`${uid}-hint`} className={styles.hint}>{prompt.idle}</p>
    </form>

    {progress.items.length > 0 && <section ref={progressRef} tabIndex={-1} className={styles.progress} aria-labelledby={`${uid}-progress`} data-state={running ? "running" : summary.failed || summary.cancelled ? "partial" : "complete"}>
      <header className={styles.progressHead}>
        <h3 id={`${uid}-progress`} role="status" aria-live="polite">{running ? <span className={styles.spin}><Glyph name="spinner" size={14} /></span> : summary.failed || summary.cancelled ? <Glyph name="warning" size={14} /> : <Glyph name="check" size={14} />}{summary.line}</h3>
        <div className={styles.progressActions}>
          {running ? <Button variant="secondary" onClick={stopAll}>Stop</Button> : <>
            {progress.items.some(canRetry) && <Button variant="primary" onClick={() => retry(progress.items.filter(canRetry).map(i => i.reference))}>Retry {progress.items.filter(canRetry).length === 1 ? "failed item" : `${progress.items.filter(canRetry).length} items`}</Button>}
            <Link prefetch={false} className={styles.textLink} href={`/initiatives/${p.slug}/sources`}>Go to Sources</Link>
          </>}
        </div>
      </header>
      <ol className={styles.progressList}>{progress.items.map(i => <li key={i.reference} data-phase={i.phase}>
        <span className={styles.phase} data-phase={i.phase}>{isActive(i) ? <span className={styles.spin}><Glyph name="spinner" size={12} /></span> : i.phase === "IMPORTED" || i.phase === "UNCHANGED" ? <Glyph name="check" size={12} /> : i.phase === "FAILED" ? <Glyph name="cross" size={12} /> : i.phase === "CANCELLED" ? <Glyph name="minus" size={12} /> : <Glyph name="clock" size={12} />}{PHASE_LABEL[i.phase]}</span>
        <span className={styles.progressName}><strong>{i.name}</strong>{isJira && i.name !== i.reference && <span className={styles.mono}>{i.reference}</span>}</span>
        <span className={styles.progressDetail}>
          {i.slow && isActive(i) ? <span className={styles.slow} role="alert">This is taking longer than expected. <button type="button" onClick={() => keepItem(i.reference)}>Keep waiting</button> <button type="button" onClick={() => cancelItem(i.reference)}>Cancel</button></span>
          : i.phase === "IMPORTED" && i.submissionId ? <Link prefetch={false} href={`/initiatives/${p.slug}/evidence/${i.submissionId}`}>Review snapshot</Link>
          : i.phase === "UNCHANGED" ? <span>{i.message ?? "Unchanged; no new snapshot was saved."}{i.submissionId && <> · <Link prefetch={false} href={`/initiatives/${p.slug}/evidence/${i.submissionId}`}>Latest snapshot</Link></>}</span>
          : i.phase === "FAILED" || i.phase === "CANCELLED" ? <span className={i.phase === "FAILED" ? styles.failText : undefined}>{i.message} {i.code && RECONNECT.has(i.code) ? <Link prefetch={false} href={reconnectHref}>Reconnect {p.label}</Link> : !running && <button type="button" className={styles.inlineRetry} onClick={() => retry([i.reference])}>Retry</button>}</span>
          : null}
        </span>
      </li>)}</ol>
      {!running && <p className={styles.hint}>Imports save a snapshot as evidence. Nothing becomes Knowledge until someone confirms it.</p>}
    </section>}

    <section className={styles.results} aria-labelledby={`${uid}-results`} aria-busy={phase.kind === "searching"}>
      <h3 id={`${uid}-results`} className="visually-hidden">{p.label} results</h3>
      {phase.kind === "idle" && <div className={styles.idle}><ProviderIcon connector={p.connector} size={22} /><p>{isJira ? "Find the epics, stories, tasks and bugs that belong to this initiative." : isFigma ? "Choose the frames that define this initiative’s design." : p.connector === "GMAIL" ? "Find the threads where decisions and commitments were made." : "Find the specifications and working documents for this initiative."}</p></div>}
      {phase.kind === "searching" && <div role="status" aria-live="polite">
        <p className={styles.loadingLine}><span className={styles.spin}><Glyph name="spinner" size={14} /></span>{isFigma ? "Loading frames from Figma…" : `Searching ${p.label}…`}</p>
        {phase.slow && <p className={styles.slowBanner}>This is taking longer than expected. <Button variant="secondary" onClick={keepWaiting}>Keep waiting</Button> <Button variant="ghost" onClick={cancelSearch}>Cancel</Button></p>}
        <ul className={styles.skeleton} aria-hidden="true">{[0, 1, 2, 3, 4].map(n => <li key={n}><span /><span /><span /></li>)}</ul>
      </div>}
      {phase.kind === "error" && <div role="alert" className={styles.errorBox}>
        <p><Glyph name="warning" size={14} /> {phase.message}{query.type && phase.code === "INVALID_REQUEST" ? ` This Jira site may not have the issue type “${query.type === "subtask" ? "Sub-task" : query.type}”.` : ""}</p>
        <div className={styles.errorActions}>{phase.code && RECONNECT.has(phase.code) ? <Link prefetch={false} className={styles.textLink} href={reconnectHref}>Reconnect {p.label}</Link> : <Button variant="secondary" onClick={() => void runSearch(query)}>Try again</Button>}</div>
      </div>}
      {phase.kind === "done" && (rows.length === 0 ? <p className={styles.empty} role="status">{prompt.empty}</p> : <>
        <div className={styles.resultsHead}>
          <p role="status" className={styles.count}><strong>{visible.length === rows.length ? rows.length : `${visible.length} of ${rows.length}`}</strong> {rows.length === 1 ? "result" : "results"}{phase.result.fileName ? ` in ${phase.result.fileName}` : ""}{phase.result.more ? ` · showing the ${rows.length} most recently updated; more match — refine the search to narrow it` : ""}{phase.result.omitted ? ` · ${phase.result.omitted} could not be read just now` : ""} · select up to {IMPORT_BATCH_LIMIT} to import</p>
          {rows.length > 3 && <label className={styles.narrow}><span className="visually-hidden">Filter these results</span><Glyph name="search" size={13} /><input type="search" value={narrow.text} onChange={e => setNarrow(n => ({ ...n, text: e.target.value }))} placeholder="Filter these results" /></label>}
        </div>
        {isJira && f.types.length > 1 && <div className={styles.chips} role="group" aria-label="Show issue type">
          <button type="button" aria-pressed={!narrow.type} onClick={() => setNarrow(n => ({ ...n, type: null }))}>All <span>{rows.length}</span></button>
          {f.types.map(t => { const r = rows.find(x => (x.jira?.type ?? "Type not returned") === t.value); return <button type="button" key={t.value} aria-pressed={narrow.type === t.value} onClick={() => setNarrow(n => ({ ...n, type: n.type === t.value ? null : t.value }))}>{r?.jira ? <TypeBadge type={r.jira.type} subtask={r.jira.subtask} /> : t.label} <span>{t.count}</span></button>; })}
          {f.statuses.length > 1 && <span className={styles.chipDivider} aria-hidden="true" />}
          {f.statuses.length > 1 && f.statuses.map(s => <button type="button" key={s.value} aria-pressed={narrow.status === s.value} onClick={() => setNarrow(n => ({ ...n, status: n.status === s.value ? null : s.value as JiraStatusCategory | "unknown" }))}>{s.label} <span>{s.count}</span></button>)}
        </div>}
        {visible.length === 0 ? <p className={styles.empty}>No loaded results match these filters. <button type="button" className={styles.inlineRetry} onClick={() => setNarrow({ text: "", type: null, status: null })}>Clear filters</button></p> : <>
          <div className={styles.listHead} data-kind={isJira ? "jira" : "generic"}>
            <label className={styles.selectAll}><input type="checkbox" checked={allVisibleSelected} disabled={running} onChange={() => setSelected(allVisibleSelected ? selected.filter(r => !visibleRefs.includes(r)) : selectVisible(selected, visibleRefs))} /><span>{allVisibleSelected ? "Clear visible" : visibleRefs.length > IMPORT_BATCH_LIMIT ? `Select first ${IMPORT_BATCH_LIMIT}` : "Select all"}</span></label>
            {isJira ? <><span>Work item</span><span>Status</span><span>Assignee</span><span>Updated</span><span>Due</span></> : <><span>{isFigma ? "Frame" : p.connector === "GMAIL" ? "Thread" : "File"}</span><span>{isFigma ? "Type" : "Kind"}</span><span>Updated</span></>}
          </div>
          <ul className={styles.list} data-kind={isJira ? "jira" : "generic"}>{groupRows(visible).map(([group, list]) => [
            group ? <li key={`g-${group}`} className={styles.groupRow} aria-hidden="true">{group}</li> : null,
            ...list.map(r => <ResultRow key={r.reference} row={r} jira={isJira} label={p.label} selected={selected.includes(r.reference)} imported={imported.has(r.reference.toLowerCase())} disabled={running} onToggle={() => toggle(r.reference)} onRowClick={e => rowClick(e, r.reference)} />),
          ])}</ul>
        </>}
      </>)}
    </section>

    {(selected.length > 0 || progress.items.length > 0) && <div className={styles.selectionBar} data-active={selected.length > 0 || running || undefined}>
      {running ? <>
        <p className={styles.barStatus} aria-hidden="true"><span className={styles.spin}><Glyph name="spinner" size={14} /></span><strong>{summary.line}</strong>{current && <span className={styles.barCurrent}>{current.name} · {PHASE_LABEL[current.phase]}</span>}</p>
        <Button variant="secondary" onClick={stopAll}>Stop</Button>
      </> : selected.length > 0 ? <>
        <p className={styles.barStatus} aria-live="polite"><strong>Selected {selected.length}</strong>{selected.length >= IMPORT_BATCH_LIMIT ? ` · limit ${IMPORT_BATCH_LIMIT}` : ""} <button type="button" className={styles.clear} onClick={() => { setSelected([]); setLimitNote(false); }}>Clear</button>{limitNote && <span className={styles.limitNote}> Import these {IMPORT_BATCH_LIMIT} first so each can be reviewed.</span>}</p>
        <fieldset className={styles.roles}><legend>Source role</legend><div className={styles.segments}>{ROLES.map(r => <label key={r.value} title={r.hint} data-checked={role === r.value || undefined}><input type="radio" name={`${uid}-role`} value={r.value} checked={role === r.value} onChange={() => setRole(r.value)} /><span>{r.label}</span></label>)}</div></fieldset>
        {isFigma && <label className={styles.check}><input type="checkbox" checked={comments} onChange={e => setComments(e.target.checked)} /> Include open comments</label>}
        <Button variant="primary" onClick={startImport}>Import {selected.length}</Button>
      </> : <>
        <p className={styles.barStatus} aria-hidden="true">{summary.failed || summary.cancelled ? <Glyph name="warning" size={14} /> : <Glyph name="check" size={14} />}<strong>{summary.line}</strong></p>
        <div className={styles.barActions}>
          {progress.items.some(canRetry) && <Button variant="primary" onClick={() => retry(progress.items.filter(canRetry).map(i => i.reference))}>Retry {progress.items.filter(canRetry).length === 1 ? "failed item" : `${progress.items.filter(canRetry).length} items`}</Button>}
          <Button variant="secondary" onClick={() => { progressRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); progressRef.current?.focus({ preventScroll: true }); }}>View results</Button>
        </div>
      </>}
    </div>}
  </div>;
}

function groupRows(rows: ImportRow[]): [string | null, ImportRow[]][] {
  const out: [string | null, ImportRow[]][] = [];
  for (const r of rows) { const g = r.group ?? null, last = out.at(-1); if (last && last[0] === g) last[1].push(r); else out.push([g, [r]]); }
  return out;
}

function ResultRow({ row: r, jira, label, selected, imported, disabled, onToggle, onRowClick }: { row: ImportRow; jira: boolean; label: string; selected: boolean; imported: boolean; disabled: boolean; onToggle: () => void; onRowClick: (e: MouseEvent<HTMLLIElement>) => void }) {
  const id = useId(), j = r.jira;
  const check = <input type="checkbox" className={styles.rowCheck} checked={selected} disabled={disabled} onChange={onToggle} aria-labelledby={`${id}-t`} aria-describedby={imported ? `${id}-i` : undefined} />;
  const importedTag = imported && <span id={`${id}-i`} className={styles.importedTag} title="Importing again saves a new snapshot only if it changed"><Glyph name="check" size={11} />Already a source</span>;
  const open = r.url && <a className={styles.open} href={r.url} target="_blank" rel="noreferrer" aria-label={`Open ${r.name} in ${label} (new tab)`}><Glyph name="external" size={14} /></a>;
  return <li className={styles.row} data-selected={selected || undefined} data-disabled={disabled || undefined} onClick={onRowClick}>
    {check}
    {jira && j ? <>
      <div className={styles.main}>
        <div className={styles.titleLine}><TypeBadge type={j.type} subtask={j.subtask} /><span className={styles.key}>{j.key}</span><span id={`${id}-t`} className={styles.title}>{r.name}</span>{importedTag}</div>
        <div className={styles.context}>{j.project && <span>{j.project.name}</span>}{j.parent && <span className={styles.parent}>Parent <span className={styles.key}>{j.parent.key}</span>{j.parent.summary && <> {j.parent.summary}</>}</span>}</div>
      </div>
      <div className={styles.meta}>
        <div className={styles.cell}><StatusChip status={j.status} category={j.statusCategory} /></div>
        <div className={styles.cell}>{j.assignee ?? <span className={styles.muted}>Unassigned</span>}</div>
        <div className={styles.cell} data-label="Updated">{r.updatedAt ? formatDate(r.updatedAt) : <span className={styles.muted}>Not returned</span>}</div>
        <div className={styles.cell} data-label="Due" data-empty={j.dueDate ? undefined : true}>{j.dueDate ? formatDate(j.dueDate) : <><span className={styles.muted} aria-hidden="true" title="No due date set in Jira">—</span><span className="visually-hidden">No due date set in Jira</span></>}</div>
      </div>
    </> : <>
      <div className={styles.main}>
        <div className={styles.titleLine}><span id={`${id}-t`} className={styles.title}>{r.name}</span>{importedTag}</div>
        {r.detail && <div className={styles.context}><span>{r.detail}</span></div>}
      </div>
      <div className={styles.meta}>
        <div className={styles.cell}><span className={styles.kindBadge}>{r.kind}</span></div>
        <div className={styles.cell} data-label="Updated">{r.updatedAt ? formatDate(r.updatedAt) : <span className={styles.muted}>Not returned</span>}</div>
      </div>
    </>}
    {open}
  </li>;
}
