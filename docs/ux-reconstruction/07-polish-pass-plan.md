# Final UX/UI polish pass — implementation plan

Approved scope: the owner's polish brief (29 Sept 2026), consolidated with `01-independent-audit.md`, `02-devil-review.md`, `03-final-ux-acceptance.md` and `06-known-ux-issues-and-polish-plan.md`. Already-fixed findings (popovers, account menu, double headers, Roadmap canvas, button system, filters-as-forms) are not reopened.

Operating rules: accepted behaviour is preserved; Evidence → Proposal → Human confirmation → Truth is untouched; no AMAN data is invented; synthetic Demo data is labelled; every colour and visual carries meaning; stages are committed and gated separately; Production is promoted only from a fully gated stage.

## Stages

### Stage 1 — Design-system foundation
- Semantic visual roles in `tokens.css`: information-type tokens for decision · evidence/provenance · risk · schedule · target · progress · freshness · metric · dependency · attention · review state. Each maps to hue + glyph, never colour alone.
- Light Mode rework: a warmer, less white-heavy sheet; tinted section surfaces (`--surface-tint-*`) for grouped areas; stronger heading contrast; fewer nested cards (shared `Section` and stat-strip grammar).
- Dark Mode foundation: `:root[data-theme="dark"]` token overrides (designed, not inverted); boot script + persisted preference (browser storage, same pattern as the rail); Light default; toggle in the account menu and on Account.
- Remove the 28 hard-coded colours from CSS modules.
- Filter selected states (F-1): visible check glyph, selected row styling, "Clear" in the menu, count on the chip; keyboard/Escape/focus verified. Tab in a menu returns focus to the trigger (F-2).
- Shared grammar: one stat-strip component, one page-header pattern, one disclosure chevron, one status glyph set, one setup/progress meter.

### Stage 2 — High-impact product surfaces
- Weekly Review: six distinct zones (selection · record at cutoff · unresolved attention · commentary · updates · finalization); the active initiative is unmistakable; unresolved decisions/blockers get the attention surface; per-section review-state glyphs in the navigator; action row fixed; honest "update required" copy. Both themes.
- Home: command-centre composition from existing data — attention band (proportion + reason split), next-28-days strip, lifecycle strip, next-action queue, "since last review" changes; sparse-data setup queue with direct links instead of repeated empty messages.
- Initiative Brief: lifecycle stepper, delivery timeline row (reusing the Roadmap row renderer), attention band, current stage / next step / target-vs-actual block, risk & decision summary; sidebar de-duplicated. E-1, m1, m2, m4, m5, E-2/C-2 included.

### Stage 3 — Data-heavy surfaces
- Demo generation v4 (synthetic, labelled "Demo dataset V4"): ~24 active initiatives across owners and business lines exercising every Roadmap state listed in the brief, plus populated metrics covering every Analysis condition listed. Validated locally first.
- Roadmap: validate under v4 (truncation, marker collision, grouping, dense periods, unscheduled lane, "what changed"); fix what the validation shows. No redesign.
- Analysis: summary-to-detail hierarchy (compact portfolio summary, collapsed contracts, jump navigation), label collisions, empty-space fix, shared stat-strip language. Missing is never zero.
- Metric setup workflow: in-product definition (name, definition, unit, formula, source + evidence link, period grain, timezone), explicit target approval (approver, date, note), review-and-confirm step before the definition exists, observation entry with "Not recorded" periods. Server-side authorization; one migration (RPC) for the hosted path; local JSON path for local auth.

### Stage 4 — Administration and integrations
- Administration IA: Organization · Members · Roles & permissions · Integrations (where connections live and why they are personal) · Preferences (appearance, workspace name) · Security & access (policies, dangerous actions with confirmation). Platform console becomes an explicit Operator surface. Role explainer for Owner / Admin / Member / Viewer. Existing actions and authorization unchanged; only routes gain sections.
- Figma: verify the code-side scopes and production configuration; plain-language failure recovery on Connections with retry; one live end-to-end connection after the owner corrects the Figma app configuration.

### Stage 5 — Brand, responsive and accessibility polish
- Mark at small sizes, sidebar logo, wordmark, login usage, favicon; orange as non-semantic identity accent (arc motif, section numerals, login geometry).
- 390 px pass: initiative tab overflow cue, connector chooser, long Analysis pages, dense tables, dialogs, dropdowns, Roadmap labels; horizontal-scroll discoverability.
- Accessibility audit: focus visibility, tab order, Escape, dialog/menu semantics, muted-text contrast, compact controls, disabled states.
- Notifications: semantic overdue/attention treatment without making the feed shout; "new for me" vs organization-wide kept.

