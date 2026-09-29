import assert from "node:assert/strict";
import test from "node:test";
import { EMPTY_STATE, FACT_KINDS, type DeliveryState, type FactKind, type FactValue, type PortfolioSource, type WorkspaceAccess } from "./types.ts";
import { recordFact, type RecordFactInput } from "./model.ts";
import { confirmationNote, factValueFromForm, factValueProblem, needsScopeFirst, NO_REASON_NOTE, SCOPE_PREREQUISITE } from "./fact-rules.ts";

const admin: WorkspaceAccess = { workspaceId: "w1", organizationId: "org1", platformRole: null, memberId: "admin", actor: { id: "admin-user", label: "ADMIN" }, role: "ADMIN", isProductLead: false };
const now = "2026-09-26T12:00:00Z", today = "2026-09-26";
const source = (): PortfolioSource => ({
  members: [{ id: "admin", workspaceId: "w1", role: "ADMIN", isProductLead: false, active: true, displayName: "ADMIN" }],
  snapshots: [{ initiative: { id: "i1", slug: "i1", name: "i1", description: null, knownReferences: null, businessLine: "MF", stage: "DELIVERY", overallState: "UNKNOWN", stateSummary: null, isDemo: false, createdAt: "2026-09-01T00:00:00Z", updatedAt: "2026-09-01T00:00:00Z" },
    claims: [], findingStates: [],
    evidence: [{ id: "e1", initiativeId: "i1", title: "Core Epic", boundary: "CURRENT_SCOPE", sourceType: "JIRA", sourceReference: "MFF-104", sourceUrl: null, contentSummary: null, occurredAt: null, capturedAt: now, lastVerifiedAt: null, createdAt: now, updatedAt: now }],
  }],
} as unknown as PortfolioSource);
const blank: FactValue = { date: null, text: null, memberId: null, extent: null };
const input = (kind: FactKind, value: Partial<FactValue>, over: Partial<RecordFactInput> = {}, state: DeliveryState = EMPTY_STATE): RecordFactInput =>
  ({ initiativeId: "i1", kind, expectedRevision: state.facts.find(f => f.kind === kind)?.revision ?? 0, value: { ...blank, ...value }, retract: false, basis: "EVIDENCE", note: "?", evidenceId: "e1", locator: null, ...over });
const failCode = (fn: () => unknown) => { try { fn(); return null; } catch (e) { return (e as { code?: string }).code ?? String(e); } };
const withScope = () => recordFact(EMPTY_STATE, source(), admin, input("SCOPE", { text: "Phase 1 · pilot" }), now);

test("screenshot case: evidence basis + current-scope source + a reason, but no Description, is refused naming the Description field", () => {
  const state = withScope();
  let error: unknown; try { recordFact(state, source(), admin, input("BLOCKER", {}, {}, state), now); } catch (e) { error = e; }
  assert.equal((error as { code: string }).code, "TEXT_REQUIRED");
  assert.match((error as Error).message, /Description/);
  assert.match((error as Error).message, /confirmation reason is recorded separately/);
  // The same inputs plus the description save; nothing else has to be re-entered.
  const saved = recordFact(state, source(), admin, input("BLOCKER", { text: "Finance sign-off outstanding" }, {}, state), now);
  assert.equal(saved.facts.find(f => f.kind === "BLOCKER")?.value.text, "Finance sign-off outstanding");
});

test("browser and server apply the same value rule for every kind and shape", () => {
  const state = withScope();
  const shapes: Partial<FactValue>[] = [{}, { text: "x" }, { date: "2026-10-01" }, { date: "2026-12-31" }, { date: "2026-10-01", text: "x" }, { unknown: true }, { unknown: true, text: "x" }, { dateUnknown: true, text: "x" }, { dateUnknown: true }, { date: "2026-09-01", extent: "FULL" }, { date: "2026-09-01", extent: "PARTIAL" }, { date: "2026-09-01", extent: "PARTIAL", text: "wave 1" }, { date: "2026-02-30" }];
  for (const kind of FACT_KINDS.filter(k => k !== "OWNER" && k !== "SCOPE")) for (const shape of shapes) {
    const client = factValueProblem(kind, { ...blank, ...shape }, today)?.code ?? null;
    const server = failCode(() => recordFact(state, source(), admin, input(kind, shape, {}, state), now));
    assert.equal(server, client, `${kind} ${JSON.stringify(shape)}`);
  }
});

test("stale prerequisite: once the scope is confirmed, the blocking message is gone and the same entry saves", () => {
  const entry = input("NEXT_STEP", { text: "Agree the divisor with Finance" });
  assert.equal(needsScopeFirst("NEXT_STEP", false), true);
  assert.equal(failCode(() => recordFact(EMPTY_STATE, source(), admin, entry, now)), "SCOPE_REQUIRED");
  const state = withScope();
  const scopeConfirmed = state.facts.some(f => f.kind === "SCOPE" && f.state === "SET");
  assert.equal(needsScopeFirst("NEXT_STEP", scopeConfirmed), false, "re-evaluated from the record, not from the earlier error");
  const saved = recordFact(state, source(), admin, { ...entry, expectedRevision: 0 }, now);
  assert.equal(saved.facts.find(f => f.kind === "NEXT_STEP")?.value.text, "Agree the divisor with Finance");
  assert.equal(SCOPE_PREREQUISITE, "Confirm the delivery phase or scope before recording delivery facts.");
});

test("the confirmation / change reason is optional and a blank one is stored as a literal, never invented", () => {
  const state = withScope();
  const saved = recordFact(state, source(), admin, input("NEXT_STEP", { text: "Re-test" }, { note: "  " }, state), now);
  assert.equal(saved.facts.find(f => f.kind === "NEXT_STEP")?.note, NO_REASON_NOTE);
  assert.equal(confirmationNote(" Finance asked "), "Finance asked");
  assert.equal(failCode(() => recordFact(state, source(), admin, input("NEXT_STEP", { text: "Re-test" }, { note: "x".repeat(2001) }, state), now)), "CONFIRMATION_NOTE");
});

test("editor form values are read the way the server action reads them", () => {
  const data = new FormData(); data.set("BLOCKER:text", "  Waiting on partner  "); data.set("BLOCKER:date", ""); data.set("unknown", "yes");
  assert.deepEqual(factValueFromForm(data, "BLOCKER:"), { date: null, text: "Waiting on partner", memberId: null, extent: null });
  assert.equal(factValueFromForm(data).unknown, true);
});
