# Local reviewer Demo validation

Status: **PASS — local operator and domain gates**. Browser and hosted-production acceptance are recorded separately by the integration coordinator.

- Organization: **Prodwise Demo**
- Organization ID: `31c38259-34fa-4459-95b2-762d68e860e4`
- Workspace ID: `0ef5f8e7-4371-46d6-ad85-77a61d9df8f2`
- Reviewer: `reviewer@prodwise.demo`
- Organization role: `ORG_OWNER`
- Global platform role: none
- Allowed domains: none; exact allowed email: `reviewer@prodwise.demo`
- Password: private ignored registration file only; omitted from this report.

## Operator proof

1. Initial provisioning used the existing persisted Platform Owner through the Auth service domain interfaces. New reviewer acceptance completed locally; no email delivery or public signup was needed.
2. A repeated `--provision-demo` invocation left Auth, product data, both delivery files, environment and credential file bytes unchanged.
3. A temporary reviewer-created initiative with `isDemo: false` and a temporary Demo delivery edit were introduced inside the registered Demo workspace. Explicit `--reset-demo` restored the exact canonical product and Demo delivery bytes.
4. Other-workspace product rows, the configured legacy delivery file, existing credentials, Auth sessions and `.env.local` remained unchanged.
5. A reset pointing at another organization was refused before any mutation.
6. A reset registration claiming `PLATFORM_OWNER` for the reviewer was refused before any mutation.
7. The local reviewer authenticated successfully into Demo as ORG_OWNER with a null platform role. Authentication into the configured AMAN workspace was rejected. The verification session was logged out and original Auth bytes restored.
8. Every reset captured a private backup. Credentials, backups and audit files remained ignored and untracked.

## Domain and Analysis proof

Eight automated tests cover deterministic scoped data, unique Demo IDs, the 27-versus-30 mismatch and explicit supersession, W38 Final/W39 Draft with +7-day Target Live movement, seven unknown delivery dates, reset refusals, record-derived Analysis counts, exclusion of foreign/future/old events, honest fixture attribution, and a stable scenario date independent of the real reset day.

## Claude critique corrections

- The registered local Demo policy was narrowed through the existing audited Platform Owner API to the exact reviewer email, with no allowed domain. Both a different `prodwise.demo` address and an arbitrary external address were rejected by the ordinary invitation flow. A duplicate invite to the reviewer was also refused. Org Owner attempts to edit platform-managed policies were refused; all refusal checks left Auth bytes unchanged.
- Every Demo membership is checked before reset: no member may hold a platform role or belong to another organization. The private server-side registration pins organization/workspace IDs; the organization name is an additional check, not the source of authority.
- Demo facts and the prepared W38 Final baseline carry explicit `preparedAsFixture` provenance and the label **Synthetic scenario preparation**. Schema-required reviewer references remain for referential integrity, but these references do not claim the real reviewer recorded or approved the seeded material. A genuine subsequent reviewer fact edit drops the fixture flag; the historical baseline remains unchanged.
- The private registration pins `asOf` to **26 September 2026**. Demo analysis uses that visible scenario date; ordinary organizations use the live clock. The reset is repeatable on later real dates.

The canonical Demo contains four initiatives, two targets upcoming at the scenario cutoff, one past target needing confirmation, one unknown target, one target-date revision within 28 days, one initiative with open decisions and two with explicit blocker notes. These are counts of synthetic records, not claims about real business outcomes.

TypeScript and scoped lint passed. No production endpoint, hosted identity provider, or external email system was used by this local operator gate.
