# Connector live verification (Phase 12, against the deployed final candidate)

Provider registrations and the Vercel Production variables exist (owner-confirmed; values
are never printed or requested). Nothing here is run against an intermediate build.
Everything is run in **a real, non-Demo organization**, using a test account the owner
controls, and only on items that test account may see. Nothing imported during
verification is shown in reports or screenshots beyond its title.

## Pre-flight (read-only, before the first click)

| Check | How | Pass when |
|---|---|---|
| Variables present | Administration → Connected sources as an admin | No connector shows "Not available yet" |
| Callback URLs | Provider consoles, compared with `https://prodwise-flax.vercel.app/api/connectors/<slug>/callback` | Slugs `jira`, `gmail`, `google-drive`, `figma` match exactly (scheme, host, no trailing slash) |
| Requested scopes | Code: `src/lib/connectors/oauth.ts` | Jira `read:jira-work read:jira-user offline_access`; Gmail `openid email gmail.readonly`; Drive `openid email drive.readonly`; Figma `current_user:read file_content:read file_comments:read` |
| Google consent mode | Google Cloud → OAuth consent screen | App in *Testing* with the test account listed. In Testing mode, refresh tokens for these scopes **expire after 7 days**: expect "Reconnect" a week after connecting. That is expected, not a defect. |
| Atlassian | Developer console → Authorization | OAuth 2.0 (3LO) enabled; the test account can reach the Jira site |
| Figma | App settings | Scopes above granted; refresh uses `POST /v1/oauth/token` with `grant_type=refresh_token` ([Figma OAuth docs](https://developers.figma.com/docs/rest-api/oauth-apps/)) |

## Per-connector flow

Run each row for Jira, Gmail, Google Drive and Figma, in that order.

| # | Step | Expected |
|---|---|---|
| 1 | **Connect** from Account → Connected sources | Provider consent → back on Connected sources with "Connected", the account label, and no token, code or provider text in the URL |
| 2 | **Search / browse**: Jira JQL or project, Gmail scoped query, Drive name search, Figma file link → frames | Only metadata rows (name, kind, updated, one factual line). No content is read yet |
| 3 | **Import selected** item(s) into a test initiative | Saved as **Evidence** (Sources tab), with provenance: provider, container, reference, link, "imported by", time. **No Knowledge, Decision or Commitment is created.** Proposals appear only after "Read with AI", and each needs explicit human confirmation |
| 4 | **Refresh** unchanged | "No change since last snapshot"; no new snapshot; *last checked* updates |
| 5 | **Change at source**, then refresh (edit the Jira summary, reply in the thread, edit the Doc, rename a Figma frame) | A new snapshot is saved; History shows "Source changed"; the Notifications item links to it; the earlier snapshot stays readable |
| 6 | **Unavailable at source** (remove access, trash or move the item), then refresh | "Source unavailable at last check"; the last snapshot is kept; nothing is deleted |
| 7 | **Disconnect**, then try a search | "Connect your … account first"; imported Evidence is unaffected |
| 8 | **Reconnect** | Works without duplicate connections; the earlier imports refresh again |

## Cross-cutting checks (each connector)

| Concern | How | Pass when |
|---|---|---|
| State / forgery | Replay the callback URL, or open it with a tampered or missing `state` or cookie | Lands on Connected sources with "That … search or selection isn't valid"; no connection change |
| Token refresh | Wait past the access-token expiry (Google/Figma about 1 h; Atlassian about 1 h), then refresh a source | Succeeds silently; Atlassian rotates the refresh token |
| Concurrent refresh | Open two tabs and refresh the same source at once | One snapshot at most; no "Reconnect" caused by a refresh-token race |
| Org isolation | Sign in to a second organization | That organization shows none of the first organization's connections or imports |
| Viewer | As a Viewer: open Connected sources, then attempt the callback | No connect or import controls; callback says view-only; nothing changes |
| Demo | In the Demo organization | "Connectors are off in the Demo organization"; no connect path |
| Secret leakage | Browser devtools (network, HTML, console) and Vercel function logs for the whole run | No access token, refresh token, client secret, auth code or provider error body anywhere; logs carry only `connector_callback_failed` with an error kind |
| Freshness | Sources tab after each step | "Last synced" / "Last checked" match the steps above |

Record the results in the Phase 12 production smoke table: pass or fail per cell,
with the failure text for any failure. Include no content from the imported items.
