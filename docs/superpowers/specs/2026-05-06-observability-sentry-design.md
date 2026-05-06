# Observability — Sentry (server + client) — Design

**Date:** 2026-05-06
**Status:** Approved (pending implementation plan)
**Owner:** Simon Brunou

## Goal

Catch silent server errors and client-side JS errors in production, with strict
PII posture appropriate for an EU-resident health-adjacent app. Stderr logging
in `hooks.server.ts` already exists; Sentry is additive, not a replacement.

## Non-goals

- Performance / tracing / Web Vitals (can light up later by toggling SDK
  options; not in this scope).
- Session Replay.
- Self-hosting Sentry. We use Sentry SaaS, EU region (Frankfurt).
- Replacing the existing `[diversif:error]` stderr line. Coolify log streaming
  remains the primary local-debug path.

## Architecture

```
                    ┌─ src/hooks.server.ts ──────────────┐
browser ──HTTP──▶   │ existing handleError (stderr+id)   │
                    │ + Sentry.captureException(err,     │ ──▶ Sentry EU
                    │   { tags: { errorId } })           │     (Frankfurt)
                    └────────────────────────────────────┘
                                    ▲
browser JS ──────── src/hooks.client.ts ──────────────────┘
                    Sentry.init({ beforeSend: scrubEvent })
                    No browserTracing, no replay.
```

Two SDK init points using `@sentry/sveltekit` (the official SvelteKit wrapper).
Source maps uploaded at build via `@sentry/vite-plugin`, gated on
`SENTRY_AUTH_TOKEN` so dev builds and CI without the token still succeed.

Single source of truth for the PII scrub rule lives in `src/lib/sentry.ts`
(isomorphic; not under `$lib/server/` because the client hook also imports it)
and is referenced by both hooks via `Sentry.init({ beforeSend: scrubEvent })`.

## PII posture (strict)

The `beforeSend` hook (server and client) runs `scrubEvent`:

- **Pathname rewrite:** every dynamic route segment is replaced with `[id]`.
  Mechanism: prefer the matched SvelteKit route pattern (`event.route.id`
  server-side, `$page.route.id` client-side); fall back to a regex pass for
  events lacking route context. Examples:
  - `/child/abc123-...-9876/log/entry-42` → `/child/[id]/log/[entryId]`
  - `/passkeys/auth/verify?cid=...` → `/passkeys/auth/verify` (query stripped)
- **Query strings dropped** entirely.
- **`request.data` dropped** (form action payloads).
- **`user` context never set.** No id, no email, no IP.
- **Breadcrumbs:** UI breadcrumbs (clicks, focus) dropped; navigation,
  console, and xhr/fetch kept (with same URL scrubbing applied).
- **Tags kept:** `errorId` from `handleError`, plus `status`, `method`,
  `route` (the SvelteKit pattern, e.g. `/child/[id]/log/[entryId]`).

Correlation back to a specific user/request is via the `errorId` token: Sentry
shows the tag, operator looks it up against the `[diversif:error]` stderr line
in Coolify, which has the full structured context (`userId`, real path, etc.).

## Components

