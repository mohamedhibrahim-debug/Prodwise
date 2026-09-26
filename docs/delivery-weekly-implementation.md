# Delivery / Roadmap / Weekly Review local candidate

Branch: `prodwise/delivery-weekly`, based on live `2596b72094ef6edcaf9ffd5f895d87b6043f479f`. No hosted migration, account creation, push or deployment is included.

## Implemented behavior

- Typed, human-confirmed delivery facts: explicit scope/phase, member-ID owner assignment, actual Definition/Development Start, planned Target Live, Actual Live with rollout extent, next milestone (date may be unknown), blocker/attention and next step.
- Scope cannot silently change while active dates/facts belong to the earlier scope. Dates remain unknown until recorded. Jira Done does not establish Live or readiness.
- Revision-guarded correction/retraction/reconfirmation and atomic full before/after target history from the first record.
- `/roadmap`: portfolio table with business-line/owner filters, planned/actual dates, target confirmation and honest unknowns. Each initiative links to the provenance of its other delivery facts.
- `/initiatives/[slug]/delivery`: fact editor, provenance and target movement history.
- `/weekly-review`: one shared full-portfolio review per workspace and selected ISO week, grouped by frozen PM owner and initiative. Actual snapshot cutoff differs from the week label.
- Portfolio comparison includes delivery fact movements, initiative addition/removal and stage changes, Knowledge value/status/confirmation changes, materially changed supporting sources/locators/excerpts, and recorded decision-state changes. It reports supported recorded values and history without inventing business impact, health or release readiness. An initial review is an inventory rather than a fictional weekly change report.
- PMs edit their own assigned initiative sections; Admin/Product Lead can coordinate all sections. Only Admin/Product Lead can assign owners or finalize; Viewer capability never grants writes. Finalization checks live membership, ownership, source support, scope, baseline, reviewed sections and revisions.
- Refresh preserves PM text and flags material changes for review. Independent PM sections have their own optimistic revisions; one SQL state conflict is re-read/revalidated rather than forcing unrelated sections to overwrite each other.
- Final reviews preserve their snapshot, owner/reviewer labels, original AI wording and reviewed narrative. A database trigger refuses update/delete of FINAL rows. Chronological backfill is rejected after a later week is final; corrections belong in the current week's review. Drafts do not advance the comparison baseline.
- Actual server-only Claude Messages integration using `fetch`. `ANTHROPIC_API_KEY` and `ANTHROPIC_MODEL` are server configuration; no model ID is guessed. Claude selects/orders allowed wording for supported same-initiative snapshot references. Every complete line must exactly match a permitted source statement option; arbitrary factual prose is rejected rather than claimed safe by regex. No-key/failure output is explicitly TEMPLATE, never fake AI. No finalization is automatic. Generation holds no local file lock.

## Mandatory Auth integration seam

`src/lib/delivery/access-adapter.ts` deliberately fails closed in this isolated branch. Root must replace its four bodies after merging Auth; do not add a public/demo bypass:

```ts
import { requireWorkspaceAccess, requireBusinessWriteAccess,
  requireReviewFinalizeAccess } from '@/lib/auth/access';
import { listWorkspaceMembers } from '@/lib/auth/service';

export const requireDeliveryAccess = requireWorkspaceAccess;
export const requireDeliveryWriteAccess = requireBusinessWriteAccess;
export const requireDeliveryFinalizeAccess = requireReviewFinalizeAccess;
// Map only necessary membership fields (id, workspaceId, displayName,
// role, active, isProductLead), without freezing unrelated email/token fields.
```

The existing scoped `getRepository().listInitiativeSnapshots()` supplies local authorized source snapshots. Read guards and write/environment guards run again at every mutation. No client chooses workspace IDs, actor IDs, roles or capabilities. Root owns navigation/Home/Brief links and the combined authenticated browser walkthrough; these shared files are untouched here.

## Persistence and migration interface

