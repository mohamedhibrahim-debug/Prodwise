# Queue Completeness (P0‑5): Implementation Package

## 1. UX/product contract

- **Decisions lanes:** Open · Deferred · Dismissed · Resolved · History. Each lane shows a live count.
  - All lanes are derived per request from `asOf`.
  - Counts come from the same derivation as the lists.
- **Panel:**
  - **Make a decision** stays primary and keeps its existing semantics.
  - **Defer…** and **Dismiss…** are secondary outlined controls.
- **Defer…**
  - Choices: "Until a date" or "Until the next Weekly Review".
  - A reason is required.
  - Copy: "Stays on record. Returns to Open on [date] or if the underlying evidence changes."
- **Dismiss…**
  - A reason is required.
  - Copy: "Recorded as not a real conflict for these exact claims. Returns only if they change."
- **Chips (icon plus text, never "Closed"):**
  - ✓ "Resolved · 3 Oct · decision"
  - ⏸ "Deferred until 10 Oct"
  - ⏸ "Deferred until next Weekly Review"
  - ⊘ "Dismissed · 3 Oct"
- **Reopen copy on a card:**
  - "Reopened: evidence changed since dismissal on 3 Oct"
  - "Reopened: deferral ended 10 Oct"
  - "Reopened: evidence changed since deferral"
- **Return to Open:**
  - Shown on active Deferred or Dismissed items to authorized users.
  - The reason is optional.
  - It appends a WITHDRAWN row and never erases the prior one.
- **States:**
  - Empty Deferred: "Nothing deferred."
  - Empty Dismissed: "Nothing dismissed."
  - Empty Open: existing copy. Never show "all clear" unless evaluation ran.
  - Error: "Couldn't record this. Nothing changed. [Retry]"
- **Mobile:**
  - Lanes are a scrollable tab strip with an edge fade and counts in the labels.
  - Panel actions sit in a sticky bottom bar.
  - Defer and Dismiss open sheets.
- **Crosslinks:**
  - Disposition → the claims and evidence it was bound to.
  - Reopened card → the changed claim's revision.
  - History shows deferred, dismissed, reopened and returned‑to‑open events.
  - Weekly Draft shows "Deferred this week (n)" and "Dismissed (n)", snapshotted into the Final per G10.
- **Viewer:** controls are hidden. The server denies regardless.

## 2. Data model changes

**New table `finding_dispositions`** (append‑only):

| Column | Type / rule |
|---|---|
| `id` | uuid, primary key |
| `organization_id` | not null, foreign key |
| `finding_id` | not null |
| `kind` | enum `DEFERRED`, `DISMISSED`, `WITHDRAWN` |
| `underlying_digest` | text, not null. This is the existing claim‑content digest; the disposition is never an input to it. |
| `defer_until` | date, null |
| `defer_until_next_review` | bool, default false |
| `reason` | text. Required unless `kind = WITHDRAWN`. |
| `actor` | not null |
| `at` | timestamptz, server‑set |
| `client_request_id` | not null |

**Constraints:**
- `UNIQUE(organization_id, client_request_id)`.
- CHECK: DEFERRED rows have exactly one of `defer_until` or `defer_until_next_review` set.
- CHECK: non‑DEFERRED rows have neither.

**Enforcement and indexing:**
- There are no UPDATE or DELETE grants. A trigger rejects mutation.
- Index `(organization_id, finding_id, at DESC, id DESC)`.

**Unchanged:**
- Findings, decisions, FindingState and the digest computation are not modified.
- There is no status column.

**Read dependency:** the finalization timestamps of existing Weekly Reviews. No schema change is needed.

## 3. Exact edge cases

1. **Latest‑row ordering.** "Latest" means the highest `at`, with ties broken by `id`. Only the latest row is evaluated; earlier rows never resurrect.
2. **Digest returns (resolves the A5‑2 wording conflict).** The normative rule is §4.2.
   - If the digest changes, the item reopens.
   - If the original digest returns and the latest row is still that DISMISSED or DEFERRED row, the disposition applies again. This mirrors real‑decision return semantics.
   - A5‑2's phrase "not revived automatically" is superseded by its own clause "digest returns → dismissal applies again".
3. **Date deferral boundary.** A date deferral is active while `asOf < defer_until`. `defer_until` is interpreted as start‑of‑day in the org's timezone. At `asOf` equal to 10 Oct it reads as Open.
4. **Next‑Weekly‑Review deferral.** It is active unless there is a Weekly Review finalized with `finalizedAt > at` and `finalizedAt ≤ asOf`. Drafts do not count.
5. **Latest row is WITHDRAWN.** The item reads Open with no reopen banner. History shows "returned to Open".
6. **Real decision exists.** The decision always wins and the item is Resolved. If it re‑emerges under existing semantics, the item is then evaluated against the dispositions.
7. **Both conditions fail.** If the deferral expired and the digest also changed, the reopen reason is "evidence changed", because the digest check takes precedence.
8. **Idempotent retry.** A duplicate `client_request_id` returns the original row, with no second history event.
9. **Stale state on submit.**
   - If `expectedDigest` does not match, return a digest conflict. The panel refreshes and the reason text is preserved.
   - If `expectedLatestDispositionId` does not match, show "Alex Kim dismissed this at 14:02." with [View] and, if authorized, [Return to Open].
