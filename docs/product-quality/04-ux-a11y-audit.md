# Enterprise UX and accessibility audit

Date: 27 September 2026. Research baseline: `79875f8fe61c799eb5f240b2bc2b2bd0f7854b34`, branch `prodwise/product-comprehension`. This is a design input for Claude and the frozen contract, not implementation approval or an accessibility conformance claim.

## Evidence and limits

Reviewed the current route/components, the synthetic [final Demo screenshots](../ui-review/final-demo/README.md), and the newer production Home/login evidence under `.data/login-demo/screenshots/`. The older final-demo captures are explicitly historical local captures; the newer production Home confirms the same composition after the completed login release. Also inspected current local synthetic Weekly Review and organization Users captures. No AMAN screenshots or credentials are included. Platform administration findings are verified from current source; they are not presented as a rendered platform-admin usability test.

Applied frontend-design, design-critique and accessibility-review guidance. Consumed [competitive research](02-competitive-research.md) before these recommendations. Its official documentation supports the patterns; the fit to Prodwise remains design judgment. The completed login should be retained. Root owns current performance measurement and implementation.

Read-only local browser observations are recorded separately in `.data/product-quality-baseline/ux-a11y-readonly.json`: 22 route/viewport checks across eleven synthetic routes at 390 and 1440px; no document overflow, unlabelled visible form controls or runtime page errors found. Guide and mobile navigation opened by keyboard, closed with Escape and returned focus correctly. The rendered Guide focus ring confirmed the cyan/canvas contrast pair below. Four current viewport captures cover Weekly Review and Users. This was a targeted DOM/keyboard check, not an automated WCAG scan or a real screen-reader test. No business updates, AI generation, finalization, invites or permission changes were submitted; the browser established Demo access only.

## Judgment

Keep the existing navy product chrome, neutral working canvas and restrained semantic orange. Increase useful information density through composition, concise rows and focused details. Adding cards, gradients, shadows or smaller text will not resolve the comprehension problem.

Three foundations already work and should survive: the Decisions comparison keeps 27 and 30 adjacent even at 390px; Knowledge presents values, confirmation and provenance in a ledger; Roadmap separates planned Target Live from Actual Live and leaves unknown dates visible. The earlier claim that Knowledge was only stacked disclosures no longer describes the inspected implementation.

The highest-priority gaps are a weak organization/administration model in the shell, Weekly Review commentary that cannot update initiative truth, hidden consequences of finalization, and Analysis navigation that only jumps down a long page.

## Required corrections, with evidence

