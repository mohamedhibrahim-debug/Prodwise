# Second Mission: research and execution ledger

Started 27 September 2026 after explicit acceptance of Current Mission at `4623810ddcb28382e79cbb3dcae8c01b7d966f3e`. Branch: `prodwise/core-operating-loop`. No deployment or push is authorized in this run. Stop at a final tested candidate checkpoint.

## Scope authority and sequence

Canonical scope: [14-second-mission-scope.md](../product-quality/14-second-mission-scope.md). The latest user instruction adds **Initiative Setup & Lifecycle Management first in P0**. The complete addendum and full replacement execution prompt were subsequently supplied in attachment 3479a1ea-b3fc-4e63-b696-9461ff5a0b09 and preserved verbatim in the canonical file. Setup is no longer blocked on missing scope.

P0: Setup/Lifecycle → Ownership → Actions/Commitments → Anchored AI Evidence → Queue Completeness → Minimum Context.

P1: Meeting Intelligence → Relationships/Dependencies → Initiative History → Risks/Open Questions.

Operating loop: Create Initiative → Complete Setup → Connect/Map Sources → AI Proposes Understanding → Human Confirms → Product Truth → Attention/Decision → Ownership/Action → Delivery/Dependencies → Weekly Review → Initiative History.

Each capability requires research, Claude UX contract, implementation, rendered review/fixes, independent browser red-team and tests. No broad external connectors, autonomous truth writes, new global modules, RBAC redesign or fabricated real-organization data.

## Existing implementation findings

- Creation currently persists name, business line, description and known references. References are hints, not connected sources. There is no completed editable Setup journey.
- `workspace/setup.ts` derives evidence/record/confirmation coverage. This is not lifecycle stage, readiness, release approval or a persisted user completion flag. Preserve the distinction when introducing Setup.
- Owner already exists as a revisioned `OWNER` delivery fact with active scoped membership checks. Home, Brief, filters and Weekly consume it. Reuse this canonical assignment rather than adding a competing owner column.
- Current repository supports create but no general initiative update/archive contract. Setup changes must retain stable slugs, server scope and audit history. Archive/lifecycle behavior follows the received addendum and binding Claude A1.
- Actions, anchored extraction proposals and structured open questions are not implemented. Existing Knowledge includes risk/dependency claim types; new structured operational records must not create duplicate truth.
- Finding state currently supports OPEN/RESOLVED. Deferred/Dismissed need distinct outcomes, digest invalidation and immutable history; never convert them to resolution.
- Effective date and controlled context require coordinated TypeScript digest and SQL decision-hash changes and conservative matching. Historical Finals must remain immutable when snapshots gain new fields.
- Current canonical write paths cross repository boundaries. Proposal confirmation needs atomic persistence or explicit recoverable idempotency; a client sequence of partial writes is not acceptable as a successful confirmation.
- Preserve request-scoped fetch deduplication and bounded portfolio aggregates. Never use cached authorization for mutations.

## Comparable product research

Primary sources read on 27 September 2026:

