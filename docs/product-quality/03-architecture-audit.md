# Product architecture and information architecture audit

27 September 2026 · Agent A · Research/design only · Contract candidate for Claude review, not implementation approval.

This audit reads the current integration source on `prodwise/product-comprehension`, the user mission in `Pasted text.txt`, and the completed [competitive research](02-competitive-research.md). Phase 1 Login + Explore Demo is complete at production SHA `79875f8`; it is a preserved foundation, not a redesign backlog. No source code, production data, credentials, or deployments were changed for this audit.

Findings below distinguish source-confirmed behavior from proposed architecture. They are not a rendered visual review, accessibility certification, performance measurement, or user test. The UX and performance workstreams supply that evidence separately.

## The main architecture correction

Prodwise should present **one initiative record, several useful portfolio views, and a dated management review of that record**. Administration changes who can access the record; it must remain visibly separate from product work. Organization selection changes the authorized context, not the user's identity or global authority.

Keep the strongest existing foundations: four portfolio links; a shared initiative header; provenance and replacement history in Knowledge; planned versus actual delivery dates; grounded Claude drafts; human section review; immutable Finals; explicit unknown values; and server-enforced organization, role, actor, and environment boundaries. The correction is to make these relationships evident before the user opens Help.

## Current gaps and their consequences

Severity: P1 = blocks understanding or a core journey; P2 = materially slows orientation or comparison. These priorities concern product comprehension, not a claim of a production security defect.

| Priority | Source-confirmed finding | Consequence | Architecture recommendation |
|---|---|---|---|
| P1 | `AccountAccess.tsx` displays the organization as a plain heading; `login-scope.ts` chooses an eligible login workspace, but provides no deliberate switching action. | A Platform Owner cannot confidently identify or enter another authorized organization. Login selection can be mistaken for a switch feature. | Shell organization control, clearly labelled current context, backed by a new explicit server-authorized session-switch contract. |
| P1 | `/users` and `/platform` are links inside account `<details>`. Both pages use repeated rows/forms/disclosures without internal administration navigation. | Daily account controls, organization management, and global authority appear mixed. Comparing people or organizations requires reading paragraphs. | One visible Administration utility; scope-labelled console with table/list → focused detail and internal navigation. |
| P1 | `WorkspaceTabs.tsx` exposes Brief, Decisions, Knowledge. Sources is a nested Knowledge view; `/delivery` is reached through contextual links. | The requested initiative mental model is incomplete, and editing the facts that feed portfolio views is hard to locate. | Four visible tabs: Brief, Decisions, Knowledge, Sources. Keep delivery editing as a clearly labelled task from Brief and Weekly Review, rather than a fifth main tab. |
| P1 | `/analysis` contains both sections with `#portfolio`/`#project` anchors and an initiative query selector. | A change of analytical scope feels like scrolling; drilldown and browser Back lack a stable location model. | Dedicated Portfolio, Projects, and project detail routes, preserving filter/back context. |
| P1 | `WeeklySection.tsx` saves six PM narrative text fields and explicitly says notes do not change recorded facts. There is no structured-update action. | A milestone, blocker, next step, or decision typed into a review can remain commentary while Roadmap and Brief retain older canonical values. | Separate Commentary from Update initiative record; preview exact field destinations and confirm canonical writes explicitly. |
| P1 | Finalization preserves `finalizedAt`, actor, cutoff, and baseline ID, but the page does not expose an obvious next-review/changes-since-this-Final journey. | The user cannot answer “what happens next?” after finishing a meeting. | Final receipt showing week, who/when, cutoff and baseline, with View changes since this review / Prepare next review. |
| P1 | Register attention uses open mismatches/blocker only; no claims gives “Knowledge not recorded,” while any claims with zero open mismatches gives “No open mismatches.” It does not display `deriveSetup` coverage. | An unverified or incomplete record can look as reassuring as a checked record. Register attention also omits the past-date checks used by Home/Roadmap. | Display coverage separately from actionable attention; use one shared derivation for common attention reasons. Zero mismatches is never a completed assessment. |
| P2 | Home has real decisions, delivery attention, recent events and upcoming dates, but its pulse contains only three attention counts; Weekly Review CTA is generic. | An empty real portfolio looks like a dashboard of zeros; a populated portfolio does not immediately expose scope or the management delta. | Compact portfolio context + ordered attention queue; meaningful empty state; Weekly CTA reflects actual draft/Final/baseline state. |
| P2 | Register lacks Owner even though `OWNER` delivery facts and active member labels are real. Latest changes combine delivery and activity summaries separately. | PM responsibility and meaningful changes are less scannable than available data permits. | Owner from the real canonical assignment; unified meaningful event ordering with a record link. Never infer an owner from account names. |
| P2 | `GuidePanel.tsx` supplies a floating Guide trigger and six sequential chapters. Account repeats `AccountAccess` before a small password form. | Guidance compensates for missing context; personal settings feel like a shell fragment rather than a coherent destination. | Short optional first-run orientation, contextual next actions, secondary Help; structured Account/Security/Organization context using only real capabilities. |
| P2 | Initiative layout/metadata, root layout/account and pages request overlapping context/record information. | Potential repeated reads need profiling; source inspection alone cannot establish navigation latency. | Persistent shell and request-level deduplication hypotheses for the performance workstream; no stale cross-request authorization cache. |