| Priority | Finding and evidence | User consequence | Required outcome |
|---|---|---|---|
| Major | `AccountAccess.tsx` renders organization name as a plain strong label and hides separate Users/Platform destinations in the personal disclosure. | A Platform Owner cannot quickly distinguish current organization work from global administration. | A labeled organization context control integrated with the shell; a discoverable Administration utility with explicit Platform/Organization scope. Only server-authorized context choices may appear. |
| Major | `WorkspaceTabs.tsx` contains Brief, Decisions, Knowledge only. Sources is nested beneath Knowledge. | The approved four-part initiative model is not visible; source inspection appears subordinate to one view. | Four persistent initiative destinations: Brief, Decisions, Knowledge, Sources. Preserve legacy deep links and active state when opening source/entry detail. Delivery remains a named fact editor reached from Brief/Roadmap/Weekly, not another ambiguous top-level area. |
| Major | `platform/page.tsx` repeats organization cards, disclosure forms and raw identity/member paragraphs. Active and archived records share the same loop. | Global authority looks like a debug tool; scanning status and finding one person's membership is difficult. | A management table, status filter, organization detail, and Users & Access roster. Archived organizations are explicitly labeled and separated by filter. No unsupported archive action may be invented. |
| Major | `users/page.tsx` mixes member identity, protected-account paragraphs, role/status controls and invitations in long rows. | Every person looks like a form; high-consequence changes lack a clear target/detail boundary. | Scan a roster; open one person's detail to change access. Keep normal role restrictions and protections intact. Invitations remain distinguishable from active memberships. |
| Major | `WeeklySection.tsx` has six narrative textareas and saves notes only. It explicitly says notes do not change recorded facts. | “Next step”, “blocker” and “next milestone” entered during review appear to be updates but remain trapped in commentary. | Separate Review commentary from structured Initiative updates. Structured changes require explicit confirmation, canonical persistence and resulting history. Do not reinterpret existing narrative automatically. |
| Major | Weekly actions share a small top action group; disabled Final has no adjacent list of unmet prerequisites. A Final provides no prominent next-review/changes-since action. | The PM cannot see what remains, where edits go, or what happens after the meeting. | State-specific action bar, review readiness, clear save/generate/apply/finalize consequences, Final receipt, and next-week entry. |
| Major | `analysis/page.tsx` uses `#portfolio`, `#project` and `/analysis#project`; Project is below Portfolio. | A navigation-looking control scrolls rather than changes analytical scope; selected initiative context is weak. | Distinct Portfolio, Projects and initiative Analysis routes, visible scope and preserved filter/back context. |
| Major | Home’s newer 390px capture is 3,062px tall. Weekly entry follows decisions, delivery attention, recent changes and upcoming dates near the bottom. | The weekly management task is not discoverable from the first mobile screen. | Promote the current review state/CTA near portfolio pulse; keep attention primary and move detailed activity behind “View all”. |
| Moderate | Home “What changed” renders fact-kind labels such as NEXT MILESTONE — PLANNED and numeric dates. | Users must translate technical events into business changes. | Render meaningful event sentences with initiative, previous→current when meaningful, recorded time and destination. Keep source records and attribution unchanged. |
| Moderate | Register already has real table/search/filter/sort, but its only attention filter is “Decisions / blockers”; knowledge absence is expressed as “Knowledge not recorded”. | Zero mismatches can still be mistaken for assessed/clear, and incomplete work cannot be isolated. | Explicit assessment states: Not assessed, Setup incomplete, Needs attention, Clear under recorded checks. Freeze exact derivation before showing a Clear label. Counts and filters use the same derivation. |
| Moderate | Roadmap repeats group headings, headers and date range for four single-row groups; Sources repeats “View source details”; Knowledge repeats “Details”. | Long pages slow scanning and repeated controls are difficult to identify out of context. | Compact shared timeline/header and optional grouping; distinct accessible detail names; preserve context in a focused detail panel. |
| Moderate | Floating Guide covers part of the work surface in mobile Decisions and older Knowledge captures. Six chapters repeat guidance outside the task. | Help competes with the action it is meant to explain. | Remove its fixed placement. Short optional first-run orientation, contextual empty-state guidance, and secondary Help in a consistent utility location. |
| Moderate | `account/page.tsx` is identity text plus one password card. | Personal security, organization authority and available help are not organized. | A small account page with Identity, Security, Organization access and Help/preferences only where functionality exists. Keep Demo session protection intact. |

## Distinct compositions to freeze

All views share typography, spacing, status and focus tokens. They should not share the same page layout.

