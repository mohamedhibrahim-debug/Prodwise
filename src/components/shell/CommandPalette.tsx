"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import {
  businessLineText,
  STAGE_LABEL,
} from "@/lib/domain/labels";
import type {
  AssessmentState,
  BusinessLine,
  Stage,
} from "@/lib/domain/types";
import { OPEN_PALETTE_EVENT, openOrganizationSwitcher } from "./events";
import styles from "./CommandPalette.module.css";

interface NavInitiative {
  archivedAt?: string | null;
  slug: string;
  name: string;
  stage: Stage;
  businessLine: BusinessLine;
  overallState: AssessmentState;
}

interface Command {
  id: string;
  label: string;
  /** Matched against, but not necessarily displayed. */
  keywords: string;
  hint?: string;
  group: string;
  href: string;
}

const WORKSPACE_TABS = [
  { segment: "manage", label: "Manage initiative" },
  { segment: "", label: "Brief" },
  { segment: "decisions", label: "Decisions" },
  { segment: "knowledge", label: "Knowledge" },
  { segment: "sources", label: "Sources" },
  { segment: "actions", label: "Commitments" },
  { segment: "evidence", label: "AI evidence workbench" },
] as const;

/**
 * The command palette.
 *
 * Every entry is a link, because every piece of state in this product is
 * already a URL — filters, tabs, anchors. That means the palette needs no state
 * layer of its own and can never drift from what the pages actually show.
 *
 * Data is loaded lazily on first open (see app/api/nav/route.ts) and kept for
 * the session, so it costs nothing on a page render and nothing on reopen.
 */
