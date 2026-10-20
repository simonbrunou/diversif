# Tests

How to run, write and triage this repo's tests. Commands live in `package.json`; this file holds what the scripts don't say.

## Running

- **`bun run test`**, with `bun run test <path>` for a focused run. It wraps `scripts/bun-test.ts`: paraglide compile, SvelteKit sync, then one `bun --conditions=browser test` process per file, so `mock.module` overrides stay inside their file. Bare `bun test` drops the browser condition, and every `@testing-library/svelte` component test fails with `` `mount(...)` is not available on the server ``: the command is wrong, not your change.
- **Coverage**: the 100% line gate runs only under `bun run test:coverage`, which is what CI runs.

## Writing unit and component tests

- **Route pages mount like components.** Import the page dynamically, after every `mock.module(...)` call: `const { default: Page } = await import('./+page.svelte');`. A static import hoists above the mocks. Mock `$app/state` (a `page.url` getter), `$app/navigation`, `$app/env` and `svelte-sonner` (its dist can't load under `bun test`), and cast a minimal `PageData` with `as unknown as PageData`. Model: `src/routes/child/[id]/log/log.hint.test.ts`.
- **Time-zone logic: pin `process.env.TZ`.** The dev host runs Paris time, so a host-local-time bug passes locally and fails only on a UTC server (#451). Set `process.env.TZ` in `beforeEach` (bun honours the change at run time) and restore it in `afterEach`, with `delete` when it was undefined. `describe.each` over zones runs every case once per host zone. Models: `src/lib/utils/dates.test.ts`, `src/routes/child/[id]/paris-midnight.test.ts`. Day logic lives in `src/lib/utils/civil-calendar.ts`; read its header.

## Writing E2E tests (Playwright)

- **Toast absence: count once.** `toHaveCount(0)` retries for 5 s and svelte-sonner toasts expire after 4 s, so it waits a wrong toast out and passes (#437). Wait for the triggering work to finish (e.g. `expect.poll` on the queue), then assert `expect(await locator.count()).toBe(0)`. Watch the check go red against the old code before trusting it. Model: the queue-replay test in `e2e/offline.spec.ts`.

## Triaging a red run

- **`src/routes/login/page.server.test.ts`** can hit the 5 s per-test timeout on a loaded machine (Argon2 hashing). Rerun the file alone before blaming your diff.
- **« Has been cancelled »**: a new push cancels the previous SHA's CI run (`cancel-in-progress` in `.forgejo/workflows/ci.yml`), and every status of the old run reads `failure` with that description. Not a test failure.