| Surface | Recognizable composition | Main interaction | Small-screen order |
|---|---|---|---|
| Home — command center | Compact context/pulse; wide prioritized attention queue; narrower upcoming/weekly region; concise meaningful changes. No four equal KPI cards as the whole page. | Open the exact decision or delivery change requiring a person. Weekly CTA states the selected week and draft/final state. | Context → pulse and review CTA → attention → upcoming → recent changes. Do not stack a long desktop right rail at the very end. |
| Initiatives — register | Toolbar and count over dense, readable rows: name, business line, stage, assessment, Target Live, latest meaningful change. Owner only from a real owner model. | Search/filter/sort; open initiative. Preserve view in URL/back navigation. | Labeled list rows with name, attention, stage, target and change; detail route, not a squeezed six-column table. |
| Brief — dossier | Stable initiative identity; concise current purpose/scope/next step; exceptions immediately visible; delivery fact rail; short change history and evidence links. | Open decision, inspect/confirm delivery record, trace Knowledge. | Current state → needs attention → planned/actual dates and next milestone → recent changes → supporting record. |
| Decisions — workbench | Queue, comparison canvas, decision controls. Values and scope together before evidence inspectors. | Inspect evidence, record a human decision, distinguish note-only review from changing Knowledge. | Queue → adjacent values → source inspection → prominent action region. Preserve 27/30 adjacency and full labels. |
| Knowledge — ledger | Consistent attribute/context → value → confirmation → provenance → detail columns, compact subject groups and current/replaced views. | Trace a value to source/confirmation/replacement, then open the existing edit/confirm action where authorized. | One labeled record at a time, with value/status/provenance before secondary detail. Do not hide field relationships from assistive technology. |
| Sources — evidence library | Source roster with title/reference/type/date/relationship/linked records; focused inspector for summary, locator/excerpt and related Knowledge. | Find and inspect supporting material. Open original with clear new-window indication where applicable. | Source list → full detail. Relationship state and excluded/historical material stay explicit. |
| Roadmap — delivery canvas | Shared date axis with compact fact-driven rows; planned target and actual launch use distinct marks plus text; unknown-date group stays visible. | Inspect target history or confirm initiative facts. No drag-to-redraw implication. | Initiative/scope, target versus actual, next milestone, attention and history link. Timeline has a text/list equivalent. |
| Analysis — analytics workspace | Portfolio/Projects route navigation; visible filters and as-of; small derived summaries plus supporting table; project detail has observations and a definition/provenance rail. | Aggregate → underlying initiatives/events/observations. Current view context survives return. | One analytical question per route; chart/text/table and scope before detail. |
| Administration — management console | Explicit scope masthead; internal Organizations / Users & Access / Access Policies navigation; toolbar, table and focused detail. | Open target organization/person before editing; review consequences before sensitive action. | Filterable list → dedicated detail or full-screen panel. No desktop table overflow or accordion forest. |
| Weekly Review — shared review document | Week/state/baseline/cutoff header; readiness and lifecycle action bar; compact initiative index grouped by owner; selected review section with facts, commentary and proposed structured changes distinct. | Prepare → draft → review → confirm initiative updates → finalize → compare next week. | Header/action/readiness → initiative index → selected section. Reading all sections remains possible; editing does not require traversing 8,000px of form. |

The weekly mobile baseline screenshot is 8,511px tall for four initiatives. Expanding to seven–nine synthetic initiatives with the same all-open form would magnify the problem. Prefer a compact index and one expanded editing section, while keeping a coherent read-only “whole review” view for the meeting. This is a recommendation for Claude to freeze, not a new pagination/data model requirement.

## Administration interaction contract

**Entry and scope.** Keep the four product navigation links. Add one Administration utility separate from the personal account action. Platform Owners can choose Platform administration or Current organization administration. Org Owners/Admins receive only their scoped administration entry. Members/Viewers have account/help only. “Platform” must never be inferred from an organization role badge. Show the active organization by name in the management masthead; a platform-wide table explicitly says “All organizations”.

**Organizations roster.** Columns: organization, status, active owners, real active-member count, policy summary, Open. Default to Active; Archived is a filter with a count when available. Show honest zero/incomplete provisioning states. Create organization is a header button with name and policy fields; explain any owner activation requirement. Opening detail contains Overview, Users & Access and Policy. Do not display archival/recovery controls unless the service supports that exact action and its authorization.

**Users & Access roster.** One identity is global; its organization memberships are separate detail records. Columns may include name/email, membership role, status/invite state and organization. In platform scope, show platform authority separately from membership role; never imply it is a normal role-picker option. A row action must include the person's accessible name. Filters: organization, role, active/invited/deactivated as supported. Empty results retain filters and a reset action.

