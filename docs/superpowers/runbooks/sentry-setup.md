# Sentry setup — operator runbook

Code is wired but inert until the env vars below are populated.

## 1. Create the Sentry project

In the Sentry dashboard (region: **DE / EU**):

- Org: pick or create one (e.g. `diversif`).
- Project: `diversif`, platform **JavaScript / SvelteKit**.
- Copy the **DSN** from project settings.

You can also run this via the Sentry MCP tools if authed locally
(`find_organizations`, `create_project`, `find_dsns`).

## 2. Create an internal integration auth token

Sentry → Organization Settings → Developer Settings → New Internal Integration:

- Name: `diversif-sourcemap-upload`
- Permissions: **Project: Releases — Admin**.
- Save and copy the token. This is `SENTRY_AUTH_TOKEN` (build-only, used by the
  `sentrySvelteKit` Vite plugin to upload the adapter-node `./build` output and
  delete the resulting `.map` files afterwards).

## 3. Wire env vars in Coolify

| Variable                                     | Value                                                                                                                                                                                           |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SENTRY_DSN`                                 | DSN from step 1 (server: errors, tracing, logs, cron check-ins)                                                                                                                                 |
| `PUBLIC_SENTRY_DSN`                          | same DSN, exposed to the browser (errors, tracing, replay, feedback, `/monitoring` tunnel)                                                                                                      |
| `SENTRY_ENVIRONMENT`                         | `production`                                                                                                                                                                                    |
| `PUBLIC_SENTRY_ENVIRONMENT`                  | `production`                                                                                                                                                                                    |
| `SENTRY_AUTH_TOKEN`                          | build-time only — set as a **build secret** in Coolify                                                                                                                                          |
| `SENTRY_ORG`                                 | your Sentry org slug                                                                                                                                                                            |
| `SENTRY_PROJECT`                             | `diversif`                                                                                                                                                                                      |
| `SENTRY_RELEASE`                             | leave empty for Coolify — `vite.config.ts` resolves `SENTRY_RELEASE`, then `SOURCE_COMMIT` (Coolify default), then `GITHUB_SHA`, then `GIT_COMMIT_SHA`, then `git rev-parse HEAD` at build time |
| `BODY_SIZE_LIMIT`                            | `131072` — also caps `/monitoring`; replay envelopes measure 34–57 KB, too close to 64 KB (see `.env.example`)                                                                                  |
| `SENTRY_TRACES_SAMPLE_RATE`                  | `0.1` (server tracing sample rate, 0–1; non-numeric/out-of-range falls back to this default)                                                                                                    |
| `PUBLIC_SENTRY_TRACES_SAMPLE_RATE`           | `0.1` (browser tracing sample rate, same fallback rule)                                                                                                                                         |
| `PUBLIC_SENTRY_REPLAYS_SESSION_SAMPLE_RATE`  | `0` (no continuous Session Replay recording — the privacy policy promises this; amend `/politique-confidentialite` §4 before raising it)                                                        |
| `PUBLIC_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE` | `1` (always attach the buffered ~last minute of replay to a captured browser error)                                                                                                             |
| `SENTRY_REPOSITORY` (optional)               | `<owner>/<repo>`, e.g. `simonbrunou/diversif` — only after step 7 (suspect commits)                                                                                                             |

Redeploy after saving.

## 4. Configure alert rules

In the Sentry project, Alerts → New Alert Rule:

- **Issues**: trigger "When a high priority issue is created" → notify a
  member/team. (This is the `SENTRY_DSN`-side equivalent of the old
  "every new issue" rule — high-priority avoids alert fatigue from
  low-severity noise.)
- **Crons**: Alerts → New Alert Rule → Monitor type → trigger on a missed or
  failed check-in for `diversif-cleanup`, so a silently-broken 6-hourly
  cleanup job (or a container that stopped booting) gets noticed instead of
  just showing up as a red dot on the Crons page.

## 5. Project settings — IP address handling

Settings → Security & Privacy → enable **"Prevent Storing of IP Addresses"**.
The app-side scrubbing in `src/lib/sentry.ts` and the same-origin `/monitoring`
tunnel already stop the client's real IP from reaching Sentry (no client
headers are forwarded), but flipping this project setting is a second,
independent layer enforced on Sentry's side regardless of app code.

No extra toggles are needed for Session Replay or Logs — both are enabled by
having `PUBLIC_SENTRY_DSN` / `SENTRY_DSN` set; sampling is controlled entirely
by the `*_SAMPLE_RATE` env vars above.

## 6. Cron monitor

`diversif-cleanup` is created automatically by the SDK the first time the
6-hourly cleanup job checks in — no manual monitor setup needed. Expected
schedule: every 6 hours, 30 min margin, 5 min max runtime; it also runs once at
every boot. If the monitor doesn't appear in Sentry → Crons after a deploy,
the cleanup job never ran (check container logs for the `cleanup` subsystem).

## 7. Suspect commits (optional)

To let Sentry point at the commit that likely introduced an issue:

1. Sentry → Organization Settings → Integrations → connect **GitHub** and
   grant it access to this repository.
2. Set `SENTRY_REPOSITORY=<owner>/<repo>` (e.g. `simonbrunou/diversif`) as a
   build-time env var.

Leave `SENTRY_REPOSITORY` unset if the GitHub integration isn't connected —
the build fails if it's set without the integration in place.

## 8. Smoke test

After deploy, verify each surface independently:

1. **Error + errorId**: hit a route that throws (or temporarily add
   `throw new Error('sentry-smoke')` to a server load and re-deploy a staging
   build). Watch:
   - Coolify stderr stream → `[diversif:error]` line with an `id`.
   - Sentry → Issues → new issue tagged `errorId=<that id>`, `route=/...`
     (with `[id]` masking), reported as unhandled.
   - Confirm the issue's request URL has no query string and no PII.
   - Remove the smoke-test throw and redeploy.
2. **Tracing**: Sentry → Performance/Traces → load any page and confirm a
   trace appears, named by route pattern rather than the raw URL.
3. **Logs**: Sentry → Logs → confirm a **"Server starting"** entry exists for
   the current release (also check for "Database migrated and seeded" after a
   fresh boot, and "Cleanup completed" after the 6-hourly job runs).
4. **Cron check-in**: Sentry → Crons → `diversif-cleanup` shows an **ok**
   check-in (in_progress → ok) after the cleanup job runs or the app boots.
5. **Session Replay**: in a browser, trigger a 5xx (or the smoke-test throw
   above) and confirm the resulting Sentry issue has a replay attached,
   showing the ~last minute before the error with all text/inputs/images
   masked.
6. **User feedback**: from the Profil page, open « Signaler un problème »,
   submit a test message, and confirm it appears in Sentry → User Feedback
   with the scrubbed route attached and no name/email/screenshot fields.
   Also try « Signaler ce problème » from a 5xx error page and confirm the
   feedback is tagged with that page's `errorId`.

## 9. Privacy policy ack

After verifying the integration is live, confirm `/politique-confidentialite`
section 3 (closing paragraph) and section 4 (Sentry GmbH bullet) are rendered
correctly in production, and that the "Dernière mise à jour" date matches (or
follows) the deploy date.
