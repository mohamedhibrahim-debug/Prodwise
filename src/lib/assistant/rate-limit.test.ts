import test from 'node:test';
import assert from 'node:assert/strict';
import { GUEST_RULE, MEMBER_RULE, SlidingWindowLimiter } from './rate-limit.ts';

test('members get 20 questions per 10 minutes, then a denial that says when to retry', () => {
  let now = 1_000_000; const limiter = new SlidingWindowLimiter(() => now);
  for (let i = 0; i < MEMBER_RULE.limit; i++) { const d = limiter.take('user:a', MEMBER_RULE); assert.ok(d.allowed); assert.equal(d.remaining, MEMBER_RULE.limit - i - 1); now += 1000; }
  const denied = limiter.take('user:a', MEMBER_RULE);
  assert.equal(denied.allowed, false); assert.equal(denied.remaining, 0);
  assert.equal(denied.retryAfterMs, MEMBER_RULE.windowMs - MEMBER_RULE.limit * 1000);
  // Denials consume nothing: the same answer again.
  assert.deepEqual(limiter.take('user:a', MEMBER_RULE), denied);
});
test('the window slides: the oldest hit expiring frees one slot, and keys are independent', () => {
  let now = 0; const limiter = new SlidingWindowLimiter(() => now);
  for (let i = 0; i < GUEST_RULE.limit; i++) { assert.ok(limiter.take('guest:demo', GUEST_RULE).allowed); now += 1000; }
  assert.equal(limiter.take('guest:demo', GUEST_RULE).allowed, false);
  assert.ok(limiter.take('user:other', MEMBER_RULE).allowed);
  now = GUEST_RULE.windowMs + 1;
  assert.ok(limiter.take('guest:demo', GUEST_RULE).allowed, 'the first hit has expired');
  assert.equal(limiter.take('guest:demo', GUEST_RULE).allowed, false);
});
test('guests share a lower limit than members', () => { assert.ok(GUEST_RULE.limit < MEMBER_RULE.limit && GUEST_RULE.windowMs === MEMBER_RULE.windowMs); });
test('expired keys are swept so memory does not grow with every visitor', () => {
  let now = 0; const limiter = new SlidingWindowLimiter(() => now);
  for (let i = 0; i < 300; i++) { limiter.take(`user:${i}`, MEMBER_RULE); now += 1; }
  now = MEMBER_RULE.windowMs + 1000;
  for (let i = 0; i < 250; i++) limiter.take('user:late', MEMBER_RULE);
  assert.ok(limiter.size() < 300);
});
