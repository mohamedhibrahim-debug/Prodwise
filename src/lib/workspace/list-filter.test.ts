import assert from "node:assert/strict";
import { test } from "node:test";
import { activeFilterCount, applyListFilters, clearListState, facetCounts, parseListState, serializeListState, setFacet, toggleFacetValue } from "./list-filter.ts";
import { filterRegister, REGISTER_FACETS, type RegisterRow } from "./register-view.ts";

const facets = ["stage", "owner"] as const;

test("list state round-trips through the URL with stable ordering", () => {
  const state = parseListState(new URLSearchParams("owner=m1&stage=DELIVERY,VALIDATION&q=merchant&sort=target&ignored=x"), facets);
  assert.deepEqual(state, { q: "merchant", filters: { stage: ["DELIVERY", "VALIDATION"], owner: ["m1"] }, sort: "target" });
  assert.equal(serializeListState(state, facets), "stage=DELIVERY%2CVALIDATION&owner=m1&q=merchant&sort=target");
  assert.deepEqual(parseListState(new URLSearchParams(serializeListState(state, facets)), facets), state);
});

test("parsing accepts a Next.js searchParams object, drops blanks and duplicates", () => {
  const state = parseListState({ stage: "DELIVERY,,DELIVERY, ", owner: ["m1", "m2"], q: undefined }, facets);
  assert.deepEqual(state.filters, { stage: ["DELIVERY"], owner: ["m1", "m2"] });
  assert.equal(state.q, "");
  assert.equal(state.sort, null);
  assert.equal(serializeListState(clearListState(state), facets), "");
});

test("toggling adds and removes values; an emptied facet disappears", () => {
  let state = parseListState(new URLSearchParams(""), facets);
  state = toggleFacetValue(state, "stage", "DELIVERY");
  state = toggleFacetValue(state, "stage", "VALIDATION");
  assert.deepEqual(state.filters.stage, ["DELIVERY", "VALIDATION"]);
  state = toggleFacetValue(toggleFacetValue(state, "stage", "DELIVERY"), "stage", "VALIDATION");
  assert.equal("stage" in state.filters, false);
  assert.equal(activeFilterCount(setFacet({ ...state, q: "x" }, "owner", ["a", "b"])), 3);
});

const rows = [
  { name: "Alpha", stage: "DELIVERY", tags: ["a", "b"] },
  { name: "Beta", stage: "DELIVERY", tags: ["b"] },
  { name: "Gamma", stage: "DEFINITION", tags: [] as string[] },
];
const accessors = { stage: (r: (typeof rows)[number]) => [r.stage], tag: (r: (typeof rows)[number]) => r.tags };
const text = (r: (typeof rows)[number]) => r.name;

test("values OR within a facet, facets AND together, search is case-insensitive", () => {
  const base = parseListState(new URLSearchParams(""), ["stage", "tag"]);
  assert.deepEqual(applyListFilters(rows, setFacet(base, "tag", ["a", "b"]), accessors, text).map(r => r.name), ["Alpha", "Beta"]);
  assert.deepEqual(applyListFilters(rows, setFacet(setFacet(base, "tag", ["b"]), "stage", ["DEFINITION"]), accessors, text), []);
  assert.deepEqual(applyListFilters(rows, { ...base, q: "  gAm " }, accessors, text).map(r => r.name), ["Gamma"]);
  // An unknown facet from a hand-edited URL is ignored rather than hiding everything.
  assert.equal(applyListFilters(rows, setFacet(base, "nope", ["x"]), accessors, text).length, 3);
});

test("facet counts equal the result count of picking that option under the other filters", () => {
  const state = setFacet(setFacet(parseListState(new URLSearchParams(""), ["stage", "tag"]), "tag", ["b"]), "stage", ["DEFINITION"]);
  const counts = facetCounts(rows, state, accessors, text, "stage");
  assert.deepEqual([...counts], [["DELIVERY", 2]]);
  for (const [value, count] of counts) assert.equal(applyListFilters(rows, setFacet(state, "stage", [value]), accessors, text).length, count);
});

const row = (over: Partial<RegisterRow>): RegisterRow => ({
  id: over.name ?? "x", slug: "x", name: "x", businessLine: "MF", reference: null, isDemo: false, archived: false,
  stage: "DELIVERY", ownerId: null, ownerLabel: "Unassigned", setup: { completed: 10, total: 10, ready: true, label: "Setup complete" },
  attention: [], target: { text: "Not recorded", date: null, moved: null, flags: ["unknown"] }, latest: null, ...over,
});
const register = [
  row({ name: "Beta", attention: [{ kind: "decision", label: "Decision needed" }], target: { text: "1 Oct", date: "2026-10-01", moved: null, flags: ["upcoming"] }, latest: { sentence: "a", at: "2026-09-20T10:00:00Z" } }),
  row({ name: "Alpha", setup: { completed: 6, total: 10, ready: false, label: "Setup incomplete" }, latest: { sentence: "b", at: "2026-09-25T10:00:00Z" } }),
  row({ name: "Smoke check", archived: true }),
];

test("the register hides archived rows unless the URL asks for them", () => {
  const empty = parseListState(new URLSearchParams(""), REGISTER_FACETS);
  assert.deepEqual(filterRegister(register, empty).map(r => r.name), ["Alpha", "Beta"]);
  assert.deepEqual(filterRegister(register, parseListState(new URLSearchParams("record=archived"), REGISTER_FACETS)).map(r => r.name), ["Smoke check"]);
  assert.equal(filterRegister(register, parseListState(new URLSearchParams("record=all"), REGISTER_FACETS)).length, 3);
});

test("links from Home keep their meaning in the register", () => {
  const names = (query: string) => filterRegister(register, parseListState(new URLSearchParams(query), REGISTER_FACETS)).map(r => r.name);
  assert.deepEqual(names("attention=any"), ["Beta"]);
  assert.deepEqual(names("attention=decision"), ["Beta"]);
  assert.deepEqual(names("target=upcoming"), ["Beta"]);
  assert.deepEqual(names("target=unknown"), ["Alpha"]);
  assert.deepEqual(names("setup=incomplete"), ["Alpha"]);
  assert.deepEqual(names("sort=updated"), ["Alpha", "Beta"]);
  assert.deepEqual(names("sort=target"), ["Beta", "Alpha"]);
});