- [Linear project overview](https://linear.app/docs/project-overview): keeps lead, project properties, resources and milestones in project context. Applicable pattern: visible identity and contextual editing. Do not import automated delivery predictions into Prodwise.
- [Linear initiatives](https://linear.app/docs/initiatives): explicit owner and purpose help orient leadership. Applicable pattern: clear responsibility and scope. Its initiative/project hierarchy and status taxonomy are not adopted wholesale.
- [Jira Product Discovery delivery](https://www.atlassian.com/software/jira/product-discovery/guides/delivery/overview): discovery ideas can relate to multiple execution items. Applicable distinction: initiative boundary is not a single Jira epic and delivery tickets are not all product truth.
- [Jira Product Discovery insights](https://support.atlassian.com/jira-product-discovery/docs/create-and-manage-insights/): evidence belongs in idea context. For Prodwise, preserve exact evidence excerpts and a separate human confirmation step rather than merely attaching an undifferentiated note.

These are pattern references, not user research or acceptance evidence. Product interpretation: keep a concise initiative identity, resumable contextual setup, visible source boundary, and evidence-to-proposal review. Do not add a generic task board or a global intake navigation item.

## Quality baseline

Current accepted performance medians (three warmed local production-mode samples): Home→Initiative 1144ms; Initiative→Decisions 999ms; Home→Roadmap 884ms; Home→Analysis 878ms; Administration→Users 1680ms. Baseline unit suite 224 passing; accessibility 73 views with no axe violations. Second Mission requires fresh measurements, not inherited PASS labels.

## Gate status

- Clean baseline verified: PASS.
- First capability detailed addendum: RECEIVED and preserved in full.
- Research/code inventory: initial pass complete; schema conflicts and acceptance cases recorded in [03-schema-and-acceptance-plan.md](03-schema-and-acceptance-plan.md).
- Claude UX contract: P0-1 Setup/Lifecycle and P0-2 Ownership FROZEN by [Claude contract](02-claude-architecture-research.md) plus [binding amendment A1](04-claude-contract-amendment.md). Later capability contracts remain drafts. API responses completed successfully; no rendered verdict yet.
- Implementation: PARTIAL. Visible Manage entry, revision-checked Basics, source identity/mapping foundation, contextual source page and source mapping/revision controls and controlled scope create/select/rename/retire are local and uncommitted. Progressive creation, delivery Unknown UI, archive/restore and readiness integration are still required.
- Local verification: 242/242 unit tests pass; TypeScript passes after source revision controls. Local PostgreSQL replay through 0021 passed preservation checks; 0022–0023 applied only to the same disposable database. SQL source behavior/RBAC/stale-write tests and context lifecycle tests pass. Engineering browser checks passed in Independent Review Lab for source link/unlink/relink, context creation and Viewer controls, with no overflow at 390/768/1440 and no axe violations in the checked Manage surface. These are partial capability checks, not independent red-team acceptance.
- Build: PASS with the existing Webpack path (`npm run build -- --webpack`). Default Turbopack cannot resolve this checkout’s existing external node_modules junction; this is an environment limitation, not a passing default build. Fresh schema replay 0001–0023 plus preservation/source/context SQL tests: PASS on a new disposable local database.
- Rendered Claude review, independent red-team and full-capability accessibility/performance: PENDING. Partial engineering Manage checks do not close those gates.
- Migrations: 0020–0023 drafted locally. No hosted migration, push or deployment.
- Latest four clarifications are preserved at the top of the canonical scope. Permission matrix finalization, concurrency tests and contextual search integration remain explicit acceptance gates.

## Engineering QA scope correction

The initial local browser pass entered the default local AMAN fixture context through a previously promoted test account. Its one newly created synthetic source container/item/mapping and three generated test activity rows were removed, with a private recovery copy retained. No original records, delivery facts, Finals or production data were altered. That run is not accepted as isolation evidence. The corrected harness explicitly selects and waits for Independent Review Lab before any mutation; it passed and replaced the screenshots/report. The private browser report records its organization.

Current artifacts (ignored, local only): `.data/second-mission/source-browser-qa.json`, `manage-390.png`, `manage-768.png`, `manage-1440.png`, `tests-contexts.log`. These have not been sent to Claude as a completed-capability visual review.

## Supplemental pattern research for the remaining contracts

- [Linear initiative/project updates](https://linear.app/docs/initiative-and-project-updates): recurring updates belong with the initiative and its responsible people. Prodwise keeps one shared finalized portfolio review and turns explicitly confirmed follow-up into commitments; it does not copy Slack delivery or health inference.
- [Linear project dependencies](https://linear.app/docs/project-dependencies): directional relationships are visible in project context. Prodwise keeps dependency direction explicit and will not move dates or predict delay without supported facts.
- [Jira Product Discovery insights](https://support.atlassian.com/jira-product-discovery/docs/create-and-manage-insights/): evidence attached to the work supports decisions. Prodwise adds verified exact excerpts and a separate human confirmation boundary.

Pattern references only; these are not rendered acceptance or user research.
