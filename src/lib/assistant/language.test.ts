import test from 'node:test';
import assert from 'node:assert/strict';
import { answerLanguage, detectLanguage, directionOf, segments } from './language.ts';

const MIXED = ['إيه الـ next best action هنا؟', 'Explainلي الـ Target Live.', 'إيه الفرق بين Risk و Decision؟'];

test('detects English, Arabic and the everyday mix of both', () => {
  assert.equal(detectLanguage('What should I do next?'), 'EN');
  assert.equal(detectLanguage('إيه اللي محتاج انتباهي دلوقتي؟'), 'AR');
  for (const q of MIXED) assert.equal(detectLanguage(q), 'MIXED', q);
});
test('technical tokens do not count as English: an Arabic question about MFF-118 on 2026-10-08 is Arabic', () => {
  assert.equal(detectLanguage('إيه حالة MFF-118 يوم 2026-10-08؟'), 'AR');
  assert.equal(answerLanguage('إيه حالة MFF-118 يوم 2026-10-08؟'), 'ar');
});
test('Auto answers mixed questions in the language of the sentence frame; a fixed preference wins', () => {
  for (const q of MIXED) assert.equal(answerLanguage(q, 'auto'), 'ar', q);
  assert.equal(answerLanguage('Which initiative has the الـ Target Live soonest?', 'auto'), 'en');
  assert.equal(answerLanguage('What should I do next?'), 'en');
  assert.equal(answerLanguage('What should I do next?', 'ar'), 'ar');
  assert.equal(answerLanguage('إيه اللي ناقص؟', 'en'), 'en');
});
test('segments split mixed text into directional runs and keep English terms as ltr runs', () => {
  const s = segments('إيه الـ next best action هنا؟');
  assert.deepEqual(s.map(x => [x.text, x.dir, x.kind]), [['إيه الـ ', 'rtl', 'text'], ['next best action', 'ltr', 'text'], [' هنا؟', 'rtl', 'text']]);
  assert.equal(s.map(x => x.text).join(''), 'إيه الـ next best action هنا؟');
});
test('a product term inside an Arabic sentence is an isolated token, and a fused word follows the Arabic frame', () => {
  const s = segments('Explainلي الـ Target Live.');
  assert.deepEqual(s.map(x => [x.text, x.dir, x.kind, x.token ?? null]), [['Explainلي الـ ', 'rtl', 'text', null], ['Target Live', 'ltr', 'token', 'term'], ['.', 'rtl', 'text', null]]);
  assert.equal(s.map(x => x.text).join(''), 'Explainلي الـ Target Live.');
});
test('English words between Arabic words each become their own left-to-right run', () => {
  const s = segments('إيه الفرق بين Risk و Decision؟');
  assert.deepEqual(s.map(x => [x.text, x.dir]), [['إيه الفرق بين ', 'rtl'], ['Risk', 'ltr'], [' و ', 'rtl'], ['Decision', 'ltr'], ['؟', 'rtl']]);
  assert.equal(s.map(x => x.text).join(''), 'إيه الفرق بين Risk و Decision؟');
});
test('Jira keys, dates, weeks, ids, paths, URLs and numbers are isolated tokens; reassembly is lossless', () => {
  const text = 'الـ Target Live اتحرك من 1 Oct 2026 إلى 2026-10-08 (+7 days) في MFF-118 — راجع /initiatives/merchant-flex-finance/delivery أو https://example.test/x?y=1 · 2026-W39 · 4f1c2b3a-1111-4222-8333-944455556666';
  const s = segments(text);
  assert.equal(s.map(x => x.text).join(''), text);
  const tokens = s.filter(x => x.kind === 'token').map(x => [x.token, x.text]);
  assert.deepEqual(tokens, [['term', 'Target Live'], ['date', '1 Oct 2026'], ['date', '2026-10-08'], ['number', '+7'], ['key', 'MFF-118'], ['path', '/initiatives/merchant-flex-finance/delivery'], ['url', 'https://example.test/x?y=1'], ['week', '2026-W39'], ['id', '4f1c2b3a-1111-4222-8333-944455556666']]);
  assert.ok(s.filter(x => x.kind === 'token').every(x => x.dir === 'ltr'));
});
test('caller-supplied terms such as metric or initiative names are isolated too; terms match as written, not case-folded', () => {
  const s = segments('قيمة Approval rate النهاردة', { terms: ['Approval rate'] });
  assert.deepEqual(s.map(x => [x.text, x.kind]), [['قيمة ', 'text'], ['Approval rate', 'token'], [' النهاردة', 'text']]);
  assert.ok(segments('set the target live date').every(x => x.kind === 'text'));
});
test('paragraph direction follows the majority script (ties go to Arabic); neutral text uses the fallback', () => {
  assert.equal(directionOf('إيه الـ next best action؟'), 'rtl');
  assert.equal(answerLanguage('إيه الـ next best action؟'), 'ar');
  assert.equal(directionOf('Explainلي الـ Target Live.'), 'rtl');
  assert.equal(directionOf('What is next؟ عربي'), 'ltr');
  assert.equal(directionOf('عربي is the word for Arabic'), 'ltr');
  assert.equal(directionOf('2026-10-08'), 'ltr');
  assert.equal(directionOf('2026-10-08', 'rtl'), 'rtl');
  assert.deepEqual(segments('12 · 27'), [{ text: '12', dir: 'ltr', kind: 'token', token: 'number' }, { text: ' · ', dir: 'ltr', kind: 'text' }, { text: '27', dir: 'ltr', kind: 'token', token: 'number' }]);
});
