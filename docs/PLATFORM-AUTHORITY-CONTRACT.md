# Platform and organization authority

Approved scope: global identity, independent platform authority, and organization membership. The MVP retains one configured product workspace and has no organization switching UI. Platform administration targets organizations explicitly.

## Roles

| Scope | Persisted role | Authority |
| --- | --- | --- |
| Global identity | PLATFORM_OWNER or no platform role | Full platform administration and organization access, including access without membership |
| Organization membership | ORG_OWNER | Organization administration, including Admin role management |
| Organization membership | ADMIN | Member and Viewer access management |
| Organization membership | MEMBER | Product work and assigned weekly review sections |
| Organization membership | VIEWER | Read-only access |

Platform authority takes precedence over a Viewer or inactive organization membership. It does not fabricate an Org Owner membership. An organization role never grants global authority. Permissions are re-resolved on server requests and database mutations.

Multiple ORG_OWNER memberships are allowed. Every active organization must retain at least one active Org Owner. Platform recovery can replace organization owners atomically and records the operation.

## Approved local provisioning

| Identity | Global role | AMAN membership |
| --- | --- | --- |
| mohamed.hibrahim@aman.eg | PLATFORM_OWNER | ORG_OWNER |
| mohamedhassanpe@outlook.com | PLATFORM_OWNER | ORG_OWNER |

These emails are provisioning inputs, never authorization conditions. The first platform role is established by a trusted, explicit operator bootstrap. Subsequent global grants require persisted Platform Owner authority.

AMAN stores allowed domains aman.eg and rayacorp.com, and the exact exception mohamedhassanpe@outlook.com. Other Outlook addresses remain denied in normal organization flows. A separate Example Bank organization may store examplebank.com without inheriting AMAN domains or exceptions.

## Boundaries and audit

Global identities own credentials and the platform role. Organization memberships own their role, active access, Product Lead capability, and any explicit policy override. Workspaces reference organizations. Membership IDs and global user IDs have separate purposes.

Normal invitations always enforce the target organization's policy. A dedicated Platform Owner provisioning operation may deliberately override it for one user and organization, with a required reason. The persisted grant remains usable after restart. It does not add a domain or change another organization's policy.

Audit records identify the real actor, target user or pending invitation email, target organization, role, timestamp, reason, and policy-override flag. Invitation acceptance links the grant to the global identity. Global platform grants use global audit scope.

Normal User Management cannot assign ORG_OWNER or PLATFORM_OWNER, or modify protected owner/platform identities. A dedicated platform screen provides organization creation, policy configuration, organization access grants, owner replacement and global Platform Owner grants.

Platform-issued invitations have a dedicated resend/revoke action in Platform administration. Resend replaces the previous opaque token and starts a new seven-day expiry. Normal User Management cannot rotate these invitations. Both lifecycle actions require persisted platform authority and a recorded reason; policy overrides remain scoped to the original grant.

## Historical product data

Existing finalized Weekly Reviews retain their frozen JSON, member labels and historical role spellings. Current access uses live authority. New delivery and review actions record the real global user ID and the actual organization member ID, which may be null for a Platform Owner.

Role or membership changes can make a draft's current inputs stale. Drafts must be refreshed and human-reviewed before finalization. Target Live history, confirmed facts and previous finalized baselines are preserved.

Role restrictions and environment write restrictions remain independent. Platform authority does not enable writes when the environment write gate is disabled.

## Local operator tool

scripts/auth/provision-local-aman.mjs provisions only the explicitly approved local AMAN identities. It requires local authentication, an ignored/untracked environment file, an explicit bootstrap acknowledgement, and the matching configured workspace. It preserves private credentials and product data; it never changes the Anthropic key or creates hosted accounts.