10. **Archived initiative or org.** Writes are rejected under G3. Reads are allowed.
11. **Final snapshots.** Existing Final weekly snapshots are immutable. A later disposition never alters an already‑Final snapshot's counts.
12. **Invalid withdraw.** Withdraw when no disposition is active is rejected with "Already open."
13. **Past defer date.** A defer date on or before `asOf` is rejected by validation.

## 4. Implementation notes

**Pure function `effectiveDisposition(finding, dispositions, finalizations, asOf)`:**
- Returns `{ lane, reopenReason?, activeRow? }`.
- It lives beside `applyFindingStates` and never reads the clock.

**Lane derivation:**
- Order: decision → disposition → Open.
- `runReview` and `applyFindingStates` are unchanged.

**Command RPC `record_disposition`:**
- Inputs: `org`, `finding`, `kind`, fields, `expectedDigest`, `expectedLatestDispositionId`, `clientRequestId`.
- In one transaction it:
  1. Checks org scope.
  2. Checks the existing decision authority, with Product Lead semantics unchanged.
  3. Checks the archive guard.
  4. Takes a row lock on the finding.
  5. Recomputes the current digest from the latest snapshot.
  6. Compares the expectations.
  7. Inserts the disposition.
  8. Appends an activity event.
- Output is a typed result: `ok`, `digest_conflict`, `disposition_conflict` (actor and at), `forbidden`, `archived` or `invalid`.

**Local journal:**
- The paired journal records the command with its `clientRequestId`.
- Replay is idempotent through the unique constraint.

**Asynchronous reopen events:**
- Reopened history events are derived at read time and at evaluation time.
- The evaluator appends an idempotent "reopened" activity keyed on (disposition id, reason) when it first observes the transition.

**Server‑side `asOf`:**
- The server request time is captured once per request and passed down explicitly.

**Weekly Draft counts:**
- Rows with `at` inside the review window are counted.
- The Final snapshot copies these counts.

## 5. Acceptance criteria

The frozen A5‑1 through A5‑7 criteria apply, with A5‑2 clarified per edge case 2. Added criteria:

- **A5‑8.** A retried `client_request_id` creates no duplicate row or event.
- **A5‑9.** A next‑review deferral opens only after a finalization in the window `(at, asOf]`.
- **A5‑10.** A DB UPDATE or DELETE on `finding_dispositions` fails.
- **A5‑11.** Archived scope writes are rejected server‑side.
- **A5‑12.** Lane counts equal the list lengths for the same `asOf`.

## 6. Targeted test matrix

| # | Layer | Case | Expected |
|---|---|---|---|
| T1 | Pure | Dismiss, same digest | Dismissed (A5‑1) |
| T2 | Pure | Digest changed | Open, "evidence changed since dismissal on 3 Oct" |
| T3 | Pure | Digest restored | Dismissed again (A5‑2 regression) |
| T4 | Pure | Defer 10 Oct, `asOf` 9 Oct / 10 Oct | Deferred / Open, "deferral ended 10 Oct" (A5‑3) |
| T5 | Pure | Next‑review deferral with Draft only / with Final after `at` | Deferred / Open |
| T6 | Pure | Latest WITHDRAWN | Open, no banner |
| T7 | Pure | Decision plus disposition | Resolved |
| T8 | Pure | Expired deferral plus digest change | "evidence changed since deferral" |
| T9 | Snapshot | Existing decision and re‑emergence suite | Byte‑identical (A5‑4) |
| T10 | Pure | Digest before and after disposition | Equal, no loop (A5‑5) |
| T11 | RPC | VIEWER / non‑authorized MEMBER / ADMIN | Forbidden / forbidden / ok (A5‑6) |
| T12 | RPC | Stale digest / stale disposition id | Typed conflicts, no row |
| T13 | RPC | Duplicate `clientRequestId` | One row (A5‑8) |
| T14 | RPC | Archived initiative | Rejected |
| T15 | DB | UPDATE or DELETE on table | Error (A5‑10) |
| T16 | UI | String scan of lanes, chips and copy | No "Closed" (A5‑7) |
| T17 | UI | Conflict path | Reason text preserved; banner shows actor and time |
| T18 | UI | Mobile | Tab strip counts; sheets open |
| T19 | Integration | Weekly Draft to Final | Counts snapshotted; later dispositions don't alter the Final |

**FREEZE APPROVED.** This is conditional on accepting the A5‑2 clarification: the §4.2 function is normative, so a returning digest re‑applies the latest disposition.