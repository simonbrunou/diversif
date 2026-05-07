# PWA Offline Log Queue (+ Install CTA + Offline Fallback) — Design Spec

**Date:** 2026-05-07
**Status:** approved, ready for implementation plan
**Tracks roadmap item:** #4 — PWA / offline log entry

## Problem

Parents log food on phones, often in places with bad signal (kitchen, restaurants). Today, a submit while offline simply fails. We want every food log to land — even when the user is on the move and the network is flaky.

The PWA shell is already in place: a hand-rolled `static/manifest.webmanifest` is linked from `app.html`, with 192/512 icons (`any maskable`), theme color, FR locale. `@vite-pwa/sveltekit` is configured with `manifest: false` (we serve our own) and a sensible Workbox runtime cache (NetworkFirst for navigation, CacheFirst for assets). What's missing is **offline write support** for the food-log endpoint, plus two small UX additions: an install-app CTA and an offline fallback page.

## Scope

In scope:

1. **Offline log queue** — queue food-log POSTs in IndexedDB when the user is offline; replay when connectivity returns; show "queued" feedback.
2. **Manifest/icons audit** — verify the existing manifest passes Lighthouse + real-device install. Audit only; no artwork changes unless something fails.
3. **Install-app CTA** — `beforeinstallprompt`-driven button on Android; iOS Safari heuristic + share-sheet instructions modal.
4. **Offline fallback page** — `/offline` route shown by the SW when navigating offline to an uncached URL.

Out of scope:

- Workbox `BackgroundSync` (rejected for iOS Safari parity — the API is not supported there; an in-page IndexedDB queue gives consistent behaviour cross-platform).
- A `/pending` queue-inspection view (toast + chrome badge is enough).
- Conflict resolution for in-flight queue items the user edits before sync.
- Offline support for any endpoint other than the food-log POST.

## Architecture

```
┌─────────────────────────────────────────────┐
│  src/routes/child/[id]/log/+page.svelte     │
│  - normal <form> for online submits         │
│  - submit handler checks navigator.onLine:  │
│    - online → let the form post normally    │
│    - offline → preventDefault, enqueue via  │
│      $lib/offline/queue, toast, navigate    │
│      back to dashboard                      │
└─────────────────────────────────────────────┘
                   │ enqueue
                   ▼
┌─────────────────────────────────────────────┐
│  src/lib/offline/queue.ts (client)          │
│  IndexedDB ('diversif-offline' / 'log')     │
│  - enqueue({ key, childId, formData,        │
│              queuedAt })                    │
│  - flush(): for each pending row, fetch the │
│    form action with x-sveltekit-action +    │
│    Idempotency-Key; parse ActionResult JSON │
│    {type:'redirect', location} → emit       │
│    milestone toasts, remove from IDB.       │
│  - flush triggers: 'online' event, page     │
│    load, 60s interval while online          │
│  - exposes a `pendingCount` Svelte store    │
└─────────────────────────────────────────────┘
                   │ POST /child/{id}/log
                   │ Idempotency-Key: <uuid>
                   ▼
┌─────────────────────────────────────────────┐
│  src/routes/child/[id]/log/+page.server.ts  │
│  - reads Idempotency-Key header             │
│  - if seen in idempotency_keys (24h TTL):   │
│    return cached redirect URL               │
│  - otherwise: existing txn, store           │
│    (key → response url) on commit           │
└─────────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────┐
│  src/lib/server/db/schema.ts                │
│  + idempotency_keys table:                  │
│    key TEXT PK, user_id INT FK, scope TEXT, │
│    redirect TEXT, created_at INT (unix ms)  │
│  + opportunistic prune (>24h old)           │
└─────────────────────────────────────────────┘
```

Cross-cutting:

