# P0‑4 Anchored AI Evidence Ingestion: Final Implementation Package

**Baseline:** `4623810d` · **Authority:** P0‑1, P0‑2, A1, Contract Freeze §0 and §3 · **Implementer:** Codex

## 0. Scope Lock

**In scope**
- Paste‑text intake.
- Reading attempts.
- Anchored proposals.
- Confirm, reject and cosmetic edit.
- Add my own entry.
- Batch confirm.
- Workbench UI.

**Deferred dependencies** (these are guards, not blockers):
- **Meeting notes (P1‑7):** `kind=MEETING_NOTES` is accepted by the schema, but the UI mode is hidden behind the flag `evidence.meetingNotes=false`.
- **Open question (P1‑10):** the server discards `OPEN_QUESTION` proposals unless an `OpenQuestionService` is registered. The type chip is hidden. A4‑9 is deferred to P1‑10.
- **Owner and stage:** always discarded before persistence (A4‑10).

## 1. Modules

```
lib/evidence/
  types.ts            // enums, DTOs
  anchor.ts           // verifyAnchor, sha256Utf8, utf16 helpers
  normalize.ts        // per-type normalizeValue, isCosmeticEdit
  extract.ts          // model call → raw candidates (outside txn)
  filter.ts           // discard owner/stage/unsupported/unverifiable
  service.ts          // submit, startAttempt, confirm, reject, edit, supersede
  targets.ts          // TargetAdapter registry (Knowledge, DeliveryFact, Action, [OpenQuestion])
  repo.ts             // EvidenceRepo interface
  repo.local.ts       // JSON repo via atomic paired journal
  repo.hosted.ts      // PostgreSQL RPC wrappers
app/initiatives/[slug]/evidence/new/page.tsx
app/initiatives/[slug]/evidence/[submissionId]/page.tsx
app/api/evidence/...  (route handlers below)
components/evidence/{IntakeForm,Workbench,EvidencePane,ProposalCard,BatchBar,ResultsPanel,ConflictNotice}.tsx
```

**TargetAdapter interface.** Each adapter reuses an existing command. There is no elevation and no reimplementation.

```ts
interface TargetAdapter<P> {
  type: ProposalType;
  can(actor, initiative, payload): Promise<{ok:boolean; reason?:string}>;
  apply(tx: UnitOfWork, actor, payload: P, prov: {evidenceAnchorId:string; submissionId:string},
        opts:{clientRequestId:string; expectedRevision?:number; rationale?:string}): Promise<ResultRef>;
  destinationCopy(payload:P, current?): string;
}
```

**UnitOfWork** is the existing transaction abstraction. Locally it is the paired journal handle. In hosted mode, confirmation runs in a single RPC (see §4).

## 2. Schema (Hosted SQL; Local JSON Mirrors Field Names)

```sql
create table evidence_submissions(
  id uuid pk, organization_id uuid not null, initiative_id uuid not null,
  source_item_id uuid not null, kind text check (kind in ('PASTED','MEETING_NOTES')),
  text text not null, text_sha256 char(64) not null,
  char_length int not null check (char_length between 1 and 20000),
  created_by uuid not null, created_at timestamptz default now(),
  client_request_id text not null, unique(organization_id, client_request_id));
create table evidence_attempts(
  id uuid pk, submission_id uuid references evidence_submissions,
  status text check (status in ('READING','READY','TIMED_OUT','FAILED','STOPPED')),
  started_at timestamptz, ended_at timestamptz, error_code text,
  model_id text, prompt_version text, discarded_count int default 0);
create table evidence_anchors(
  id uuid pk, submission_id uuid references evidence_submissions,
  start_offset int not null, end_offset int not null, quote text not null,
  check (0 <= start_offset and start_offset < end_offset));
create table evidence_proposals(
  id uuid pk, attempt_id uuid, submission_id uuid, anchor_id uuid references evidence_anchors,
  type text not null, payload_json jsonb not null, payload_sha256 char(64) not null,
  version int not null default 1, base_revision_json jsonb,
  status text check (status in ('PENDING','CONFIRMED','REJECTED','SUPERSEDED_BY_HUMAN_ENTRY','OUTDATED')),
  decided_by uuid, decided_at timestamptz, reject_reason text,
  result_ref_type text, result_ref_id uuid, superseded_from uuid);
create table evidence_confirmations(
  proposal_id uuid primary key references evidence_proposals,
  proposal_version int, actor uuid, at timestamptz, result_ref_type text, result_ref_id uuid,
  client_request_id text, unique(proposal_id));
```

**Immutability**
- A trigger rejects any UPDATE of `text`, `text_sha256` or `char_length`, and any UPDATE of anchors.
- There are no DELETE grants on any `evidence_*` table for the app role.
- Search indexers exclude these tables.

**Provenance columns** (nullable) are added to the Knowledge claims, delivery fact revisions and `actions` tables:
- `evidence_submission_id`
- `evidence_anchor_id`

## 3. Anchor Validation (UTF‑16)

