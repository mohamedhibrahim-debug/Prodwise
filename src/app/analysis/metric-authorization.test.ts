import { test } from "node:test";
import assert from "node:assert/strict";
import { metricSetupDecision, type MetricSetupActor, type MetricSetupTarget } from "../../lib/analysis/metric-authorization.ts";

const actor = (over: Partial<MetricSetupActor>): MetricSetupActor => ({ role: "MEMBER", platformRole: null, isProductLead: false, memberId: "m-self", ...over });
const target: MetricSetupTarget = { ownerMemberId: "m-owner", archived: false };
const env = { writesEnabled: true, demoGuest: false };
const reason = (a: MetricSetupActor, t = target, e = env) => { const d = metricSetupDecision(a, t, e); return d.allowed ? "ALLOWED" : d.reason; };

test("decision D2: the initiative owner, Org Owner, Admin or Product Lead may define metrics; Viewers and other Members may not", () => {
  assert.equal(reason(actor({ memberId: "m-owner" })), "ALLOWED");
  assert.equal(reason(actor({ role: "ORG_OWNER" })), "ALLOWED");
  assert.equal(reason(actor({ role: "ADMIN" })), "ALLOWED");
  assert.equal(reason(actor({ isProductLead: true })), "ALLOWED");
  assert.equal(reason(actor({ role: null, platformRole: "PLATFORM_OWNER", memberId: null })), "ALLOWED");
  assert.equal(reason(actor({})), "NOT_OWNER");
  assert.equal(reason(actor({ role: "VIEWER" })), "VIEW_ONLY");
  assert.equal(reason(actor({ role: "VIEWER", isProductLead: true })), "VIEW_ONLY");
  assert.equal(reason(actor({ role: null, memberId: null })), "VIEW_ONLY");
  // An initiative with no recorded owner has no owner to match.
  assert.equal(reason(actor({}), { ownerMemberId: null, archived: false }), "NOT_OWNER");
});

test("the environment gate applies after the role check, and Demo guests follow it", () => {
  assert.equal(reason(actor({ role: "ORG_OWNER" }), target, { writesEnabled: false, demoGuest: false }), "WRITE_DISABLED");
  assert.equal(reason(actor({ role: "ORG_OWNER" }), target, { writesEnabled: false, demoGuest: true }), "WRITE_DISABLED");
  assert.equal(reason(actor({ role: "ORG_OWNER" }), target, { writesEnabled: true, demoGuest: true }), "ALLOWED");
  assert.equal(reason(actor({ role: "VIEWER" }), target, { writesEnabled: false, demoGuest: false }), "VIEW_ONLY", "a Viewer is told about the role, not the environment");
});

test("archived initiatives refuse every metric write, whoever asks", () => {
  assert.equal(reason(actor({ role: "ORG_OWNER" }), { ownerMemberId: "m-self", archived: true }), "ARCHIVED");
  const d = metricSetupDecision(actor({ role: "VIEWER" }), target, env);
  assert.ok(!d.allowed && d.message.startsWith("Viewers"));
});
