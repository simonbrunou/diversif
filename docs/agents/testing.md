# Tests

How to run, write and triage this repo's tests. Commands live in `package.json`; this file holds what the scripts don't say.

## Running

- **`bun run test`**, with `bun run test <path>` for a focused run. It wraps `scripts/bun-test.ts`: paraglide compile, SvelteKit sync, then one `bun --conditions=browser test` process per file, so `mock.module` overrides stay inside their file. Bare `bun test` drops the browser condition, and every `@testing-library/svelte` component test fails with `` `mount(...)` is not available on the server ``: the command is wrong, not your change.
- **Coverage**: the 100% line gate runs only under `bun run test:coverage`, which is what CI runs.
- **Worktrees run through the dev shell.** `bun` is on PATH only inside the flake's dev shell, and a new worktree is not `direnv allow`ed, so prefix commands with `nix develop -c`. A fresh worktree needs `nix develop -c bun install --frozen-lockfile` first. Run `git push` that way too: the husky pre-push hook runs `bun run lint` and `bun run check` (about 80 s) and fails outside the shell. The pre-commit hook runs `npx lint-staged` under node and needs only `node_modules`.

## Writing unit and component tests

- **Route pages mount like components.** Import the page dynamically, after every `mock.module(...)` call: `const { default: Page } = await import('./+page.svelte');`. A static import hoists above the mocks. Mock `$app/state` (a `page.url` getter), `$app/navigation`, `$app/env` and `svelte-sonner` (its dist can't load under `bun test`), and cast a minimal `PageData` with `as unknown as PageData`. Model: `src/routes/child/[id]/log/log.hint.test.ts`.
- **Time-zone logic: pin `process.env.TZ`.** The dev host runs Paris time, so a host-local-time bug passes locally and fails only on a UTC server (#451). Set `process.env.TZ` in `beforeEach` (bun honours the change at run time) and restore it in `afterEach`, with `delete` when it was undefined. `describe.each` over zones runs every case once per host zone. Models: `src/lib/utils/dates.test.ts`, `src/routes/child/[id]/paris-midnight.test.ts`. Day logic lives in `src/lib/utils/civil-calendar.ts`; read its header.
- **Password hashes are cheap under `bun test`.** `bunfig.preload.ts` sets `__TEST_RELAXED_ARGON__`, so while `NODE_ENV` is `test` (bun test sets it), `hashPassword` uses the E2E cost (`m=4096,t=1`) instead of the production `m=19456,t=2`. `Bun.password.verify` reads the cost from the stored hash, so verifying against those hashes and the login decoy is cheap too. Every Vite build inlines `false`. A test that needs the production cost sets the global to `false` and restores `true` in `afterEach`; model: the `hashPassword cost` block in `src/lib/server/auth.test.ts`.
- **An unhandled rejection fails the running test.** `bun test` fails whichever test is running when a promise rejection goes unhandled, even with a `process.on('unhandledRejection')` listener and even when the test body ends synchronously. A regression test for an "unhandled rejection" Sentry issue only has to drive the code path, with no listener or sleep.

## Writing E2E tests (Playwright)

- **Toast absence: count once.** `toHaveCount(0)` retries for 5 s and svelte-sonner toasts expire after 4 s, so it waits a wrong toast out and passes (#437). Wait for the triggering work to finish (e.g. `expect.poll` on the queue), then assert `expect(await locator.count()).toBe(0)`. Watch the check go red against the old code before trusting it. Model: the queue-replay test in `e2e/offline.spec.ts`.
- **Which project runs a spec.** In `playwright.config.ts` the `desktop` project runs every spec except those tagged `@mobile-only`, and the `mobile` project (an iPhone 14 viewport on Chromium) runs only specs tagged `@responsive` or `@mobile-only`. Tag a spec `@responsive` when it must also pass below the `md` breakpoint. A spec whose logic does not depend on the viewport needs no tag.
- **`ORIGIN` is read at build time.** adapter-node 6 has no runtime `ORIGIN`, so `vite.config.ts` pins `paths.origin` from `ORIGIN` during `bun run build`. A production build served over plain http without it fails every form POST with 403 "Cross-site POST form submissions are forbidden". The Playwright `webServer` builds with `ORIGIN=http://localhost:<port>`.

## Reproducing a bug on a production build

Dev mode registers no service worker and serves unbundled modules instead of the `/_app/immutable/` chunks, so chunk-load and service-worker failures show only on a production build. Reproduce them there, and rebuild and restart after every code change (a build takes about 30 s):

```sh
nix develop -c env ORIGIN=http://localhost:3123 bun run build
nix develop -c env DATABASE_PATH=/tmp/diversif-repro.db PORT=3123 WEBAUTHN_RP_ID=localhost NODE_ENV=production bun build/index.js
```

The browser Sentry SDK and the `/monitoring` tunnel start only when `PUBLIC_SENTRY_DSN` is set. It is read at run time, so for a browser Sentry repro add a fake one to the `bun build/index.js` line (for example `PUBLIC_SENTRY_DSN=https://0123456789abcdef0123456789abcdef@o1.ingest.de.sentry.io/2`), with `PUBLIC_SENTRY_TRACES_SAMPLE_RATE=0` and `PUBLIC_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE=0` to keep traces and replays out of the envelopes. Leave `SENTRY_DSN` unset, and intercept `/monitoring` in the browser to read the envelopes: the tunnel would otherwise relay them to the DSN's host. Delete `/tmp/diversif-repro.db*` afterwards.

## Triaging a red run

- **A timeout in `src/routes/login/page.server.test.ts` is not load noise.** Its rate-limit tests loop 20 or more logins, and at full Argon2 cost two of them crossed the 5 s per-test limit on a loaded runner (#475). Since `bun test` hashes at the relaxed cost the file runs in under a second, so rerunning it alone hides a real regression. Look for a change that brings the full cost back: a test that sets `NODE_ENV` to something other than `test`, or `__TEST_RELAXED_ARGON__` to `false`, around a loop.
- **« Has been cancelled »**: a new push cancels the previous SHA's CI run (`cancel-in-progress` in `.forgejo/workflows/ci.yml`), and every status of the old run reads `failure` with that description. Not a test failure.
