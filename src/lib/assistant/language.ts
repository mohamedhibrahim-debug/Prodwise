import type { AnswerLanguage, LanguagePreference } from './types.ts';

/**
 * Language handling for Ask Prodwise. Pure: no provider, no locale data.
 *
 * Prodwise has no i18n layer, so this is deliberately narrow: tell Arabic from
 * English (and the everyday mix of both), pick the answer language, and split
 * an answer into directional runs so mixed-script text renders correctly with
 * technical tokens (Jira keys, dates, ids, URLs, product terms) kept isolated.
 */
export type QuestionLanguage = 'EN' | 'AR' | 'MIXED';
export type Direction = 'rtl' | 'ltr';
export type TokenKind = 'url' | 'path' | 'id' | 'key' | 'week' | 'date' | 'number' | 'term';
export interface Segment { text: string; dir: Direction; kind: 'text' | 'token'; token?: TokenKind }

// Letters only: Arabic punctuation such as ؟ and ، is Script=Common and stays neutral.
const ARABIC = /\p{Script=Arabic}/u;
const LATIN = /\p{Script=Latin}/u;

/** Product field names that stay in English inside Arabic answers, so they are isolated as terms. */
export const PRODUCT_TERMS = ['Next Best Action', 'Target Live', 'Actual Live', 'Next Milestone', 'Next Step', 'Weekly Review', 'Product Truth', 'Business Line', 'Ask Prodwise', 'Prodwise'] as const;

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const TOKEN_PATTERNS: { kind: TokenKind; re: RegExp }[] = [
  { kind: 'url', re: /https?:\/\/[^\s<>"']+/g },
  { kind: 'id', re: /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi },
  { kind: 'path', re: /(?<![\w/])\/[a-z][a-z0-9-]*(?:\/[A-Za-z0-9._~%-]+)*(?:\?[^\s]*)?(?:#[^\s]*)?/g },
  { kind: 'key', re: /\b[A-Z][A-Z0-9]{1,9}-\d{1,6}\b/g },
  { kind: 'week', re: /\b\d{4}-W\d{2}\b/g },
  { kind: 'date', re: /\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2} (?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{4}\b/g },
  { kind: 'number', re: /(?<![\w.,])[+\-−]?\d+(?:[.,]\d+)*%?(?![\w.,])/g },
];

interface Match { start: number; end: number; kind: TokenKind }
/** Non-overlapping technical tokens, earliest first; on a tie the longer match wins. */
function tokens(text: string, terms: readonly string[] | null): Match[] {
  const found: Match[] = [];
  const patterns = [...TOKEN_PATTERNS];
  // Terms are matched as written in the product ("Target Live"), never case-folded: "target live" in a sentence is prose.
  const list = terms ? [...new Set([...terms, ...PRODUCT_TERMS].map(t => t.trim()).filter(t => t.length >= 2))].sort((a, b) => b.length - a.length) : [];
  if (list.length) patterns.push({ kind: 'term', re: new RegExp(`(?<![\\p{L}\\p{N}])(?:${list.map(escape).join('|')})(?![\\p{L}\\p{N}])`, 'gu') });
  for (const { kind, re } of patterns) for (const m of text.matchAll(re)) if (m[0]) found.push({ start: m.index, end: m.index + m[0].length, kind });
  found.sort((a, b) => a.start - b.start || b.end - a.end);
  const out: Match[] = [];
  for (const m of found) if (!out.length || m.start >= out[out.length - 1]!.end) out.push(m);
  return out;
}

/** Text with technical tokens (not product terms) blanked, so script counts describe the person's own words. */
function withoutTokens(text: string): string {
  let out = '', at = 0;
  for (const m of tokens(text, null)) { out += text.slice(at, m.start) + ' '; at = m.end; }
  return out + text.slice(at);
}

/**
 * Words per script, ignoring technical tokens. The opening word carries the
 * sentence frame (an interrogative or particle such as إيه, فين, الـ), so an
 * Arabic opener counts one extra: "إيه الـ next best action؟" is an Arabic
 * question about an English term, while "عربي is the word for Arabic" is not.
 */
function scriptWords(text: string): { arabic: number; latin: number } {
  let arabic = 0, latin = 0, first: Direction | null = null;
  for (const word of withoutTokens(text).split(/\s+/)) {
    if (!word) continue;
    const dir: Direction | null = ARABIC.test(word) ? 'rtl' : LATIN.test(word) ? 'ltr' : null;
    if (dir === 'rtl') arabic++; else if (dir === 'ltr') latin++;
    if (dir && !first) first = dir;
  }
  return { arabic: arabic + (first === 'rtl' ? 1 : 0), latin };
}

/** Which scripts the person wrote in, ignoring Jira keys, ids, dates and URLs. */
export function detectLanguage(question: string): QuestionLanguage {
  const { arabic, latin } = scriptWords(question);
  if (arabic && latin) return 'MIXED';
  return arabic ? 'AR' : 'EN';
}

/**
 * Auto picks the language of the sentence frame: a mixed question is answered
 * in Arabic when its Arabic words (plus the opener bonus) are at least as many
 * as its plain-English ones, because that is the language the person is
 * thinking in; technical terms stay in English either way. A tie goes to
 * Arabic: an Arabic frame around English product terms is the everyday style.
 */
export function answerLanguage(question: string, preference: LanguagePreference = 'auto'): AnswerLanguage {
  if (preference === 'en' || preference === 'ar') return preference;
  const { arabic, latin } = scriptWords(question);
  if (!arabic) return 'en';
  if (!latin) return 'ar';
  return arabic >= latin ? 'ar' : 'en';
}

/**
 * Paragraph direction from the script most words are written in — not the
 * first strong character, which would make "Explainلي الـ Target Live." an
 * English paragraph. A tie goes to Arabic (an Arabic frame around English
 * terms); text with no letters at all follows `fallback`.
 */
export function directionOf(text: string, fallback: Direction = 'ltr'): Direction {
  const { arabic, latin } = scriptWords(text);
  if (!arabic && !latin) return fallback;
  return arabic >= latin ? 'rtl' : 'ltr';
}

/** BCP 47 tag for the `lang` attribute of an answer. */
export const langTag = (language: AnswerLanguage) => language === 'ar' ? 'ar' : 'en';

/**
 * Split text into runs the UI can wrap with `dir` (and `unicode-bidi: isolate`
 * for tokens). Adjacent words of one script share a run. Neutral characters
 * (spaces, punctuation, digits) stay with a run in the paragraph direction and
 * are held back from a run in the other direction, so a question mark after an
 * English word in an Arabic sentence still ends the sentence on the left.
 * Technical tokens are always their own left-to-right run, so a Jira key or a
 * date inside an Arabic sentence never gets its characters reordered.
 */
export function segments(text: string, options: { terms?: readonly string[]; base?: Direction } = {}): Segment[] {
  const base = options.base ?? directionOf(text);
  const out: Segment[] = [];
  const pushText = (chunk: string) => {
    if (!chunk) return;
    let pending = '', current: { text: string; dir: Direction } | null = null;
    const flush = () => { if (current) { out.push({ ...current, kind: 'text' }); current = null; } };
    for (const part of chunk.split(/(\s+|[\p{P}\p{S}]+)/u)) {
      if (!part) continue;
      const dir: Direction | null = ARABIC.test(part) ? 'rtl' : LATIN.test(part) ? 'ltr' : null;
      if (dir === null) { if (current && current.dir === base) current.text += part; else pending += part; continue; }
      if (current && current.dir !== dir) flush();
      if (current) current.text += pending + part; else current = { text: pending + part, dir };
      pending = '';
    }
    flush();
    if (pending) out.push({ text: pending, dir: base, kind: 'text' });
  };
  let at = 0;
  for (const m of tokens(text, options.terms ?? [])) {
    pushText(text.slice(at, m.start));
    out.push({ text: text.slice(m.start, m.end), dir: 'ltr', kind: 'token', token: m.kind });
    at = m.end;
  }
  pushText(text.slice(at));
  return out;
}
