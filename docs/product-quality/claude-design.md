# Prodwise final quality mission: design recommendation and implementation contract

This is a design specification only. I changed no files and ran no commands. It is ready for Root to freeze, but the final UI is **not approved**: that still needs the rendered review in §17.

I read `docs/product-quality/02`–`05` plus `06-engineering-contract.md`, the integration source for every surface below, and the synthetic final-demo captures at 1440 and 390.

## 0. What the current build shows

| # | Observation | Consequence for the contract |
|---|---|---|
| 1 | The organization name appears only in the grey `AccountAccess` strip, a second bar under the command bar. There is no switch. Users and Platform are `<a>` links inside an account `<details>`, so they load a full document (2.39 s). | Put the organization in the shell. Remove the strip. Add one Administration utility that uses client links. |
| 2 | `WorkspaceTabs` has three tabs; Sources sits under Knowledge. `/delivery` highlights Brief with no explanation. Brief repeats the initiative's identity under its h1. | Four tabs. Delivery is an explained task page under Brief. |
| 3 | Home groups items by reason, so Merchant Flex Finance appears as both a decision and a blocker. It shows `TARGET LIVE — PLANNED` and ISO dates. The weekly review entry point is the last block on mobile. The floating Guide covers content. | One attention row per initiative, changes written as sentences, weekly status near the top, Guide removed. |
| 4 | The register says "No open mismatches" even when setup is incomplete. There is no Owner column. Dates are ISO, and a ↗ glyph suggests an external link. | Separate coverage from attention. Owner comes from the canonical `OWNER` fact. |
| 5 | Weekly is 5,613 px (desktop) and 8,511 px (mobile) with 4 initiatives. Its three actions look equally important. Finalize is disabled with no reason. Commentary cannot update any fact. | An index plus one section at a time, one primary action per state, a visible checklist, and a separate record-update panel. |
| 6 | Analysis uses `#anchor` "tabs", a navy KPI band, and a project checklist only. | Real routes and a persisted metric model. |
| 7 | Roadmap repeats its header and axis for four single-row groups. | One shared axis. |

**Keep unchanged:**
- The Decisions workbench, including 27/30 shown side by side at 390.
- The Knowledge ledger with provenance.
- Planned versus actual dates on the Roadmap.
- Honest "Unknown" and "Not recorded" copy.
- Claude drafting that uses supported statements only, with the Template fallback.
- The immutable Final.
- All server authorization, and the completed login/Demo flow.

## 1. Research applied (from 02-competitive-research.md)

| Documented pattern | Decision | How Prodwise applies it | Why |
|---|---|---|---|
| The workspace name opens settings; Administration is separate from work (Linear Workspaces) | **Adapt** | An organization control under the brand; one Administration utility | Scope is visible without making admin part of daily navigation |
| A global sidebar plus object tabs, with settings next to the object (Jira navigation) | **Adopt** scope separation; **reject** suite breadth | 4 portfolio links; an initiative header with 4 tabs | Location tells you which object you are changing |
| A settings area with a member roster and detail (Productboard) | **Adapt**; **reject** custom roles | Roster → person detail; fixed roles only | Compare people at a glance; make each change in one focused place |
| Account / workspace / personal scopes (Aha) | **Adapt**; **reject** configurable navigation | Account (personal), Organization, and Platform each have a labelled header | Removes "which settings am I in?" |
| Start guide, sample views, demo workspace (Linear, JPD, Aha) | **Adapt**; **reject** forced tours and reset-on-refresh | Optional in-flow orientation, a Help panel, and the connected synthetic Demo story | Users learn the model from a real example |
| List as the default view; timelines need dates (JPD) | **Adapt**; **reject** a mandatory timeline | The register is the default; Roadmap keeps an "unknown date" group | No invented dates |
| Side peek over a database (Notion) | **Adapt narrowly** | Sources expand inline; admin people/orgs and Analysis projects get dedicated detail pages | Keyboard- and mobile-safe, no nested accordions |
| Aggregate figures link to their records (Linear Insights, Notion charts) | **Adopt** | Every Analysis or Home count links to the register, filtered by the same logic | Numbers can be inspected |
| Dashboard builder (Aha) | **Reject** | Fixed page compositions | Avoids cards multiplying |
| Boards as views over one hierarchy (Productboard) | **Adopt** | Home, Register, Roadmap, Analysis and Weekly are all views of one record | No second store of truth |
| Updates with changes-since, AI drafting, editable after posting (Linear) | **Adapt** drafting and cadence; **reject** editable/deletable Finals and inferred health | Weekly lifecycle with an immutable Final and separate record updates | Trust |
| Local sync engine (Linear engineering post) | **Adapt the goal**; **reject** the rewrite | Per-request de-duplication, client links, loading boundaries | Faster without stale authorization |

## 2. Frozen information architecture

### 2.1 Three visible levels

| Level | Visible element | Placement | Rule |
|---|---|---|---|
| 1. Product + organization | Prodwise brand; organization control (name, role line, demo/scenario line) | Rail top at ≥1101 px; the command bar's leading slot when the rail is collapsed (1024); the mobile top bar at ≤780 | Visible on **every** signed-in screen, at every width |
| 2. Portfolio | Home · Initiatives · Roadmap · Analysis | Rail / drawer primary navigation | Exactly four. Weekly Review is reached from context, not a fifth link. |
| 3. Initiative | "Initiatives /" breadcrumb, **h1 name**, stage, business line, owner, "Synthetic demo" tag; tabs **Brief · Decisions · Knowledge · Sources** | Initiative header; the rail nests the current initiative under Initiatives | Delivery is a task page under Brief |
| Utility | Administration (authorized users only) · Help · Account | Bottom of the rail / drawer, separated by a 1 px rule | Never mixed with the four work links |

### 2.2 Shell anatomy

**Desktop rail (navy), top to bottom:**
1. Prodwise mark and wordmark.
2. **Organization control** (§3).
3. Home, Initiatives, Roadmap, Analysis. On an initiative route, that initiative appears indented under Initiatives.
4. Flexible space.
5. Utility zone:
   - **Administration**.
   - **Help**.
   - **Account** (initials + name), which opens a menu with *My account* and *Sign out*.
   - An exception line, shown only when writes are off: "Changes disabled in this environment".
   - Collapse.

**Command bar (56 px):** page title or breadcrumb on the left; Search ⌘K on the right; a "Viewer · read-only" chip when applicable. On initiative routes the initiative header replaces the command bar, as it does today, and keeps Search.

**Remove:**
- the `AccountAccess` grey strip;
- the floating Guide;
- the rail footer that always shows "Environment writes on".

**Mobile (≤780 px, including 768):**
- **Top bar:** ☰, organization name (truncated; ▾ only if it can switch; "Demo" badge), and Search.
- **Drawer:** a modal dialog containing the brand, the organization control, the four links, a rule, then Administration, Help, Account and Sign out.
- **Initiative header:** below the top bar. Four tabs scroll horizontally with the existing edge fades.

