import { answerLanguage, directionOf, langTag, segments, type Direction, type Segment } from './language.ts';
import { starters, type Starter } from './starters.ts';
import type { AnswerLanguage, AskFailureCode, AskResult, AssistantAnswer, AssistantScreen, HistoryTurn, InitiativeTab, LanguagePreference } from './types.ts';
import { HISTORY_LIMIT, HISTORY_TURN_LIMIT, INITIATIVE_TABS } from './types.ts';
import type { Recommendation } from './recommend.ts';
import { displayDate } from '../delivery/display.ts';

/**
 * The Ask Prodwise panel's pure model (no React, no DOM, no fetch), so the
 * panel's rendering decisions can be unit-tested like the rest of the engine:
 * which screen a path is, which starters apply, how a thread turn becomes a
 * view with per-paragraph direction and isolated technical tokens, what each
 * failure code shows, and the remembered open state.
 */

/* ── Screen ─────────────────────────────────────────────────────────────── */
export interface ScreenInfo { screen: AssistantScreen; tab: InitiativeTab | null; initiativeSlug: string | null; name: string }
export const SCREEN_NAME: Record<AssistantScreen, string> = { home: 'Home', initiatives: 'Initiatives', initiative: 'Initiative', roadmap: 'Roadmap', analysis: 'Analysis', 'weekly-review': 'Weekly Review', administration: 'Administration', notifications: 'Notifications', account: 'My account', other: 'Prodwise' };

/** Initiative tab names as the workspace tabs print them. */
export const TAB_LABEL: Record<InitiativeTab, string> = { brief: 'Brief', knowledge: 'Knowledge', sources: 'Sources', decisions: 'Decisions', delivery: 'Delivery facts', actions: 'Commitments', context: 'Risks & questions', history: 'History', manage: 'Manage initiative', setup: 'Setup', evidence: 'Evidence', memory: 'Product Memory' };

/** The panel header's context line: the screen name, or on an initiative its name, stage and (past the Brief) the tab. */
export function contextLine(screen: ScreenInfo, initiative: { name: string; stage: string | null } | null): string {
  if (screen.screen !== 'initiative') return screen.name;
  if (!initiative) return 'Initiative';
  return [initiative.name, initiative.stage, screen.tab && screen.tab !== 'brief' ? TAB_LABEL[screen.tab] : null].filter(Boolean).join(' · ');
}