- `src/lib/components/QueueBadge.svelte` — subscribes to `pendingCount`, renders an "N à synchroniser" pill in `AppShell` near the user menu.
- `src/lib/components/InstallPrompt.svelte` — handles `beforeinstallprompt` (Android Chrome) and iOS Safari (UA + `display-mode: standalone` MQ) with a share-sheet instructions modal.
- `src/routes/offline/+page.svelte` — minimal fallback page; `vite.config.ts` `workbox.navigateFallback` switches from `/` to `/offline`.

## File map

| Path                                            | Status | Responsibility                                                                                                                                                                                                                                                                                                                           |
| ----------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `drizzle/<next-index>_idempotency_keys.sql`     | new    | Migration (drizzle-kit picks the next sequential index): `idempotency_keys` table                                                                                                                                                                                                                                                        |
| `src/lib/server/db/schema.ts`                   | edit   | Add `idempotencyKeys` drizzle table                                                                                                                                                                                                                                                                                                      |
| `src/lib/server/idempotency.ts`                 | new    | `withIdempotencyKey(...)`, `pruneExpiredKeys(...)`                                                                                                                                                                                                                                                                                       |
| `src/lib/server/idempotency.test.ts`            | new    | TTL, dedupe, scope mismatch, in-flight, isolation between users                                                                                                                                                                                                                                                                          |
| `src/routes/child/[id]/log/+page.server.ts`     | edit   | Header read + validation, dedupe wrap around existing txn                                                                                                                                                                                                                                                                                |
| `src/routes/child/[id]/log/page.server.test.ts` | edit   | Same key returns same redirect; different keys insert distinct rows; expired keys re-execute; missing header keeps existing behaviour                                                                                                                                                                                                    |
| `src/lib/offline/queue.ts`                      | new    | IDB wrapper: `enqueue`, `flush`, `pendingCount` store                                                                                                                                                                                                                                                                                    |
| `src/lib/offline/queue.test.ts`                 | new    | Mock IDB via `fake-indexeddb`; happy path, retry, drop, store updates                                                                                                                                                                                                                                                                    |
| `src/lib/offline/uuid.ts`                       | new    | `crypto.randomUUID()` wrapper (testable)                                                                                                                                                                                                                                                                                                 |
| `src/lib/components/QueueBadge.svelte`          | new    | Pill, hidden at 0                                                                                                                                                                                                                                                                                                                        |
| `src/lib/components/QueueBadge.test.ts`         | new    | Renders/hides on count                                                                                                                                                                                                                                                                                                                   |
| `src/lib/components/InstallPrompt.svelte`       | new    | Android `beforeinstallprompt` path + iOS instructions modal                                                                                                                                                                                                                                                                              |
| `src/lib/components/InstallPrompt.test.ts`      | new    | Both platform branches                                                                                                                                                                                                                                                                                                                   |
| `src/lib/components/AppShell.svelte`            | edit   | Mount `QueueBadge` and `InstallPrompt`                                                                                                                                                                                                                                                                                                   |
| `src/routes/+layout.svelte`                     | edit   | Register `online` listener, run `queue.flush()` on load + interval                                                                                                                                                                                                                                                                       |
| `src/routes/child/[id]/log/+page.svelte`        | edit   | Intercept submit when offline → enqueue + toast + nav                                                                                                                                                                                                                                                                                    |
| `src/routes/offline/+page.svelte`               | new    | Offline fallback (FR + EN)                                                                                                                                                                                                                                                                                                               |
| `messages/{fr,en}.json`                         | edit   | New keys: `offline.queued.toast`, `offline.synced.toast`, `offline.dropped.toast`, `offline.sessionExpired.toast`, `offline.badge.label`, `offline.fallback.title`, `offline.fallback.body`, `offline.fallback.retry`, `install.cta`, `install.iosInstructions.title`, `install.iosInstructions.body`, `install.iosInstructions.dismiss` |
| `vite.config.ts`                                | edit   | `workbox.navigateFallback: '/offline'`                                                                                                                                                                                                                                                                                                   |
| `tests/offline.spec.ts`                         | new    | Playwright: offline submit → online → entry visible                                                                                                                                                                                                                                                                                      |