export function CommandPalette({administration=false,canSwitch=false}:{administration?:boolean;canSwitch?:boolean}) {
  const router = useRouter();
  const pathname = usePathname();
  const listId = useId();

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [initiatives, setInitiatives] = useState<NavInitiative[] | null>(null);
  const [failed, setFailed] = useState(false);
  /** Fetch guard: a ref, so requesting once never triggers a render. */

  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  /** Restored on close, so keyboard users are not dumped at the top of the page. */
  const returnFocus = useRef<HTMLElement | null>(null);

  /* The initiative whose workspace is currently open, if any. Tab commands are
     only meaningful inside one, so they are offered only there. */
  const currentSlug = useMemo(() => {
    const m = pathname.match(/^\/initiatives\/([^/]+)/);
    const slug = m?.[1];
    return slug && slug !== "new" ? slug : null;
  }, [pathname]);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setActive(0);
  }, []);

  // ⌘K / Ctrl+K from anywhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((wasOpen) => {
          if (!wasOpen) returnFocus.current = document.activeElement as HTMLElement;
          return !wasOpen;
        });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /* Escape and Tab live on the window, not on the dialog.
     Bound to the dialog they only fired while focus was inside it — and the
     dialog holds exactly one focusable node, so clicking its own footer
     legend (which advertises "esc close") moved focus to <body> and stopped
     Escape working, while Tab walked into the page behind a scrim that
     claims aria-modal. */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      } else if (e.key === "Tab") {
        e.preventDefault();
        const closeButton = document.querySelector<HTMLButtonElement>('[aria-label="Close search"]');
        if (document.activeElement === inputRef.current && closeButton) closeButton.focus();
        else inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, close]);

  // Opened from the rail's Search affordance, so the shortcut is discoverable
  // rather than folklore.
  useEffect(() => {
    const onRequest = () => {
      returnFocus.current = document.activeElement as HTMLElement;
      setOpen(true);
    };
    window.addEventListener(OPEN_PALETTE_EVENT, onRequest);
    return () => window.removeEventListener(OPEN_PALETTE_EVENT, onRequest);
  }, []);

  // Re-read on every open: the list is small, and a list held for the whole
  // session went stale — new initiatives were missing and, because this shell
  // survives client navigation, a switched organization still showed the
  // previous one's initiatives. The last list stays visible while it loads.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    void (async () => {
      try {
        const res = await fetch("/api/nav");
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as { initiatives: NavInitiative[] };
        if (!cancelled) {
          setFailed(false);
          setInitiatives(data.initiatives);
        }
      } catch {
        // Say so, and allow a retry. Swallowing this into an empty list made
        // the palette answer "Nothing matches" for the rest of the session —
        // a confident claim produced by an error, in a product whose whole
        // thesis is that it never asserts what it does not know.
        if (!cancelled) {
          setFailed(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open]);

  // Focus follows open state here rather than inside close(), so no callback
  // created during render reads a ref.
  useEffect(() => {
    if (!open) returnFocus.current?.focus?.();
  }, [open]);

  useEffect(() => {
    if (open) { dialogRef.current?.showModal(); inputRef.current?.focus(); }
  }, [open]);

  const commands = useMemo<Command[]>(() => {
    const out: Command[] = [];

    for (const i of initiatives ?? []) {
      out.push({
        id: `init-${i.slug}`,
        label: i.name,
        keywords: `${i.name} ${STAGE_LABEL[i.stage]} ${businessLineText(i.businessLine)}`,
        hint: `${i.archivedAt?"Archived · ":""}${STAGE_LABEL[i.stage]} · ${businessLineText(i.businessLine)}`,
        group: "Initiatives",
        href: `/initiatives/${i.slug}`,
      });
    }

    if (currentSlug) {
      for (const t of WORKSPACE_TABS) {
        out.push({
          id: `tab-${t.segment || "overview"}`,
          label: t.label,
          keywords: `${t.label} tab section area`,
          group: "This initiative",
          href: t.segment
            ? `/initiatives/${currentSlug}/${t.segment}`
            : `/initiatives/${currentSlug}`,
        });
      }
      for (const lane of [
        { id: "needs-decision", label: "Needs a decision" },
        { id: "reviewed", label: "Reviewed" },
        { id: "resolved", label: "Resolved" },
        { id: "history", label: "History" },
        { id: "not-checked", label: "Not checked yet" },
      ] as const) {
        out.push({
          id: `lane-${lane.id}`,
          label: `Decisions — ${lane.label}`,
          keywords: `decisions review findings ${lane.label} lane`,
          group: "This initiative",
          href: `/initiatives/${currentSlug}/decisions#lane-${lane.id}`,
        });
      }
    }

    out.push(
      {
        id: "go-home",
        label: "Home",
        keywords: "home attention portfolio",
        group: "Go to",
        href: "/",
      },
      {
        id: "go-initiatives",
        label: "All initiatives",
        keywords: "initiatives home list",
        group: "Go to",
        href: "/initiatives",
      },
      {
        id: "go-roadmap",
        label: "Roadmap",
        keywords: "roadmap delivery timing portfolio",
        group: "Go to",
        href: "/roadmap",
      },
      {
        id: "go-analysis", label: "Analysis", keywords: "outcomes results metrics",
        group: "Go to", href: "/analysis/portfolio",
      },
      {
        id: "go-weekly", label: "Weekly Review", keywords: "weekly meeting review",
        group: "Go to", href: "/weekly-review",
      },
      {
        id: "go-notifications", label: "Notifications", keywords: "notifications attention inbox overdue changed",
        group: "Go to", href: "/notifications",
      },
      {
        id: "go-connections", label: "Connected sources", keywords: "jira gmail google drive docs figma connect sources import",
        group: "Utilities", href: "/account/connections",
      },
    );

    if(administration)out.push({id:'administration',label:'Administration',keywords:'users organization access policy',group:'Utilities',href:'/administration'});
    if(canSwitch)out.push({id:'switch-organization',label:'Switch organization…',keywords:'organization scope workspace',group:'Utilities',href:'#switch-organization'});
    return out;
  }, [initiatives, currentSlug, administration, canSwitch]);

  /* Plain case-insensitive substring matching. Nothing semantic, nothing fuzzy:
     a navigation aid that guesses is worse than one that does not. Order is
     fixed and explainable: name starts with the query, then a word in the name
     does, then the name contains it, then only a keyword does; ties keep list order. */
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    const tier = (c: Command) => { const label = c.label.toLowerCase(); return label.startsWith(q) ? 0 : label.split(/[\s\-·/]+/).some((w) => w.startsWith(q)) ? 1 : label.includes(q) ? 2 : 3; };
    return commands
      .filter((c) => `${c.label} ${c.keywords}`.toLowerCase().includes(q))
      .map((c, i) => ({ c, i, t: tier(c) }))
      .sort((a, b) => a.t - b.t || a.i - b.i)
      .map((x) => x.c);
  }, [commands, query]);

  const run = useCallback(
    (cmd: Command | undefined) => {
      if (!cmd) return;
      close();
      if(cmd.href==='#switch-organization'){
        requestAnimationFrame(openOrganizationSwitcher);return;
      }
      router.push(cmd.href);
    },
    [close, router],
  );

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (results.length ? (i + 1) % results.length : 0));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (results.length ? (i - 1 + results.length) % results.length : 0));
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      run(results[active]);
      return;
    }
    // Focus trap: the dialog holds exactly one tabbable control, so Tab stays.
    if (e.key === "Tab") e.preventDefault();
  };

  useEffect(() => {
    if (!open) return;
    document.getElementById(`${listId}-opt-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [active, open, listId]);

  /* Initiatives are still arriving, but the static destinations are already
     real — so the list stays rendered and only says what is still pending.
     Replacing it with a lone "Loading…" row left a keyboard cursor moving
     through invisible commands. */
  const pending = initiatives === null && !failed;

  if (!open) return null;

  let lastGroup = "";

  return (
    <dialog ref={dialogRef} className={styles.layer} aria-label="Command palette" onCancel={close}>
      {/* Not a button: a backdrop is not an action, and announcing one to a
          screen reader adds a control that does nothing Escape does not. */}
      <div className={styles.scrim} onClick={close} aria-hidden="true" />

      <div
        className={styles.dialog}
        onKeyDown={onKeyDown}
      >
        <input
          ref={inputRef}
          className={styles.input}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          placeholder="Jump to an initiative, a tab, or a view…"
          aria-label="Search commands"
          role="combobox"
          aria-expanded="true"
          aria-controls={listId}
          aria-activedescendant={
            results.length ? `${listId}-opt-${active}` : undefined
          }
          autoComplete="off"
          spellCheck={false}
        />

        {/* role="presentation" on the wrappers: an option must be owned by the
            listbox, and a listitem in between left the accessibility tree with a
            listbox holding zero options — silent arrow-key selection. */}
        <ul className={styles.list} id={listId} role="listbox" aria-label="Commands">
          {failed ? (
            <li className={styles.status} role="presentation">
              Could not load initiatives. Close and reopen to try again.
            </li>
          ) : results.length === 0 ? (
            <li className={styles.status} role="presentation">
              Nothing matches “{query}”.
            </li>
          ) : (
            results.map((cmd, i) => {
              const header = cmd.group !== lastGroup ? cmd.group : null;
              lastGroup = cmd.group;
              return (
                <li key={cmd.id} role="presentation">
                  {header ? (
                    <div className={styles.group} role="presentation">
                      {header}
                    </div>
                  ) : null}
                  <div
                    id={`${listId}-opt-${i}`}
                    role="option"
                    aria-selected={i === active}
                    className={`${styles.item} ${i === active ? styles.itemActive : ""}`}
                    onMouseMove={() => setActive(i)}
                    onClick={() => run(cmd)}
                  >
                    <span className={styles.itemLabel}>{cmd.label}</span>
                    {cmd.hint ? (
                      <span className={styles.itemHint}>{cmd.hint}</span>
                    ) : null}
                  </div>
                </li>
              );
            })
          )}
          {pending ? (
            <li className={styles.status} role="presentation">
              Loading initiatives…
            </li>
          ) : null}
        </ul>

        <div className={styles.footer}>
          <button type="button" className="pw-btn" data-variant="ghost" data-size="sm" onClick={close} aria-label="Close search">Close</button>
          <span>
            <kbd className={styles.kbd}>↑</kbd>
            <kbd className={styles.kbd}>↓</kbd> navigate
          </span>
          <span>
            <kbd className={styles.kbd}>↵</kbd> open
          </span>
          <span>
            <kbd className={styles.kbd}>esc</kbd> close
          </span>
        </div>
      </div>
    </dialog>
  );
}
