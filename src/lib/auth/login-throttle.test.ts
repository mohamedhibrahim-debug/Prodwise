import test from "node:test";
import assert from "node:assert/strict";
import { loginWait, recordLoginFailure, recordLoginSuccess, throttleKey, waitMessage } from "./login-throttle.ts";

test("five failures are free, then the wait doubles and is capped", () => {
  const k = throttleKey("a@x.test", "1.1.1.1"), t = 1_000_000;
  for (let i = 0; i < 5; i++) { assert.equal(loginWait(k, t), 0); recordLoginFailure(k, t); }
  assert.equal(loginWait(k, t), 0);
  recordLoginFailure(k, t); assert.equal(loginWait(k, t), 60_000);
  recordLoginFailure(k, t); assert.equal(loginWait(k, t), 120_000);
  for (let i = 0; i < 10; i++) recordLoginFailure(k, t);
  assert.equal(loginWait(k, t), 15 * 60_000);
  assert.equal(waitMessage(15 * 60_000), "Too many sign-in attempts. Wait 15 minutes and try again.");
});

test("success clears it; other addresses and people are unaffected", () => {
  const k = throttleKey("b@x.test", "2.2.2.2"), t = 2_000_000;
  for (let i = 0; i < 7; i++) recordLoginFailure(k, t);
  assert.ok(loginWait(k, t) > 0);
  assert.equal(loginWait(throttleKey("b@x.test", "3.3.3.3"), t), 0);
  assert.equal(loginWait(throttleKey("c@x.test", "2.2.2.2"), t), 0);
  recordLoginSuccess(k); assert.equal(loginWait(k, t), 0);
});

test("an idle hour forgets earlier failures", () => {
  const k = throttleKey("d@x.test", "4.4.4.4"), t = 3_000_000;
  for (let i = 0; i < 7; i++) recordLoginFailure(k, t);
  assert.equal(loginWait(k, t + 61 * 60_000), 0);
});