## Freeze three visible levels

| Level | User must be able to answer | Visible elements | Scope boundary |
|---|---|---|---|
| Product / organization | “Which product and organization am I using?” | Prodwise brand first; current-organization control second; account, Help, Administration utilities | Global identity is separate from organization membership. Platform scope is explicitly labelled. |
| Portfolio | “What needs attention, and how does delivery compare?” | Home · Initiatives · Roadmap · Analysis | Every view reads the active server-bound workspace within the organization. Weekly Review is reached from Home/Roadmap/contextual tasks, not added as another main work area. |
| Initiative | “Which initiative, what is known, and what should I do?” | Portfolio breadcrumb; initiative name/business line/stage; Brief · Decisions · Knowledge · Sources | An initiative and its source/claim/fact IDs must belong to the verified workspace. Tabs preserve the same object. |

Recommended route model, subject to the frozen contract:

```text
/                                      Home
/initiatives                           Portfolio register
/initiatives/[slug]                    Brief
/initiatives/[slug]/decisions          Differing values and human outcomes
/initiatives/[slug]/knowledge          Confirmed/current/replaced ledger
/initiatives/[slug]/sources            Source library, visible fourth tab
/initiatives/[slug]/delivery           Confirmed delivery facts and history (task destination)
/roadmap                               Date/scope outlook
/analysis/portfolio                    Derived portfolio analysis
/analysis/projects                     Choose/filter projects for analysis
/analysis/projects/[slug]              Metric definitions, observations, freshness
/weekly-review?week=YYYY-Www            Draft/Final and review history
/account                               Personal identity and security
/administration                        Authorized scope landing
/administration/platform/organizations Platform organization register
/administration/platform/organizations/[organizationId]
/administration/platform/users         Global identities and scoped memberships
/administration/platform/policies      Per-organization policy management
/administration/organization/users     Current organization membership/invitations
/administration/organization/settings  Existing owner-only workspace configuration
```

Preserve old `/users`, `/platform`, `/analysis`, and nested Knowledge/Sources URLs with safe redirects/aliases. Preserve deep links to claim/source IDs and existing actions while routes migrate. Do not expose new administration pages through presentation checks alone. A request still requires the same server authority even if the entry is hidden.

**Sources recommendation:** promote the existing source library, not create a second store. **Delivery recommendation:** retain one canonical editor/history path and open it from the relevant field; do not create a parallel Weekly Review fact form with its own truth rules. **Analysis recommendation:** `/analysis` redirects to Portfolio; actual routes replace scroll anchors.

## Journeys and authority

CEO, Product Lead and PM are user jobs/personas, not additional roles to add to Auth. A CEO may be Viewer; Product Lead is the existing separate review-finalization capability. Navigation can emphasize the job without granting authority.

| Job | First question and path | Completion evidence | Permission boundary |
|---|---|---|---|
| CEO / executive reader | Home → attention reason → named Brief/Decision; Roadmap for dates; Analysis for supporting records; Final review for management history | Understand affected initiative, why attention is needed, responsible person if recorded, next action and freshness | Viewer can read authorized records. Seeing an outcome or Final does not grant a release approval or write capability. |
| Product Lead | Home → changed/blocked initiatives → Roadmap → shared review readiness → human Final | All applicable sections reviewed against current inputs; who finalized, cutoff, and next baseline visible | Existing Lead capability or organization administrator/global authority; recheck membership, environment, source revision, and baseline at finalization. |
| PM | Initiatives → own real assignments/filter → Brief → Sources/Knowledge → Decisions or confirmed delivery edit → own Weekly section | Canonical changes appear in Brief, Home, Roadmap and review delta; commentary stays in the review | Existing business-write role plus environment guard; weekly ownership restrictions retained. AI drafts never confirm facts or mark human review. |
| Organization Admin / Org Owner | Administration → Current organization → Users → person detail/invitation | Compare access, change permitted membership, see result and real history | Admin manages Member/Viewer; Org Owner manages Admin and permitted settings. Protected Org Owners/Platform identities remain protected in normal flows; no global controls. |
| Platform Owner | Administration → Platform → organization/user/policy detail; deliberately Open organization for product work | Target organization is explicit for every grant/policy/ownership action; global role shown separately from membership | Platform role comes from persisted identity, never email. Dedicated audited APIs retain override reasons and minimum active owner guards. Product scope changes only through the switch action, not by viewing an admin detail. |