| File                                                | Status | Purpose                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| --------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/sentry.ts`                                 | new    | `scrubEvent(event)` — the PII scrub rule. Pure, isomorphic, no SDK side effects. Imported by both hooks.                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `src/hooks.server.ts`                               | edit   | Call `Sentry.init({ dsn, beforeSend: scrubEvent })` at module top; in `handleError`, call `Sentry.captureException(err, { tags: { errorId, status, method, route } })` after the existing `console.error` line.                                                                                                                                                                                                                                                                                                                                               |
| `src/hooks.client.ts`                               | new    | Call `Sentry.init({ dsn: PUBLIC_SENTRY_DSN, beforeSend: scrubEvent })` at module top. Export `handleError` (SvelteKit's client hook) that captures via Sentry.                                                                                                                                                                                                                                                                                                                                                                                                |
| `vite.config.ts`                                    | edit   | Add `sentryVitePlugin({ org, project, authToken: env.SENTRY_AUTH_TOKEN })` — gated; absent token = plugin not added.                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `.env.example`                                      | edit   | Document `SENTRY_DSN`, `PUBLIC_SENTRY_DSN`, `SENTRY_AUTH_TOKEN`, `SENTRY_ENVIRONMENT` (default `production`), `SENTRY_RELEASE` (default git SHA).                                                                                                                                                                                                                                                                                                                                                                                                             |
| `src/routes/politique-confidentialite/+page.svelte` | edit   | Substantive rewrite: the page currently asserts "aucun service tiers" (sections 3 & 4) and no extra-EU transfer (section 9). Soften §3 ("aucun cookie de mesure, aucune adresse IP, aucun User-Agent") to retain its intent; revise §4 to disclose Sentry GmbH as a sous-traitant for technical error collection (rôle, base légale: intérêt légitime, durée: 90 jours, localisation: Francfort UE); keep §9 accurate (Sentry EU region keeps data in the EU). Update "Dernière mise à jour" date. French copy throughout, matching the page's existing tone. |
| `package.json`                                      | edit   | Add `@sentry/sveltekit` (runtime) and `@sentry/vite-plugin` (devDep).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |

## Data flow

**Server error:**

1. Route loader / action / endpoint throws.
2. SvelteKit catches → `handleError` runs.
3. Existing: `console.error('[diversif:error]', JSON.stringify({ id, userId, path, ... }))`.
4. New: `Sentry.captureException(err, { tags: { errorId, status, method, route } })`.
5. SDK fires async to Frankfurt. Failure is swallowed by the SDK; never affects the response.

**Client error:**

1. Unhandled exception or rejection in browser JS.
2. SDK's global handler captures.
3. `beforeSend` runs `scrubEvent` — rewrites URL, drops `request.data`, removes `user`.
4. Sent async; offline → SDK queues in memory and drops on tab close.

**Build:**

1. `vite build` runs.
2. If `SENTRY_AUTH_TOKEN` set → `@sentry/vite-plugin` uploads sourcemaps tagged
   with `SENTRY_RELEASE` (default: `git rev-parse HEAD`).
3. If unset → plugin not added; build succeeds; stacks in Sentry will be
   minified (acceptable degradation).

## Error handling / failure modes

- **No DSN configured** → `Sentry.init` no-ops; `captureException` becomes a
  no-op. Safe.
- **DSN configured, network down** → SDK queues internally; on flush failure,
  drops silently. Request is unaffected.
- **`scrubEvent` throws** (regression) → caught by SDK's internal try/catch;
  event is dropped rather than crashing the page. Tests must guard against
  this regression.
- **Sourcemap upload fails in CI** → fail the build (it's a deploy-time issue
  worth surfacing). Local `vite build` without the token is allowed.
- **Privacy escape hatch:** setting `PUBLIC_SENTRY_DSN=""` disables client
  capture without a code change. Same for `SENTRY_DSN=""` server-side.

## Testing

| File                                  | Coverage                                                                                                                                                                                                                                                                                                                                                                      |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/server/sentry.test.ts` (new) | Unit tests for `scrubEvent`. Inputs: synthetic Sentry event objects covering child UUIDs, entry IDs, passkey credential IDs in path and query; events with `request.data`; events with `user` set. Asserts: IDs replaced with `[id]`, query stripped, `request.data` removed, `user` stripped, tags preserved. Also: `scrubEvent` is total — never throws on malformed input. |
| `src/hooks.server.test.ts` (extend)   | Mock `@sentry/sveltekit`'s `captureException`; assert it's called from `handleError` with the expected `tags` shape and no PII fields. The existing stderr line still emits and contains the same `errorId`.                                                                                                                                                                  |

No e2e for Sentry — CI must not depend on Sentry SaaS reachability.

**Coverage gate:** existing 100% threshold applies. `src/lib/sentry.ts`
must hit 100%. The init paths in `hooks.client.ts` and the init call site in
`hooks.server.ts` are bootstrap singletons exercising real SDK / network; they
go in the existing `coverage.exclude` list with the same justification as
`db/index.ts`.

## Operational

- **Sentry project setup** (out of code, done via dashboard or `mcp_Sentry` tools):
  - Create project `diversif` in EU org.
  - Set environment to `production`.
  - Configure quota (free tier is fine for v1).
  - Set up an alert: "any new issue → email Simon".
- **Release tracking:** `SENTRY_RELEASE` defaults to `git rev-parse HEAD` at
  build time. "Errors since last deploy" works without extra config.
- **Privacy policy update** is part of this change set, not a follow-up.

## Out of scope (followups)

- Performance monitoring (`tracesSampleRate`).
- Spotlight (local Sentry dev UI).
- Source-context for Coolify deploys (would need `SENTRY_AUTH_TOKEN` in
  Coolify build env — easy follow-up).
- Self-hosted alternative (GlitchTip) — kept as an option if Sentry SaaS
  posture changes.
