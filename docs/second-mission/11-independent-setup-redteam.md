# Independent Setup / Lifecycle / Ownership red-team

Scope: fresh browser review of P0-1/P0-2 and their source-mapping/context surfaces after Claude rendered APPROVE round 2. This is **not** the final Second Mission red-team or a production-readiness verdict.

## Current verdict: PASS for the scoped browser checks — RT-SETUP-01 closed after retest

No blocker or canonical data overwrite was observed. The one major safe-editing UX defect identified below is now closed after the final fresh browser retest. Historical findings and earlier failed retests are retained for traceability.

### RT-SETUP-01 — Major: stale source role submission discards the user's draft

Reproduction on a newly created synthetic initiative in Independent Review Lab:

1. Open Manage in two tabs and open Change source role in both.
2. Tab A saves a new role with a reason.
3. Tab B selects Requirements and enters a distinct reason, then saves its stale revision.
4. The server correctly refuses the stale write with “This source mapping changed. Reload and review before saving.”
5. Tab B's selection resets to its previous role and its reason becomes empty. The proposed change cannot be reviewed or reapplied without reconstructing it.

Observed twice: requested REQUIREMENTS reset to DELIVERY, then DECISIONS. The current canonical role remained the newer confirmed role. This is draft-loss, not a lost canonical update. Preserve the proposed role and reason across rejected action results, and provide a deliberate reload/review path.

Evidence: `.data/second-mission/redteam-source-conflict.png`, `independent-setup-conflict.json`, `independent-setup-security.json`. Scripts of the corresponding names reproduce the checks. No credentials were captured in screenshots or reports.

## Fresh browser results

First run: **19/19 checks passed**, zero harness errors. Follow-up security: **4/5 passed**, the sole failure is RT-SETUP-01.

- Member creation fixes initial owner to self and saves progressive setup.
- Explicit Unknown appears separately from Missing.
- Manage Initiative is directly discoverable from the initiative experience.
- Member owner cannot reassign ownership or archive.
- Manage has no horizontal overflow at 390 / 768 / 1024 / 1440.
- Axe WCAG 2 A/AA + 2.1 AA on Manage: **0 violations**.
- Two-tab stale basics save is rejected; losing draft and newer canonical objective survive.
- Organization administrator has an initial scoped owner selector.
- Archive opens a labelled modal with initial heading focus.
- Archived Member view exposes no basics/source write controls.
- Archived initiative leaves the active register, remains in the archived filter, and restores with its objective intact.
- Viewer sees no ownership/source/archive/edit controls; direct `/initiatives/new` is read-only.
- Replay of an actual Member server-action request under a Viewer session returns an application-level access refusal (transport HTTP 200), without changing canonical basics.
- Two-tab stale owner save is rejected.
- Two-tab stale source role save is rejected and newer canonical role is preserved; losing form draft fails as above.

## Evidence / test boundary

All writes were limited to new synthetic initiatives in **Independent Review Lab** on `http://localhost:3216`. The administrator account defaults to local AMAN, so the test explicitly switched and waited for the Independent Review Lab organization label before any write. External browser requests were blocked by the harness. No production, deployment, migration, app source, or existing finalized review was changed.

Screenshots: `.data/second-mission/redteam-manage-{390,768,1024,1440}.png`, `redteam-archive.png`, `redteam-viewer.png`, `redteam-source-conflict.png`.

The first test attempt omitted optional scope on creation; delivery correctly remained disabled until a current scope exists. The corrected test entered its synthetic scope. This was a harness setup omission, not a product failure.

A foreign-slug isolation probe was discarded: existing fixtures intentionally reuse slugs across organizations, so seeing a same-named local fixture is not evidence of cross-organization access. No unique foreign slug existed for that probe. Broader organization isolation and context tampering remain required in the final integration gate.

This scoped browser review does not establish immutable Final preservation byte-for-byte, hosted database authorization, the full Ready/lost-readiness history journey, or every role/context combination. Existing SQL/unit evidence may support those separate gates; it is not represented here as fresh browser coverage. No full-mission approval is implied.

## Retest after controlled draft state change

Fresh two-tab browser retest still returns **REVISE** for RT-SETUP-01. The stale write remains correctly blocked. The rationale now survives (`Keep this losing draft reason`), but the selected role changes from requested REQUIREMENTS to GENERAL after rejection. Native form reset appears to reset the DOM select despite the controlled React draft value; the exact mechanism should be verified during the fix.

Latest evidence: `.data/second-mission/independent-setup-conflict.json` and `redteam-source-conflict.png`. The retest changes the winning tab to a different role each time, avoiding an unchanged-value/no-op submission. The textarea is inspected by its `name=reason` field selector after the error.


## Final retest — RT-SETUP-01 CLOSED

After the explicit form-reset prevention fix, the same fresh two-tab browser scenario passed:

- Requested role: REQUIREMENTS.
- Role after stale rejection: REQUIREMENTS.
- Reason after stale rejection: `Keep this losing draft reason`.
- Server response remains: “This source mapping changed. Reload and review before saving.”
- Harness errors: 0.

Both proposed fields now survive the rejected write, and the stale write remains refused. Latest evidence is saved in `.data/second-mission/independent-setup-conflict.json` and `redteam-source-conflict.png`.

Current scoped browser verdict: **PASS**, with no remaining blocker/major among the executed checks. Earlier coverage limitations remain unchanged; this does not replace the final whole-mission integration, isolation, or production-readiness gates.
