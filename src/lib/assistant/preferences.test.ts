import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_PREFERENCES, mergePreferences, normalizePreferences, validatePatch } from './preferences-model.ts';

test('defaults: shown, Auto language, remembered open state, no proactive badge', () => {
  assert.deepEqual(DEFAULT_PREFERENCES, { show: true, language: 'auto', openBehaviour: 'remember', proactive: false });
  assert.deepEqual(normalizePreferences(undefined), DEFAULT_PREFERENCES);
  assert.deepEqual(normalizePreferences('junk'), DEFAULT_PREFERENCES);
});
test('stored values round-trip through JSON; unknown keys and wrong values fall back per key', () => {
  const stored = { show: false, language: 'ar', openBehaviour: 'collapsed', proactive: true, extra: 1 };
  const read = normalizePreferences(JSON.parse(JSON.stringify(stored)));
  assert.deepEqual(read, { show: false, language: 'ar', openBehaviour: 'collapsed', proactive: true });
  assert.deepEqual(normalizePreferences({ show: 'yes', language: 'fr', openBehaviour: 'open', proactive: 1 }), DEFAULT_PREFERENCES);
});
test('a patch may change any subset and nothing else', () => {
  const ok = validatePatch({ language: 'en', proactive: true }); assert.ok(ok.ok); assert.deepEqual(ok.patch, { language: 'en', proactive: true });
  assert.deepEqual(mergePreferences(DEFAULT_PREFERENCES, ok.patch), { show: true, language: 'en', openBehaviour: 'remember', proactive: true });
  for (const bad of [null, [], {}, { colour: 'navy' }, { show: 'true' }, { language: 'fr' }, { openBehaviour: 'open' }, { proactive: 'no' }]) assert.equal(validatePatch(bad).ok, false, JSON.stringify(bad));
});
