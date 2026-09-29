import test from 'node:test';
import assert from 'node:assert/strict';
import { answerView, contextLine, displayAsOf, failureView, historyFor, initialOpen, OPEN_STORAGE_KEY, plainText, readOpenState, resultFromResponse, SCOPE_NOTE, screenFromPath, showsDot, startersFor, userView, writeOpenState, type Turn } from './panel-model.ts';
import type { AssistantAnswer } from './types.ts';
import { FAILURE_MESSAGE } from './types.ts';
import { displayDate } from '../delivery/display.ts';
const asOf = displayDate('2026-09-26');

const answer = (over: Partial<AssistantAnswer> = {}): AssistantAnswer => ({
  language: 'en', source: 'deterministic', synthetic: true, links: [{ label: 'Setup', href: '/initiatives/mff/setup' }],
  basedOn: { screen: 'initiative', initiative: { name: 'Merchant Flex Finance', slug: 'mff', href: '/initiatives/mff' }, asOf: '2026-09-26T10:00:00.000Z' },
  blocks: [
    { kind: 'text', text: 'Based on the recorded state.\n\nSecond paragraph with MFF-12 and 2026-10-01.' },
    { kind: 'facts', items: [{ text: 'Target Live: 30 Oct 2026', href: '/initiatives/mff/delivery' }] },
    { kind: 'missing', items: [{ text: 'Actual Live: Not recorded' }] },
    { kind: 'pending', title: 'Waiting on you', items: [{ text: '2 pending proposals', href: '/initiatives/mff/sources' }] },
    { kind: 'recommendations', items: [{ key: 'decision:1', kind: 'decision', action: 'Decide the recorded difference on Merchant Flex Finance.', why: 'Two recorded values disagree.', href: '/initiatives/mff/decisions', go: 'Review decision', initiative: { name: 'Merchant Flex Finance', slug: 'mff' } }] },
  ],
  ...over,
});

test('screenFromPath maps every route family, with initiative tabs and slugs', () => {
  assert.deepEqual(screenFromPath('/'), { screen: 'home', tab: null, initiativeSlug: null, name: 'Home' });
  assert.equal(screenFromPath('/initiatives?attention=any').screen, 'initiatives');
  assert.equal(screenFromPath('/initiatives/new').screen, 'initiatives');
  assert.deepEqual(screenFromPath('/initiatives/merchant-flex-finance'), { screen: 'initiative', tab: 'brief', initiativeSlug: 'merchant-flex-finance', name: 'Initiative' });
  assert.equal(screenFromPath('/initiatives/merchant-flex-finance/knowledge#entry-1').tab, 'knowledge');
  assert.equal(screenFromPath('/initiatives/merchant-flex-finance/unknown-tab').tab, 'brief');
  for (const [path, screen] of [['/roadmap', 'roadmap'], ['/analysis/projects/x', 'analysis'], ['/weekly-review?week=2026-W39', 'weekly-review'], ['/administration/members', 'administration'], ['/users', 'administration'], ['/platform', 'administration'], ['/notifications', 'notifications'], ['/account/connections', 'account'], ['/sources', 'other']] as const) assert.equal(screenFromPath(path).screen, screen, path);
});

test('the context line names the screen, or the initiative with its stage and tab', () => {
  assert.equal(contextLine(screenFromPath('/'), null), 'Home');
  assert.equal(contextLine(screenFromPath('/initiatives/mff'), { name: 'Merchant Flex Finance', stage: 'Delivery' }), 'Merchant Flex Finance · Delivery');
  assert.equal(contextLine(screenFromPath('/initiatives/mff/decisions'), { name: 'Merchant Flex Finance', stage: 'Delivery' }), 'Merchant Flex Finance · Delivery · Decisions');
  assert.equal(contextLine(screenFromPath('/initiatives/mff/delivery'), { name: 'Merchant Flex Finance', stage: null }), 'Merchant Flex Finance · Delivery facts');
  assert.equal(contextLine(screenFromPath('/initiatives/mff'), null), 'Initiative', 'before the header publishes its title');
});

