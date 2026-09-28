import test from "node:test";
import assert from "node:assert/strict";
import { formatDate, orgDay } from "./labels.ts";
import { cairoDay } from "../delivery/model.ts";

test("orgDay: a late-evening UTC timestamp is the next Cairo day, matching formatDate and cairoDay", () => {
  const at = "2026-09-28T23:16:00.000Z"; // 02:16 on 29 Sept in Cairo — the History mismatch seen in production
  assert.equal(orgDay(at), "2026-09-29");
  assert.equal(orgDay(at), cairoDay(at));
  assert.equal(formatDate(orgDay(at)), formatDate(at));
  assert.equal(orgDay("2026-09-28"), "2026-09-28");
});