### 2.3 Route map

| Route | Purpose | Status |
|---|---|---|
| `/` | Home command center | Recomposed |
| `/initiatives?q,line,stage,owner,coverage,attention,target,sort` | Register | Recomposed; new filters |
| `/initiatives/[slug]` | Brief | Recomposed |
| `/initiatives/[slug]/decisions?item=&returnTo=` | Workbench | Kept; action hierarchy fixed |
| `/initiatives/[slug]/knowledge?view=confirmed\|all\|replaced` | Ledger | Kept; Sources sub-navigation removed |
| `/initiatives/[slug]/sources` (+ `/new`, `/[evidenceId]/edit`) | Evidence library, **canonical** | Promoted |
| `/initiatives/[slug]/knowledge/sources*` | **Renders the same page — no redirect** | Alias (see conflict C8) |
| `/initiatives/[slug]/delivery?returnTo=` | Delivery facts task page; Brief tab active | Recomposed |
| `/roadmap?businessLine,owner,cutoff,view` | Delivery canvas | Recomposed |
| `/analysis` | **307 →** `/analysis/portfolio` | New |
| `/analysis/portfolio` | Derived delivery analysis | New |
| `/analysis/projects?line,stage,measurement` | Measurement coverage register | New |
| `/analysis/projects/[slug]?back=` | Metric detail | New |
| `/weekly-review?week=YYYY-Www&initiative=slug&view=all\|since` | Lifecycle | Recomposed |
| `/account` | Identity, access, security | Recomposed |
| `/administration` | Scope landing (authorized users only) | New |
| `/administration/organization/users` (+ `?view=invitations`), `/users/[memberId]`, `/policy`, `/settings` | Organization scope | New |
| `/administration/platform/organizations` (+ `/[organizationId]`), `/users` (+ `/[userId]`), `/policies` (+ `/[organizationId]`) | Platform scope | New |
| `/users`, `/platform`, `/analysis?initiative=<id>` | **307** to the new routes (the last one to `/analysis/projects/<slug>` when authorized, otherwise `/analysis/projects`) | Compatibility |
| `/reporting` → `/roadmap`; `memory/*` 308s | Unchanged | Kept |

All new aliases are **temporary (307)**. The permanent 308 that already shipped for `/sources` shows why: browsers cache permanent redirects.

## 3. Organization control and server-authorized switching

### Display

| Situation | Control shows |
|---|---|
| Line 1 (always) | Organization name |
| Line 2: role | "Org Owner", "Admin", "Member", "Viewer · read-only", or "Platform access · not a member" (Platform Owner without a membership), plus "· Product Lead" |
| Line 2: Demo | "Synthetic data · scenario 26 Sep 2026" |
| Only one authorized context | Static text, not a button |
| Two or more contexts | A button that opens a **modal dialog "Switch organization"** |

The dialog contains:
- A radio list: name, role line, current marker.
- **Cancel** and **Switch** (primary).
- The consequence: "Prodwise opens Home in the selected organization. Unsaved changes on this page are lost." If the page has unsaved changes, an extra warning appears.
- The list loads **when the dialog opens**, never on every navigation.

### Server contract (Root)

`listAuthorizedContexts()`:
- Includes organizations where the identity has an active membership, the organization and workspace are ACTIVE and have an active owner, and the email policy allows the user (or a recorded override exists).
- Adds every ACTIVE organization for a **persisted** `PLATFORM_OWNER`, never one inferred from email.
- Never includes ARCHIVED or BOOTSTRAPPING organizations, registered Demo scenarios, or the organization of a Demo guest session.
- Returns names and role labels only.

`switchOrganizationAction(targetOrganizationId, scopeWorkspaceId)`:
1. **Refuse Demo guest sessions** (`DEMO_SESSION_PINNED`). They never see a chooser.
2. Re-derive identity from the current session. Re-check the target organization and workspace status, membership/role/policy/override or persisted platform authority, and owner readiness, using exactly the existing `context()` rules. There is no fallback to a default organization.
3. If the organization has more than one ACTIVE workspace, refuse. There is no workspace switching in this mission.
4. Issue a new bound session for the same identity and provider tokens. Revoke **only** the current session. Audit `SESSION_CONTEXT_SWITCHED` with the actor, from-organization, to-organization and time.
5. Redirect to `/?switched=1`. Home announces "You are now working in {Org}" (`role=status`) and focuses the h1. Palette cache, orientation keys and dialogs reset.
6. **Scope token:** every mutation form carries a hidden `scopeWorkspaceId`. The server compares it with the session's workspace before doing anything else. A mismatch returns "This page belongs to another organization. Reload before saving."
   - This covers forms that name no object, such as *Prepare review* and *Create initiative*, which object IDs alone cannot protect.
   - It also covers other browser tabs, which change organization silently when one tab switches.

**Invariants (unchanged):**
- `PLATFORM_OWNER` is global and independent of membership.
- Organization roles are ORG_OWNER, ADMIN, MEMBER and VIEWER.
- Several Org Owners are allowed, with at least one active.
- A Demo guest is never a platform user and never has real-organization access.
- Public signup and anonymous access stay off.
- Organization email policies stay enforced on the server.

## 4. Administration console

### Entry and scope

The **Administration** utility is visible to `PLATFORM_OWNER`, and to ORG_OWNER or ADMIN of the current organization. It is **hidden for Demo guest sessions**. Hiding it is presentation only; every page and action keeps its existing server check.

`/administration`:
- **Platform Owner:** two list rows — "Platform — all organizations" and "Organization — {current org}".
- **Org Owner / Admin:** redirected to organization scope.
- **Anyone else:** the existing "restricted" page.

Every page starts with a **header band (masthead)**: a scope pill plus a title, e.g. "Platform administration · All organizations" or "Organization administration · {Org}". Each scope has exactly three internal sections:

| Platform scope | Organization scope |
|---|---|
| Organizations | Organization (settings) |
| Users & Access | Users & Access |
| Access Policies | Access Policy (read-only for organization roles) |

At ≥1024 the sections appear as a left sub-navigation; below that, as a horizontal list. All links are client `<Link>`s.

### Surfaces