test('starters follow the screen, the tab and the preferred language', () => {
  const home = startersFor(screenFromPath('/'), 'auto');
  assert.ok(home.length >= 1 && home.length <= 4 && home.some(s => s.key === 'next'));
  assert.ok(startersFor(screenFromPath('/initiatives/mff/knowledge'), 'en').some(s => s.key === 'risk-vs-decision'));
  const arabic = startersFor(screenFromPath('/roadmap'), 'ar');
  assert.ok(arabic.every(s => /\p{Script=Arabic}/u.test(s.label)));
  assert.deepEqual(startersFor(screenFromPath('/'), 'auto'), startersFor(screenFromPath('/'), 'en'), 'Auto reads as English before the person writes');
});

test('remembered open state is per browser, guarded, and only honoured under Remember', () => {
  const store = new Map<string, string>();
  const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v); } };
  assert.equal(readOpenState(storage), false);
  assert.equal(writeOpenState(storage, true), true);
  assert.equal(store.get(OPEN_STORAGE_KEY), 'true');
  assert.equal(initialOpen('remember', storage), true);
  assert.equal(initialOpen('collapsed', storage), false, 'Always start collapsed ignores the remembered value');
  const throwing = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
  assert.equal(readOpenState(throwing), false);
  assert.equal(writeOpenState(throwing, true), false);
  assert.equal(initialOpen('remember', null), false);
});

test('an answer becomes a view with every block kind, default titles, tokens and the Based on line', () => {
  const view = answerView(answer(), { terms: ['Demo Organization'] });
  assert.equal(view.lang, 'en');
  assert.equal(view.blocks.length, 5);
  const text = view.blocks[0]!; assert.equal(text.kind, 'text'); if (text.kind !== 'text') return;
  assert.equal(text.paragraphs.length, 2, 'blank lines split paragraphs');
  const tokens = text.paragraphs[1]!.runs.filter(r => r.kind === 'token').map(r => [r.token, r.text]);
  assert.deepEqual(tokens, [['key', 'MFF-12'], ['date', '2026-10-01']]);
  const [facts, missing, pending, recs] = view.blocks.slice(1);
  assert.equal(facts!.kind, 'facts'); if (facts!.kind === 'facts') { assert.equal(facts!.title, 'Recorded'); assert.equal(facts!.items[0]!.href, '/initiatives/mff/delivery'); }
  if (missing!.kind === 'missing') { assert.equal(missing!.title, 'Not recorded'); assert.equal(missing!.items[0]!.href, undefined); }
  if (pending!.kind === 'pending') assert.equal(pending!.title, 'Waiting on you', 'a given title wins over the default');
  assert.equal(recs!.kind, 'recommendations'); if (recs!.kind === 'recommendations') { assert.equal(recs!.title, 'Recommended next action'); assert.equal(recs!.items[0]!.go, 'Review decision'); assert.ok(recs!.items[0]!.actionView.runs.some(r => r.kind === 'token' && r.token === 'term' && r.text === 'Merchant Flex Finance'), 'the initiative name from the context header is isolated as a term'); }
  assert.equal(view.basedOn, `Based on Merchant Flex Finance · Initiative · as of ${asOf}`);
  assert.equal(view.provenance, 'Computed from recorded state');
  assert.equal(view.synthetic, true);
  assert.equal(view.scopeNote, null);
  assert.deepEqual(view.links, [{ label: 'Setup', href: '/initiatives/mff/setup', dir: 'ltr' }]);
});

test('Arabic answers default their block titles in Arabic and read right to left; a portfolio answer names the screen', () => {
  const view = answerView(answer({ language: 'ar', source: 'model', basedOn: { screen: 'home', initiative: null, asOf: '2026-09-26' }, blocks: [{ kind: 'text', text: 'الحالة المسجلة كالتالي.' }, { kind: 'missing', items: [{ text: 'الـ Actual Live غير مسجل' }] }] }));
  assert.equal(view.lang, 'ar');
  const [text, missing] = view.blocks;
  if (text!.kind === 'text') assert.equal(text!.paragraphs[0]!.dir, 'rtl');
  if (missing!.kind === 'missing') { assert.equal(missing!.title, 'غير مسجل'); assert.equal(missing!.titleDir, 'rtl'); assert.equal(missing!.items[0]!.dir, 'rtl'); assert.ok(missing!.items[0]!.runs.some(r => r.kind === 'token' && r.text === 'Actual Live' && r.dir === 'ltr')); }
  assert.equal(view.basedOn, `Based on Home · as of ${asOf}`);
  assert.equal(view.provenance, 'Written from recorded state · advisory');
});

