# P0-6 Minimum Context: Implementation Package

## 1. UX/Product Contract

**Applies-to row**
- **Where:** Knowledge create, delivery-fact edit and proposal confirm.
- **Fields:** a Context picker (the initiative's controlled contexts plus "No specific context") and an optional Effective date.
- **Default:** the current context is pre-filled and visible, and the user can clear it.
- **Mobile:** the row is a disclosure, "Applies to: {name|No specific context} ▸", that opens a sheet with the same fields.

**Picker states**
- **No contexts, authorized user:** "No contexts yet — [Create context]", using existing A1.12 authority.
- **No contexts, other users:** "No specific context" only.
- **Retired context:** shown as "{name} (retired)". It displays on existing records but is excluded from selection for new records.

**Chip on claims and facts**
- **Format:** "{context} · from {D MMM YYYY}". Variants are context-only "{context}" and date-only "from {date}".
- **Null/null:** no chip.
- **Click:** opens Knowledge filtered by `context_id`.

**Not-compared line**
- **Copy:** "{n} claims about {attribute} weren't compared: applicability differs or isn't recorded. [Review]"
- **Placement:** Knowledge, and the attention area of the Brief.
- **Styling:** neutral info style. It is never green and never counted in the healthy total.
- **[Review]:** opens the claim pair.
- **Inside comparisons:** a null side reads "Context not recorded".

**Roadmap:** Target Live markers carry a context label. A marker click opens the delivery-fact history.

**Old Finals:** rendered from stored bytes with no chip injection.

**Permissions**
- The row inherits the host action's write authority. Viewer sees read-only chips.
- Context create and rename follow A1.12 unchanged.

## 2. Data Model Changes

**Migration** (additive, nullable, no backfill):

```sql
-- prerequisite if absent
ALTER TABLE initiative_contexts ADD CONSTRAINT initiative_contexts_init_id_uk UNIQUE (initiative_id, id);

ALTER TABLE claims ADD COLUMN context_id uuid NULL, ADD COLUMN effective_date date NULL;
ALTER TABLE claims ADD CONSTRAINT claims_context_fk
  FOREIGN KEY (initiative_id, context_id) REFERENCES initiative_contexts(initiative_id, id);
-- identical pair for delivery_fact_revisions
```

- **Composite FK:** a composite FK with MATCH SIMPLE allows `context_id` to be NULL and enforces same-initiative otherwise, which satisfies A6-6.
- **Assumption:** `delivery_fact_revisions` already carries `initiative_id`. If it does not, see the blocker note at the end.

**Types**
- Add `contextId: string | null` and `effectiveDate: string | null` (`YYYY-MM-DD`) to the Claim and DeliveryFactRevision domain types.
- Update RPC signatures to match.
- Do not use `Date` objects for `effectiveDate`.

**Digest**
- **TS `contentDigestOf`** and **SQL `decision_hash`**: if both fields are null, the input is unchanged.
- Otherwise append `SEP+"ctx="+lower(uuid|"")+SEP+"eff="+(date|"")`, where SEP is the encoder's existing separator (`\u001f` if that is baseline).
- **SQL date formatting:** use `to_char(effective_date,'YYYY-MM-DD')`, never `::timestamptz`.

**Finals**
- The new `schemaVersion` (G10) adds `contextId`, `contextName` and `effectiveDate` to claim and fact entries.
- Existing Finals are untouched.

## 3. Exact Edge Cases

| Case | Result |
|---|---|
| Both contexts null, both dates null | Compared (baseline behaviour) |
| One context null, other set | Not compared, plus Not-compared line |
| Same context, one date null | Not compared |
| Same context, different dates | Not compared |
| Retired context vs same retired context | Compared as equal |
| Different contexts, same value | No conflict (values equal anyway) |
| Superseded side | Excluded, as before |
| Cross-initiative `context_id` | FK violation, surfaced as a validation error with no write |
| Retired context submitted on a new record | Rejected server-side, not only hidden in the UI |
| Context/date change on a claim | New revision via supersession with `expectedRevision`; a stale revision triggers the G4 conflict |
| Effective date 2026-12-31 in a UTC±14 client | Stored and digested as `2026-12-31` |
| Uppercase UUID input | Lowercased in the digest |
| Proposal confirm with context pre-filled then cleared | Persists NULL |
| Context renamed | Chip shows the new name. Digest uses the id, so it is unchanged. Finals keep the stored name. |

## 4. Implementation Notes

**Comparison and review**
- Add the context/date equality clause to the shared comparison predicate in the pure `runReview`, and to any SQL equivalent.
- Keep the predicate a strict narrowing of today's match: no new match paths.

**Not-compared items**
- `runReview` emits them as `{type:'NOT_COMPARED', claimIds:[a,b]}`.
- A pair qualifies when every clause except the applicability clause holds.
- They are informational only: excluded from health totals and never passed to FindingState conflict creation.
- `applyFindingStates` is unchanged. Null/null fingerprints and `contentDigest` are identical, so existing decisions persist.

**Writes**
- Repository writes stay org-scoped.
- The RPC validates that the context is not retired for new records.
- The FK validates the initiative.
- The immutable activity history entry records `context_id` and `effective_date` on the revision event.

**Local paired journal:** carries the two fields verbatim as strings.

**Rendering**
- Roadmap groups markers by `(context_id, fact)`.
- Old Final renderers must not read the live context tables.

## 5. Acceptance Criteria

- **A6-1:** Phase 1 = 15 Oct and Phase 2 = 31 Mar raise no conflict. Two differing Phase 1 values raise a conflict.
- **A6-2:** Phase 1 vs null raises no conflict and shows the Not-compared line (neutral, not counted healthy).
- **A6-3:** TS and SQL digests are equal on at least 20 fixtures covering null/null, context-only, date-only, both, and 2026-12-31 under non-UTC process and DB timezones.
- **A6-4:** All baseline null/null fixture digests equal `4623810d` values. After migration, zero previously decided findings re-emerge.
- **A6-5:** Every pre-migration Final is byte-identical, compared by stored-hash equality.
- **A6-6:** A cross-initiative `context_id` is rejected by the database.
- **Additional criteria (from the approved contract):**
  - Retired contexts are non-selectable for new records.
  - Viewer cannot edit applicability.
  - A context change creates a new revision.
  - A stale `expectedRevision` triggers a conflict.

A6-3 and A6-4 are release gates.

## 6. Targeted Test Matrix

| # | Layer | Test |
|---|---|---|
| T1 | Unit, `runReview` | Predicate truth table across contexts {null, A, B, A-retired} × dates {null, d1, d2} |
| T2 | Unit | Not-compared emission and exclusion from health |
| T3 | Parity (TS↔SQL) | 20+ fixtures, run with TZ=Pacific/Kiritimati and TZ=Pacific/Pago_Pago, DB timezone varied |
| T4 | Golden | Baseline null/null digests equal `4623810d` snapshot |
| T5 | Migration | Seeded decisions: no FindingState reopens after migrate plus review |
| T6 | Migration | Final bytes and hashes are unchanged |
| T7 | DB | Cross-initiative FK rejects; null accepted; retired rejected via RPC |
| T8 | Integration | Context change goes through supersession; stale revision returns G4 conflict |
| T9 | Permissions | Each role on the three host writes; Viewer read-only; Create-context link only when authorized |
| T10 | E2E | Pre-fill and clear; retired suffix; mobile sheet; chip filter link; [Review] opens pair; Roadmap marker opens history |
| T11 | Snapshot | New-schema Final includes context; old Final renders with no chip |
| T12 | Journal | Round-trip preserves the fields as strings |

**FREEZE APPROVED.** This is conditional on one pre-coding check. If `delivery_fact_revisions` lacks `initiative_id`, the composite FK cannot be built as written. In that case, derive `initiative_id` through a validating trigger or check function rather than adding scope; this becomes a blocker only if neither approach is acceptable.