| Surface | List | Detail | Actions (existing server methods only) |
|---|---|---|---|
| Platform · Organizations | Search. Status filter: **Active by default**, then Bootstrapping, Archived, All, with counts. Columns: Organization (+ "Synthetic demo" / "Archived generation" tags) · Status · Active owners (counting only active memberships on active identities; "0 · needs owner") · Active members · Pending invitations · Policy summary ("2 domains · 1 exact email") · **Open {name}** | Overview; Owners; Members (links to Users & Access filtered to this org); Policy summary; Platform invitations; History (latest 50) | Create organization; add an owner (existing provisioning with ORG_OWNER, reason required, policy override off by default); **Replace all owners** (secondary, danger styling, stating that every other owner becomes Admin); resend/revoke platform invitations with a reason; **Open this organization** (the switch action; ACTIVE and non-Demo only) |
| Platform · Users & Access | Person · Platform authority (separate badge) · Organizations ("AMAN · Org Owner +1") · Identity status · **Open {name}** | Identity; Platform authority; membership table (org, role, active, Product Lead, override + reason); History | Grant Platform Owner (reason required, consequence shown); membership changes follow the rules in the next row |
| Organization · Users & Access | Person · Role · Access · Product Lead · Protected marker; `?view=invitations` lists invitations (Pending/Expired/Revoked/Accepted, expiry) | Person detail with membership fields limited to allowed choices; that person's history | Invite (Admin: Member/Viewer; Org Owner: + Admin); change role, active and Product Lead; resend/revoke non-platform invitations. **Org Owner and Platform identities are read-only here, with the reason shown.** |
| Access Policies | Platform: a table of organizations' domains, exact emails and override counts | Policy edit, with the target organization named in the heading and a diff preview | Save (platform only). The organization-scope view is read-only: "Managed by Platform administration." |
| Organization settings | — | Workspace name, owners (read-only), status | Rename the workspace (Org Owner) |

**Must not appear**, because no server method exists:
- archiving or deleting an organization;
- removing Platform Owner;
- deleting an identity;
- deactivating an owner;
- security settings or sign-in history;
- custom roles.

Sensitive actions (replacing owners, granting Platform Owner, overriding a policy) show a short in-page review that names the target organization, person, role and effect before submitting. There is no generic "Are you sure?".

Forms keep their input after an error, show field-linked errors and a pending state, and block double submission.

## 5. One shared portfolio projection

`src/lib/workspace/portfolio.ts` is a pure module. It reads the portfolio source, delivery state, workspace ID, activity and the as-of date (the scenario date for Demo, otherwise today in Cairo). Home, Register, Roadmap filters, Analysis and the Weekly index all consume it.

### Coverage (from `deriveSetup`)

| Condition | Label |
|---|---|
| No in-scope source | **Setup incomplete · no in-scope source** |
| No Knowledge recorded | **Setup incomplete · no Knowledge recorded** |
| Nothing confirmed | **Setup incomplete · nothing confirmed** |
| Setup complete | **Checked · no open differences** or **Checked · N open differences** |

- Append "· N not confirmed" when unconfirmed entries exist.
- "No open differences" is **never** shown when setup is incomplete.
- There is no "Clear", "Assessed" or "Healthy" label, and `overallState` is never rendered.

### Attention reasons

Each reason links to its exact destination:
- **Decision needed** — open, actionable CONFLICT findings → `/decisions?item=`.
- **Recorded blocker** → `/delivery`.
- **Past target · update needed** — `deliveryTiming` returns NEEDS_UPDATE.
- **Past milestone · update needed**.
- **Supporting evidence changed** — `supportChanged` on TARGET_LIVE or ACTUAL_LIVE.

A target movement is a *change*, not attention. It appears as a date annotation.

### Ordering and counts

- The attention queue is ordered by reason type, then date, then name. The UI says: "Ordered by reason type, then date — not a priority score."
- Counts distinguish initiatives from reasons: "3 initiatives need attention (5 reasons)".

### Upcoming and changes

- **Upcoming:** a Target Live without a recorded full go-live, or a Next milestone, dated within today to today + 28 days.
- **Changes:** `changesSince(current, latest Final)` when a Final exists; otherwise the last 28 days of events. A shared sentence renderer produces:
  - "Target Live moved 1 Oct → 8 Oct 2026 (+7 days)"
  - "Blocker withdrawn · current status unknown"
  - "Added to Prodwise"
  - "Stage changed: Delivery → Validation"

  Each sentence ends with "{actor} · {date}". Unknown event types fall back to their stored summary, unchanged.

## 6. Surface compositions and action hierarchy

Rule: at most **one filled primary button per page state**. Every surface has a distinct structure; there is no shared card-grid template.

### 6.1 Home — command center (answers "what needs me?" in 10 seconds)

**Reading path:** h1 → pulse sentence → review module → first attention row.

**Header:**
- Eyebrow "Portfolio · {Org}", plus a scenario chip for Demo.
- h1 "What needs attention".
- Pulse sentence. Every figure links to the register filter for that figure:

  > "8 initiatives · 3 need attention (5 reasons) · 4 setup incomplete · 4 targets in the next 28 days · 2 without Target Live"

**Review module** (right of the header on desktop; directly under the pulse on mobile). It is state-aware and holds the page's **single primary button**:

| State | Content | Primary |
|---|---|---|
| Draft | "W39 review · Draft · 2 of 8 sections reviewed · compared with W38 Final (20 Sep)" | **Continue review** |
| Final | "W39 · Final · {finalizer}, {date}" | **Prepare W40 review** (when allowed) |
| None | "No review prepared for W39" | **Prepare W39 review** |

Beneath it, a deterministic, permission-aware "Your next step", for example:
- "Review your 3 sections"
- "W39 ready to finalize"
- "Waiting on 3 sections before finalization"
- Viewer: "Read the W38 Final"

This line never ranks initiatives.

**Main column (about 62%) — Needs attention.** One row per initiative:
- Name → Brief, stage, owner.
- Its reasons, each on its own line with its destination link, e.g. "Decision needed — Daily repayment divisor **27 vs 30** · *Review decision*".
- The human-recorded next step: "Recorded next step: …".
- Show 5 rows, then "View all".
- Under the queue, a quiet line: "Not yet checkable: 4 initiatives have setup incomplete · *Show*."

**Right column (about 38%):**
- Coming up (next 28 days).
- "2 initiatives have no Target Live" link.

**Below:** "What changed since W38 Final" — up to 6 sentences, with new initiatives grouped ("4 initiatives added: …") and **View all changes**.

**Remove:** anchor-jump pulse links, the separate "Delivery needs attention" section, the shortcut links, and the floating Guide.

### 6.2 Initiatives — register

**Toolbar:**
- Search, always visible.
- Filters: Business line, Stage, **Owner**, **Coverage**, **Attention**, **Target** (Next 28 days, Past, Unknown, Moved in last 28 days).
- Sort: Name, Target Live, Latest change, Attention first.
- **Apply** and **Clear**.
- "8 of 8 initiatives · filtered by …".

Primary action: **Create initiative** (writers only).

**Table** (`<table>` with a caption; only the initiative name is a link):

| Column | Content |
|---|---|
| Initiative | Name; line · reference; synthetic tag |
| Stage | Recorded stage |
| Owner | Canonical `OWNER` fact, or "Unassigned". Never inferred from account names. |
| Coverage | Label from §5 |
| Attention | Short labels in the attention text colour; "—" with screen-reader text "No attention reasons recorded" |
| Target Live | "8 Oct 2026 · moved +7 d from 1 Oct", "Unknown", or "Live 10 Sep 2026 (full)" |
| Latest change | Sentence and date |

Remove the ↗ glyph.

### 6.3 Brief — dossier

