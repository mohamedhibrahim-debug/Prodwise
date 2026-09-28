import test from "node:test";
import assert from "node:assert/strict";
import { safeMessage } from "./safe-message.ts";

const f = "The change was not saved. Reload and try again.";
test("our own plain refusals pass through", () => {
  assert.equal(safeMessage(new Error("This source mapping changed. Reload and review before saving."), f), "This source mapping changed. Reload and review before saving.");
  assert.equal(safeMessage(new Error("Viewers can read this workspace, but cannot save changes."), f), "Viewers can read this workspace, but cannot save changes.");
});
test("technical text never reaches a person", () => {
  for (const raw of [
    'duplicate key value violates unique constraint "claims_pkey"', "STALE_SOURCE_MAPPING", "TypeError: Cannot read properties of undefined (reading 'id')",
    "fetch failed", "connect ECONNREFUSED 127.0.0.1:5432", 'insert or update on table "claims" violates foreign key constraint', "PGRST116: JSON object requested, multiple (or no) rows returned",
    "at readStore (store.ts:201:5)", "Request to https://example.supabase.co/rest/v1 failed", "Evidence 3b9d806b-656a-4c05-8c46-958b55e8c8f9 not found", "$undefined", "lowercase technical detail", "",
  ]) assert.equal(safeMessage(new Error(raw), f), f, raw);
  assert.equal(safeMessage({ message: "x" }, f), f);
  assert.equal(safeMessage(null, f), f);
});
