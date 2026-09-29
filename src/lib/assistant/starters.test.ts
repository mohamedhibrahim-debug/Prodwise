import test from 'node:test';
import assert from 'node:assert/strict';
import { starters } from './starters.ts';
import { ASSISTANT_SCREENS, INITIATIVE_TABS } from './types.ts';
import { classifyIntent } from './fallbacks.ts';
import { detectLanguage } from './language.ts';

test('every screen has one to four starters with unique keys, in both languages', () => {
  for (const screen of ASSISTANT_SCREENS) for (const language of ['en', 'ar'] as const) {
    const list = starters(screen, { language });
    assert.ok(list.length >= 1 && list.length <= 4, `${screen} ${language}`);
    assert.equal(new Set(list.map(s => s.key)).size, list.length);
    for (const s of list) { assert.ok(s.label.trim() && s.question.trim()); assert.ok(s.question.length <= 160); }
  }
});
test('Arabic starters are written in Arabic and keep product terms in Latin script', () => {
  const list = starters('roadmap', { language: 'ar' });
  assert.ok(list.every(s => detectLanguage(s.question) !== 'EN'));
  assert.ok(list.some(s => /Target Live/.test(s.question)));
});
test('initiative tabs refine the starters; an unknown tab falls back to the initiative set', () => {
  const brief = starters('initiative'), knowledge = starters('initiative', { tab: 'knowledge' }), unknown = starters('initiative', { tab: 'nope' });
  assert.ok(knowledge.some(s => s.key === 'risk-vs-decision'));
  assert.deepEqual(unknown, brief);
  for (const tab of INITIATIVE_TABS) assert.ok(starters('initiative', { tab }).length >= 1, tab);
  assert.deepEqual(starters('home', { tab: 'knowledge' }), starters('home'));
});
test('every starter marked deterministic is answered without a provider', () => {
  for (const screen of ASSISTANT_SCREENS) for (const language of ['en', 'ar'] as const) for (const s of starters(screen, { language })) {
    if (s.deterministic) assert.ok(classifyIntent(s.question), `${screen}/${s.key}/${language}: ${s.question}`);
  }
  for (const tab of INITIATIVE_TABS) for (const language of ['en', 'ar'] as const) for (const s of starters('initiative', { tab, language })) {
    if (s.deterministic) assert.ok(classifyIntent(s.question), `${tab}/${s.key}/${language}: ${s.question}`);
  }
});
test('no starter mentions a provider or a persona', () => {
  for (const screen of ASSISTANT_SCREENS) for (const language of ['en', 'ar'] as const) for (const s of starters(screen, { language })) assert.doesNotMatch(`${s.label} ${s.question}`, /claude|anthropic|gpt|openai|assistant persona/i);
});