`0011_delivery_weekly.sql` depends on the final `0010_auth_users.sql` and its explicit service-role privileges. New tables are `delivery_facts` (typed date/text/member columns plus full confirmation envelope) and `weekly_reviews` (unique workspace/ISO week plus frozen artifact). Existing activity_log stores real initiative delivery events only. Portfolio finalization audit is in the immutable review itself; no fake initiative ID is inserted.

Server-only RPCs:

| RPC | Inputs | Behavior |
|---|---|---|
| delivery_read_workspace | workspace UUID, live member UUID | Auth membership check and consistent source/state JSON snapshot |
| delivery_commit_workspace | workspace/member UUID, expected source/state JSON, next validated state JSON | Workspace/source row locks, membership/role checks, meaningful-source CAS, state CAS, atomically facts + audit + review writes |

Source and state helpers are also service-only. `delivery_meaningful` excludes irrelevant timestamp metadata from source comparison while actual timestamps remain available for display; supporting content, boundaries, locators/excerpts and trust changes remain material. An independent state conflict can retry once; changed sources and same-section/fact revision conflicts are refused.

Local fallback is `.data/prodwise-delivery-weekly.json`, separate from Auth/main data. Exclusive lock + atomic temporary-file replacement provide single-machine durability and rollback. A short bounded lock retry accommodates simultaneous PM saves. Corrupted files fail explicitly. A crashed process may leave a lock requiring local operator inspection; locks are never guessed stale and deleted automatically. Local source double-read catches changes but is not a distributed/multi-store database snapshot. The hosted path uses the database transaction instead. Local fallback is refused on Vercel.

## Validation

Direct commands (package scripts unchanged for isolation):

```text
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --conditions=react-server --import ./scripts/db-test/test-alias.mjs --test --test-isolation=none "src/lib/delivery/*.test.ts"
npm run typecheck
npm run lint
node node_modules/next/dist/bin/next build --webpack
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/delivery/sql-check.ts
```

Webpack is used because the authorized local dependency junction points outside Turbopack's configured filesystem root. No framework/config/dependency changes were made. Restricted-runner child-process EPERM is avoided with no-isolation unit tests; the unchanged build and SQL harness require normal local worker execution. The SQL harness is hardcoded to disposable localhost `track_c_test` on port 55433; its startup assertion and reset operate only on that test database. `scripts/delivery/bootstrap.sql` supplies an explicitly labelled auth.users FK stand-in; fixtures are synthetic `.invalid` users, not real provider accounts.

Checks cover owner/self-assignment and Viewer denial, scope mixing, real/unknown milestone dates, stale revisions, independent PM sections, preserved stale narrative, source changes, immutable finals, chronological ordering, intermediate target movements, unsupported AI statements (Arabic digits/spelled/relative dates/launch/health/foreign refs), mocked provider success and no-key fallback, durable reopen/rollback/concurrency, local PostgreSQL audit/CAS/privileges.

Final validation: 119 regression tests passed, including 24 delivery tests; TypeScript and lint passed. The production webpack build passed. Real disposable PostgreSQL tests passed with the latest Auth 0010 prerequisite: consistent snapshots, typed facts, atomic event audit, stale CAS refusal, Viewer denial, shared Final immutability and service-only privileges. No live provider or hosted database was called.

## Remaining limits

- Real provider calls are unverified because the user will supply the local API key later. Mock provider tests prove transport/validation behavior, not live credentials or model compatibility.
- The isolated branch intentionally has no working authenticated routes until root wires the real Auth adapter. Root must verify the combined UI; this branch does not claim authenticated browser screenshots.
- AI wording is intentionally extractive and constrained. It can organize/choose supported phrases; it does not assess health, infer facts, extract evidence, or invent next steps.
- Review narrative fields are human editorial notes, separate from confirmed fact cards. They do not mutate source truth. Earlier manual edit versions are not a collaborative text-history product; the current reviewed text and all original AI drafts are retained.
- Full multi-release entities, integrations, scheduled publication, Analysis metrics, attachments and public links remain outside this track.