**Person detail.** Header identifies the person and scope. Membership section shows role, active status and Product Lead finalization capability separately. The actions apply only to that membership. Protected accounts show a concise protected label in the table; detail explains why and links to the appropriate authorized administration surface. A forbidden role is absent from the editable choices; the server must continue rejecting forged values. Do not offer Org Owner/Platform Owner assignment in ordinary User Management.

**Invites and policy.** Invitations are real invitation states with expiry, resend and revoke. Resend explains that it replaces the prior link. A normal invite shows the selected organization's allowed domains/exact exceptions in supporting text; no global domain assumption. Only the existing platform provisioning flow exposes deliberate policy override, default off, target organization/email/role and mandatory reason. Audit receipt records the actual actor, target, organization, role, time and override. Sensitive changes require a short review of the specific change, not a generic confirmation on every save.

**Forms.** Persistent labels, concise help beside unfamiliar fields, Save/Cancel, preserved input on errors, pending state, result message and field-specific errors. Disable repeated submissions. Keep “Your role is read-only/protected” separate from “Changes are disabled in this environment.” Do not remove explanatory read-only context merely because an action is hidden.

## Weekly Review lifecycle contract

| State/action | What the person sees | Persistence and trust requirement |
|---|---|---|
| No review / Prepare review | Selected week, full portfolio scope, proposed previous Final and cutoff explanation; one clear primary action. | Create one shared Draft. First review says there is no previous Final; do not invent changes. |
| Draft / Save draft | Persistent Draft label, baseline link, snapshot cutoff, saved/unsaved state; per-section owner and review status. | Save commentary without falsely marking it human-reviewed. Either separate “Mark reviewed” or make the existing combined action explicit; freeze this choice. |
| Generate with Claude | Secondary action with pending wording; a clear note that AI drafts from recorded evidence and human review is required. | No canonical fact write. Existing edited commentary must be preserved or replacement explicitly reviewed. Honest Template fallback label and reason; failure never silently appears AI-generated. |
| Review initiative section | Recorded facts/change comparison, editable review commentary, and a separate “Update initiative facts” action. | Narrative is review-only. Do not parse free text into facts. Structured fields use current value, proposed value, scope/source and human confirmer. |
| Apply structured updates | “This updates the initiative record” with initiative name and before/after values, including explicit unknown/cleared state. | Commit through scoped canonical actions, preserve revision/target history, reject stale values, then refresh the Draft snapshot and mark affected sections for review. Show success links to Brief/Roadmap/history. Other initiative notes remain preserved. |
| Ready to finalize | All reviewed count, no stale input warning, applied/pending updates summary; prominent Finalize review. If blocked, show the exact remaining sections or stale facts beside the action. | Only existing authorized finalizer; server verifies access, revisions and completeness. Pending unsaved commentary/structured proposals cannot be silently discarded. |
| Final | Week, Final state, finalizer/time, cutoff, previous baseline and preserved portfolio scope; read-only content. Fixture preparation is labeled as synthetic, not attributed to a real person's confirmation. | Immutable management record; no release approval implication and no “Edit Final”. Canonical truth can evolve independently afterward. |
| After Final | “View changes since this review” and “Prepare next review” as obvious actions. | Next Draft compares current canonical state with the previous eligible Final. Show target, stage, decision, blocker, milestone and next-step deltas only when supported. A historical comparison never silently switches baseline. |

No separate draft per PM. Owner grouping and edit authority remain within the single shared portfolio review. CEO/read-only users see the review and sources without an editor façade; PMs see their editable sections; Product Lead/Admin see readiness and finalization.

## First run and Help

Retain Explore Demo and its honest persistent synthetic scope. Add a short optional first-run orientation in normal document flow: what Prodwise connects, why attention matters, and a single useful next action. Offer “Open an initiative” and “Continue working”; do not force six chapters or an account setup wizard.

A quiet start-here list may link to three useful tasks—inspect an initiative, compare evidence, prepare the shared review—without gamification, completion scores or marking business actions completed merely because a page was visited. Role-aware copy avoids inviting a Viewer to modify records. First-run dismissal stays scoped to the person and context, with a restart option in Help.