An executive “attention” destination must show the reason and supporting record, not a generic health label. A PM should be able to follow `Source → confirmed Knowledge → differing-value Decision → current Brief → portfolio effect → weekly snapshot` without losing initiative identity.

## Organization control and safe switching contract

Placement is a shell design decision: compact current-organization name/control near product identity, not an extra primary link or dominant brand. One context is still clearly labelled; multiple authorized contexts receive a chooser. Product organization and an administration page's **target organization** are separate concepts and must not overwrite each other.

The current implementation has session binding and fresh authorization, but **no completed switch API**. Required behavior before presenting a working chooser:

1. Server returns only authorized active contexts for the signed identity. Ordinary users require active eligible organization membership and policy/recorded override; Platform Owners use persisted global authority and the same active context checks. Do not assume every organization in the platform register is open for normal work.
2. Client submits a target identifier as a request, never an access grant. Server rechecks identity, target organization/workspace status, membership/role/policy/owner state and applicable session restrictions immediately before issuing the new bound session. No fallback to a deployment-default organization on failure.
3. The new opaque session selects exactly one persisted organization/workspace. Global password/provider identity stays unchanged. Revoke/replace the current app session safely; do not invalidate unrelated sessions or memberships merely because this browser switched.
4. Handle unsaved work explicitly. After switching, land on Home, announce the organization, and reset scope-dependent search, filters, selection, guide keys and rendered caches. Do not carry an initiative slug into a different organization where it might identify another object.
5. Mutations reauthorize and verify their intended scope/revision; stale forms opened before a switch cannot silently act on the new organization. No client-only menu filter, cookie name, query string, local preference or cached role may become the security boundary.
6. Explore Demo guest sessions remain pinned to the server-registered synthetic organization/workspace. A forged switch request must fail, even if the chooser is absent. Demo password restrictions, global-role null requirement, expiry/revocation and per-request revalidation remain intact.

No general workspace switcher is required for this MVP. If an organization later has multiple workspaces, selection must be explicit or follow a documented server rule; current workspaces are real records and must not be fabricated from an organization name.

## Administration as a management console

Use one Administration utility below/separate from the four work links. The console has an explicit Platform / Current organization scope title and internal navigation. Account contains personal controls and an Administration shortcut, not the only discovery point.

| Surface | Real current data/capability | Recommended presentation | Do not imply |
|---|---|---|---|
| Organizations | Organization/workspace IDs and statuses, policies; organization memberships and global identity activity | Searchable status-filtered table: name, status, effective active owners, member count with definition, policy summary, Open / detail; create form as focused task | Archive/delete actions without a corresponding approved server method. Archived Demo history must not look like another active duplicate. |
| Users & Access | Global identities, global platform role, per-organization role/active state/Lead capability, policy override | Global identity table → detail with scoped membership rows. Distinguish identity status, membership status, invitation and platform role. | Removing a membership deletes a global identity; deactivation in one org disables all orgs; Org Owner is a global role. |
| Current organization Users | Current org roster, scoped invitations, membership history, protected identities | Name, email, role, access status, organization; invitation state belongs to a clearly identified pending invitation row/view. One focused detail surface for changes and history | A member's accepted/expired invitation is their current account status. Do not join invitations to people by name or obscure separate records. |
| Access Policies | Exact allowed domains/emails, persisted per-membership override and reason, platform audit | Select explicit target organization; compare policy summary; inspect exceptions/override details; confirm affected scope | An exact Outlook exception exempts its whole domain or another organization. No global AMAN default. |
| Configuration | Existing owner-only workspace rename; creation/owner provisioning/ownership replacement/global role grant | Show only supported controls and clearly state effects before sensitive actions | Organization rename, platform grant removal, global user deletion, or security settings that do not exist. Ownership replacement currently demotes all prior owners; label that effect explicitly. |
| History | `membership_events` and `platform_events` with persisted actor, target, time, before/after and reason | Detail timeline/record table with readable recorded action and scope; expose actual pagination/limits | Comprehensive security audit, sign-in history, or analytics not stored. Do not infer historical role from a person's current role. |

