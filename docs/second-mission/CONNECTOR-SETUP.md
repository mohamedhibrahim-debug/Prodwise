# Connected sources — setup (manual steps)

Prodwise connectors are real OAuth integrations. Until a provider is registered, its card says
**"Not set up for this installation"** and manual source references keep working. Nothing is simulated.

What every connector does: a person connects **their own** account, searches or pastes a link, selects
items explicitly, and imports them as **Source + Evidence snapshots**. Proposals come only from reading a
snapshot, and nothing becomes Knowledge, a decision or a delivery fact until a person confirms it.
Connectors are always off in the Demo organization.

Production origin used below: `https://prodwise-flax.vercel.app`. Replace it if the domain changes.

## 0. Shared (once)

1. Generate a token-sealing key: `openssl rand -base64 32`.
2. In Vercel → Prodwise → Settings → Environment Variables (Production, **not** `NEXT_PUBLIC_`):
   - `CONNECTOR_TOKEN_KEY` = the generated value
   - `PRODWISE_PUBLIC_URL` = `https://prodwise-flax.vercel.app`
3. Migration `0039_connectors.sql` is applied with the release (tables `connector_connections`,
   `source_item_syncs`; RLS on, service role only).

Rotating `CONNECTOR_TOKEN_KEY` invalidates every stored connection: people simply reconnect.

## 1. Jira (Atlassian OAuth 2.0 3LO)

1. Open <https://developer.atlassian.com/console/myapps/> → **Create** → **OAuth 2.0 integration**, name `Prodwise`.
2. **Permissions** → Jira API → **Add** → **Configure** → classic scopes **`read:jira-work`** and **`read:jira-user`**. Nothing else.
3. **Authorization** → OAuth 2.0 (3LO) → Callback URL: `https://prodwise-flax.vercel.app/api/connectors/jira/callback`
   (add `http://localhost:3000/api/connectors/jira/callback` too if you test locally).
4. **Settings** → copy **Client ID** and **Secret** into Vercel as `JIRA_OAUTH_CLIENT_ID` and `JIRA_OAUTH_CLIENT_SECRET`.
5. **Distribution** → Edit → **Sharing** (with the personal-data declaration). Until sharing is on, only the app owner can connect.
6. If your Atlassian organization restricts third-party apps, an Atlassian org admin must allow the app
   (admin.atlassian.com → Security / Apps → user-installed / third-party app policy).

Prodwise requests `offline_access` so connections survive; Atlassian rotates refresh tokens and Prodwise stores each new one.

## 2. Gmail and 3. Google Drive / Docs (one Google OAuth client)

1. <https://console.cloud.google.com/> → create or select project `Prodwise`.
2. **APIs & Services → Library** → enable **Gmail API** and **Google Drive API**.
3. **Google Auth Platform → Branding / Audience**:
   - If every user is in your Google Workspace domain, choose **Internal** (no Google verification needed).
   - Otherwise **External**. While in **Testing**, add each person as a test user. `gmail.readonly` and
     `drive.readonly` are restricted scopes, so public External use requires Google verification and a security assessment.
4. **Data access** → add scopes: `openid`, `email`, `https://www.googleapis.com/auth/gmail.readonly`,
   `https://www.googleapis.com/auth/drive.readonly`. No send, modify or write scopes.
5. **Clients → Create client → Web application**. Authorized redirect URIs:
   - `https://prodwise-flax.vercel.app/api/connectors/gmail/callback`
   - `https://prodwise-flax.vercel.app/api/connectors/google-drive/callback`
6. Copy the client ID and secret into Vercel as `GOOGLE_OAUTH_CLIENT_ID` and `GOOGLE_OAUTH_CLIENT_SECRET`.
7. If your Workspace admin restricts third-party access (Admin console → Security → Access and data control → API controls),
   mark this client ID as **Trusted**.

Gmail and Drive are separate connections with separate consent: sharing documents never shares a mailbox.

## 4. Figma

1. <https://www.figma.com/developers/apps> → **Create a new app** (owned by your Figma team or organization).
2. Callback: `https://prodwise-flax.vercel.app/api/connectors/figma/callback`.
3. Scopes: **`current_user:read`**, **`file_content:read`**, **`file_metadata:read`**, **`file_comments:read`**. No write scopes.
4. Copy the client ID and secret into Vercel as `FIGMA_OAUTH_CLIENT_ID` and `FIGMA_OAUTH_CLIENT_SECRET`.
5. Keep the app private to your Figma organization. Access for people outside it requires Figma's publishing review.

## After setting variables

Redeploy (environment variables apply to new deployments). Then **My account → Connected sources** shows
**Connect** for each configured provider, and each initiative's **Sources → Import from Jira, Gmail, Drive or Figma** opens the importer.

## What people will see when something goes wrong

| Situation | Message (what happened → what now) |
|---|---|
| Not configured | "Not available yet — … hasn’t been set up for Prodwise. You can still add sources by reference." (Platform Owners also see which variables are missing.) |
| Token expired / access revoked | "Your … connection expired or was revoked. Reconnect it; nothing already imported has changed." |
| No permission to an item | "Your … account can't open this item. Ask for access in …; the last saved snapshot is kept." |
| Deleted / moved / unshared | "… no longer has this item, or it is no longer shared with you. The last saved snapshot is kept." (recorded once in History) |
| Rate limited / provider down | "… asked Prodwise to slow down / didn't respond. Try again; nothing was saved." |
| Forged or stale sign-in return | "The … sign-in expired or didn't match this session. Start again; nothing changed." |