Secondary Help belongs in a consistent account/utility location. It explains the current page briefly, links to relevant concepts, and can restart orientation. Empty states carry their own reason and next action: no records, filtered-out records, permission restriction, unavailable data and unconfigured measurement are distinct states. The application must be usable without opening Help.

## Accessibility findings and acceptance

### Confirmed code/visual findings

- **Focus contrast requires correction.** Global `--focus-ring` uses `#00aec7`; computed WCAG relative-luminance contrast is 2.32:1 against canvas `#eaf0f3` and 2.67:1 against white. The global rule removes the native outline. Auth forms explicitly use the same cyan outline. Use a focus indicator meeting 3:1 against each adjacent surface, including dark chrome; test actual rendered focus after the token change. The completed Login uses a darker custom focus outline and should retain it. [W3C non-text contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html).
- **Some muted text is surface-dependent.** `--ink-400` (`#67737e`) is approximately 4.22:1 on canvas, below 4.5:1 for normal text. It is used by several meta/unknown styles. It is approximately 4.85:1 on white, so the token is not universally failing. Verify every actual foreground/background pair; darken where used on tinted surfaces. `--ink-500` on canvas is approximately 4.74:1. [W3C text contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html).
- **Knowledge’s visual table headers are hidden from assistive technology** (`ledgerHead aria-hidden=true`) and the columns are generic divs. Preserve a meaningful sequence with explicit field labels or semantic table/list relationships; do not rely on alignment alone. Repeated “Details”/“View source details” controls need the associated value/source in their accessible name.
- **Register’s mobile table removes its thead with display:none** and relies on generated `data-label` text. Do not assume that its desktop header relationships survive across browser/screen-reader combinations. Prefer a separately semantic list/detail representation or preserve associated table headers; verify with assistive technology.
- **No skip link is present in ApplicationShell.** Named primary/initiative navigation and a main landmark are already useful. Add a first-focus “Skip to main content” link and stable focus target as a straightforward bypass path.
- **Several route titles are generic.** Current browser inspection returned only “Prodwise” for Roadmap, Weekly Review, Users and My account. Give each a descriptive document title so browser tabs and assistive technology identify the destination. All 22 inspected route/viewport states had one visible h1 and one main landmark.
- **Help positioning visibly competes with content.** Remove the fixed Guide affordance; any future sticky action region must leave the focused control visible. WCAG 2.2 AA requires it not to be entirely obscured; the product target should keep the whole focus indicator visible. [W3C focus not obscured](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html).

### Preserve existing strengths

Native buttons/labels/forms, action errors using role=alert, success messages using role=status, meaningful named navigation, aria-current on route links, text accompanying status colors, reduced-motion CSS, adjacent mobile comparison values, and keyboard handling in the existing mobile navigation/command palette. Their presence in code is not a substitute for regression tests.

Do not add ARIA tab roles to links merely because they look like tabs. Routes are navigation links with aria-current; in-page content tabs, if introduced, need the complete tablist/tab/tabpanel keyboard pattern. Likewise, use a real table for a data table; do not label a static table as an interactive grid unless implementing its keyboard model.

### Release acceptance matrix

