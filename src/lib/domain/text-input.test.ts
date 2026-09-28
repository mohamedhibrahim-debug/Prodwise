import test from "node:test";
import assert from "node:assert/strict";
import { cleanInput, cleanText } from "./text-input.ts";

test("invisible control and direction characters are removed; line breaks stay", () => {
  assert.equal(cleanText("a\u0000b‮c⁦d\ne\tf"), "abcd\ne\tf");
});
test("limits are enforced and other fields pass through", () => {
  assert.throws(() => cleanInput({ value: "x".repeat(4001) }), /Value is too long/);
  assert.deepEqual(cleanInput({ subject: "S‮", other: 1 }), { subject: "S", other: 1 });
});
test("source links must be web links", () => {
  assert.throws(() => cleanInput({ sourceUrl: "javascript:alert(1)" }), /web link/);
  assert.throws(() => cleanInput({ sourceUrl: "https://user:pw@example.com" }), /web link/);
  assert.equal(cleanInput({ sourceUrl: " https://example.com/a " }).sourceUrl, "https://example.com/a");
  assert.equal(cleanInput({ sourceUrl: null }).sourceUrl, null);
});