```ts
export function verifyAnchor(text:string, a:{start:number;end:number;quote:string}, expectedSha?:string){
  if (!Number.isInteger(a.start)||!Number.isInteger(a.end)||a.start<0||a.end>text.length||a.start>=a.end) return false;
  if (isLoneSurrogateBoundary(text,a.start)||isLoneSurrogateBoundary(text,a.end)) return false;
  if (expectedSha && sha256Utf8(text)!==expectedSha) return false;
  return text.slice(a.start,a.end)===a.quote;
}
```

**Rules**
- **Where it runs:** TypeScript runs this check both on insert and inside the confirm transaction.
- **Text storage:**
  - Text is stored exactly as received after a single normalization at submit: line endings CRLF→LF, then NFC.
  - `char_length = text.length` in UTF‑16 units.
  - The hash is taken over the UTF‑8 bytes of the stored text.
- **Hosted re‑verify:** the RPC performs a hash check with `encode(sha256(convert_to(text,'UTF8')),'hex')`.
- **Quote comparison in SQL:** SQL substring uses code points, not UTF‑16 units, so SQL does not compare slices.
  - The TypeScript layer passes `quote` and the submission's `text_sha256`.
  - The RPC re‑checks that the anchor row's `quote` equals the passed quote and that the hash equals the stored hash.
  - Anchor rows are immutable, and slice correctness was verified at insert.
- **Model output:** the model returns quotes, not trusted offsets.
  - `extract.ts` locates the quote with `indexOf` from the model's offset hint.
  - If the quote occurs more than once, the occurrence nearest the hint wins.
  - If no match is found, the candidate is discarded and counted in `discarded_count`.

## 4. Commands and API

All routes resolve `organization_id` from the session membership. Foreign IDs return 404. Viewers and archived initiatives are rejected before any write, with the A1.8 copy.

| Route | Body | Result |
|---|---|---|
| `POST /api/initiatives/[slug]/evidence` | `{text, sourceItemId?\|newPasted:true, clientRequestId}` | `201 {submissionId}`. Save first; replay is idempotent. Over‑limit returns `422 TEXT_TOO_LONG{length}`. |
| `POST /api/evidence/[id]/attempts` | `{clientRequestId}` | Creates a READING attempt, calls the model outside any transaction, persists anchors and proposals, then sets READY, FAILED or TIMED_OUT. |
| `POST /api/evidence/attempts/[aid]/stop` | none | STOPPED |
| `GET /api/evidence/[id]` | none | Submission, latest attempt (a stale READING attempt is reported as TIMED_OUT on read), anchors, proposals with `can{Confirm,Reject,AddOwn}` and reasons, and `discardedCount`. |
| `POST /api/evidence/proposals/[pid]/confirm` | `{expectedVersion, clientRequestId, rationale?, context?}` | `200 {resultRef, targetStatus}`, or one of the 409 errors below. |
| `POST .../reject` | `{expectedVersion, reason?}` | Requires target authority. |
| `PATCH .../payload` | `{expectedVersion, payload}` | A cosmetic change bumps `version`. Otherwise returns `422 VALUE_EDIT_REQUIRES_NEW_ENTRY`. |
| `POST .../supersede` | `{humanResultRef}` | Called after a successful standard create. Sets `SUPERSEDED_BY_HUMAN_ENTRY`. The new record carries no anchor. |
| `POST .../repropose` | none | For an OUTDATED delivery proposal: creates a new proposal on the same anchor against the current revision, with `superseded_from` set. |

**Confirm 409 errors**
- `PROPOSAL_HANDLED{by,at,resultRef}`
- `VERSION_STALE`
- `TARGET_CONFLICT{current,actor,at}`
- `ANCHOR_INVALID`

**Confirm algorithm** (a single transaction in both modes):
1. Look up the confirmation by `proposal_id`. If one exists and has the same `clientRequestId`, return the stored result. If it exists with a different request, return `PROPOSAL_HANDLED`.
2. Lock the proposal (`SELECT … FOR UPDATE` in hosted mode; journal lock locally). Require PENDING and the expected version.
3. Re‑verify the anchor and hash.
4. Call `adapter.can`. On failure return 403 with the reason and write nothing.
5. Call `adapter.apply(tx, …)`.
   - **Delivery facts:** pass `expectedRevision` from `base_revision_json` and the required rationale (prefilled as "From evidence: {source}").
   - **Knowledge:** return the service's status verbatim.
6. Insert the confirmation row, set the proposal to CONFIRMED with `result_ref`, append an `initiative_events` row (`EVIDENCE_CONFIRMED`), and set the source link status to "Evidence added".
7. Commit.
   - If the target returns a revision conflict for a delivery proposal, roll back fully. Then, in a separate small transaction, set OUTDATED only if `base_revision` is stale.

**Mode specifics**
- **Hosted:** `rpc_confirm_evidence_proposal(p_org, p_actor, p_proposal, p_expected_version, p_quote, p_sha, p_client_request_id, p_target_args jsonb)`. It calls the existing target SQL functions (Knowledge create, delivery fact revise, action create) inside the same plpgsql transaction. It must not make a nested HTTP call.
- **Local:** a single paired‑journal entry containing every row mutation. Replaying the journal on crash must be all‑or‑nothing, and a test covers this.

