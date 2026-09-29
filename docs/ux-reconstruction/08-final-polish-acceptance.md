# Final UX/UI polish pass — acceptance

**Integrated branch:** `prodwise/p1-core-operating-loop` at `a63764f` (Preview only; not promoted).
**Plan and decisions:** `07-polish-pass-plan.md`. **Adversarial reviews:** Devil Round 1 and Round 2 (reports in the session scratchpad, summarised below).

## Verdict

**UX/UI Finished for MVP with Minor Non-Blocking Items.**

The Devil's Round 2 recommended "Further Polish Required" because of six bounded Majors, and stated it would sign off at this verdict once they were fixed. All six are fixed and verified in the browser (below). No Blocker or Major is open. The remaining items are optional polish, listed at the end.

Promotion is **not** a UX question and is blocked on three owner steps (section "Before promotion").

## What was delivered

| Area | Result |
|---|---|
| Visual system | Semantic information-type tokens (decision, evidence, risk, dependency, schedule, target, progress, metric, freshness, review state); sheet tint with white panels; one stat-strip grammar; no hard-coded colours outside the appearance swatches |
| Light Mode | Less white-heavy: tinted working bands, stronger headings, fewer nested cards |
| Dark Mode | Designed through the same tokens; toggle in the account menu and My account; remembered per browser; Light default; verified on every surface |
| Filters | Visible check/radio, "choose any/one", per-facet Clear, count on the chip; Tab and Escape return focus |
| Home | Command centre: "Prodwise recommends" (grounded, 1–3, with why), attention band, Coming up strip, lifecycle strip, sparse setup queue |
| Initiative Brief | Lifecycle stepper, delivery row with the Roadmap's mark vocabulary, attention band, risks/decisions/open-work summary, de-duplicated sidebar |
| Weekly Review | Six distinct zones; unmistakable active initiative; unresolved attention prominent; one primary; honest stale copy |
| Roadmap | Validated on Demo dataset V4 (24 active initiatives, every requested state); sticky header aligned with the body; collision handling; Details collapsed |
| Analysis | Summary-to-detail hierarchy, coverage mini-bars, stale indicator, label collision handling, contracts collapsed; Missing is never zero |
| Metric setup | In-product define → review → confirm → record a period (or Not recorded with a reason); server-side authorization; local persistence; migration 0045 written |
| Administration | Organization · Members · Roles & permissions (derived from the real guards) · Integrations · Preferences · Security & access; Operator surface separate |
| Connectors | Plain-language recovery for every result code with Retry; Figma scopes verified in code |
| Notifications | Bell opens a quick-glance panel (For me/Everything, Unread only, grouped, click-through marks read, Mark all read, View all); full page is "View all" |
| Ask Prodwise | Docked with Search, Notifications and Help; panel from the top-right; bottom sheet on phones; grounded answers; English, Arabic and mixed; advisory only; preferences on My account |
| Brand | Mark with a pivot and lighter tile; orange only as a decorative numeral accent |

## Devil Round 2 Majors — fixed and verified

| # | Finding | Fix | Verified |
|---|---|---|---|
| 1 | Roadmap header 43px off the body grid at 1440 | Body labels clip at the canvas edge | Header and body scrollWidth both 1296 |
| 2 | Dark Mode Target diamond, scenario line, latest metric point ~1.2:1 | Marks use `--ink-navy`; checkboxes use the accent | Dark roadmap screenshot |
| 3 | Ask Prodwise dead-ends without a provider key | Only record-backed starters offered; the not-configured state shows them, no dead Retry | Home starters: "What should I do next?", "What am I missing?" |
| 4 | Metric capture time stored in server time | Read on the organization clock (Africa/Cairo) | Unit tests incl. DST |
| 5 | Metric form controls had no accessible name | Label id and help/error description on every control | `getByLabel` finds the fields |
| 6 | Open commitment shown with the Done ✓ | ○ for open, ▲ for late/blocked; no phone collision | Brief |

## Gates on `a63764f`

