import assert from "node:assert/strict";
import { test } from "node:test";
import { homeChanges, portfolioPulse } from "./home-view.ts";
import type { PortfolioRow, ProjectionChange } from "./portfolio.ts";

const row = (id: string, attention: string[], archived = false) => ({ initiative: { id, archivedAt: archived ? "2026-09-20T00:00:00Z" : null }, attention: attention.map(kind => ({ kind })) }) as unknown as PortfolioRow;
const change = (id: string, initiativeId: string, sentence: string, occurredAt: string, actorLabel = "Lina"): ProjectionChange => ({ id, initiativeId, slug: initiativeId, name: initiativeId, sentence, actorLabel, occurredAt, href: `/initiatives/${initiativeId}` });

test("pulse hides zero categories and counts initiatives, not reasons", () => {
  const rows = [row("a", ["DECISION", "BLOCKER"]), row("b", ["DECISION"]), row("c", []), row("z", ["DECISION"], true)];
  const pulse = portfolioPulse({ rows, summary: { total: 3, attentionInitiatives: 2, attentionReasons: 3, setupIncomplete: 0, upcomingTargets: 0, unknownTargets: 1 } });
  assert.deepEqual(pulse.map(p => [p.key, p.count]), [["attention", 2], ["decision", 2], ["blocker", 1], ["unknown", 1]]);
  assert.equal(pulse.find(p => p.key === "decision")!.href, "/initiatives?attention=decision");
});

test("archived initiatives never appear in Home changes", () => {
  const rows = [row("live", []), row("smoke-check", [], true)];
  const { added, lines } = homeChanges([
    change("1", "smoke-check", "Added to Prodwise", "2026-09-28T10:00:00Z"),
    change("2", "live", "Added to Prodwise", "2026-09-27T10:00:00Z"),
    change("3", "smoke-check", "Owner assignment recorded", "2026-09-27T09:00:00Z"),
    change("4", "live", "Next step confirmed: x", "2026-09-26T09:00:00Z"),
  ], rows);
  assert.deepEqual(added.map(c => c.id), ["2"]);
  assert.deepEqual(lines.map(l => l.change.id), ["4"]);
});

test("same actor, same initiative, within ten minutes reads as one line; duplicates collapse", () => {
  const rows = [row("a", []), row("b", [])];
  const { lines } = homeChanges([
    change("1", "a", "Risk tracked", "2026-09-26T10:09:00Z"),
    change("2", "a", "Question opened", "2026-09-26T10:00:00Z"),
    change("3", "b", "Dependency recorded", "2026-09-26T09:00:00Z"),
    change("4", "a", "Dependency recorded", "2026-09-26T09:00:00Z"),
  ], rows);
  assert.deepEqual(lines.map(l => [l.change.id, l.more]), [["1", ["Question opened"]], ["3", []]]);
});