### Stage 6 — Ask Prodwise (mini assistant, §19 / §19.X)
Implemented only after the sizing below is accepted as bounded. Home's "Prodwise recommends" section (§19.8) is built in Stage 2 from the deterministic recommendation engine, without any provider call.

### Stage 7 — Operational account setup
- After Stage 4 is accepted: an Organization Admin invitation for Nourhan Nahnoush (nourhan.nahnoush@aman.eg) through the product's invite flow. She sets her own password on acceptance; no generic password exists. Admin cannot remove the Owner, transfer ownership, delete the organization or perform Owner-only actions (verified against `roles.ts` and the owner-only guards).

### Final acceptance
Includes the explicit design question: "Does Ask Prodwise look and behave like an intrinsic part of Prodwise, or like a generic AI chatbot added on top?" — a chatbot answer fails the assistant.
Fresh review of every surface listed in the brief, both themes, populated states, representative responsive states; findings as Major / Minor / Cosmetic; verdict without a score.

## Gates after every stage
`tsc --noEmit` · `eslint` (0 errors) · `npm test` · production build · browser acceptance (`scripts/e2e/acceptance.mjs`) · screenshots at 1440 and 390 in both themes · privacy scan · commit and push (Preview only; promotion is the owner's step).

## Decisions and dependencies for the owner

| # | Item | Proposed default (used unless overruled) | Blocks |
|---|---|---|---|
| D1 | Appearance preference storage | Per-browser (like the sidebar), no schema change; Light default; Light/Dark only | — |
| D2 | Metric setup authorization | Definitions and observations: initiative owner, Admin, Owner or Product Lead. Targets require a named approver and approval date. A definition exists only after an explicit confirm step. Needs one migration applied to hosted Supabase | Stage 3 hosted path |
| D3 | Demo v4 in Production | Built and validated locally first; the hosted Demo is reset to v4 only on explicit approval (Demo organization only; AMAN untouched) | Stage 3 production validation |
| D4 | Figma app configuration | Owner sets scopes `current_user:read`, `file_content:read`, `file_comments:read` in the Figma app; live test needs the owner's Figma account | Stage 4 live test |
| D5 | Nourhan's invitation | Created by the owner in the new Administration → Members (validates the flow) or by me on request; the link is shared privately, never written anywhere | Stage 6 |
| D6 | Production promotion cadence | Promote after Stage 2 and after final acceptance; earlier stages stay on Preview | — |

## Ask Prodwise — sizing and proposed architecture (§19.15)

### A. Existing reusable capabilities
- **Claude provider pattern:** `src/lib/delivery/ai.ts` (`draftWeeklyWording`) and `src/lib/evidence/extract.ts` (`extractEvidence`, `modelJson`) — direct `fetch` to the Messages API, `ANTHROPIC_API_KEY` / `ANTHROPIC_MODEL`, `isClaudeConfigured`, timeouts, honest fallbacks, `stop_reason` checks, tolerant JSON parsing, no provider text surfaced. The assistant reuses this call shape and its refusal codes.
- **Authorization and scoping:** `requireWorkspaceAccess`, `readDelivery()` (returns `ctx` with workspace, organization, member, role, platform role), `canBusinessWrite`, `hasOrganizationAdminAuthority`, Demo guest detection. Every page already reads through these; the assistant's context builder calls the same functions, so it can only see what the page would render.
- **Context APIs:** `buildPortfolioProjection` (attention reasons with hrefs, setup coverage, upcoming targets, target movement, changes since the last Final), `ownerAttention`, `portfolioPulse`, `homeChanges`, `deriveReadiness` (setup requirements with labels and hrefs), `finalizationChecks`, `weeklyContextDelta`, `listProjectMetrics` + `metricCoverage`, risks/questions/relationships readers.
- **Recommendation-like logic:** attention ranking (decision → blocker → past target → past milestone → dependency → support changed), setup "next requirement", proposal counts, overdue commitments/questions, stale metrics (`lastCaptured`). These are the grounded inputs for Next Best Actions.
- **Design system:** `Popover`/`FloatingLayer` (portal, collision-aware, bottom sheet ≤780px, focus return, Escape), `Button`, `StatePill`, `EmptyState`, `BrandMark`, `InstrumentIcon`, `StatStrip`, tokens for Light and Dark, `safeMessage` for error copy, `unicode-bidi: isolate` already global.
- **Language:** none yet. There is no i18n layer; the assistant needs its own detection and bidi handling only.

### B. New backend work
- `src/lib/assistant/context.ts` — builds a bounded, authorization-scoped context for the current screen (org, initiative, tab, confirmed Knowledge titles/values, evidence metadata, pending proposal counts, decisions, risks, questions, commitments, delivery facts, roadmap state, metrics and freshness, review state, recent confirmed changes). Reads only through the existing scoped readers; never connector payloads, never platform data.
- `src/lib/assistant/recommend.ts` — deterministic Next Best Action engine (1–3 actions with *why* and href) shared by Home and the assistant. Pure, unit-tested, no provider.
- `src/lib/assistant/starters.ts` — per-screen starter actions (Home, Initiative, Roadmap, Analysis, Weekly Review, Administration).
- `src/lib/assistant/language.ts` — Arabic/English/mixed detection; answer-language choice (Auto/EN/AR); pure, unit-tested.
- `src/lib/assistant/answer.ts` — the provider call: system prompt fixing scope (Prodwise only, advisory, facts vs missing vs pending vs recommendation), context as structured data, the user's question, effort low, 25s timeout, 600-token answer cap, output validated as plain text + optional navigation links limited to hrefs present in the context. Out-of-domain → fixed redirect line in the user's language.
- `POST /api/assistant` — authenticated route; per-user rate limit; returns `{answer, language, links, recommendations}` or a refusal code; logs only code, status and duration.
- Preferences: read/write of the assistant preferences (show, language, open behaviour, proactive).

### C. New frontend work
- `AskProdwise` client surface: collapsed control (compact Prodwise mark in a quiet pill, bottom-right, 44px, never over primary CTAs — page padding reserves the space), open panel (390px, max 72vh desktop; bottom sheet 90dvh on phones using the existing sheet pattern; keyboard-safe via `dvh` and scroll-into-view).
- Panel content: context header (screen/initiative and status), starter chips, message list with per-message `dir` and `lang` and `unicode-bidi: isolate` around technical tokens, input with Enter/Shift+Enter, loading skeleton, error + retry, "Based on" record links.
- Preferences UI: Account → "Ask Prodwise" section; account menu show/hide.
- Home "Prodwise recommends" section (Stage 2, deterministic).

### D. Data / model changes
- One column: `users.preferences jsonb not null default '{}'` (migration + local JSON equivalent) for the four assistant preferences, per user across devices. Appearance stays per browser (already decided).
- No conversation persistence in the MVP: a session's thread lives in the panel's memory and is discarded on reload.

### E. Security implications
- Context is assembled server-side from the caller's own `ctx`; the route never accepts identifiers it does not re-authorize. Cross-organization reads are impossible by construction (same readers as pages). Platform/operator data and other users' connector data are excluded explicitly.
- Prompt, context and answers are never logged; only codes, HTTP status and duration. Provider bodies are not surfaced. Evidence text is treated as untrusted content in the prompt (same instruction as evidence reading).
- Advisory only: the route has no write path. Navigation links are validated against hrefs the context produced.
- Rate limit per user (e.g. 20 questions / 10 min) to bound spend; Demo guests share a lower limit.
- Demo organization: allowed (synthetic data), labelled.

### F. Token / model usage
- Per question: system ≈ 700 tokens (cacheable), context 2–5k tokens (bounded lists, titles not bodies), answer ≤ 600. Roughly 3–6k input + ≤0.6k output per question at low effort; one call per question, no tool use, no streaming in the MVP (a 25s bound with an honest retry state).
- Home and starters cost nothing: deterministic.

### G. Complexity
Medium. ~2,000–2,500 lines including tests; ~1 stage of work after Stages 1–5, comparable to the connector import experience.

### H. Risks and unknowns
- Arabic answer quality and mixed-script rendering across browsers (mitigated by per-message direction and isolating technical tokens; verified with fixtures).
- Hallucinated recommendations — mitigated by letting the model *explain* deterministic recommendations, never invent them; the prompt forbids adding actions.
- Provider latency from lhr1 and the 25s bound; the panel must stay usable while waiting.
- Mobile keyboard behaviour with a bottom sheet.
- Rate-limit storage on serverless (per-instance memory is not shared): MVP uses a DB-backed counter or accepts best-effort per-instance limiting — decision D7.

### I. Proposed MVP boundary
The six capabilities in §19.6 (explain, summarize, missing, next best action, weekly-review preparation, navigation help); starters per screen; EN/AR/mixed with Auto; preferences; Light/Dark; desktop panel + mobile sheet; Home recommendations; all advisory.

### J. Deferred to Phase 2
Draft actions (create a proposal from a suggestion), conversation history, streaming, proactive push beyond a quiet badge, voice, cross-organization search, any write, any connector write, tool use.

### Identity rules (§19.X)
Label "Ask Prodwise"; no persona, no provider name in the UI; existing mark, navy/teal, orange only as the existing decorative accent; existing components and tokens; the same identity in Arabic and English; voice: concise, structured, factual ("What needs attention", "Why it matters", "Recommended next action", "Based on", "Not recorded", "Pending confirmation").

| # | Decision | Proposed default |
|---|---|---|
| D7 | Rate-limit storage | DB-backed counter table on hosted; in-memory locally |
| D8 | Assistant preferences storage | `users.preferences jsonb` (one migration) |
| D9 | Demo guests | Allowed with a lower limit; answers labelled synthetic |

## Execution: waves and workstreams (source of truth for ownership)

Wave 1 — shared foundations: **done** (`e673451`): tokens and semantic roles, Light rework, Dark Mode + preference, filter selection, StatStrip, `src/lib/assistant/recommend.ts` (deterministic Next Best Actions).

Wave 2 — parallel product surfaces, each in its own worktree from the same base:

| Agent | Owns (may edit) | Must not edit |
|---|---|---|
| B — Core product experience | `src/app/page.tsx`, `src/app/home.module.css`, `src/app/initiatives/[slug]/page.tsx` + `brief.module.css`, `src/app/weekly-review/**`, `src/components/weekly/**`, `src/components/initiative/OverviewBlocks*`, `src/app/notifications/**`, `src/components/shell/CommandPalette*` (polish only), `src/components/shell/WorkspaceTabs.tsx` (m4/m5), `src/lib/assistant/recommend*` (consumer fixes), new `src/components/workspace/LifecycleStrip*`, `src/components/initiative/DeliveryRow*` | tokens/global/controls CSS, Popover, StatStrip, Roadmap, Analysis, admin, connectors |
| C — Planning & measurement | `src/components/roadmap/**`, `src/lib/workspace/roadmap-layout*`, `src/app/roadmap/**`, `src/app/analysis/**`, `src/components/analysis/**`, `src/lib/analysis/**`, `src/lib/demo/**` (v4 generation), `scripts/demo/**`, new migration `supabase/migrations/0045_*.sql` (metric setup), new metric actions | tokens/global/controls CSS, Popover, StatStrip, Home/Brief/Weekly, admin, connectors |
| D — Administration & integrations | `src/app/administration/**`, `src/app/platform/**`, `src/app/users/**`, `src/components/admin/**`, `src/app/account/connections/**`, `src/components/connectors/**`, `src/lib/connectors/**` (recovery copy, scope verification only), `src/app/api/connectors/**` | tokens/global/controls CSS, Popover, StatStrip, auth authorization semantics, product surfaces |
| E — Ask Prodwise (Wave 2: backend + language + tests only; Wave 3: panel + shell mount) | new `src/lib/assistant/{context,starters,language,answer,preferences}*`, new `src/app/api/assistant/**`, Wave 3: new `src/components/assistant/**`, one mount line in `ApplicationShell`, an Account section, a preferences migration | everything else |

Shared-file rule: a workstream that needs a new token or a change to a shared primitive adds a component-local custom property derived from existing tokens, and lists it in its final report; the lead folds it into tokens.css at merge. No agent edits `tokens.css`, `global.css`, `controls.css`, `Popover.*`, `StatStrip.*`, `theme-preference.*`.

Merge order: B → C → D → E, each merged by the lead after its gates, with a rendered check in both themes.

Wave 3 — Ask Prodwise UI integration. Wave 4 — brand, responsive, accessibility sweep across all surfaces (lead + A). Wave 5 — final integrated acceptance.

### Wave 3 decisions for the Ask Prodwise panel (answers to the Wave 2 report)
- D10 The panel sends `preferredLanguage` explicitly on every call (it holds the preference; saves a read).
- D11 When the panel sent an `initiativeSlug` and the answer's `basedOn.initiative` is null, it shows "This initiative isn't available to you in this organization; the answer covers your portfolio." — the same non-disclosing wording as the 404.
- D12 Term isolation is client-side: the panel passes initiative and metric names from the context header to `segments()`; the route returns no term list.
- D13 The "Proactive suggestions" preference is exposed in Wave 3 and controls the quiet badge on the collapsed control (one dot when `recommend()` has at least one item for the current screen). No push, no auto-open.
- D14 Preference writes are not gated by `DEMO_WRITE_ENABLED` (a personal setting, same precedent as notification read marks); Demo guests keep in-memory defaults.
- D15 Rate limiting stays per instance for the MVP; a DB-backed counter is a hosted follow-up behind the same interface.
