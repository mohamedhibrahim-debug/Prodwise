# Prodwise — remaining scope and execution plan (canonical)

This is the authoritative record of the user-approved remaining scope and its order.
It supersedes chat context. Later phases never start before earlier ones are complete.

## Execution order (strict)

| # | Phase | Status |
|---|---|---|
| 1 | Finish current mission: Relationships/Dependencies, Initiative History, Risks & Open Questions, organization-aware sign-up, darker/clearer UX direction, UX specialist review, independent red-team — all Blocker/Major fixed | Complete |
| 2 | Realistic Demo / data enrichment (sanitized synthetic portfolio) | In progress |
| 3 | Real connector layer: **Jira → Gmail → Google Drive / Docs → Figma** | Not started |
| 4 | Notifications / Attention Center (in-app) | Not started |
| 5 | Perceived performance / interaction responsiveness | Not started |
| 6 | Error states & edge-case hardening | Not started |
| 7 | Final product polish / forgotten details | Not started |
| 8 | Production readiness & trust sweep | Not started |
| 9 | Final full acceptance (+ final UX review and fresh red-team) | Not started |
| 10 | Final candidate (push to `prodwise/p1-core-operating-loop`, verify remote SHA, no force-push) | Not started |
| 11 | Deploy exact tested candidate (non-destructive migrations) | Not started |
| 12 | Production smoke + final report (verdict: READY FOR DEMO / READY WITH ONE MANUAL STEP / BLOCKED) | Not started |

## Phase 2 — Demo enrichment rules
- Learn only *patterns* from authorized Jira / Drive / Gmail. Never copy real names, emails, keys, URLs, figures, customer/merchant names or wording. No raw source excerpts in Git, fixtures, screenshots, logs or prompts.
- One canonical synthetic truth model: every number on every surface derives from canonical records.
- Target density (coherence over volume): 12–16 initiatives (one archived example), 35–60 sources, 50–80 Knowledge records, 10–20 decisions across lanes, 15–25 commitments, 8–15 risks, 8–15 open questions, 6–12 relationships, multiple weekly reviews, meaningful history, trustworthy analysis data.
- Stories: A (document requirement superseded by email), B (delivery slip → target revision → dependency attention), C (meeting notes → proposals → selective confirmation), D (conflict deferred → new evidence → reopened), E (overdue commitment → attention → completed).
- Privacy review before commit. Enriched dataset is used for all later performance measurements.

## Phase 3 — Connector principles (all connectors)
- Real integrations only; no fake connector behaviour. Manual structured references remain the fallback.
- External data enters as **Source / Evidence**, then Evidence → Proposal → Human confirmation → canonical truth. Never automatic Product Truth.
- Explicit selection / scoped search only; many external objects may map to one initiative; preserve key/URL/metadata, source role, freshness, manual refresh.
- Handle disconnect, expired token, missing permission, deleted/renamed/updated source, sync failure, retry. Never expose or log tokens. No cross-organization leakage.
- If OAuth credentials or callbacks need manual configuration, report the exact manual step; do not fake success.

### 3a Jira (first)
Read-first delivery evidence: connect workspace, choose project(s), search/browse, multi-select, map to initiative with role/context, key + URL, last synced, manual sync. Signals: status, progress, milestones, blockers, dependencies, changed dates, meaningful activity. Jira status is never translated into Prodwise truth without confirmation where interpretation is needed.

### 3b Gmail
Read-only. Scoped search, explicit thread/message selection, safe sender/date/subject metadata, source role, freshness. Never ingest a whole mailbox; never send email.

### 3c Google Drive / Docs
Search/browse, multi-select, file metadata, version / modified time, last checked, manual refresh. Explicit selection only.

### 3d Figma (approved; implement after Jira, Gmail, Drive)
Role: **design evidence / product definition**.
- Figma is a structured Source, not a design editor.
- Map files / pages / frames where authorized; many Figma objects may map to one initiative.
- Preserve direct links and useful metadata.
- Comments may be evidence only when relevant and scoped.
- Figma changes are evidence / change signals, **not** automatic Product Truth. Design approval is never inferred from a changed frame.
- Human confirmation is required before canonical Product Truth changes.
- Integrate Figma evidence into Brief, Knowledge, Decisions, Weekly Review, History, and Notifications where meaningful.
- Respect file/workspace permissions and organization boundaries; never expose access tokens or private data.
- Support manual structured Figma references if live-connector limitations remain.

## Phase 4 — Notifications / Attention Center
In-app only. Meaningful canonical events (conflicts, source changed, decision reopened, action overdue / due soon, target moved, dependency risk, risk opened, question overdue, approval evidence arrived, Weekly Review due, setup incomplete, connector failure). Deduplicated, grouped, organization-scoped, owner-aware; unread/read, mark all read, deep links, type filter, timestamps.

## Phases 5–8 (summary)
- **5 Responsiveness:** immediate click feedback, persistent shell, selective prefetch, progressive destination loading, safe optimistic UI (never for Product Truth/permissions/destructive actions). Measure click → feedback / context / content / settle on the enriched Demo (baseline recorded before enrichment).
- **6 Error states:** what happened → why (when safe) → what now; preserve input (React 19 form reset must not wipe drafts); no stack traces, DB errors, internal IDs or secrets; retry and recovery obvious; accessible.
- **7 Polish:** brand/logo, Guide/Help critique, micro-UI, copy, icons, quiet states, level consistency, 390px mobile, accessibility, "what did we forget".
- **8 Trust sweep:** deterministic Demo reset/reseed (never affects AMAN), search sanity, auditability, archived-data exclusions, 404/unauthorized/session-expired surfaces, diagnosable runtime errors without secrets, privacy scan.

## Known manual steps (production)
- Supabase Auth → URL configuration must allow `https://prodwise-flax.vercel.app/signup/verify`.
- Supabase Auth email templates should link to `/signup/verify?token_hash={{ .TokenHash }}&type=…` so link scanners cannot consume one-time tokens; configure custom SMTP for real onboarding volume.

## Open product decision
P0 lets a Platform Owner without a membership write an organization's product records (tests + SQL 0012). This is kept, and such writes are now labelled "(Platform Owner, not a member)" (migration 0038). Whether it should become read-only is the user's decision.