**Batch confirm.** The client posts N independent confirms with at most 3 running at once. Results are aggregated. Items that are not applied stay PENDING or become OUTDATED, and each shows its reason.

## 5. Normalization (`isCosmeticEdit`)

`normalizeValue(type, payload)`:
- Collapses whitespace.
- Casefolds the statement only for comparison.
- Strips trailing punctuation.
- For dates, parses to a `YYYY-MM-DD` calendar date with no timezone. Unparseable or vague dates (for example "early October") normalize to a raw text token.

An edit is cosmetic when `normalize(old) === normalize(new)`. Assignee or due changes on an Action proposal are never cosmetic. Assignee must be chosen explicitly. It is never inferred, and the default is unassigned.

## 6. UI States

| State | Behaviour |
|---|---|
| **Intake** | The three persistent honesty lines. A live character counter using `text.length`. Over the limit, the submit button is disabled and the text is kept. |
| **Workbench shell** | The text pane renders immediately. The header shows Saved, Reading…, Proposals ready, Timed out, Failed or Stopped, always as text plus icon. |
| **Failure** | "Your text is saved. [Retry reading]" |
| **Cards** | Type chip, statement, destination copy, blockquote with span number, and buttons: Show evidence, Confirm, Reject, Add my own entry. There is no confidence score. Where the actor lacks authority, a reason replaces the buttons. |
| **After a decision** | "Added to Knowledge · {serviceStatus}" · "Already confirmed by {name} at {time} · View record" · Outdated: "Current value is {v} (set by {name}) [Propose again from current]" |
| **Empty or discarded** | The frozen copy. The discarded‑count line never shows the discarded content. |
| **Viewer or archived** | Read‑only, with reasons. |
| **Mobile (390)** | "Evidence \| Proposals (n)" tabs. Show evidence switches to the Evidence tab, scrolls without animation under reduced motion, focuses a `tabindex=-1` span, and shows a "Back to proposal" chip. Card footer with More. Sticky batch bar using `scroll-padding-bottom`. |

## 7. Edge Cases

- **Emoji and surrogate pairs:** covered by boundary tests.
- **CRLF paste:** normalized before hashing.
- **Duplicate quote occurrences:** resolved by the hint rule in §3.
- **Double submit:** handled by `clientRequestId`.
- **Retry:** reuses the submission. Earlier attempts' proposals remain visible, grouped under "Attempt 1".
- **Concurrent confirm of the same proposal:** exactly one wins.
- **Tampered anchor in the database:** confirm returns `ANCHOR_INVALID` and writes nothing.
- **Deactivated member picked as assignee:** the Action adapter rejects the write.
- **Cross‑org IDs:** return 404.
- **Model returns an owner, stage or unknown type:** dropped before persistence.
- **Model returns an open question while P1‑10 is not registered:** dropped and counted.
- **Model‑suggested due hint:** shown as a suggestion that the user must accept.

## 8. Focused Tests

**Unit**
- `verifyAnchor`: ASCII, emoji, CJK, lone surrogate, out‑of‑range and mismatched cases.
- SHA parity between TypeScript and SQL across 20 fixtures.
- `isCosmeticEdit` matrix: date format change passes; "early October"→"8 Oct" fails.
- Filter drops OWNER, STAGE and OPEN_QUESTION when unregistered.

**Service (run on both local and hosted repositories)**
- A4‑1 through A4‑8 and A4‑10.
- Idempotent replay.
- Parallel confirm race, which must produce one claim and one confirmation.
- Delivery stale revision → OUTDATED with no fact revision written.
- Forced failure after the target write in the local journal → full rollback.
- Viewer and archived denial with zero rows written.
- Rejected proposal absent from Knowledge, Delivery, Actions and Weekly queries.

**Database**
- UPDATE on text or anchors fails.
- DELETE on any evidence table fails for the app role.

**End‑to‑end** at 390, 768, 1024 and 1440:
- Tab and focus flow with keyboard only.
- Axe scan with no violations.
- No horizontal overflow.
- Screenshots captured for rendered review.

## 9. Acceptance Criteria

1. A4‑1 through A4‑8, A4‑10 and A4‑11 pass in both local and hosted modes.
2. A4‑9 is tracked under P1‑10.
3. There is no canonical write without a confirm, supersede‑create or standard create command issued by a human.
4. Every canonical write goes through an existing target command and appends a history event in the same transaction.
5. Owner and stage are never inferred.
6. `can*` flags are server‑derived.
7. Rendered review and red team remain required before the capability is marked complete.

## Verdict

**FREEZE APPROVED** for P0‑4 as scoped above.

There are no blockers. The following are conditional deferrals:
- **Meeting notes:** flagged off until P1‑7 is frozen.
- **Open question target:** disabled, with those proposals discarded, until P1‑10 is frozen.

Codex must also confirm one assumption about the existing code: the Knowledge, delivery‑fact and action commands must accept an injected UnitOfWork (locally) and be callable as SQL functions (in hosted mode). If they cannot, add thin transactional wrappers only. Their policy logic must not change.