Count definitions matter: organization owners count only effective active memberships attached to active identities; invitations do not count as active members. Derive platform-member totals from memberships, not number of raw identity records. Do not load sensitive global identities for an Org Admin merely to hide them afterward.

My Account should show global identity, current org membership, and platform authority separately; Security offers the existing authenticated password change, with Demo explanation instead of that form. Organization context links to the actual chooser/authority-specific administration. Help can restart orientation and describe shortcuts using existing browser preferences; no invented notification or profile settings.

## Facts, projections, and actual data dependencies

| Information | Current source / behavior | Required dependency or correction |
|---|---|---|
| Initiative identity, business line, stage | `Initiative`; real stage vocabulary. `overallState` exists, but it is not a fresh assessed-at/coverage audit record. | Keep stage separate from assessment. No stage update method exists in the current Repository: confirmed Stage editing needs a new guarded, audited mutation contract. |
| Owner, scope, Target/Actual Live, milestone, blocker, next step | `DeliveryFact` + revision, basis, evidence, confirming global actor and `DeliveryEvent` before/after | Reuse canonical fact writes and history. Record absence/withdrawal as unknown, never zero, completion or failure. Owner uses actual membership assignment. |
| Sources and confirmed Knowledge | Evidence, claims, links, locators, confirmation and replacement lineage | Four visible initiative sections use the same records. A canonical general Decision can use existing `DECISION` claim type with explicit confirmation/provenance; mismatch outcomes use existing finding resolution. Do not convert free narrative into a decision automatically. |
| Coverage / assessed state | `deriveSetup` checks in-scope sources, any claims and active confirmed claims; deterministic findings run from current claims | Show Setup incomplete / unverified state honestly. “No mismatches in checked record” is qualified check output, not an assessment. A literal human “Assessed / Clear” label requires explicit assessment provenance/coverage; do not invent it from claim count or `overallState`. |
| Portfolio attention | Home checks open actionable findings, recorded blockers, past targets and milestones; register currently checks fewer reasons | Share derivation and reason links across Home/register/Roadmap/Analysis. Count affected initiatives separately from overlapping reasons; past targets request updates, not automatic late/failure verdicts. |
| Weekly baseline/deltas | Frozen input, references, facts/events/claims/finding states, stage, review cutoff and previous Final | Preserve truthful skipped-week/cutoff semantics. Refresh invalidates affected human review; Final immutable. No extra weekly database of canonical values. |
| Portfolio analysis | Derived stages, targets, changes and attention with supporting records | Dedicated routes and drilldowns over these real inputs; no readiness percentages or business-performance inference. Current stage counts include all visible records: do not call them active initiatives without a recorded active/archive state. |
| Project performance | Current page says Measurement not configured; no approved metric definition/observation store exists | Real metric detail needs definition, source, period, formula, target, approval owner and freshness. Freeze a minimal canonical metric contract before adding 1–2 synthetic Demo examples; real AMAN stays unconfigured until actual records exist. |
| Demo | Explicit registered synthetic workspace, scenario date, facts/events and prior Final | Enrich only that scenario with 7–9 coherent varied initiatives; the same records must feed every projection. Fixed scenario date and actual new-action timestamps stay distinguishable. Shared Demo persistence must not be described as browser-local. |

No existing zero, missing claim, default stage, fixture actor, or synthetic business measure should be promoted into a stronger factual claim. Use source details to explain why a count appears and what it cannot establish.

## Weekly Review lifecycle contract

Keep two visibly distinct surfaces within each initiative section:

- **Review commentary:** meeting wording such as “Finance confirmed the approach this week.” Save draft/mark reviewed; it changes the review narrative only.
- **Update initiative record:** typed structured fields with current value, proposed value, destination, confirmation basis and expected revision. State “This updates the initiative record.” Apply confirmed fields through the canonical guarded writes; link to the updated record/history.

An inline confirmed field update is a smaller valid implementation than a speculative all-fields transaction spanning separate stores. If several changes are submitted, show each real result and partial failures; never announce all applied when only some succeeded. Claude may propose grounded wording/changes, but a person confirms truth and provenance. Stage and general Decision destinations need the contracts above; do not add duplicate delivery kinds to avoid designing them.

```text
Prepare review → capture current facts versus latest earlier Final
→ Draft → optional Claude wording → PM edits commentary
→ confirm canonical changes → refresh affected inputs → review changed sections
→ authorized human Finalize → immutable meeting snapshot
→ Final receipt / history → next review compares current truth against that Final
```