/** Which screen a pathname is, in the route's vocabulary. Query strings and hashes are ignored. */
export function screenFromPath(pathname: string): ScreenInfo {
  const path = pathname.split(/[?#]/)[0] ?? '/';
  const info = (screen: AssistantScreen, extra: Partial<ScreenInfo> = {}): ScreenInfo => ({ screen, tab: null, initiativeSlug: null, name: SCREEN_NAME[screen], ...extra });
  if (path === '/') return info('home');
  const initiative = /^\/initiatives\/([^/]+)(?:\/([^/]+))?/.exec(path);
  if (initiative && initiative[1] !== 'new') {
    const segment = initiative[2] ?? 'brief';
    const tab = (INITIATIVE_TABS as readonly string[]).includes(segment) ? segment as InitiativeTab : 'brief';
    return info('initiative', { tab, initiativeSlug: initiative[1]! });
  }
  if (path.startsWith('/initiatives')) return info('initiatives');
  if (path.startsWith('/roadmap')) return info('roadmap');
  if (path.startsWith('/analysis')) return info('analysis');
  if (path.startsWith('/weekly-review')) return info('weekly-review');
  if (path.startsWith('/administration') || path.startsWith('/users') || path.startsWith('/platform')) return info('administration');
  if (path.startsWith('/notifications')) return info('notifications');
  if (path.startsWith('/account')) return info('account');
  return info('other');
}

/** The starters the panel offers for a screen, in the language the preference implies (Auto reads as English until the person writes). */
/**
 * Starters for the screen. When the model is known to be unavailable, only
 * questions answered from the recorded state are offered, topped up with the
 * universal ones, so the first suggestion never fails (Devil R2-M3).
 */
export function startersFor(screen: ScreenInfo, preference: LanguagePreference, configured: boolean | null = null): Starter[] {
  const language = preference === 'ar' ? 'ar' : 'en';
  const all = starters(screen.screen, { tab: screen.tab, language });
  if (configured !== false) return all;
  const own = all.filter(s => s.deterministic);
  const universal = starters('home', { language }).filter(s => s.deterministic && !own.some(o => o.key === s.key));
  return [...own, ...universal].slice(0, 4);
}

/* ── Remembered open state ──────────────────────────────────────────────── */
export const OPEN_STORAGE_KEY = 'prodwise.ask.open';
type Readable = { getItem(key: string): string | null };
type Writable = { setItem(key: string, value: string): void };
export function readOpenState(storage: Readable | null | undefined): boolean {
  try { return storage?.getItem(OPEN_STORAGE_KEY) === 'true'; } catch { return false; }
}
export function writeOpenState(storage: Writable | null | undefined, open: boolean): boolean {
  try { storage?.setItem(OPEN_STORAGE_KEY, String(open)); return true; } catch { return false; }
}
/** Collapsed always starts collapsed; Remember starts where the browser last left it. Nothing else is remembered. */
export function initialOpen(openBehaviour: 'remember' | 'collapsed', storage: Readable | null | undefined): boolean {
  return openBehaviour === 'remember' && readOpenState(storage);
}

/* ── Thread ─────────────────────────────────────────────────────────────── */
export type Turn =
  | { id: string; role: 'user'; text: string; sentInitiativeSlug: string | null }
  | { id: string; role: 'answer'; answer: AssistantAnswer; sentInitiativeSlug: string | null }
  | { id: string; role: 'pending'; question: string }
  | { id: string; role: 'failure'; question: string; code: AskFailureCode | 'SESSION_ENDED'; language: AnswerLanguage; message: string; retryAfterSeconds?: number };

/** Turns the route may see as history, oldest first: the person's questions and the answers as plain text. */
export function historyFor(turns: readonly Turn[]): HistoryTurn[] {
  const out: HistoryTurn[] = [];
  for (const t of turns) {
    if (t.role === 'user') out.push({ role: 'user', text: t.text.slice(0, HISTORY_TURN_LIMIT) });
    else if (t.role === 'answer') out.push({ role: 'assistant', text: plainText(t.answer).slice(0, HISTORY_TURN_LIMIT) });
  }
  return out.slice(-HISTORY_LIMIT);
}

/** An answer as one plain string, for history only: block titles and item texts, never hrefs. */
export function plainText(answer: AssistantAnswer): string {
  return answer.blocks.map(b => {
    if (b.kind === 'text') return b.text;
    const title = b.title ? `${b.title}: ` : '';
    if (b.kind === 'recommendations') return title + b.items.map(r => `${r.action} ${r.why}`).join(' ');
    return title + b.items.map(i => i.text).join('; ');
  }).join('\n').trim();
}

/* ── View model ─────────────────────────────────────────────────────────── */
export interface Run extends Segment { key: number }
export interface Paragraph { dir: Direction; runs: Run[] }
export interface ItemView { dir: Direction; runs: Run[]; href?: string }
export type BlockView =
  | { kind: 'text'; paragraphs: Paragraph[] }
  | { kind: 'facts' | 'missing' | 'pending'; title: string; titleDir: Direction; items: ItemView[] }
  | { kind: 'recommendations'; title: string; titleDir: Direction; items: (Recommendation & { actionView: Paragraph; whyView: Paragraph })[] };
export interface AnswerView {
  lang: 'en' | 'ar';
  blocks: BlockView[];
  links: { label: string; href: string; dir: Direction }[];
  basedOn: string;
  /** How the words were produced; shown so a computed list is never mistaken for a written one. */
  provenance: string;
  synthetic: boolean;
  /** Decision D11: the panel named an initiative the answer could not use. */
  scopeNote: string | null;
}
export interface UserView { lang: 'en' | 'ar'; dir: Direction; runs: Run[] }

const DEFAULT_TITLE: Record<'facts' | 'missing' | 'pending' | 'recommendations', Record<AnswerLanguage, string>> = {
  facts: { en: 'Recorded', ar: 'المسجل' },
  missing: { en: 'Not recorded', ar: 'غير مسجل' },
  pending: { en: 'Pending confirmation', ar: 'في انتظار التأكيد' },
  recommendations: { en: 'Recommended next action', ar: 'الإجراء التالي الموصى به' },
};
export const SCOPE_NOTE = 'This initiative isn’t available to you in this organization; the answer covers your portfolio.';

const withKeys = (list: Segment[]): Run[] => list.map((s, key) => ({ ...s, key }));
function paragraph(text: string, terms: readonly string[], fallback: Direction): Paragraph {
  const dir = directionOf(text, fallback);
  return { dir, runs: withKeys(segments(text, { terms, base: dir })) };
}
/** Prose splits on blank lines; a single newline stays inside a paragraph as a soft break the renderer keeps. */
export const paragraphs = (text: string) => text.split(/\n{2,}/).map(t => t.trim()).filter(Boolean);

/** The as-of date exactly as the pages print dates; anything unreadable is shown as written. */
export function displayAsOf(iso: string): string {
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(iso);
  return m ? displayDate(m[1]) : iso;
}

export function answerView(answer: AssistantAnswer, options: { terms?: readonly string[]; sentInitiativeSlug?: string | null } = {}): AnswerView {
  const terms = [...new Set([...(options.terms ?? []), ...(answer.basedOn.initiative ? [answer.basedOn.initiative.name] : [])])].filter(t => t.trim().length >= 2);
  const fallback: Direction = answer.language === 'ar' ? 'rtl' : 'ltr';
  const blocks: BlockView[] = answer.blocks.map(b => {
    if (b.kind === 'text') return { kind: 'text', paragraphs: paragraphs(b.text).map(p => paragraph(p, terms, fallback)) };
    const title = b.title?.trim() || DEFAULT_TITLE[b.kind][answer.language];
    const titleDir = directionOf(title, fallback);
    if (b.kind === 'recommendations') return { kind: 'recommendations', title, titleDir, items: b.items.map(r => ({ ...r, actionView: paragraph(r.action, terms, 'ltr'), whyView: paragraph(r.why, terms, 'ltr') })) };
    return { kind: b.kind, title, titleDir, items: b.items.map(i => ({ ...paragraph(i.text, terms, fallback), ...(i.href ? { href: i.href } : {}) })) };
  });
  const where = answer.basedOn.initiative ? `${answer.basedOn.initiative.name} · ${SCREEN_NAME[answer.basedOn.screen]}` : SCREEN_NAME[answer.basedOn.screen];
  return {
    lang: langTag(answer.language),
    blocks,
    links: answer.links.map(l => ({ ...l, dir: directionOf(l.label, 'ltr') })),
    basedOn: `Based on ${where} · as of ${displayAsOf(answer.basedOn.asOf)}`,
    provenance: answer.source === 'deterministic' ? 'Computed from recorded state' : 'Written from recorded state · advisory',
    synthetic: answer.synthetic,
    scopeNote: options.sentInitiativeSlug && !answer.basedOn.initiative ? SCOPE_NOTE : null,
  };
}

export function userView(text: string, terms: readonly string[] = []): UserView {
  const dir = directionOf(text, 'ltr');
  return { lang: langTag(answerLanguage(text, 'auto')), dir, runs: withKeys(segments(text, { terms, base: dir })) };
}

/* ── Failures ───────────────────────────────────────────────────────────── */
export interface FailureView { message: string; retry: boolean; retryAfterSeconds: number | null; showStarters: boolean; signIn: boolean; lang: 'en' | 'ar'; dir: Direction }
export function failureView(turn: Extract<Turn, { role: 'failure' }>): FailureView {
  const code = turn.code;
  return {
    message: turn.message,
    // Retrying cannot help when the model is not configured here; the starters that read the record can (Devil R2-M3).
    retry: code !== 'OUT_OF_SCOPE' && code !== 'INVALID_REQUEST' && code !== 'SESSION_ENDED' && code !== 'NOT_CONFIGURED',
    retryAfterSeconds: code === 'RATE_LIMITED' ? Math.max(1, turn.retryAfterSeconds ?? 60) : null,
    showStarters: code === 'OUT_OF_SCOPE' || code === 'NOT_CONFIGURED',
    signIn: code === 'SESSION_ENDED',
    lang: langTag(turn.language),
    dir: directionOf(turn.message, turn.language === 'ar' ? 'rtl' : 'ltr'),
  };
}

/** The panel's reading of an HTTP response body and status. Unknown shapes read as a provider failure, never as an answer. */
export function resultFromResponse(status: number, body: unknown, question: string, id: string, sentInitiativeSlug: string | null): Turn {
  const b = body && typeof body === 'object' ? body as Record<string, unknown> : null;
  if (status === 401 || status === 403) return { id, role: 'failure', question, code: 'SESSION_ENDED', language: 'en', message: 'Your session has ended or this request was refused. Sign in again to keep asking.' };
  if (b && b.ok === true && b.answer && typeof b.answer === 'object') return { id, role: 'answer', answer: b.answer as AssistantAnswer, sentInitiativeSlug };
  const r = b as (Extract<AskResult, { ok: false }> | null);
  const code = r && typeof r.code === 'string' && ['NOT_CONFIGURED', 'TIMED_OUT', 'PROVIDER_FAILED', 'INVALID_RESPONSE', 'RATE_LIMITED', 'OUT_OF_SCOPE', 'INVALID_REQUEST'].includes(r.code) ? r.code : 'PROVIDER_FAILED';
  const language: AnswerLanguage = r?.language === 'ar' ? 'ar' : 'en';
  const message = r && typeof r.message === 'string' && r.message.trim() ? r.message : 'Ask Prodwise could not answer right now. Nothing was changed; try again shortly.';
  return { id, role: 'failure', question, code, language, message, ...(typeof r?.retryAfterSeconds === 'number' ? { retryAfterSeconds: r.retryAfterSeconds } : {}) };
}

/** Decision D13: the quiet dot on the collapsed control. Only a preference plus a recorded recommendation can light it. */
export const showsDot = (proactive: boolean, recommendations: number | null) => proactive && (recommendations ?? 0) > 0;
