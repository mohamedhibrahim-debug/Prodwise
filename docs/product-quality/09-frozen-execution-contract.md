# Frozen product comprehension contract

The user mission, researched evidence (02), and Claude Opus design recommendation (claude-design.md) are consumed before implementation. Root freezes that recommendation with the following explicit corrections. Implementation starts after this document.

- Platform Owners retain access to EVERY active organization, including the registered Demo. Claude C13 and criteria 6–7's Demo exclusion are rejected because they conflict with the approved global authority model. Guest sessions remain immutably pinned to Demo and cannot switch; archived organizations remain unavailable. Normal membership policy is still enforced. Never manufacture a membership for platform access.
- Preserve the existing two historical blockers. The user requested approximately one, not exactly one; inventing a resolution to reduce the count would distort the record. Add no additional blockers. Preserve the W38 Final byte-identically, and append four fictional initiatives with honest late-recorded provenance; refresh the existing W39 Draft without discarding commentary. Operator enrichment aborts on changed prerequisites.
- Synthetic metric observations belong in the canonical Demo fixture/operator model and the database, never disconnected presentation constants. Claude's absolute prohibition on values anywhere in source code is interpreted as a prohibition on UI hard-coding, not on test/seed fixtures.
- Stage follows current delivery-fact authority (organization administrator, platform authority, or assigned PM) and optimistic concurrency. General decisions use the existing create-and-confirm Knowledge path. Review commentary never writes canonical facts. All structured writes explicitly confirm consequences and report partial success honestly.
- Product Leads retain current review editing/finalization authority; that does not expand their initiative-fact authority.
- Keep Save and mark reviewed combined. Do not invent independent persisted draft/approval states.
- Guest business operation/finalization remains authorized. External invitations and sensitive administration remain denied by existing Demo management guards. Hide administration from guest navigation and enforce denial server-side.
- No new destructive management actions or platform-role grant UI. Existing replacement of organization owners is sensitive, requires clear consequence review, and preserves at least one active owner.
- Both Sources URL forms render the same library to avoid loops with the previously shipped permanent redirect.
- Use the final measured baseline in 05 (1334/1227/911/933/2350 ms), not the superseded timing table quoted by Claude.
- Session, membership, organization policy and initiative truth may only be memoized within one server request. Mutations use fresh access and existing transaction/concurrency guards.

## Shared ownership and interfaces

A owns shell/components, global focus and design tokens, Home, register, Brief, Knowledge/Sources, Roadmap, Help/orientation and the pure shared portfolio projection. B owns administration, legacy admin page redirects, account page, Analysis routes/components. C owns Weekly UI/actions/model, delivery fact UI, canonical Demo enrichment and fixtures. Root owns auth service/core/scope switching, data repositories, delivery repository caching, schemas, metric repository, stage mutation, loading boundaries, gates and release. No agent edits another owner's file without a handoff.

Root APIs:
- auth/scope.ts: assertFormWorkspace(form, ctx), requiring scopeWorkspaceId matching the server context; client input is a stale-scope fence, never authority.
- auth/service.ts: listAuthorizedContexts() returns AuthorizedContext[] with organizationId, workspaceId, organizationName, workspaceName, role, platformRole, current, isDemo. switchOrganization(workspaceId, expectedWorkspaceId) rotates the bound session after a fresh authorization check.
- app/account/organization-actions.ts: switchOrganizationAction FormData action; consumes workspaceId and scopeWorkspaceId, redirects Home after success. Root owns this file within B's account directory.
- lib/analysis/metrics.ts: listProjectMetrics(initiativeId?: string) scoped server-only read; types in lib/analysis/metric-types.ts. Root publishes exact types early.
- lib/workspace/stage.ts: updateInitiativeStage({initiativeId, stage, expectedUpdatedAt, reason, scopeWorkspaceId}) guarded audited mutation, returns void or throws safe error. Root owns stage.ts; no competing stage model.

A publishes the portfolio projection interface before consumers implement. C coordinates Demo metric fixture shape with Root before writing seeds. Delivery.module.css is frozen; surfaces add their own CSS modules. Root is sole schema/merge/deploy owner. Production remains unchanged until all gates in 08 pass.
