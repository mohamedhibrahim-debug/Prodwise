import test from "node:test";
import assert from "node:assert/strict";
import { CONNECT_RESULT_CODES, connectRecovery } from "./recovery.ts";
import { CONNECTORS, type ConnectorErrorCode } from "./types.ts";
import { PROVIDERS } from "./oauth.ts";

const ALL_CODES: ConnectorErrorCode[] = ["NOT_CONFIGURED", "NOT_CONNECTED", "NEEDS_RECONNECT", "NO_ACCESS", "NOT_FOUND", "RATE_LIMITED", "PROVIDER_UNAVAILABLE", "UNSUPPORTED", "INVALID_REQUEST", "DEMO_ORGANIZATION", "VIEW_ONLY", "SCOPE_REFUSED"];

test("every result code has three plain sentences for every connector, and never leaks provider text or secrets", () => {
  assert.deepEqual([...CONNECT_RESULT_CODES].sort(), [...ALL_CODES].sort());
  for (const connector of CONNECTORS) for (const code of ALL_CODES) {
    const r = connectRecovery(code, connector);
    assert.ok(r.title.length > 8 && r.happened.length > 20 && r.next.length > 10, `${connector}/${code}`);
    assert.match(r.happened, /Nothing was connected and nothing changed/, `${connector}/${code} must say what did not change`);
    for (const text of [r.title, r.happened, r.next, r.operator ?? ""]) {
      assert.ok(!/error_description|access_token|stack|undefined|\[object/i.test(text), `${connector}/${code}: ${text}`);
      assert.ok(!text.includes(code), `${connector}/${code}: stored codes are not user copy`);
    }
  }
});

test("Figma scope refusal names exactly the three read-only scopes the app must allow, and offers a retry", () => {
  const r = connectRecovery("SCOPE_REFUSED", "FIGMA");
  assert.equal(r.retry, true);
  assert.match(r.next, /current_user:read, file_content:read, file_comments:read/);
  assert.match(r.operator ?? "", /FIGMA_OAUTH_CLIENT_ID/);
  assert.deepEqual(PROVIDERS.FIGMA.scopes, ["current_user:read", "file_content:read", "file_comments:read"]);
  assert.ok(!r.happened.includes("write"));
});

test("retry restarts the sign-in only where a retry can succeed", () => {
  const retryable = ALL_CODES.filter(code => connectRecovery(code, "JIRA").retry).sort();
  assert.deepEqual(retryable, ["INVALID_REQUEST", "NEEDS_RECONNECT", "NOT_CONNECTED", "NOT_FOUND", "NO_ACCESS", "PROVIDER_UNAVAILABLE", "RATE_LIMITED", "SCOPE_REFUSED", "UNSUPPORTED"]);
  for (const code of ["NOT_CONFIGURED", "DEMO_ORGANIZATION", "VIEW_ONLY"] as const) assert.equal(connectRecovery(code, "GMAIL").retry, false, code);
});

test("operator guidance exists only where the fix is in the installation, and names our own settings", () => {
  assert.match(connectRecovery("NOT_CONFIGURED", "GMAIL").operator ?? "", /GOOGLE_OAUTH_CLIENT_ID/);
  assert.match(connectRecovery("NEEDS_RECONNECT", "GOOGLE_DRIVE").operator ?? "", /\/api\/connectors\/google-drive\/callback/);
  assert.equal(connectRecovery("NOT_CONNECTED", "JIRA").operator, null);
});
