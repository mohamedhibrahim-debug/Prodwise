import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isCrossOriginEmbedded, standaloneHref, type FrameView } from './embedding.ts';

const ORIGIN = 'https://prodwise.example';
function view(partial: Partial<FrameView>): FrameView {
  const self = {}; return { self, top: self, origin: ORIGIN, readTopOrigin: () => ORIGIN, ...partial };
}

test('a top-level document is not embedded', () => {
  assert.equal(isCrossOriginEmbedded(view({})), false);
});

test('a frame whose ancestor denies access to its location is cross-origin embedded', () => {
  const denied = view({ top: {}, readTopOrigin: () => { throw new DOMException('Blocked a frame', 'SecurityError'); } });
  assert.equal(isCrossOriginEmbedded(denied), true);
});

test('a frame whose ancestor has another origin is cross-origin embedded', () => {
  assert.equal(isCrossOriginEmbedded(view({ top: {}, readTopOrigin: () => 'https://leaderboard.example' })), true);
});

test('a same-origin frame keeps the forms: its cookies are first-party', () => {
  assert.equal(isCrossOriginEmbedded(view({ top: {}, readTopOrigin: () => ORIGIN })), false);
});

test('a sandboxed frame with an opaque origin counts as embedded', () => {
  assert.equal(isCrossOriginEmbedded(view({ top: {}, origin: 'null', readTopOrigin: () => { throw new Error('SecurityError'); } })), true);
});

test('a discarded top context is treated as not embedded rather than throwing', () => {
  assert.equal(isCrossOriginEmbedded(view({ top: null })), false);
});

test('the standalone link keeps path and query and never carries a host', () => {
  assert.equal(standaloneHref({ pathname: '/login', search: '?returnTo=%2Finitiatives%2Fmerchant-flex-finance' }), '/login?returnTo=%2Finitiatives%2Fmerchant-flex-finance');
  assert.equal(standaloneHref({ pathname: '/signup', search: '' }), '/signup');
  assert.ok(!standaloneHref({ pathname: '/login', search: '?x=https://evil.example' }).startsWith('http'));
});
