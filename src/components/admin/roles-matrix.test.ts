import { test } from "node:test";
import assert from "node:assert/strict";
import { administratorColumns, roleMatrix, MATRIX_COLUMNS, GRANT_TEXT } from "./roles-matrix.ts";

const cell = (key: string, column: (typeof MATRIX_COLUMNS)[number]) => roleMatrix().find(r => r.key === key)!.grants[column];

test("the matrix is derived from the guards: Owner, Admin and the operator administer; Viewer reads only", () => {
  assert.deepEqual(administratorColumns(), ["ORG_OWNER", "ADMIN", "PLATFORM_OWNER"]);
  for (const column of MATRIX_COLUMNS) assert.equal(cell("read", column), "yes");
  assert.equal(cell("write", "VIEWER"), "no");
  assert.equal(cell("write", "MEMBER"), "yes");
  assert.equal(cell("members", "MEMBER"), "no");
  assert.equal(cell("members", "ADMIN"), "yes");
});

test("Admins cannot invite or change Admins, cannot rename the workspace; Owners can", () => {
  assert.equal(cell("admins", "ADMIN"), "no");
  assert.equal(cell("admins", "ORG_OWNER"), "yes");
  assert.equal(cell("rename", "ADMIN"), "no");
  assert.equal(cell("rename", "ORG_OWNER"), "yes");
});

test("Owners are assigned by the operator only; email policy is operator only; deletion exists for nobody", () => {
  for (const column of ["ORG_OWNER", "ADMIN", "MEMBER", "VIEWER"] as const) {
    assert.equal(cell("owners", column), "no");
    assert.equal(cell("policy", column), "no");
    assert.equal(cell("delete", column), "none");
  }
  assert.equal(cell("owners", "PLATFORM_OWNER"), "operator");
  assert.equal(cell("policy", "PLATFORM_OWNER"), "operator");
  assert.equal(cell("delete", "PLATFORM_OWNER"), "none");
});

test("finalizing a Weekly Review: Owner and Admin by role, Member with the Product Lead flag, never a Viewer", () => {
  assert.equal(cell("finalize", "ORG_OWNER"), "yes");
  assert.equal(cell("finalize", "ADMIN"), "yes");
  assert.equal(cell("finalize", "MEMBER"), "lead");
  assert.equal(cell("finalize", "VIEWER"), "no");
  assert.equal(GRANT_TEXT.lead, "With Product Lead flag");
});

test("every row has a grant for every column and a plain-language note", () => {
  for (const row of roleMatrix()) {
    assert.ok(row.label.length > 10 && row.note.length > 10, row.key);
    for (const column of MATRIX_COLUMNS) assert.ok(row.grants[column] in GRANT_TEXT, `${row.key}/${column}`);
  }
});