Refresh and stale-state validation remain necessary after canonical updates. Finalize is disabled with a specific reason when inputs, baseline, section review, authority or environment do not permit it. Show lifecycle actions prominently where relevant; do not make users discover them in text links. The Final receipt names finalized actor/date, week, cutoff, baseline and the consequence: “This Final becomes the baseline for the next review.” A preserved review records what management discussed; it is not business or release approval.

## Research consumed: adopt, adapt, reject

These are Prodwise design inferences drawn from the actual primary-source findings in [02-competitive-research.md](02-competitive-research.md), not claims of measured competitor superiority.

- **Adapt scoped administration.** [Linear Workspaces](https://linear.app/docs/workspaces), [Jira navigation](https://support.atlassian.com/jira-software-cloud/docs/what-is-the-new-navigation-in-jira/) and [Aha workspace settings](https://support.aha.io/aha-roadmaps/support-articles/settings/workspace-settings~7444672578262482800) separate work, account/configuration and scope. Preserve Prodwise's four links and stricter global/organization distinction; reject suite navigation breadth and custom menu builders.
- **Adapt register/detail.** [Productboard's current guide](https://support.productboard.com/hc/en-us/articles/27858826222355-Fundamentals-of-Productboard) and [Notion database views](https://www.notion.com/help/views-filters-and-sorts) support shared records across views and focused record detail. Use roster/register tables and accessible detail; on mobile use list → page. Do not turn every record into nested disclosures or introduce custom roles.
- **Adopt inspectable aggregates.** [Linear Insights](https://linear.app/docs/insights) and [Notion Charts](https://www.notion.com/en-gb/help/charts) expose supporting records. Prodwise counts open the actual scoped data/history; project metrics need real definitions and observations. Reject charts over absent measurements.
- **Adapt cadence and human editing.** [Linear updates](https://linear.app/docs/initiative-and-project-updates) supports changes-since-last drafting and human publication. Keep Prodwise's immutable Final, review ownership and canonical fact confirmation; reject competitor-editable posted updates and inferred health.
- **Adapt purposeful onboarding.** [Linear Start Guide](https://linear.app/docs/start-guide), [JPD pre-built views](https://support.atlassian.com/jira-product-discovery/docs/pre-built-views-beta/) and [Aha Demo workspace](https://support.aha.io/aha-roadmaps/getting-started/introduction/explore-demo-workspace~7444678436705438242) support examples/contextual learning. Reuse completed Explore Demo and a short optional orientation. Reject refresh-reset semantics, forced tours, or sample data inserted into real organizations.
- **Adapt the performance goal, not a sync engine.** [Linear's engineering account](https://linear.app/now/rebuilding-delta-sync-read-path) supports authorized selective reads as part of navigation speed. Measure Prodwise's actual routes and reduce safe duplicate work; reject a new local-first architecture or stale auth caching as an unmeasured redesign shortcut.

## Freeze decisions and recommended order

Claude should review and freeze the following concrete contract; these are design/implementation scope decisions, not requests to re-approve the user's existing RBAC choices:

1. Three visible levels; four work links, four initiative tabs, one Administration utility; separate active product scope from admin target scope.
2. Route model and compatibility aliases; dedicated Analysis routes; delivery editor remains a contextual task.
3. Organization chooser backed by a new session-switch API, explicit Demo denial and scoped cache/form behavior. Current login candidate selection cannot substitute for it.
4. Coverage and attention wording/derivation; no unsupported Assessed/Clear or readiness verdict.
5. Weekly commentary/canonical-update surfaces, per-field destination, Stage write scope, confirmation and refresh/final consequences.
6. Minimal project metric schema/source contract for approved synthetic examples versus real unconfigured data.
7. Administration's supported action inventory: do not invent archive/global removal/security operations merely to fill the console.

After freeze: **shared shell/scope and route foundations → administration table/detail + Account → canonical Stage/weekly update contract and read-model consistency → coherent Demo enrichment + Home/register/Roadmap → Analysis and metric detail → weekly lifecycle presentation + contextual onboarding**. The performance workstream should establish measurements immediately and improve authorized request work alongside these slices. Finish with rendered desktop/mobile critique and independent acceptance review, not code-only approval.

Acceptance evidence must demonstrate: an unaided reader identifies product/org/object; Org Admin cannot see/use global controls; Platform Owner opens a real authorized organization; guest/forged/stale scope switching is denied; tables retain list context and usable mobile detail; no data/zero implies an assessment; a confirmed weekly update appears in the initiative and portfolio before Final; commentary alone does not; stale inputs block Final; previous Final stays unchanged; next review uses the stated baseline; analysis drilldowns retain scope and supporting provenance; all measured route improvements preserve fresh authorization and trust-critical data.
