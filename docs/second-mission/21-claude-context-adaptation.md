# Minimum Context Adaptation: Review Decision

**Verdict: Approved. No blocker identified.** This rests on your stated interface facts, since no source or data was attached. The conditions below are clarifications, not new scope.

## 1. UX
- Both fields are optional and nullable. **contextId** is chosen from existing contexts filtered to the fact's workspaceId and initiativeId. **effectiveDate** uses a date picker and is not free text.
- NOT_COMPARED appears in a separate informational panel or projection. It never appears in runReview findings or counts.
- When a human changes applicability:
  - The UI shows the new record as UNVERIFIED.
  - The superseded record stays viewable and linked.
  - Evidence is flagged "needs re-verification."
- The new record displays no AI anchor and no verified badge.

## 2. Data
- There is no new table. Revision and context fields live in `delivery_facts.data` JSON: `contextId`, `effectiveDate`, `supersedes`, `supersededBy`, `status`.
- Every create or supersede writes an immutable `delivery_events` row with before/after JSON.
- There is no backfill. Existing facts stay null/null.
- **Condition:** `effectiveDate` must be canonical `YYYY-MM-DD`, with no time or zone. `contextId` is stored verbatim.
- **Fingerprint and claim digest:**
  - Keep the existing length-prefixed UTF-16LE SHA-256 encoder unchanged.
  - For null/null, the part list is unchanged, so output is byte-identical.
  - For non-null values, append labeled parts in a fixed order: `ctx:<id>` first, then `date:<YYYY-MM-DD>`, each included only if non-null.
  - Labels prevent collisions between context-only and date-only values.

## 3. Edges
- **Empty string:** reject or normalize it to null before persistence. Otherwise `""` would produce a new digest and break null-preservation.
- **Cross-scope context:** reject a contextId whose workspaceId or initiativeId doesn't match the fact.
- **Deleted or archived context:** keep the stored id and do not re-validate historic records.
- **Comparisons:** use strict equality only. null ≠ value, and null = null. There is no date ranges or overlap logic.
  - If either side has a non-null field and the other doesn't, or the values differ, the pair is NOT_COMPARED (informational). It never becomes one of the five frozen finding types.
- **Superseding a superseded record:** reject it. Only the current head of a chain can be superseded.
- **Final artifacts:** bytes are immutable. Revisions never regenerate or alter Final outputs.

## 4. Implementation
- Add a validator for normalization, scope checks, and date format.
- Extend the fingerprint and claim-digest builders with conditional labeled parts. Do not modify the encoder itself.
- The supersession service must do the following in one transaction:
  1. Mark the old record superseded.
  2. Create the new UNVERIFIED record with a null AI anchor.
  3. Copy evidence links flagged for re-verification.
  4. Write the event row.
- Keep the comparison predicate pure, and route mismatches to the NOT_COMPARED projection.
- runReview's taxonomy enum stays untouched.

## 5. Acceptance
- Null/null fingerprints and claim digests are byte-identical to pre-change golden values.
- The five finding types are unchanged, and NOT_COMPARED never appears in runReview output.
- A human applicability change yields:
  - an old record that is superseded and retained;
  - a new record that is UNVERIFIED with no AI anchor;
  - evidence that is linked and pending re-verification;
  - one immutable event.
- No schema migration and no backfill.
- Final bytes hash is identical before and after any revision.

## 6. Tests
- **Golden digests:** a corpus of existing facts yields identical fingerprints and digests.
- **Distinctness:** the ctx-only, date-only, both, and null/null cases give four distinct digests. Swapping values between labels changes the digest.
- **Normalization:** empty strings, malformed dates, and datetime strings are rejected or normalized.
- **Scope:** a cross-workspace or cross-initiative contextId is rejected.
- **Equality matrix:** null/null compares; value/value compares only when equal; mismatches go to the NOT_COMPARED projection only.
- **Taxonomy guard:** a snapshot of runReview finding types shows exactly the five.
- **Supersession:**
  - transaction atomicity, with rollback on event-write failure;
  - superseding a non-head record is rejected;
  - the new record has no AI anchor and no verified status, and evidence is flagged.
- **Events:** before/after JSON is present, and update/delete of the event row is denied.
- **Final immutability:** the Final artifact hash is unchanged after revision.

**Residual risk to verify against real source:** confirm the encoder accepts additional parts without changing its framing, and confirm no consumer parses `delivery_facts.data` with a strict schema that rejects the new keys.
Implementation clarification: Delivery uses its existing JSON facts/events and adds no revision table. Claims still require the nullable context_id/effective_date columns and same-initiative constraint specified in the original approved Minimum Context package (document16); migration0033 also extends the existing decision functions. No historic rows or Final snapshots are backfilled.
