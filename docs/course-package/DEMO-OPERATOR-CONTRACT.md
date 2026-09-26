# Canonical reviewer Demo — operator contract

The pure fixture factory is `src/lib/demo/canonical.ts`. It has no database client, filesystem writes, network calls or Auth provisioning. The integration owner controls both local and hosted persistence.

## Registered target and actor

Call `canonicalDemoData({ workspaceId, organizationId, reviewerMemberId, reviewerUserId, asOf? })` with explicitly provisioned UUIDs belonging to the dedicated **Prodwise Demo** organization. The factory returns:

- `productStore`: initiative, activity, evidence, source, Knowledge, link and human-decision collections. Every row contains the explicit workspace ID.
- `deliveryState`: scoped facts, revision events, finalized W38 and draft W39.
- `source`: canonical snapshots and the reviewer membership projection.
- `reviewer`: ORG_OWNER and **null** platform role.
- `version`, `cutoff` and organization identity.

All product entity IDs are deterministic UUIDs derived from a Demo-only namespace and the explicit workspace ID. The existing synthetic Merchant Flex Finance inputs are remapped; no AMAN workspace IDs or original product IDs are reused. Original synthetic source URLs are removed.

Default scenario cutoff: **2026-09-26T10:00:00.000Z**. W38 is a reviewed Final baseline; W39 is an editable Draft with no fabricated Claude output. The factory uses ordinary domain functions to construct delivery revisions and finalized review state.

## Reset safety

Before an operator writes:

1. Resolve the persisted, registered Demo organization and workspace. Compare both IDs and the exact organization name with the approved target.
2. Verify the reviewer's persisted global role is null and organization role is ORG_OWNER. Refuse if any Demo member has a platform role or membership in any other organization. The private operator registration pins the organization and workspace IDs; the display name is only an additional check.
3. Call `assertDemoResetTarget` with all existing target initiatives. It refuses another organization, another workspace, a platform reviewer or any foreign scoped row. By default it also refuses non-demo initiatives. The local operator permits reviewer-created experiments only after validating the exact private Demo registration, persisted organization binding, reviewer identity, role and access policy; their `isDemo` flag is not the tenant boundary.
4. Verify the replacement fixture has only the same workspace ID, all synthetic initiatives, and no credentials.
5. Replace only the explicitly selected synthetic Demo workspace collections in one transaction or under the local repository's appropriate exclusive lock. Preserve other workspaces, organizations, identities, credentials, sessions and all unrelated data.
6. Capture a private backup before replacement. Record operator identity, target IDs, fixture version and timestamp in the operator audit. Never place passwords, session tokens or API keys in that audit.
7. Verify reset idempotence: repeated resets return the same canonical business records. Then verify foreign workspace records have identical before/after digests.

The reset is an operator script, never an unauthenticated route or normal product button. A failed safety check is a refusal, not a reason to broaden the selection. Do not remove or reset AMAN data to make the demo convenient.

## Local operator

Run from the integration project root:

```text
node --experimental-transform-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --conditions=react-server --import ./scripts/db-test/test-alias.mjs scripts/demo/provision-local.mjs --provision-demo
node --experimental-transform-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --conditions=react-server --import ./scripts/db-test/test-alias.mjs scripts/demo/provision-local.mjs --verify-demo
node --experimental-transform-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --conditions=react-server --import ./scripts/db-test/test-alias.mjs scripts/demo/provision-local.mjs --reset-demo
```

Provisioning is idempotent and does not reset an existing Demo. Reset is a separate explicit operation. Keep local preview mutations idle while resetting; the operator guards against changed input files and uses the local delivery lock. Every reset captures a private backup under `.data/demo-backups/` and writes a private operator audit. Existing Auth sessions and credentials are preserved.

The private registration and reviewer password are in `.data/demo-access.json`, which must remain ignored and untracked. Demo delivery is stored at `.data/delivery/<registered-workspace-id>.json`. The configured legacy workspace retains its separate existing delivery file. Product rows share `.data/prodwise.json` but are explicitly scoped and only Demo rows are replaced.

The registered policy is exact-email only: `domains: []`, `exactEmails: ["reviewer@prodwise.demo"]`. The operator can narrow only the explicitly registered older Demo policy that allowed `prodwise.demo`; it does so through the existing audited Platform Owner policy API after a private backup. No AMAN policy is changed. The registration also pins `asOf` to the canonical scenario cutoff; the UI labels this scenario date.

Seeded facts and the W38 Final baseline carry `preparedAsFixture: true` and use **Synthetic scenario preparation** as their visible attribution. Schema-required user/member references are retained solely for referential integrity and simulated scenario authorship. They are not evidence the reviewer took those actions. Ordinary reviewer edits construct fresh facts without this fixture marker. The unreviewed W39 Draft has no Final fixture marker, so its later human finalization is attributed normally.

## Canonical acceptance checks

- Four synthetic initiatives; no outcome KPI observations.
- Merchant Flex Finance retains the **27 versus 30** mismatch and explicit financing supersession.
- Every initiative has a named scope and the reviewer as PM owner.
- Target Live for Merchant Flex Finance: **1 Oct → 8 Oct**, revision history preserved, **+7 days** versus W38.
- Seven unknowns across Development Start, Target Live and Actual Live in the four initiative rows.
- All four Actual Live dates remain unknown; this does not prove that an initiative failed to launch.
- W38 Final is immutable; W39 Draft has baseline W38 and no AI output until the real provider is called.
- Reviewer's role is ORG_OWNER only inside Demo; no platform role or AMAN membership.
- `src/lib/demo/canonical.test.ts` verifies deterministic fixtures, golden logic, baseline/delta, unknowns, reset refusals and Analysis semantics.

## Private credentials

Use a git-ignored file under `.data/` for the operator-owned reviewer credentials. Never log or screenshot the password, include it in generated public documentation, or commit it. The course package only explains how the reviewer receives access through the private submission channel.
