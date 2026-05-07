# Sentry setup — operator runbook

Code is wired but inert until the env vars below are populated.

## 1. Create the Sentry project

In the Sentry dashboard (region: **DE / EU**):

- Org: pick or create one (e.g. `diversif`).
- Project: `diversif`, platform **JavaScript / SvelteKit**.
- Copy the **DSN** from project settings.

You can also run this via the Sentry MCP if it's authed locally:

- `mcp__claude_ai_Sentry__find_organizations`
- `mcp__claude_ai_Sentry__create_project` (org=diversif, platform=javascript-sveltekit)
- `mcp__claude_ai_Sentry__find_dsns` to grab the DSN

## 2. Create an internal integration auth token

Sentry → Organization Settings → Developer Settings → New Internal Integration:

- Name: `diversif-sourcemap-upload`
- Permissions: **Project: Releases — Admin**.
- Save and copy the token. This is `SENTRY_AUTH_TOKEN` (build-only).

## 3. Wire env vars in Coolify

| Variable                    | Value                                                  |
| --------------------------- | ------------------------------------------------------ |
| `SENTRY_DSN`                | DSN from step 1 (server)                               |
| `PUBLIC_SENTRY_DSN`         | same DSN, exposed to browser                           |
| `SENTRY_ENVIRONMENT`        | `production`                                           |
| `PUBLIC_SENTRY_ENVIRONMENT` | `production`                                           |
| `SENTRY_AUTH_TOKEN`         | build-time only — set as a **build secret** in Coolify |
| `SENTRY_ORG`                | your Sentry org slug                                   |
| `SENTRY_PROJECT`            | `diversif`                                             |
| `SENTRY_RELEASE`            | leave empty — adapter resolves to `git rev-parse HEAD` |

Redeploy after saving.

## 4. Configure an alert rule

In the Sentry project, Alerts → New Alert Rule:

- Trigger: "When a new issue is created"
- Action: "Send a notification to a member" → your email.
- Save.

## 5. Smoke test

After deploy:

1. Hit a route that throws (or temporarily add `throw new Error('sentry-smoke')` to a server load and re-deploy a staging build).
2. Watch:
   - Coolify stderr stream → `[diversif:error]` line with an `id`.
   - Sentry → Issues → new issue tagged `errorId=<that id>`, `route=/...` (with `[id]` masking).
3. Confirm the issue's request URL has no query string and no PII.
4. Remove the smoke-test throw and redeploy.

## 6. Privacy policy ack

After verifying the integration is live, confirm `/politique-confidentialite`
section 4 is rendered correctly in production. The "Dernière mise à jour"
should match the deploy date. Replace the "à vérifier sur le DPA" placeholder
with Sentry GmbH's registered address from https://sentry.io/legal/dpa/.