test('decision D11: a sent slug the answer could not use shows the non-disclosing scope note', () => {
  const portfolio = answer({ basedOn: { screen: 'initiative', initiative: null, asOf: '2026-09-26' } });
  assert.equal(answerView(portfolio, { sentInitiativeSlug: 'not-mine' }).scopeNote, SCOPE_NOTE);
  assert.equal(answerView(portfolio, { sentInitiativeSlug: null }).scopeNote, null);
  assert.equal(answerView(answer(), { sentInitiativeSlug: 'mff' }).scopeNote, null);
});

test('direction and segmentation on the three mixed examples', () => {
  const arabicFrame = userView('إيه الـ next best action هنا؟');
  assert.equal(arabicFrame.dir, 'rtl'); assert.equal(arabicFrame.lang, 'ar');
  const latin = arabicFrame.runs.find(r => r.dir === 'ltr');
  assert.ok(latin && latin.text.includes('next best action'), 'the English phrase is one left-to-right run');
  assert.ok(arabicFrame.runs.at(-1)!.text.endsWith('؟') && arabicFrame.runs.at(-1)!.dir === 'rtl', 'the question mark stays with the Arabic frame');

  const englishFrame = userView('Explain الـ Target Live for MFF-12');
  assert.equal(englishFrame.dir, 'ltr'); assert.equal(englishFrame.lang, 'en');
  assert.ok(englishFrame.runs.some(r => r.dir === 'rtl' && r.text.includes('الـ')));
  assert.ok(englishFrame.runs.some(r => r.kind === 'token' && r.token === 'term' && r.text === 'Target Live'));
  assert.ok(englishFrame.runs.some(r => r.kind === 'token' && r.token === 'key' && r.text === 'MFF-12'));

  const tokensInArabic = userView('MFF-12 اتأجلت لـ 2026-10-01', ['Merchant Flex Finance']);
  assert.equal(tokensInArabic.dir, 'rtl');
  const t = tokensInArabic.runs.filter(r => r.kind === 'token');
  assert.deepEqual(t.map(r => [r.token, r.text, r.dir]), [['key', 'MFF-12', 'ltr'], ['date', '2026-10-01', 'ltr']]);
});

test('history is the last six turns as plain text, with hrefs and pending or failed turns left out', () => {
  const turns: Turn[] = [];
  for (let i = 0; i < 5; i++) { turns.push({ id: `u${i}`, role: 'user', text: `Q${i}`, sentInitiativeSlug: null }); turns.push({ id: `a${i}`, role: 'answer', answer: answer(), sentInitiativeSlug: null }); }
  turns.push({ id: 'f', role: 'failure', question: 'Qf', code: 'NOT_CONFIGURED', language: 'en', message: FAILURE_MESSAGE.NOT_CONFIGURED.en });
  turns.push({ id: 'p', role: 'pending', question: 'Qp' });
  const history = historyFor(turns);
  assert.equal(history.length, 6);
  assert.deepEqual(history.map(h => h.role), ['user', 'assistant', 'user', 'assistant', 'user', 'assistant']);
  assert.equal(history[0]!.text, 'Q2');
  assert.ok(!history.some(h => h.text.includes('/initiatives/')), 'hrefs never enter history');
  assert.match(plainText(answer()), /^Based on the recorded state\./);
  assert.match(plainText(answer()), /\nActual Live: Not recorded\n/);
  assert.match(plainText(answer()), /Waiting on you: 2 pending proposals/);
  assert.match(plainText(answer()), /Decide the recorded difference on Merchant Flex Finance\. Two recorded values disagree\./);
});