There is no second identity heading. The page content starts immediately.

- **Main column:**
  - Current state: recorded stage, scope/phase, recorded next step (who and when), coverage line.
  - Needs attention: blocker, decisions with 27 vs 30 inline, past dates.
  - What changed since the latest Final.
  - Recorded risks and dependencies.
- **Right rail — Delivery facts:** Owner, Target Live (movement annotation + history link), Actual Live, Next milestone, Development start.
  - The rail's primary action is **Update delivery facts** for users with authority, otherwise "View delivery facts".
  - Below it, links to Knowledge and Sources with counts.
- **Setup incomplete variant:** the existing `SetupGuide`, with its single next setup step, replaces the attention block.

### 6.4 Delivery facts (task page)

- Sub-header: "← Brief · Delivery facts for {initiative}". `returnTo` is validated with `safeReturnPath` and allows Brief, Roadmap or a Weekly section.
- A ledger table (Fact | Current value | Confirmed by · basis · when | **Edit**) replaces the 9-row accordion list.
- Only one inline editor is open at a time. It reuses the existing `FactEditor` fields.
- Target history stays below.

### 6.5 Decisions — workbench (preserve)

- In the action panel, **Make a decision** is the primary button.
- **Assign confirmer** is secondary.
- "Review with a note only" becomes a text button with the hint "Records a note; Knowledge unchanged."
- Add `returnTo` support.
- Values stay side by side at every width.

### 6.6 Knowledge — ledger (preserve)

- Remove the Record/Sources sub-navigation.
- Fix semantics: remove the `aria-hidden` header, and use real table header relationships or explicit field labels.
- Give each Details button a unique name, e.g. "Details for Daily Repayment · Calculation Divisor (27)".

### 6.7 Sources — evidence library (fourth tab)

- Grouped roster: Source · Reference · Type · Source date · Relationship group · Linked entries.
- An inline inspector opens per row, with a unique accessible name. It shows the summary, locator/excerpt and related Knowledge.
- Primary: **Add source** (writers). On mobile, a list followed by the detail.

### 6.8 Roadmap — delivery canvas

- **One sticky shared axis** (range plus a cutoff marker).
- Business-line groups become thin labelled separator rows, with no repeated headers.
- Compact rows show identity/owner, the timeline, and the milestone/attention.
- "No Target Live recorded (N)" is the final group.
- Pulse figures link to the matching filter, and the "1 initiatives" plural is fixed.
- At 390/768 the graphic is replaced by a text list: "Target 8 Oct (moved from 1 Oct) · Live not recorded".

### 6.9 Analysis — three distinct routes, navigated by links with `aria-current`

**Portfolio:**
- Header with organization, as-of/scenario date and the fixed windows (±28 days).
- A light inline stat row — no navy band and no tiles — where each figure links to the register filtered by the same logic.
- Stage distribution (bars and counts; each row links to `?stage=`) beside attention-reason counts.
- Tables: *Upcoming targets* and *Target revisions* (from → to, Δ days, recorded by, when).
- A definitions rail/disclosure reusing the existing text.

**Projects:**
- A register of initiatives: Business line, Stage, Measurement ("2 metrics · last captured 22 Sep 2026" or "Not configured"), **Open**.
- Headline: "Measurement is configured for 1 of 8 initiatives."

**Project detail:**
- "← Projects" link that preserves filters through the validated `?back=`.
- For each metric:
  - latest value, unit and period;
  - target line ("≤ 3.0 days · approved by …, 28 Aug 2026" or "**No target approved**");
  - a neutral comparison sentence with no red/green;
  - an observations table (period, value or "Not observed", captured, source link).
- A definition rail: Definition, Source, Period, Formula, Target, Target owner/approval, Freshness.
- Label: "Synthetic demo measurement".
- A chart only when there are 3 or more observations, drawn with CSS bars plus the table. No chart library.
- When nothing is configured, keep the existing checklist.

### 6.10 Account, Help, orientation

**Account:**
- Identity (name, email).
- Access: current organization, role, Product Lead, and **Platform Owner (global)** shown separately.
- Security: the existing password form; for Demo, an explanation instead.
- Preferences: navigation pin, restart orientation.
- Sign out.

**Help:**
- A dialog from the utility zone with: *About this page* (per route), *Concepts* (repurposed from the Guide chapters), *Keyboard shortcuts*, and *Restart orientation*.

**First-run orientation:**
- An in-flow notice on Home only, of at most 3 lines, with one contextual action and **Dismiss**.
- Stored per person and organization. It never overlays content.
- Demo copy:

  > "This is a synthetic organization. Start with Merchant Flex Finance: two sources disagree on the repayment divisor (27 vs 30)."

  Action: **Open Merchant Flex Finance**.
- Viewers get read-only wording.

### 6.11 Empty and edge states (exact intent)

| Situation | Copy / action |
|---|---|
| No initiatives | "No initiatives recorded in {Org} yet." Writers see **Create initiative**. |
| Nothing needs attention, but setup is incomplete | "No recorded decisions, blockers or past dates. 4 initiatives have setup incomplete, so they cannot be checked yet." |
| All checked, nothing flagged | "…under the current checks. This is not a readiness assessment." |
| Nothing coming up | "No dated commitments in the next 28 days · 2 initiatives have no Target Live." |
| Filters return nothing | "No initiatives match these filters." **Clear filters**; the filters stay visible. |
| No blocker recorded | "No blocker recorded — this does not confirm there are none." |
| Metric not observed | "Not observed" (null), never 0. |
| Restricted | Names the required authority. |
| Load failure | "This data could not be loaded. Nothing was changed." **Retry** |

## 7. Weekly review lifecycle contract

### Layout

- **Header:** title, week picker (existing reviews plus the current week), state chip.
- **Baseline line:** "Compared with W38 Final · finalized 20 Sep 2026 13:00 Cairo". It also shows the snapshot cutoff and the scenario note.
- **Lifecycle status line** (text, not a wizard): Prepare · Draft wording · Review sections 2/8 · Record updates (1 applied) · Finalize.
- **Two panes:**
  - An **index** grouped by owner. Each row shows Needs review / Reviewed / Needs re-check and markers (Target +7 d, Decision, Blocker, New).
  - The **selected section**, chosen with `?initiative=`.
- `view=all` is a read-only full document for the meeting.

**Each section has three visually distinct blocks:**
1. **Record at cutoff** (read-only), plus "Changes since W38" as sentences.
2. **Meeting commentary — this review only.** Six text areas and a single **Save and mark reviewed** button. This stays combined; see conflict C9.
3. **Update the initiative record.** Its own bordered panel headed "Changes apply to {initiative} after you confirm. They are not part of the review text."

### One primary action per state