## Data flow

### T0 — User offline, submits the form

1. `+page.svelte` form submit handler reads `navigator.onLine`. If `false` (or if a 5s timeout fires before any response when nominally online):
   - `e.preventDefault()`
   - `key = crypto.randomUUID()`
   - `await queue.enqueue({ key, childId, formData, queuedAt: Date.now() })`
   - Toast: `m['offline.queued.toast']()`
   - `goto(\`/child/${childId}\`)` — back to dashboard, no milestone toasts (we don't know milestones yet)

### T1 — Connectivity returns

2. `+layout.svelte` registers `window.addEventListener('online', queue.flush)` once. Also calls `flush()` on layout mount and on a 60s interval while `navigator.onLine`.
3. `flush()` reads all rows from IDB ordered by `queuedAt`. For each:
   - `fetch(\`/child/\${row.childId}/log?/default\`, { method: 'POST', headers: { 'Idempotency-Key': row.key, 'x-sveltekit-action': 'true' }, body: <URLSearchParams from row.formData> })`
   - SvelteKit returns the action result as JSON (because of `x-sveltekit-action: true`). Parse `await res.json()`:
     - `{ type: 'redirect', location }` where `location` matches `/child/\d+?...` (the success URL pattern) → extract milestone qs; emit toasts; delete row from IDB.
     - `{ type: 'redirect', location: '/login' }` → session expired (`requireUser` threw). Drop row, toast `m['offline.sessionExpired.toast']()`.
     - `{ type: 'error', status: 403 }` → membership revoked (`requireMembership` threw). Drop row, toast `m['offline.dropped.toast']()`, log to Sentry.
     - `{ type: 'failure', status: 409, ... }` → idempotency in-flight or scope mismatch. Leave row, retry next trigger.
     - `{ type: 'failure', status: 4xx other }` (validation 400, etc.) → drop row, toast `m['offline.dropped.toast']()`, log to Sentry.
     - `{ type: 'error', status >= 500 }` or HTTP 5xx / network error → leave row, retry next trigger.
   - HTTP 429 (if a rate limit middleware is added later) → leave row, exponential backoff next trigger.

### T2 — Server receives replay

4. `+page.server.ts` reads `Idempotency-Key`. If present:
   - Reject if length > 100 or fails `^[a-zA-Z0-9-_]+$` (`fail(400)`).
   - Wrap existing txn with `withIdempotencyKey(tx, { key, userId, scope: \`log:child:\${childId}\` }, doWork)`.
   - `withIdempotencyKey` semantics:
     - **Fresh** — no row → INSERT with `redirect = NULL`, run `doWork()`, UPDATE `redirect` on success, return `{ kind: 'fresh', redirect }`.
     - **Replay (committed)** — row with non-null `redirect` → return `{ kind: 'replay', redirect }`.
     - **Replay (in-flight)** — row with null `redirect` (concurrent first request not finished) → throw `IdempotencyInFlight`; endpoint returns 409.
     - **Scope mismatch** — row exists but scope differs → throw `IdempotencyScopeMismatch`; endpoint returns 409.
   - On `replay`, short-circuit: `throw redirect(303, result.redirect)`.
   - Opportunistic prune (`pruneExpiredKeys`) every Nth insert (cheap WHERE on indexed `created_at`).

### T3 — Page surfaces milestones (post-replay)

5. The dashboard's existing milestone-toast helper reads the parsed milestone qs from the replay response and shows toasts wherever the user currently is. `AppShell` already renders the toast container globally, so this works regardless of route.

## Server idempotency contract

### Schema

```ts
export const idempotencyKeys = sqliteTable('idempotency_keys', {
  key: text('key').primaryKey(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  scope: text('scope').notNull(),
  redirect: text('redirect'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull()
});
```

`scope` is defence-in-depth: same key replayed against a different child / different action returns 409, not the cached redirect. UUID v4 collision is vanishingly rare but the check is cheap.

### Public API

```ts
export class IdempotencyInFlight extends Error {}
export class IdempotencyScopeMismatch extends Error {}

export function withIdempotencyKey<T extends { redirect: string }>(
  tx: DBTx,
  args: { key: string; userId: number; scope: string },
  doWork: () => T
): { kind: 'fresh' | 'replay'; redirect: string };

export function pruneExpiredKeys(
  tx: DBTx,
  olderThanMs?: number // default 24h
): number; // deleted count
```

The transaction parameter is critical: claiming the key (INSERT-on-fresh) must be atomic with running `doWork()` so two concurrent first requests cannot both insert food entries. The endpoint already wraps its work in `db.transaction((tx) => ...)`; `withIdempotencyKey` participates in that same transaction.

### Endpoint integration sketch

```ts
const idempotencyKey = request.headers.get('Idempotency-Key');
if (idempotencyKey && (idempotencyKey.length > 100 || !/^[a-zA-Z0-9-_]+$/.test(idempotencyKey))) {
  return fail(400, { error: 'Idempotency-Key invalide' });
}

try {
  const result = db.transaction((tx) => {
    if (idempotencyKey) {
      return withIdempotencyKey(
        tx,
        { key: idempotencyKey, userId: user.id, scope: \`log:child:\${childId}\` },
        () => /* existing txn body, returns { redirect: '/child/.../?logged=1&...' } */
      );
    }
    return { kind: 'fresh' as const, redirect: /* existing txn body output */ };
  });
  throw redirect(303, result.redirect);
} catch (e) {
  if (e instanceof IdempotencyInFlight || e instanceof IdempotencyScopeMismatch) {
    return fail(409, { error: 'Conflit de clé d\\'idempotence' });
  }
  throw e;
}
```

The existing `LogActionAbort` path (validation failures inside the txn) is unchanged.

## Client queue contract

### IDB structure

- Database: `diversif-offline`
- Object store: `log` (key path: `key`)
- Indexed by `queuedAt` for FIFO replay

### API

```ts
export interface QueuedSubmit {
  key: string;
  childId: number;
  formData: Record<string, string>; // serializable, not FormData (which IDB can't clone reliably across browsers)
  queuedAt: number; // Date.now()
}

export const pendingCount: Readable<number>;

export async function enqueue(item: QueuedSubmit): Promise<void>;
export async function flush(): Promise<void>;
export async function clear(): Promise<void>; // dev/test helper
```

`formData` is plain object, not `FormData`, because Safari < 15.4 has reliability issues cloning `FormData` into IDB. Conversion happens at `enqueue` (form → object) and reverse at `flush` (object → URLSearchParams body).

### Triggers

| Trigger                   | Where                               | Notes                                      |
| ------------------------- | ----------------------------------- | ------------------------------------------ |
| `'online'` event          | `+layout.svelte` (mount once)       | Most common case                           |
| Page load while online    | `+layout.svelte` (after auth ready) | Catches "user closed and reopened the tab" |
| 60s interval while online | `+layout.svelte` setInterval        | Catches "online but DNS still flaky"       |
| Manual (test only)        | `clear()` + `flush()` direct calls  |                                            |

`flush()` is reentrant-safe via a module-level `inFlight` boolean.

## UI surfaces

### Queue badge

`QueueBadge` reads `pendingCount`. Hidden when 0; shows pill `m['offline.badge.label']({ count: n })` ("1 à synchroniser" / "3 à synchroniser") when N>0. Click → `goto(\`/child/${activeChildId}\`)` (no dedicated view; the badge just says "stuff is queued").

Mounted in `AppShell` next to the existing user menu and `LocaleSwitcher`.

### Install CTA

`InstallPrompt` component:

- On mount, listen for `beforeinstallprompt`. When fired, store the event, show `m['install.cta']()` as a button.
- If iOS Safari (UA contains `iPhone` / `iPad` / `iPod`, no `CriOS`/`FxiOS`/`EdgiOS`, and `display-mode: standalone` MQ is **not** matched), show the same button. Click → opens a small modal with `m['install.iosInstructions.title']()` + body explaining "tap the share button → 'Add to Home Screen'", with a dismiss button.
- If already installed (`display-mode: standalone` matches), render nothing.
- A `localStorage` key `install-prompt-dismissed` (set on close) suppresses the CTA for 30 days.

Mounted in `AppShell` footer. Localized FR/EN.

### Offline fallback page

`/offline/+page.svelte` — minimal page: title, body explaining "you're offline, your queued entries will sync when you reconnect", and a "Retry" button that calls `location.reload()`. Localized FR/EN.

`vite.config.ts` `workbox.navigateFallback` changes from `/` to `/offline`. The SW serves this for navigation requests that miss the cache while offline.

## Edge cases

| Case                                                    | Behaviour                                                                                                                                                 |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Closed tab before reconnect                             | Queue persists in IDB; `+layout.svelte` calls `flush()` on next load                                                                                      |
| Two devices logging the same food at the same instant   | Different Idempotency-Keys → both inserts succeed (correct)                                                                                               |
| Custom-food creation in queued submit                   | Original txn creates the food atomically; replay short-circuits via key — no double-create                                                                |
| Idempotency table bloat                                 | 24h TTL + opportunistic prune; rows ~120 bytes; bounded                                                                                                   |
| User edits the form, submits offline twice              | Each submit gets its own UUID; both replay; both create entries (correct — user _did_ submit twice)                                                       |
| `givenAt` from queue time, replay hours later           | Server txn computes milestones at replay time against actual DB state; redirect URL encodes the milestones for that moment; replay returns the stored URL |
| Session expires between submit and replay               | Replay gets `{type:'redirect', location:'/login'}` (from `requireUser`); queue drops the row; toast tells the user to re-enter after re-auth              |
| `Idempotency-Key` shorter than UUID or with weird chars | Server rejects with 400; client never sends short keys (uses `crypto.randomUUID()`)                                                                       |

## Testing strategy

### Unit (vitest)

- `idempotency.test.ts`
  - Fresh key runs `doWork`, stores redirect, returns `'fresh'`
  - Replay (committed) returns same redirect without re-running `doWork` (assert via spy)
  - Scope mismatch throws `IdempotencyScopeMismatch`
  - In-flight (null-redirect row) throws `IdempotencyInFlight`
  - Different `userId` for same key — treated as fresh (key is global PK so this can't actually happen, but assert error path for safety)
  - `pruneExpiredKeys` only deletes rows older than threshold, returns count
  - Invalid keys (length, charset) — covered at endpoint level
- `queue.test.ts` (uses `fake-indexeddb`)
  - `enqueue` persists row; `pendingCount` increments
  - `flush` posts each row in `queuedAt` order, deletes on success, decrements `pendingCount`
  - Network failure / `type: 'error'` 5xx leaves row; subsequent flush retries
  - 400/422 (validation) drops row + emits drop toast
  - `type: 'redirect'` to `/login` drops row + emits session-expired toast
  - `type: 'error'` 403 drops row + emits drop toast
  - `type: 'failure'` status 409 leaves row queued
  - `flush` reentrancy guard — concurrent calls don't double-post
- `QueueBadge.test.ts` — hides at 0, renders count at N>0, click navigates
- `InstallPrompt.test.ts` — Android branch (mock `beforeinstallprompt`), iOS branch (mock UA + standalone MQ false), already-installed branch (renders nothing), 30-day dismiss persistence

### Integration (existing `page.server.test.ts`)

- Same key + same form data twice → second call returns same redirect; only one `food_entries` row in DB
- Same key + different child id (synthetic, route-param mismatch) → 409
- Missing `Idempotency-Key` header → existing behaviour unchanged (no regression)
- Invalid `Idempotency-Key` (length, charset) → 400

### E2E (`tests/offline.spec.ts`)

1. `context.setOffline(true)`, submit log form → toast appears, badge shows "1 à synchroniser"
2. `context.setOffline(false)` → badge clears within 5s, log entry visible in `/child/[id]/log/list`
3. Submit twice while offline (same form data, distinct keys) → two distinct entries appear after sync
4. Navigate to `/offline` directly → fallback page renders FR text by default; `/en/offline` renders EN

### Coverage

The project enforces 100% on `src/lib/**/*.ts`, `src/routes/**/+server.ts`, and `+page.server.ts`. New modules must hit the bar:

- `src/lib/server/idempotency.ts` — every branch
- `src/lib/offline/queue.ts` — every branch (use `fake-indexeddb` to drive error paths)
- `src/lib/offline/uuid.ts` — single-line wrapper, trivial test

`src/lib/components/*.svelte` are not under the 100% gate, but should still be tested at component level (they are).

### Not tested at e2e

- iOS Safari install instructions modal — Playwright cannot reliably emulate iOS Safari's UA quirks in CI. The unit test covers detection logic. **Manual smoke on a real iPhone before merge.**
- BackgroundSync — explicitly not in scope.

## Manifest/icons audit (pre-flight)

Run before merging the PR; document results inline in the PR description. No code changes expected — if anything fails, fix lives outside this PR's scope (artwork or static-asset config).

- [ ] `curl -I https://<host>/manifest.webmanifest` returns `Content-Type: application/manifest+json`
- [ ] `curl -I /icons/icon-{192,512}.png` both return 200 with `image/png`
- [ ] `static/icons/icon-512.png` opened in [maskable.app/editor](https://maskable.app/editor) — safe inner 80% circle does not clip the logo
- [ ] `npx lighthouse https://<host> --only-categories=pwa --quiet` — "Installable" green
- [ ] Real-device install on Android Chrome and iOS Safari — installs, launches in `standalone`, correct icon and theme color

## Risks

| Risk                                        | Mitigation                                                                                                                                  |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| CSP blocks IDB / fetch from page JS         | `connect-src 'self'` already covers same-origin fetches; IDB has no CSP gate. Verify in CI build.                                           |
| Idempotency table growth                    | 24h TTL, opportunistic prune, key-length cap. Bounded.                                                                                      |
| Replay collides with later schema change    | Replays are short-lived (≤24h). Breaking changes drop rows with a toast — acceptable rare case.                                             |
| iOS Safari UA-sniff false positive/negative | Tests cover both branches; modal text says "If you're on iPhone…" so a false positive on Android is low-stakes.                             |
| Service worker caches stale form            | `navigateFallback: '/offline'` only intercepts uncached navigations; runtime NetworkFirst with 3s timeout already handles stale form pages. |

## Rollout

- Single PR (matches the project's pattern: #45 Sentry, #47 i18n).
- No feature flag — the offline path only triggers when `navigator.onLine === false`. Online users are unaffected.
- Migration is additive (`idempotency_keys` table only); no down-migration needed.
- Coverage gate stays at 100% on `src/lib/**/*.ts`, `+page.server.ts`, `+server.ts`.
- Real-device manual smoke on iPhone before merge (covers iOS install modal that Playwright can't).

## Out of scope (could come later)

- Workbox BackgroundSync (rejected — iOS parity)
- `/child/[id]/log/pending` view to inspect/cancel queued items (rejected — toast + badge is enough)
- Bulk "Sync now" UI
- Conflict resolution beyond Idempotency-Key (e.g., user edits an entry that's still queued — drop the original from queue when they hit edit)