test('each failure code decides retry, retry-after, starters and sign-in', () => {
  const f = (code: Extract<Turn, { role: 'failure' }>['code'], extra: Partial<Extract<Turn, { role: 'failure' }>> = {}) => failureView({ id: 'x', role: 'failure', question: 'q', code, language: 'en', message: code === 'SESSION_ENDED' ? 'Your session has ended.' : FAILURE_MESSAGE[code].en, ...extra });
  assert.deepEqual([f('NOT_CONFIGURED').retry, f('TIMED_OUT').retry, f('PROVIDER_FAILED').retry, f('INVALID_RESPONSE').retry], [false, true, true, true]);
  assert.equal(f('OUT_OF_SCOPE').retry, false); assert.equal(f('OUT_OF_SCOPE').showStarters, true);
  assert.equal(f('INVALID_REQUEST').retry, false);
  assert.equal(f('RATE_LIMITED', { retryAfterSeconds: 42 }).retryAfterSeconds, 42);
  assert.equal(f('RATE_LIMITED').retryAfterSeconds, 60, 'a missing retry-after is bounded, never zero');
  assert.equal(f('SESSION_ENDED').signIn, true); assert.equal(f('SESSION_ENDED').retry, false);
  const arabic = failureView({ id: 'x', role: 'failure', question: 'q', code: 'TIMED_OUT', language: 'ar', message: FAILURE_MESSAGE.TIMED_OUT.ar });
  assert.equal(arabic.dir, 'rtl'); assert.equal(arabic.lang, 'ar');
});

test('responses are read defensively: answers, refusal codes, session loss and garbage', () => {
  const ok = resultFromResponse(200, { ok: true, answer: answer() }, 'q', 'id', 'mff');
  assert.equal(ok.role, 'answer');
  const limited = resultFromResponse(429, { ok: false, code: 'RATE_LIMITED', language: 'en', message: FAILURE_MESSAGE.RATE_LIMITED.en, retryAfterSeconds: 30 }, 'q', 'id', null);
  assert.equal(limited.role, 'failure'); if (limited.role === 'failure') { assert.equal(limited.code, 'RATE_LIMITED'); assert.equal(limited.retryAfterSeconds, 30); }
  const gone = resultFromResponse(401, { ok: false, code: 'UNAUTHENTICATED', message: 'x' }, 'q', 'id', null);
  if (gone.role === 'failure') assert.equal(gone.code, 'SESSION_ENDED');
  const garbage = resultFromResponse(502, '<html>', 'q', 'id', null);
  if (garbage.role === 'failure') { assert.equal(garbage.code, 'PROVIDER_FAILED'); assert.doesNotMatch(garbage.message, /html/); }
  const unknownCode = resultFromResponse(500, { ok: false, code: 'WEIRD', language: 'ar', message: 'رسالة' }, 'q', 'id', null);
  if (unknownCode.role === 'failure') { assert.equal(unknownCode.code, 'PROVIDER_FAILED'); assert.equal(unknownCode.language, 'ar'); assert.equal(unknownCode.message, 'رسالة'); }
});

test('the quiet dot needs both the preference and a recorded recommendation; as-of dates read like the product', () => {
  assert.equal(showsDot(true, 2), true);
  assert.equal(showsDot(false, 2), false);
  assert.equal(showsDot(true, 0), false);
  assert.equal(showsDot(true, null), false);
  assert.equal(displayAsOf('2026-09-26T10:00:00.000Z'), asOf);
  assert.equal(displayAsOf('scenario day'), 'scenario day');
});

test('without a provider only record-backed starters are offered, and the not-configured failure offers them instead of Retry (Devil R2-M3)', () => {
  for (const path of ['/', '/weekly-review', '/analysis/portfolio', '/roadmap', '/initiatives/mff']) {
    const list = startersFor(screenFromPath(path), 'en', false);
    assert.ok(list.length >= 1, path); assert.ok(list.every(s => s.deterministic), path);
  }
  const v = failureView({ id: 'x', role: 'failure', question: 'q', code: 'NOT_CONFIGURED', language: 'en', message: 'm' });
  assert.equal(v.retry, false); assert.equal(v.showStarters, true);
});