| State | Primary action | Also shown |
|---|---|---|
| Not prepared (writer) | **Prepare W39 review** | Baseline preview ("Compares with W38 Final · 7 changes since"), or "First review — no previous Final" |
| Draft, inputs stale | **Refresh inputs** | "Record changed after the snapshot · 2 sections affected" |
| Draft, sections pending | **Review next section** | Secondary: *Draft wording with Claude*; Finalize disabled with the checklist |
| Draft, ready (finalizer) | **Finalize W39 review** | Consequence text |
| Draft, ready (not a finalizer) | — | "Ready — waiting for a Product Lead or Admin" |
| Final | **Prepare W40 review**, when that week has started and the user can write | *View changes since W39 Final*; *Read full review* |
| Viewer | — | Read-only; no editor controls |

**Finalize checklist.** It sits beside the button, linked with `aria-describedby`, and mirrors the server checks exactly:
- the review is a Draft;
- you are Org Owner, Admin, Platform Owner or Product Lead;
- the environment allows changes;
- no later week is finalized;
- inputs are current (otherwise **Refresh inputs**);
- the baseline Final is unchanged;
- every section is reviewed and none needs re-check (list them, with links);
- no section is unavailable.

**"Prepare next review" disabled reasons:**
- "W40 starts Monday 28 Sep" — `createReview` uses the real calendar, not the scenario date;
- "W40 already exists — Open W40";
- read-only role;
- environment off.

**Final receipt:**

> "W39 · Final — finalized 26 Sep 2026, 14:10 Cairo by {name} · Snapshot cutoff … · Compared with W38 Final · This Final is the baseline for the next review. It records what management reviewed; it is not a release or business approval."

- There are no edit controls; the server already refuses edits.
- `view=since` shows `changesSince(current record, this Final)`, labelled "Current record compared with W39 Final — not a review."

### Record updates (block 3)

No proposal is stored, so there is no parallel store of truth. The page warns about unsaved changes.

| Field | Destination | Write path | Authority |
|---|---|---|---|
| Target Live | Delivery fact `TARGET_LIVE` | `recordFact` (expected revision, basis, source/locator, required note) | Org Owner, Admin, Platform Owner, or the assigned PM |
| Actual Live (+ extent, rollout text) | `ACTUAL_LIVE` | same | same |
| Next milestone (text, date) | `NEXT_MILESTONE` | same | same |
| Blocker (set or **withdraw**) | `BLOCKER` (withdraw = retract) | same | same |
| Next step | `NEXT_STEP` | same | same |
| Stage | `initiative.stage` | **New** `updateInitiativeStage` (expected `updatedAt`, reason, audited) | Proposed: same as delivery facts |
| Decision | Knowledge claim of type `DECISION` | Existing create + confirm (EVIDENCE with a current-scope source, or DIRECT_KNOWLEDGE with a note) | Existing claim authority |
| Differing values | Existing Decisions workbench | Link `?item=&returnTo=` | Existing |
| Scope, owner, solution/development dates | Delivery facts page | Link | Existing |

**Apply flow:**
1. The user enters proposed values.
2. **Review updates** opens a modal listing each field's *current live value → proposed value*, the basis, and the required reason, with the statement: "This updates the initiative record for {name}. Brief, Home, Roadmap and Analysis show it immediately. This review refreshes and the section will need re-check."
3. **Apply N updates**. The server re-checks authorization and the scope token, then writes in this order:
   - Stage, then Decision (product store);
   - then **one `mutateDelivery` commit** containing every delivery fact **and** `refreshReview`. This is atomic, because the delivery state commits as one unit.
   - It stops at the first failure and reports **each field's result**. It never says "all applied" unless all were.
   - If a product write succeeded but the delivery group did not run, a standalone refresh runs.
4. The result appears as `role=status` with links to Brief and the fact history. The section shows **Needs re-check**, with the commentary preserved.

**Claude:**
- It stays a secondary action that drafts commentary from supported statements only, labelled *Claude* or *Template*.
- It **never** fills block 3.
- Commentary never writes facts.

## 8. Project metrics model (Root; additive migration)