Typecheck clean · lint 0 errors · 546/546 unit tests · production build clean (no warnings) · browser acceptance 23/23 (after a dev recompile; first run 22/23 on a recompile abort) · privacy scan: no leaked files, no tracked private files.

## "Does Ask Prodwise look and behave like an intrinsic part of Prodwise, or like a generic AI chatbot added on top?"

**Intrinsic.** It is a tool in the top-bar cluster beside Search, Notifications and Help, opening from its trigger like the bell panel — not a floating bubble. It carries only the Prodwise mark and the label "Ask Prodwise"; no persona, provider name, sparkle or separate palette. Answers use the product's own record grammar ("Recorded", "Not recorded", "Pending confirmation", numbered recommendations identical to Home's), state what they are based on and when, label synthetic data, never write, and respect the person's role. With no provider it offers only questions it can answer from the record. The inside is still a question-and-answer thread with a composer — inherent to asking a question, and kept secondary. Round 2's own verdict was "intrinsic in placement and content"; its remaining objection (the unconfigured dead end) is fixed.

## Before promotion — owner steps (not done; production risk if skipped)

1. **Apply migrations `0045_metric_setup.sql` and `0046_user_preferences.sql` to hosted Supabase.** Without them, metric definition/observation and Ask Prodwise preference saving fail on Production (reads still work).
2. **Reset the hosted Demo to Demo dataset V4** (`scripts/demo/provision-hosted.mjs`, Demo organization only; AMAN untouched). The label in code says "Demo dataset V4"; the hosted Demo is still V3 and records its registry key, not the generation, so the label cannot follow the data. Promote only together with the reset.
3. **Provider key**: Ask Prodwise model answers need `ANTHROPIC_API_KEY`/`ANTHROPIC_MODEL` (already used by evidence reading in Production). The model path has not been exercised live; do one live question after promotion.

Also owner-dependent: Figma app scopes and one live connection; Nourhan Nahnoush's Organization Admin invitation (through Administration → Members; she sets her own password on acceptance; no generic password exists).

## Remaining non-blocking items

- Arabic answers still carry English list items; arrows point right in RTL.
- Lifecycle bar and Brief stepper encode stage by colour position (the legend and labels carry the meaning).
- READY green reused for setup coverage and the organization "Active" pill in member views.
- Home attention legend counts initiatives under a header that counts reasons.
- Brief tiles truncate at 1440 on long values; delivery-row label clipped at 390.
- Weekly Review: overdue commitments not marked in the frozen record; long finalize checklist.
- Search palette does not say it searches initiatives and pages only.
- Home stat strip leaves an empty cell at 1024.
- Ask Prodwise rate limit is per server instance (documented, D15).
- Brand mark can still read as a spinner at 16px next to a real spinner.

## Release log — 29 Sept 2026

| Step | State |
|---|---|
| 1–2 Migrations | **Applied to hosted** (`qhtlbjtbjidflsquvbbg`): `0045_metric_setup`, `0046_user_preferences`. Verified: hosted list ends 0043 · 0044 · 0045 · 0046 (no drift against the repository); three functions present; execute granted to `service_role` only (not `anon`/`authenticated`); RLS on; `users.preferences` defaults to `{}`. Security advisors: nothing new (deny-all RLS by design; the pre-existing "leaked password protection disabled" Auth setting remains an owner setting). Proven first on a fresh local replay of all 46 migrations and 18 SQL proof suites. Production (`0541fef`) kept serving normally after the change. |
| 3 Demo V4 reset | **Waiting on the owner.** The approved operator flow (`scripts/demo/provision-hosted.mjs --dry-run --reset`, then `--apply --reset`) needs the private operator configuration and the private registration of the active hosted Demo, which are on the owner's machine. The V4 reset path is proven on a fresh local database (26 isolated initiatives per generation, reviewer identity reused, prior generation archived, no deletes). |
| 4–11 | Pending on step 3 and promotion. |

The hosted operator proof now expects V4 (26 initiatives per generation). The V3-only additive metrics path is retired from the replay: a V4 generation carries its own metrics through the reset.