| Area | Required acceptance and evidence |
|---|---|
| Landmarks and headings | One main landmark, meaningful page title and h1, unique navigation names, logical heading sequence; skip link reaches the page content. Initiative identity remains available on all four routes. |
| Keyboard | Every control reachable and operable without pointer; visible focus and logical order; no hidden/inert element receives focus. Search, filters, account/org controls, action menus and narrow navigation work. |
| Panels and dialogs | Accessible title; appropriate initial focus; focus remains in a modal; Escape and visible Close; focus returns to invoker or a logical successor. Background is actually inert when aria-modal is true. Wide nonmodal inspection panels must not falsely trap focus. [W3C dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/). |
| Forms | Visible associated labels, autocomplete where relevant, required/format hints, field-linked errors plus summary for long forms, preserved inputs, announced pending/result status, no duplicate submission. Disabled Final explains exact prerequisites outside the disabled button. |
| Tables and lists | Column/row headers and caption/accessible name where needed; sorting state announced; row actions identify their subject. Mobile keeps field relationships and no content loss. |
| Contrast and state | Normal text ≥4.5:1, large text ≥3:1; meaningful controls/states/graphics ≥3:1. Check light, dark, hover, focus, selected and error states. Status always has text/icon meaning in addition to color. |
| Pointer targets | Product target is 44px for important touch actions. WCAG 2.2 AA minimum is 24×24 CSS px with defined exceptions/spacing; 44px is not a blanket AA rule. `min-height` on an inline link alone does not enlarge its hit box. Measure actual bounds. [W3C target-size minimum](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html). |
| Reflow and text | Review 390, 768, 1024, 1440 and a large desktop; 768 uses a deliberate compact layout. Also test 320 CSS px reflow, 200% text and 400% desktop zoom as applicable. No document horizontal overflow; any necessary two-dimensional visualization has an accessible equivalent. [W3C reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html). |
| Charts and dates | Charts have textual values and supporting records. Planned/actual/unknown remain named. No color-only movement or date mark; consistent date locale, period and as-of/scenario context. |
| Motion and navigation | Reduced motion respected; persistent shell; transition loading state retains dimensions and does not steal focus. Route arrival makes title/context available; failed transitions expose recovery. Performance numbers come from measured gates, not visual impressions. |
| Assistive technology | Run automated checks plus manual keyboard and a real screen-reader pass on representative register, decision, weekly form and admin dialog. Record browser/AT/version and findings; do not label screenshot-only checks a screen-reader pass. |

No final accessibility PASS is asserted by this research. Implementation must close blocker/major issues and run these gates on the actual integrated candidate.

## Competitive synthesis applied

- **Adopt:** scope separation (Jira/Linear), aggregate-to-underlying-record navigation (Linear/Notion), one canonical data model behind multiple views (Productboard), coherent synthetic examples (Aha!). These support the four product destinations, four initiative destinations, inspectable numbers and connected Demo story.
- **Adapt:** roster→detail (Notion/Productboard), personal/workspace/platform settings scopes (Aha!/Linear), optional task-led first run (JPD/Linear), dated AI-assisted update preparation (Linear). Prodwise retains its own authorization, explicit fact confirmation and immutable Final.
- **Reject:** suite navigation breadth, customizable role/dashboard builders, forced tours, mandatory timelines for unknown dates, fake outcome graphs, automatic health inference, and editable/deletable Finals. No competitor capability overrides the approved truth model.

See [the research brief](02-competitive-research.md) for primary-source links and limitations. A vendor pattern is evidence of an available interaction, not proof that it improves Prodwise.

## Decisions for Claude’s frozen contract

1. Exact organization-control and Administration placement; platform/internal organization navigation; mobile detail treatment.
2. Weekly section index/reading/editing layout and one unambiguous state-specific primary action. Freeze whether Save draft and Mark reviewed are separate.
3. Structured update review/confirmation design, stale-input recovery and success handoff to canonical initiative facts.
4. Assessment labels and precise meaning of Clear versus Not assessed/Setup incomplete; no health score inferred.
5. Analysis route/back-filter contract and synthetic metric provenance layout.
6. Short orientation placement and secondary Help; remove the floating trigger.
7. Shared focus/contrast correction and route/table/detail semantics as release acceptance, not optional polish.

Recommended implementation order: shared scope/navigation/accessibility primitives → Administration and Analysis routes → Weekly lifecycle/canonical updates → Home/register and connected Demo density → rendered cross-surface critique → keyboard/screen-reader/responsive gates → independent persona red-team. Parallel ownership can proceed after these shared decisions are frozen. Authentication and authorization remain intact throughout.