**`metric_definitions`:**
- scope: `id`, `organization_id`, `workspace_id`, `initiative_id` (composite FK to the initiative's workspace);
- definition: `name`, `definition`, `unit`, `formula`;
- source: `source_label`, `source_evidence_id` (must belong to the same initiative), `period_grain`, `timezone`;
- target: `target_value` (nullable), `target_comparator` (AT_MOST / AT_LEAST / EQUAL, nullable), `target_owner_label`, `target_approved_at`, `target_note`;
- provenance: `origin` (SYNTHETIC_DEMO / HUMAN_ENTRY), `revision`, created/updated.

**`metric_observations`:** `metric_id`, `workspace_id`, `period_start`, `period_end`, `value` (numeric, **nullable = not observed**), `captured_at`, `source_evidence_id`, `note`, `origin`. Unique on (metric, period).

**Rules:**
- RLS on. Access revoked for anon and authenticated; the service role reads through a guarded repository `listMetrics(initiativeId)`.
- No update/delete grants for the application, and **no editing UI**.
- Freshness is computed as `max(captured_at)` against the as-of date.
- Only the operator seeds, and only the registered Demo.
- Real organizations stay "Not configured".
- A source-code search must find no metric values.

## 9. Demo enrichment contract (C)

**Target state at the W39 cutoff (26 Sep 2026):**

| # | Initiative | Line · Stage | Owner | Delivery facts | Coverage | Story role |
|---|---|---|---|---|---|---|
| 1 | Merchant Flex Finance (existing) | MF · Delivery | Demo Reviewer | Target 1 Oct → 8 Oct (+7 d); milestone 29 Sep; blocker | Checked · 1 open difference (27 vs 30) · 2 not confirmed | Decision #1, moved target |
| 2 | Instant Settlement Payout (existing) | FS · Release prep | Demo Reviewer | Target 24 Sep (past); milestone 28 Sep; blocker | Setup incomplete · no Knowledge | Past target |
| 3 | Merchant KYC Refresh (existing) | Acceptance · Alignment | Demo Reviewer | No target; milestone with no date | Setup incomplete · no Knowledge | Unknown stays unknown |
| 4 | Collections Reporting Rebuild (existing) | BP · Definition | Demo Reviewer | Target 15 Oct; milestone 2 Oct | Setup incomplete · no Knowledge | Definition, upcoming |
| 5 | *Tap-to-Pay Merchant Onboarding* (new) | Acceptance · **Live validation** | Demo Reviewer | Dev start 1 Jun; target 10 Sep; **Actual Live 10 Sep (full)**; milestone "30-day live review" 10 Oct | Checked · no open differences (3 sourced entries) | Live + **2 sourced metrics** |
| 6 | *Merchant Pricing Update* (new) | FS · **Validation** | Demo Reviewer | Dev start 3 Aug; target 12 Oct; milestone "UAT sign-off" 1 Oct | Checked · 1 open difference: standard settlement fee **1.50% vs 1.75%** (two current-scope sources) | **Decision #2** |
| 7 | *Agent Cash-In Network* (new) | Digital transformation · Discovery | **Unassigned** | No target; next step recorded | Setup incomplete · nothing confirmed (2 unconfirmed entries) | Incomplete / unconfirmed |
| 8 | *Installment Early Settlement* (new) | MF · Delivery | Demo Reviewer | Dev start 1 Sep; target 20 Oct; milestone "QA sign-off" 6 Oct | Checked · no open differences | Clean within recorded checks |

Names in italics are placeholders; confirm they do not match any real initiative name.

**Result:**
- 2 open decisions and 2 blockers (both inherited from W38; see conflict C12).
- 1 target moved by +7 days.
- 4 targets within 28 days, and 2 unknown targets.
- All 5 business lines and 7 of the 8 stages.

**Metrics** (initiative #5, `origin=SYNTHETIC_DEMO`, source is a current-scope synthetic evidence record):
- **M1 "Median onboarding time" (days).** Target ≤ 3.0, approved 28 Aug 2026. Observations: 10–13 Sep (partial launch week, flagged) 4.1; 14–20 Sep 3.4. Captured 22 Sep.
- **M2 "First transaction within 7 days" (%).** **No target approved.** Observations: 10–13 Sep cohort 48%; 14–20 Sep cohort **null** ("window completes 27 Sep").

**Generation rules:**
- **Canonical v2** runs the v1 path unchanged up to and including the W38 Final and the post-W38 v1 records.
- It then **appends** the new initiatives. They are created on 22 Sep, with facts, claims and activity dated between 20 Sep 10:00 and 26 Sep 10:00, and every fixture is labelled.
- Only then does it create W39, which now has 8 sections. The four new initiatives honestly show as "New to this review scope"; facts recorded late about earlier dates are flagged as recorded late.
- New Knowledge follows v1 convention (LEGACY, "Verification history not recorded") and claims no human verification.
- Test: for the same identity, `JSON.stringify(W38)` from v1 and v2 is **byte-identical**, and all v1 facts and events are an unchanged prefix.

**Applying to the live Demo** (operator only):
- Validate the registered Demo organization and workspace, the organization name, and that the reviewer has no platform role. Never touch AMAN or user data.
- **Prefer an in-place append.** Preconditions: generation v1, the W38 hash equals the canonical v1 W38, and W39 is still a Draft.
- Then run `refreshReview` on W39. This adds 4 sections and flags changed ones, while keeping guest edits.
- If any precondition fails, **stop and report**. Reseeding is a separate Root decision; it archives the current generation.

## 10. Responsive contract

| Surface | 390 | 768 | 1024 | 1440 |
|---|---|---|---|---|
| Shell | Top bar with organization; drawer | Same as 390 | Collapsed 76 px rail with tooltips; organization in the command bar | Expanded rail with organization |
| Home | Pulse → review module → attention (3) → coming up (3) → changes (3) | One column; review module beside the pulse | Two columns (60/40) | Two columns (62/38) |
| Register | Search + **Filters (n)** sheet; list rows | Two-line list rows | Table; latest change moves under the name | Full 7-column table |
| Brief | Summary → attention → 2×2 key-dates grid → changes → risks | Same, with the facts grid inline | Main + 320 px rail | Main + 360 px rail |
| Decisions | Current layout: lane tabs, side-by-side values, "Decision controls ↓" | Lane tabs; comparison; controls below | Lane tabs above; comparison + controls | Queue \| canvas \| controls |
| Knowledge / Sources | Record blocks / list → detail | Record blocks | Table | Table |
| Roadmap | Text list | Text list | Shared axis | Shared axis |
| Analysis | One question per section, stacked | Stacked; stat row wraps | Two columns | Two columns + definitions rail |
| Admin | Filter sheet; list → detail page | List → detail | Horizontal sub-nav + table | Left sub-nav + table; two-column detail |
| Weekly | Header/action/checklist → "Sections (8)" disclosure → section | Index as a select above the section | 260 px index | 300 px index |

- No horizontal document scroll at 320 px.
- Pass 200% text and 400% desktop zoom.

## 11. Keyboard, focus and accessibility

- **Skip link** "Skip to main content" as the first focusable element, targeting a `tabindex=-1` main.
- One h1 per page. Named landmarks: *Primary*, *Administration and account*, *Initiative sections*, *Analysis sections*, *Administration sections*.
- **Route links** use `aria-current`, never ARIA tab roles.
  - Alt+1–4 switch initiative tabs (extends today's Alt+1–3).
  - Shortcuts are ignored in input, textarea, select and contenteditable.
  - ⌘/Ctrl+K opens the palette. Its entries are updated: 4 tabs, Administration (authorized users only), Weekly, and "Switch organization…", which opens the dialog.
- **Dialogs** (organization switch, drawer, Help, record-update confirmation) have:
  - a title;
  - sensible initial focus and a focus trap;
  - Escape and a visible Close;
  - focus returned to the element that opened them;
  - an actually inert background.

  The inline Sources inspector does not trap focus.
- **Tables** have a caption, `th scope`, sort buttons with `aria-sort`, and row actions named after their subject. Mobile lists keep label–value relationships.
- **Focus ring:**
  - Light surfaces: a double ring of 2 px surface colour plus 2 px **#00607A**, about 6.2:1 on the canvas and 7.1:1 on white.
  - Navy chrome: **#99DBE9**, about 9.6:1.
  - Never obscured by sticky headers; `scroll-padding-top` follows `--workspace-header-h`.
- **Contrast:**
  - Remove `--ink-400` from small text on the canvas (4.22:1).
  - Link text on light backgrounds uses dark teal, not `#00AEC7`.
  - Attention text needs at least 4.5:1: `#DC6B2F` is about 2.95:1 on the canvas, so use it only for rules and icons; a text token such as `#A3450F` gives about 5.3:1.
  - Status always pairs colour with text.
  - Nothing uses green to mean "healthy".
- **Touch targets:** 44 px for primary touch actions, measured on actual bounds.
- Route arrival and state changes are announced with `role=status`, and the org switch focuses the h1.
- **Keyboard-only completion is required for:** switching organization, opening an initiative, making a decision, applying a record update, and finalizing.

## 12. Performance contract (Root)

**Implementation:**
- Per-request `cache()` only, keyed by the verified cookie/scope, for `contextForRequest`, `workspacePresentation`, `readDelivery` (the `delivery_read_workspace` RPC) and `getInitiativeBySlug`, shared by metadata, layout and page.
- Mutations keep a fresh access check and the existing database guards.
- No process-wide session, membership, tenant or truth cache. Keep `no-store`.
- Every internal navigation uses `<Link>`, including admin.
- The shell layout persists.
- A `loading.tsx` per segment, with dimension-stable skeletons.
- The organization list loads only when the dialog opens.

**Targets** (same harness and three warm samples as the baseline; a miss is reported, never claimed as met):

| Transition | Baseline | Target |
|---|---|---|
| Home → Initiative | 1,586 ms / 30 requests | ≤ 1,000 ms / ≤ 18 |
| Initiative → Decisions | 1,208 ms / 31 | ≤ 800 ms / ≤ 18 |
| Home → Roadmap | 956 ms / 18 | ≤ 750 ms / ≤ 11 |
| Home → Analysis | 974 ms / 18 | ≤ 750 ms / ≤ 11 |
| Administration → Users | 2,391 ms / 43, document load | ≤ 1,200 ms / ≤ 20, client navigation |

- Session/provider validation happens at most once per server request (today it is 5–12 times).
- No route may regress against its baseline.

## 13. Acceptance criteria

**Navigation and scope**
1. Every signed-in capture at 390, 768, 1024 and 1440 shows the Prodwise identity and the current organization name, and on initiative routes the initiative name.
2. Primary navigation is exactly Home, Initiatives, Roadmap, Analysis. The utility zone is separate. Administration is absent for Member, Viewer and Demo guest.
3. Initiative routes show exactly Brief, Decisions, Knowledge, Sources with `aria-current`. `/delivery` highlights Brief and shows "← Brief · Delivery facts".
4. All legacy URLs resolve without loops, including in a browser that already cached the `/sources` → `/knowledge/sources` 308.
5. There is no floating Guide. Help is in the utility zone. Orientation is in-flow, dismissible and restartable.

**Organization switching and RBAC**
6. The chooser lists only server-authorized ACTIVE, non-Demo organizations. Users with one context see static text.
7. Forged or invalid switches (foreign, archived, bootstrapping, Demo, deactivated, policy-blocked) are refused by the server. A Demo guest switch is always refused.
8. A successful switch lands on the new organization's Home with an announcement; the old session is revoked; an audit row exists.
9. A form rendered before a switch cannot write after it. This includes forms that name no object.
10. A Platform Owner without a membership sees "Platform access · not a member". No role can be gained through the UI.
11. Org Admin cannot reach platform surfaces (restricted page plus server denial). Org Owner sees owners read-only, with the reason.
12. Every owner operation leaves at least one active Org Owner; the guard's error appears as a field error.

**Administration**
13. Organizations: Active by default; counts follow §4; archived Demo generations are labelled; unsupported actions do not appear.
14. Users & Access: roster → detail; platform authority is separate from organization role; protected accounts are read-only with the reason; invitations are distinct from members.
15. Sensitive actions show an in-page review of the consequence, naming the target.
16. Admin pages navigate on the client.

**Home**
17. At 1440, the h1, pulse, review module with its primary button, and the first attention row are visible above the fold (900 px). At 390, the review button appears before the attention queue.
18. Each initiative appears at most once in the queue; every reason links to its exact destination.
19. There are no KPI tiles. Setup-incomplete initiatives are never counted or described as clean.
20. Changes are sentences, with no enum labels and no ISO dates, measured against the latest Final.

**Register and initiative**
21. The register has the 7 columns and new filters; URL state survives Back.
22. Coverage labels follow §5 exactly.
23. Dates read "8 Oct 2026", with movement annotations.
24. Brief has no duplicate identity heading. On mobile, delivery facts appear within the first two screens.
25. Decisions keeps values side by side at 390. **Make a decision** is the only primary button.
26. Sources inspectors have unique accessible names.

**Weekly**
27. Saving commentary never changes facts or events (test).
28. Record updates write only through `recordFact`, `updateInitiativeStage`, or the claim create + confirm path, all with expected revisions. A stale revision is refused with a reload message. Results are reported field by field.
29. After apply, the Draft refreshes and affected sections show Needs re-check with commentary preserved. Brief, Home, Roadmap and Register show the new values **before** Final.
30. When Finalize is disabled, the unmet prerequisites are listed next to it and match the server checks.
31. The Final receipt shows finalizer, date/time, week, cutoff, baseline and the next-baseline sentence. "View changes since" and "Prepare next review" work, with disabled reasons.
32. The next Draft uses the latest Final. **W38 Final is byte-identical** before and after enrichment.
33. The default Draft view shows the index and one section; the full document is available only under `view=all`.
34. Claude is secondary and labelled, and never writes record fields.

**Analysis and Demo**
35. The three Analysis routes exist. `/analysis` returns 307. Going back from a detail page restores the filters.
36. Each portfolio count equals the result count of the register filter it links to.
37. Metric detail shows all seven definition fields. Null renders as "Not observed". The synthetic label is present. No chart appears with fewer than 3 observations.
38. No metric value exists in source code.
39. The Demo matches the §9 table: 8 initiatives, 2 open decisions, 2 blockers, 1 target moved +7 days, upcoming dates, 1 unconfirmed initiative, 2 clean initiatives, 2 metrics.
40. The operator enrichment refuses any non-Demo target. AMAN and user data are untouched. Archives are kept.

**Accessibility, performance and non-goals**
41. The criteria in §11 pass: skip link, focus ring contrast, dialogs, tables, 44 px targets, 320 px reflow, 200% text, and keyboard-only completion of the five core tasks.
42. Text contrast is at least 4.5:1, including attention text.
43. The §12 targets are measured and reported. Authorization is always fresh.
44. There are no health scores, RAG states, readiness percentages or rendered `overallState`. No marketing or login restyle. No chart dependency. No RBAC broadening beyond the items listed in §16.

## 14. Prioritized frozen contract (order of work)

**P0 — foundations, all shared**
1. **Root:** per-request de-duplication, client links, loading boundaries; baseline re-measured.
2. **Root:** switch API, `listAuthorizedContexts`, scope-token check; Demo-guest admin hiding and server denial verified (C3).
3. **A:** shell (organization control, utility zone, strip and Guide removed, skip link, focus/contrast tokens), four tabs plus the non-redirecting Sources route, and the `portfolio.ts` **interface first**.
4. **Root:** stage mutation (RPC, repository, audit) and the metric schema plus read repository.

**P1 — surfaces**
5. **A:** Home, Register, Brief, Delivery task page, Roadmap axis.
6. **C:** Weekly restructure and record updates. Delivery facts ship first; stage and decision follow once Root lands step 4. Then the receipt and next-review flow.
7. **B:** Administration console, Account, Analysis routes and metric detail.

**P2 — data, polish, proof**
8. **C:** Demo v2 generator, in-place enrichment path, metric seeds.
9. **A:** Help, orientation, empty-state sweep.
10. **All:** accessibility pass, responsive captures, performance run, rendered review, then independent persona review.

## 15. File ownership

- **A — shell, Home, register, initiative:**
  - `src/components/shell/*` (ApplicationShell, NavRail + css, GlobalCommandBar, ShellActions, WorkspaceHeader, WorkspaceTabs, CommandPalette), plus new OrganizationControl and UtilityNav;
  - `GuidePanel` → HelpPanel and FirstRunOrientation;
  - retiring `AccountAccess` (coordinate with B);
  - `src/app/page.tsx`, `src/app/initiatives/page.tsx`, `[slug]/page.tsx`, `[slug]/delivery`, `[slug]/sources/**`, `[slug]/knowledge/page.tsx` (sub-navigation), `src/app/roadmap`;
  - `src/lib/workspace/portfolio.ts` and `copy.ts`, with tests;
  - focus/contrast tokens in `src/styles/global.css`.
- **B — admin, analysis, account:**
  - `src/app/administration/**` and `src/components/admin/**`;
  - `/users` and `/platform` become redirect stubs that reuse their existing `actions.ts`;
  - `src/app/account`;
  - `src/app/analysis/**` (portfolio, projects, projects/[slug], model) and `src/components/analysis/**`.
- **C — weekly, demo:**
  - `src/app/weekly-review/**` and `src/components/weekly/**`: WeeklyIndex, SectionRecord, SectionCommentary, RecordUpdatePanel, FinalizeChecklist, FinalReceipt; `WeeklySection` is split.
  - `applyRecordUpdatesAction` in `src/lib/delivery/actions.ts`, and pure helpers in `model.ts`.
  - `src/lib/demo/canonical.ts` v2, the fixtures, the operator enrichment script, and metric seed rows.
- **Root — performance, schema, integration:**
  - migrations `0017` (metrics), `0018` (stage mutation + audit), `0019` (session switch, if a hosted RPC is needed);
  - switching and scope token in `auth/service.ts` and `core.ts`;
  - repository methods `updateInitiativeStage` and `listMetrics` across the Supabase, local and guarded adapters;
  - request caches, `next.config.ts`, `loading.tsx`, the performance harness, merges and release gates.
- **Shared-file rules:**
  - `delivery.module.css` is frozen; each surface gets its own new CSS module.
  - Changes to `labels.ts` are additive and made by Root only.
  - Tokens are changed by A only.

## 16. Schema and RBAC conflicts — Root must freeze each

| # | Conflict | Recommendation |
|---|---|---|
| C1 | There is no organization-switch API; a session binds one workspace. | Build §3. Login candidate selection is not a substitute. |
| C2 | The repository has no stage-update method. | Add a guarded, audited, optimistically concurrent mutation. Proposed authority: same as delivery facts. `changesSince` already detects stage. |
| C3 | The Demo guest context is **ORG_OWNER** (`demo-session.ts`). It currently gets the Users link and admin/finalize authority in the shared Demo, and user-management writes may be possible if `MANAGEMENT_WRITE_ENABLED`. | Hide Administration for guests. Verify on the server that guest management writes are refused, and if not, add a narrow denial (a security fix, not a feature). Keep guest business writes and finalization as designed today, and note that guests can finalize W39. |
| C4 | An Org Owner cannot change owners (`OWNER_PROTECTED`). Platform "Replace owners" demotes **every** other owner. No path deactivates a single owner. | Keep this. Label Replace as destructive. Add owners through provisioning. Demote a single owner only by re-provisioning, and only if Root confirms the hosted RPC supports changing the role of an existing membership. Never show owner deactivation. |
| C5 | A Product Lead can edit any weekly section but only owner facts (`FactEditor` rule). | Their record-update fields appear read-only with the reason. Do not broaden. |
| C6 | A Platform Owner without a membership has a null `memberId`. | They cannot be assigned as owner. Show "Platform access · not a member". |
| C7 | The metrics model does not exist. | Additive tables in §8. Operator seeds the Demo only. No editing UI. |
| C8 | The **permanent 308** `/sources` → `/knowledge/sources` has shipped. A reverse redirect would loop for browsers that cached it. | Render both paths and redirect neither way. The canonical link and tab point to `/sources`. |
| C9 | Separating "Save draft" from "Mark reviewed" needs a section-schema change. | Keep the combined **Save and mark reviewed**, clearly labelled, with an unsaved-changes guard. |
| C10 | Varied owners in the Demo would need synthetic identities and memberships (auth tables). | Out of scope. Use Demo Reviewer, with one initiative Unassigned. |
| C11 | W38 must stay byte-identical, but guests may have finalized or edited W39, and a reseed changes IDs. | In-place append only when the §9 preconditions hold; otherwise stop and escalate. |
| C12 | "About one blocker" conflicts with the two blockers already frozen in W38. | Keep 2 and add none. Withdrawing Instant Settlement Payout's blocker would create a resolution that did not happen and would read "current status unknown". Root may override. |
| C13 | Should the Demo organization appear in the Platform Owner's switcher? | Exclude every Demo generation from product switching; view them in admin only. Keeps real identities out of synthetic data. |
| C14 | `overallState` still exists in the schema and seeds. | Never render it anywhere. |
| C15 | Stage and Decision writes cannot join the delivery commit, so partial success is possible. | Use the ordered writes and per-field reporting in §7. Never claim all changes applied when some failed. |

## 17. Screenshots needed for the final rendered review

Synthetic data only. Capture at 390, 768, 1024 and 1440 unless a width is noted, plus keyboard-focus captures where marked ⌨.

1. **Shell:**
   - Home as Demo guest;
   - the organization dialog open, for a Platform Owner with two or more organizations (desktop dialog and mobile sheet ⌨), using synthetic or locally seeded organization names;
   - the drawer open at 390 ⌨;
   - collapsed rail at 1024;
   - Viewer and writes-off variants.
2. **Home:**
   - Demo populated;
   - sparse real-style organization (local fixture with 0 and with 2 initiatives);
   - Viewer;
   - orientation shown and dismissed;
   - just after a switch (announcement).
3. **Register:**
   - default;
   - Attention and Coverage filters;
   - filtered to zero;
   - mobile list;
   - focus on a sort header ⌨.
4. **Initiative:**
   - Brief for Merchant Flex Finance, Agent Cash-In (setup incomplete) and Tap-to-Pay (Live);
   - Delivery ledger with one editor open;
   - Decisions for Merchant Flex Finance and Merchant Pricing (1440, 390);
   - Knowledge;
   - Sources with an inspector open ⌨.
5. **Roadmap:** shared axis, the "No Target Live" group, and the mobile text list.
6. **Analysis:**
   - Portfolio;
   - Projects;
   - project detail with metrics (Tap-to-Pay) and without (not configured);
   - back navigation keeping filters.
7. **Weekly:**
   - not prepared;
   - Draft (index + section);
   - inputs stale;
   - record-update confirmation dialog ⌨;
   - apply result with Needs re-check;
   - Finalize blocked with its checklist;
   - ready to finalize;
   - Final receipt;
   - `view=since`;
   - `view=all`;
   - Claude and Template labels.
8. **Administration** (synthetic organizations/people only):
   - Platform Organizations list and detail;
   - Users & Access list and person detail;
   - Access Policies list and edit;
   - organization-scope Users, Invitations and person detail;
   - the Replace-owners consequence review;
   - the restricted page for a Member.
9. **Account** (Demo and real-style) and the **Help** dialog ⌨.
10. **Reflow and zoom:** 320 px reflow for Home, Weekly and Register; 200% text for Brief and Weekly.

This is a design recommendation only. Final UI approval waits for these rendered captures and the acceptance evidence above.