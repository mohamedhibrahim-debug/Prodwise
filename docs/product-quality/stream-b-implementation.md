# Analysis and administration implementation

Status: source implementation and local populated-metric/sensitive-form gates passed. Hosted guest and final integration gates remain with the integration coordinator. No production changes or commits were made by this stream.

## Implemented surfaces

- `/analysis/portfolio` uses the same portfolio projection and filters as the initiative register. Counts drill into their supporting records. Planned targets, current confirmation history, unknown dates, and overlapping attention categories are described explicitly.
- `/analysis/projects` is a measurement coverage register with line, stage and measurement filters. Dedicated project routes retain the filtered return path and link recorded evidence to Sources.
- Metric views show definition, source, period, formula, approved target and approver, freshness, observations and synthetic provenance. A missing latest observation stays missing; zero is a valid observation. Unapproved targets produce no comparison. Charts require three numeric observations. Percentage differences use percentage points.
- `/administration` separates platform authority from the named current organization. Platform routes cover organizations, scoped access, identities and access policies. Organization routes cover settings, members, invitations and its policy.
- Supported actions reuse existing service functions. No global-role grant control or unsupported organization deletion/archive action was introduced. Owner and platform identities are protected in normal organization management. Platform Owners retain access to active Demo organizations.
- `/account` shows actual identity, independent platform and organization roles, scoped workspace, password change and sign out. Guest account controls remain unavailable.
- Legacy `/users`, `/platform` and `/analysis` entry points redirect to the corresponding real routes.

## Scope and interaction safeguards

Every management, password and organization-switch form carries `scopeWorkspaceId`. Mutation actions check fresh session scope before invoking existing authorization. Successful actions refresh administration while retaining the current task route and its result.

Sensitive policy, membership and owner-replacement forms show a named consequence and entered values. The initial review control is a non-submit button and cancels the click default before changing review state. The server also rejects these actions without an explicit reviewed state, preventing native or pre-hydration submission from applying changes. The review heading receives focus. Errors retain entered values; successful password changes clear password inputs.

Two unscoped forms observed in the shared shell are the duplicate desktop/mobile Sign out controls. They carry no named application fields and end the global session; they do not modify an organization.

## Evidence

- Full TypeScript check: passed.
- Scoped ESLint: passed.
- Nine pure tests: passed, including missing-versus-zero observations, approval, chart eligibility, percentage comparison, safe back paths, identity-aware active counts, invitation states and pre-review rejection.
- Desktop/tablet/phone rendering: 54 route-viewports across 1440, 768 and 390 pixels; no page overflow or unnamed visible fields.
- Synthetic administration: Viewer platform restriction observed; current organization switched to Interface Lab through the actual UI.
- Final clean-runtime gate: 16 checks passed and 15 populated metric/policy viewports at 1440/768/390 pixels passed. Hydration and two animation frames were awaited before interaction/capture. Review focus, prior values, deliberate review state and retained input passed. No business requests were attempted; zero runtime errors, page overflows or unnamed visible fields.
- Canonical metrics: one of eight initiatives has two persisted definitions and four observations. Latest missing remains `Not observed`, no unapproved target comparison appears, and two numeric observations do not fabricate a trend chart. Filtered return and scoped evidence links passed.
- Private screenshots and reports: `.data/product-quality/b-ui/` and final `.data/product-quality/b-ui-final/report.json`; only synthetic business screens were captured.

The initial development runtime exhibited incomplete hydration, independently reproduced by the shell stream. After restart, a focused probe found a separate click-default issue: the review button became a submit button during the same click. Interception prevented the request from reaching the server. Cancelling that default fixed the issue, and the final clean-runtime gate passed with zero attempted business requests. The earlier reports are retained as history.

Explore Demo guest login is deliberately unavailable with `AUTH_MODE=local` in the auth service. Its new-shell navigation/direct-route integration gate therefore remains a hosted or dedicated-backend check; the local run does not claim it passed. Real management mutations and production acceptance also remain outside this read-only UI gate.

## Ownership

This stream changed administration and analysis routes/components, account page/password action, and existing Users/Platform action adapters. It did not edit auth service/core, organization-switch action, repositories, migrations, the shared shell/tokens, Weekly Review or Demo provisioning.
