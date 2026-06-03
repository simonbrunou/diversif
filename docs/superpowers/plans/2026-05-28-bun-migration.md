# Bun Migration Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans or subagent-driven-development to drive this task-by-task. Each phase produces a working, runnable app — commit at each phase boundary.

**Goal:** Convert Diversif from Node/npm/pg/Vitest/adapter-node to a Bun-native stack (bun + bun:sql + PGlite + bun test + svelte-adapter-bun + Bun.password).

**Architecture:**

- Runtime: Bun 1.3+ replaces Node end-to-end (dev, test, build, prod server, scripts).
- DB: `bun:sql` (Postgres) in prod via `drizzle-orm/bun-sql`; `@electric-sql/pglite` in tests via `drizzle-orm/pglite` — real Postgres semantics inside the test process, no Docker, no pg-mem rewrites.
- Tests: `bun test` with `happy-dom` preload + jest-dom matchers + `$app/*` mocks. Coverage via `bun test --coverage`.
- HTTP: `svelte-adapter-bun` (community) outputs a Bun.serve-based server.
- Hashing: `Bun.password` (Argon2id built-in) replaces `@node-rs/argon2` — standard `$argon2id$` format is verify-compatible.
- Package manager: `bun install` (text `bun.lock`).
- CI: GitHub Actions `oven-sh/setup-bun`.

**Tech stack additions:** `@electric-sql/pglite`, `@happy-dom/global-registrator`, `svelte-adapter-bun`. **Removals:** `pg`, `@types/pg`, `pg-mem`, `@node-rs/argon2`, `@sveltejs/adapter-node`, `vitest`, `@vitest/coverage-v8`.

---

## Decisions locked

| Question       | Answer                            | Why                                                                     |
| -------------- | --------------------------------- | ----------------------------------------------------------------------- |
| Prod DB driver | `bun:sql`                         | Native Bun driver, fastest path.                                        |
| Test DB        | PGlite (in-process WASM Postgres) | Real PG semantics, kills ~150 lines of pg-mem hacks. No Docker.         |
| Adapter        | `svelte-adapter-bun`              | Native Bun.serve, maximally Bun-native.                                 |
| Test runner    | `bun test`                        | Bun-native; cost is migrating 195 test files (mostly mechanical).       |
| Argon2         | `Bun.password`                    | Built-in, no native addon. Standard hash format verifies existing rows. |

---

## File-level structure

**New files:**

- `bunfig.toml` — Bun config (test preload, runtime options).
- `bunfig.preload.ts` — happy-dom registrator + jest-dom matcher install + `$app/*` mocks.
- `vitest.config.ts` — **deleted** (test config moves out of `vite.config.ts`).

**Modified files (critical path):**

- `package.json` — deps, scripts.
- `svelte.config.js` — adapter swap.
- `vite.config.ts` — drop `test:` block + `vitest/config` import; back to plain `vite/defineConfig`.
- `src/lib/server/db/index.ts` — `pg.Pool` → `Bun.SQL`; drizzle adapter `node-postgres` → `bun-sql`.
- `src/test/db.ts` — pg-mem → PGlite. Loses the 150-line workaround block.
- `src/lib/server/auth.ts` — argon2 swap.
- All 195 `*.test.ts` files — `from 'vitest'` → `from 'bun:test'`, `vi.fn()` → `mock()`, `vi.mock()` → `mock.module()`.
- `.github/workflows/ci.yml` — setup-bun.
- `scripts/*.mjs` — convert to TS where the script runs under bun.
- `README.md`, `CLAUDE.md` — npm → bun.

---

## Phase 1 — Toolchain

**Why first:** Establishes Bun as the package manager. Everything downstream depends on `bun install` producing a working `node_modules`.

### Steps

1. **Branch.**

   ```bash
   git checkout -b bun-migration
   ```

2. **Snapshot deps to delete later.**

   ```bash
   jq -r '.dependencies, .devDependencies | keys[]' package.json | sort > /tmp/deps-before.txt
   ```

3. **Delete npm lockfile + node_modules.**

   ```bash
   rm -rf node_modules package-lock.json
   ```

4. **`bun install`.**

   ```bash
   bun install
   ```

   Expected: produces `bun.lock` (text). No errors. Husky's `prepare` hook runs.

5. **Smoke-check that prettier/eslint still work.**

   ```bash
   bun run lint
   ```

   Expected: passes (this is just a tooling check — no code changed yet).

6. **Commit.**
   ```bash
   git add bun.lock package.json
   git rm package-lock.json
   git commit -m "chore: migrate package manager to bun"
   ```

---

## Phase 2 — Argon2 swap

**Why now:** Smallest, lowest-risk runtime swap. Validates that we can drop a native N-API addon.

### Steps

1. **Rewrite `src/lib/server/auth.ts` argon section.**

   Replace lines 1–32 with:

   ```ts
   import { randomBytes } from 'node:crypto';
   import { and, eq, gt } from 'drizzle-orm';
   import { db } from './db';
   import { sessions, users, memberships, type Session, type User } from './db/schema';
   import type { SafeUser } from '$lib/types';
   import type { Cookies } from '@sveltejs/kit';

   export const SESSION_COOKIE = 'session';
   export const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 30;
   export const SESSION_RENEW_THRESHOLD_MS = 1000 * 60 * 60 * 24 * 15;

   // Bun.password defaults to argon2id; memoryCost/timeCost mirror the
   // previous @node-rs/argon2 tuning so existing $argon2id$ hashes verify
   // and new hashes have the same cost profile.
   const ARGON_OPTS = {
     algorithm: 'argon2id',
     memoryCost: 19_456,
     timeCost: 2
   } as const;

   export async function hashPassword(plain: string): Promise<string> {
     return Bun.password.hash(plain, ARGON_OPTS);
   }

   export async function verifyPassword(hash: string, plain: string): Promise<boolean> {
     try {
       // NOTE: argument order is (password, hash) for Bun.password,
       // OPPOSITE of @node-rs/argon2's (hash, password).
       return await Bun.password.verify(plain, hash);
     } catch {
       return false;
     }
   }
   ```

2. **Remove dep.**

   ```bash
   bun remove @node-rs/argon2
   ```

3. **Verify with auth-touching unit tests** (still vitest at this point — sanity check before we migrate the test runner).

   ```bash
   bunx vitest run src/lib/server/auth
   ```

4. **Commit.**
   ```bash
   git add src/lib/server/auth.ts package.json bun.lock
   git commit -m "feat(auth): swap @node-rs/argon2 for Bun.password (argon2id)"
   ```

---

## Phase 3 — DB layer

**Why now:** Largest semantic change; everything else (tests, prod server) depends on the new shapes.

### Step 3a — Install drivers

```bash
bun add @electric-sql/pglite
bun remove pg @types/pg pg-mem
```

`bun:sql` is built into Bun — no install needed. `drizzle-orm` is already at 0.45.2 which exports both `drizzle-orm/bun-sql` and `drizzle-orm/pglite`.

### Step 3b — Rewrite `src/lib/server/db/index.ts`

Full new contents:

```ts
// Side-effect-only: ensures Sentry is initialised before this module's
// top-level await runs migrations.
import '$lib/sentry-init.server';

import path from 'node:path';
import * as Sentry from '@sentry/sveltekit';
import { SQL } from 'bun';
import { drizzle, type BunSQLDatabase } from 'drizzle-orm/bun-sql';
import { migrate } from 'drizzle-orm/bun-sql/migrator';
import * as schema from './schema';
import { seedFoods } from './seed';
import { registerShutdownHandlers } from '../shutdown';
import { building } from '$app/environment';

export type DB = BunSQLDatabase<typeof schema>;

function resolveDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is required (e.g. postgres://user:pass@host:5432/diversif)');
  }
  return url;
}

function resolvePoolMax(): number {
  const raw = process.env.PGPOOL_MAX;
  /* v8 ignore next */
  if (!raw) return 10;
  const n = Number(raw);
  /* v8 ignore next */
  if (!Number.isInteger(n) || n <= 0) return 10;
  return n;
}

// Bun.SQL pools internally. `max` caps concurrent connections; the timeouts
// keep us from hanging behind a saturated pool or a runaway query — same
// failure semantics as the previous pg.Pool config.
const sqlClient = new SQL({
  url: resolveDatabaseUrl(),
  max: resolvePoolMax(),
  idleTimeout: 30, // seconds
  connectionTimeout: 5, // seconds
  // statement_timeout is a Postgres GUC; set via connection options.
  // bun:sql passes unknown keys as connection params (libpq-compatible).
  statement_timeout: 10_000
});

const drizzleDb = drizzle(sqlClient, { schema });

if (!building) {
  try {
    const migrationsFolder = path.resolve('./drizzle');
    await migrate(drizzleDb, { migrationsFolder });
    await seedFoods(drizzleDb);
  } catch (err) {
    Sentry.captureException(err, { tags: { subsystem: 'db-migrate' } });
    throw err;
  }
}

export const db = drizzleDb;
export { schema };
export { sqlClient as pool }; // keep the export name so callers in shutdown.ts don't break

if (!building && process.env.NODE_ENV !== 'test' && !process.env.BUN_TEST) {
  let stopCleanupTimer: (() => void) | null = null;
  void import('../cleanup').then((mod) => {
    stopCleanupTimer = mod.stopCleanupTimer;
    mod.startCleanupTimer();
  });
  registerShutdownHandlers({
    pool: sqlClient,
    beforeExit: () => stopCleanupTimer?.(),
    flush: async () => {
      await Sentry.close(2000);
    }
  });
}
```

**Follow-up edits:** `src/lib/server/shutdown.ts` probably calls `pool.end()`. Bun.SQL has `.end()` too — keep the shape compatible. If the type was `Pool`, change it to `SQL`.

### Step 3c — Rewrite `src/test/db.ts` for PGlite

Full new contents (drops the 150-line pg-mem workaround block):

```ts
import path from 'node:path';
import { readFileSync, readdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { drizzle, type PgliteDatabase } from 'drizzle-orm/pglite';
import { sql } from 'drizzle-orm';
import * as schema from '$lib/server/db/schema';

type DB = PgliteDatabase<typeof schema>;

// One in-process PGlite instance per test run. PGlite has real PG semantics
// — DO $$ blocks, SAVEPOINT, ALTER COLUMN, CHECK NULL — so we apply the
// actual migrations folder without any rewrites.
const pglite = new PGlite();
const testDb: DB = drizzle(pglite, { schema });

async function applyMigrations(): Promise<void> {
  const migrationsDir = path.resolve('./drizzle');
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  for (const file of files) {
    const sqlText = readFileSync(path.join(migrationsDir, file), 'utf8');
    for (const stmt of sqlText
      .split('--> statement-breakpoint')
      .map((s) => s.trim())
      .filter(Boolean)) {
      await pglite.exec(stmt);
    }
  }
}

await applyMigrations();

export { testDb, schema };

const TRUNCATE_ORDER = [
  'tip_dismissals',
  'symptoms',
  'food_entries',
  'invitations',
  'memberships',
  'webauthn_challenges',
  'passkeys',
  'sessions',
  'idempotency_keys',
  'children',
  'users',
  'foods'
];

export async function resetTestDb(): Promise<void> {
  // TRUNCATE … RESTART IDENTITY CASCADE is real Postgres — PGlite supports
  // it directly. Faster than the per-table DELETE loop the pg-mem version
  // had to do (pg-mem didn't reset sequences cleanly).
  await testDb.execute(
    sql.raw(
      `TRUNCATE TABLE ${TRUNCATE_ORDER.map((t) => `"${t}"`).join(', ')} RESTART IDENTITY CASCADE`
    )
  );
}
```

### Step 3d — Audit `pg-mem`-aware code

The queries in `src/lib/server/guidance/queries/diversity.ts` have `// pg-mem can plan it` comments noting WHERE-vs-HAVING wraps. With PGlite (real PG), those wraps are no longer needed _for correctness_, but they don't hurt — leave them. Update the comments to drop pg-mem references.

Similarly:

- `src/lib/server/db/texture.test.ts:31` comment about "pg-mem always returns 'NO'" — re-verify under PGlite, the test may now reach an assertion that was previously skipped.
- `src/lib/server/idempotency.test.ts:120,149` — pg-mem-specific SQLSTATE nesting. With PGlite + bun:sql, error shapes change. Tests in this file need re-verification after Phase 5.

### Step 3e — Verify

```bash
bunx vitest run src/lib/server/db
bunx vitest run src/lib/server/auth
```

Expected: passes. (Still vitest at this point — runner swap is Phase 5.)

### Step 3f — Commit

```bash
git add src/lib/server/db/index.ts src/test/db.ts package.json bun.lock
git commit -m "feat(db): swap pg/pg-mem for bun:sql + PGlite"
```

---

## Phase 4 — Adapter swap

### Steps

1. **Install community Bun adapter.**

   ```bash
   bun add -d svelte-adapter-bun
   bun remove @sveltejs/adapter-node
   ```

2. **Update `svelte.config.js`** — replace the first import:

   ```js
   import adapter from 'svelte-adapter-bun';
   ```

   Keep the `adapter({ out: 'build' })` call — `svelte-adapter-bun` accepts the same `out` option and emits a Bun.serve entry at `build/index.js`.

3. **Build + run.**

   ```bash
   bun run build
   DATABASE_URL=postgres://localhost/dummy bun build/index.js &
   sleep 2 && curl -s http://localhost:3000/healthz && kill %1
   ```

   (The DB URL doesn't need to resolve — `migrate()` will fail and the server will exit, which is fine for a build-success smoke test. For a real smoke test against a local PGlite or Docker pg, set a working URL.)

4. **Commit.**
   ```bash
   git add svelte.config.js package.json bun.lock
   git commit -m "feat(http): swap adapter-node for svelte-adapter-bun"
   ```

---

## Phase 5 — Test framework migration (the big one)

**Why a separate phase:** 195 test files. Most transforms are mechanical; a residual set will need hand-editing.

### Step 5a — `bunfig.toml`

```toml
[install]
# Bun's npm registry config — mirror npm defaults.

[test]
preload = ["./bunfig.preload.ts"]
coverage = false  # opt in via --coverage flag in scripts
```

### Step 5b — `bunfig.preload.ts`

```ts
// Test-process preload: registers a happy-dom global, wires jest-dom matchers
// into bun:test's expect, and mocks SvelteKit's virtual $app/* modules so
// modules importing from $app/environment etc. resolve at test time.

import { GlobalRegistrator } from '@happy-dom/global-registrator';
GlobalRegistrator.register();

import { expect, mock } from 'bun:test';
import * as matchers from '@testing-library/jest-dom/matchers';
expect.extend(matchers as never);

// $app/environment — SvelteKit virtual module. In tests we're never in a
// build context.
mock.module('$app/environment', () => ({
  browser: false,
  building: false,
  dev: true,
  version: 'test'
}));

// $app/state — readable stores in real SvelteKit; stub minimal shapes.
mock.module('$app/state', () => ({
  page: {
    url: new URL('http://localhost/'),
    params: {},
    route: { id: null },
    data: {},
    form: null,
    status: 200,
    error: null
  },
  navigating: null,
  updated: { current: false }
}));

mock.module('$app/navigation', () => ({
  goto: async () => {},
  invalidate: async () => {},
  invalidateAll: async () => {},
  preloadData: async () => {},
  preloadCode: async () => {},
  afterNavigate: () => {},
  beforeNavigate: () => {},
  onNavigate: () => {},
  pushState: () => {},
  replaceState: () => {}
}));

mock.module('$app/stores', () => {
  const readable = <T>(v: T) => ({
    subscribe: (fn: (v: T) => void) => {
      fn(v);
      return () => {};
    }
  });
  return {
    page: readable({
      url: new URL('http://localhost/'),
      params: {},
      route: { id: null },
      data: {},
      form: null,
      status: 200,
      error: null
    }),
    navigating: readable(null),
    updated: readable(false),
    getStores: () => ({ page: readable({}), navigating: readable(null), updated: readable(false) })
  };
});

mock.module('$app/forms', () => ({
  enhance: () => ({ destroy: () => {} }),
  applyAction: async () => {},
  deserialize: <T>(s: string) => JSON.parse(s) as T
}));
```

Install:

```bash
bun add -d @happy-dom/global-registrator @testing-library/jest-dom
# (jest-dom is already a dep but ensure it's there)
```

### Step 5c — Move vitest test config out of `vite.config.ts`

Delete the `test:`, `resolve:`, and `define:` sections that are only there for vitest (keep `define:` if it's needed for the real build — re-read after edit). Change `import { defineConfig } from 'vitest/config';` back to `import { defineConfig } from 'vite';`.

### Step 5d — Codemod the 195 test files

Save this transformer as `/tmp/bun-test-codemod.sh` (run from repo root):

```bash
#!/usr/bin/env bash
set -euo pipefail
shopt -s globstar nullglob

for f in src/**/*.test.ts src/**/*.spec.ts; do
  # 1. import source: vitest → bun:test
  sed -i "s|from 'vitest'|from 'bun:test'|g; s|from \"vitest\"|from \"bun:test\"|g" "$f"

  # 2. vi.fn() → mock()
  sed -i 's|\bvi\.fn(|mock(|g' "$f"

  # 3. vi.mock(spec, factory) → mock.module(spec, factory)
  sed -i 's|\bvi\.mock(|mock.module(|g' "$f"

  # 4. vi.spyOn → spyOn (bun:test exports spyOn)
  sed -i 's|\bvi\.spyOn(|spyOn(|g' "$f"

  # 5. vi.clearAllMocks/restoreAllMocks → no direct equivalent;
  #    bun has mock.restore() globally. Comment out for manual review.
  sed -i 's|\bvi\.clearAllMocks()|/* TODO bun: vi.clearAllMocks */|g' "$f"
  sed -i 's|\bvi\.restoreAllMocks()|mock.restore()|g' "$f"
  sed -i 's|\bvi\.resetAllMocks()|/* TODO bun: vi.resetAllMocks */|g' "$f"

  # 6. vi.useFakeTimers / vi.useRealTimers → bun:test setSystemTime
  sed -i 's|\bvi\.useFakeTimers()|/* TODO bun: fake timers */|g' "$f"
  sed -i 's|\bvi\.useRealTimers()|/* TODO bun: real timers */|g' "$f"
  sed -i 's|\bvi\.setSystemTime(|setSystemTime(|g' "$f"
  sed -i 's|\bvi\.advanceTimersByTime(|/* TODO bun: advanceTimers */|g' "$f"

  # 7. add missing imports: any file that uses `mock(`/`spyOn(` but doesn't
  #    import them gets them added. Quick + dirty grep+sed:
  if grep -q '\bmock(' "$f" && ! grep -q "import.*mock.*from 'bun:test'" "$f"; then
    sed -i "1s|^|import { mock } from 'bun:test';\n|" "$f"
  fi
  if grep -q '\bspyOn(' "$f" && ! grep -q "import.*spyOn.*from 'bun:test'" "$f"; then
    sed -i "1s|^|import { spyOn } from 'bun:test';\n|" "$f"
  fi
done

echo "Codemod done. Manual review TODOs:"
grep -rn 'TODO bun:' src/ || echo "  (none)"
```

Run it:

```bash
chmod +x /tmp/bun-test-codemod.sh && /tmp/bun-test-codemod.sh
```

### Step 5e — Hand-fix residue

The `TODO bun:` markers represent the non-mechanical bits. Address:

- **clearAllMocks / resetAllMocks**: Bun has `mock.restore()` (restores spies) but no equivalent of vitest's full mock reset. For each: replace with `mock.restore()` if the intent is restoring spies between tests, or delete if the test relied on resetting `vi.fn` call history (in Bun, `mock()` is fresh per test usually).
- **Fake timers**: Bun's `setSystemTime(date)` from `bun:test` covers the common pattern of "freeze clock during this test". Vitest's `advanceTimersByTime` doesn't have a direct Bun equivalent — find each call site and rework using real timers + `await Bun.sleep(ms)` if the test was timing-dependent, or restructure if it was abusing the API.
- **Module mock factories with hoisting**: vitest hoists `vi.mock` calls above imports. `mock.module()` in Bun does NOT hoist — move any `mock.module` call to the very top of the file, before any imports it intends to intercept. Codemod doesn't reorder, so this needs manual work in files that use module mocks.

### Step 5f — Update `package.json` scripts

```jsonc
{
  "scripts": {
    "dev": "bun --bun vite dev",
    "build": "INLANG_TELEMETRY=false bun --bun vite build",
    "preview": "bun --bun vite preview",
    "paraglide": "INLANG_TELEMETRY=false bun --bun paraglide-js compile --project ./project.inlang --outdir ./src/lib/paraglide",
    "check": "bun run paraglide && bun --bun svelte-kit sync && bun --bun svelte-check --tsconfig ./tsconfig.json --threshold warning",
    "check:watch": "bun --bun svelte-kit sync && bun --bun svelte-check --tsconfig ./tsconfig.json --threshold warning --watch",
    "check:budget": "bun run build && bun scripts/check-bundle-size.ts",
    "lint": "bun run paraglide && bun --bun prettier --check . && bun --bun eslint . && bun run lint:i18n",
    "lint:i18n": "bun scripts/lint-i18n.ts && bun scripts/check-i18n-unused.ts",
    "format": "bun --bun prettier --write .",
    "test": "bun run paraglide && bun test",
    "test:watch": "bun test --watch",
    "test:coverage": "bun run paraglide && bun test --coverage",
    "test:e2e": "bun scripts/reset-e2e-db.ts && bun --bun playwright test",
    "test:e2e:install": "bun --bun playwright install --with-deps chromium",
    "db:generate": "bun --bun drizzle-kit generate",
    "db:push": "bun --bun drizzle-kit push",
    "prepare": "husky"
  }
}
```

Notes:

- `--unhandled-rejections=warn` is dropped — Bun's default unhandled-rejection behavior is `warn` already.
- `bun --bun` forces tools that detect a Node-shebang to still run under Bun.
- `node scripts/foo.mjs` becomes `bun scripts/foo.ts` (Phase 6 converts the files).

### Step 5g — Run the suite

```bash
bun test
```

Iterate: fix failures in batches (jest-dom matcher gaps, module mock hoisting, env var checks like `process.env.VITEST` — change those to `process.env.BUN_TEST` everywhere).

### Step 5h — Coverage

`bun test --coverage` outputs lcov-compatible reports. Configure thresholds via `bunfig.toml`:

```toml
[test]
preload = ["./bunfig.preload.ts"]
coverage = false
coverageThreshold = { line = 1.0, function = 1.0 }
coverageSkipTestFiles = true
coverageReporter = ["text", "lcov"]
```

The previous vitest config excluded a list of files from coverage. Bun supports `coveragePathIgnorePatterns`:

```toml
coveragePathIgnorePatterns = [
  "src/**/*.test.ts",
  "src/**/*.d.ts",
  "src/test/**",
  "src/lib/types.ts",
  "src/lib/server/db/index.ts",
  "src/lib/server/db/schema.ts",
  "src/hooks.client.ts",
  "src/lib/paraglide/**",
  "src/hooks.ts",
  "src/lib/i18n.ts",
  "src/lib/components/ui/use-bottom-sheet-drag.svelte.ts"
]
```

### Step 5i — Drop vitest deps

```bash
bun remove vitest @vitest/coverage-v8 happy-dom
# happy-dom stays only if other code uses it; the global-registrator pkg has its own happy-dom.
```

Actually — `@happy-dom/global-registrator` bundles its own happy-dom. If no other code imports `happy-dom` directly, drop it. Otherwise keep.

### Step 5j — Commit

```bash
git add bunfig.toml bunfig.preload.ts vite.config.ts package.json bun.lock src/
git commit -m "feat(test): migrate vitest → bun test"
```

---

## Phase 6 — Scripts

Convert each `.mjs` to `.ts` (renaming + minor type touch-ups). Update package.json references (done in 5f).

Files:

- `scripts/check-bundle-size.mjs` → `.ts`
- `scripts/check-i18n-unused.mjs` → `.ts`
- `scripts/cleanup.mjs` → `.ts`
- `scripts/export-user.mjs` → `.ts`
- `scripts/generate-icons.mjs` → `.ts`
- `scripts/lint-i18n.mjs` → `.ts`
- `scripts/list-stale-users.mjs` → `.ts`
- `scripts/reset-e2e-db.mjs` → `.ts`

Each conversion: rename, fix any `process.argv` typing, replace `import('pg')` with `import { SQL } from 'bun'` where the script connects to PG, run once to validate.

Commit:

```bash
git add scripts/ package.json
git commit -m "chore(scripts): convert .mjs scripts to .ts under bun"
```

---

## Phase 7 — CI

Edit `.github/workflows/ci.yml`. The shape of the diff:

- Remove `actions/setup-node@v4` blocks.
- Add `oven-sh/setup-bun@v2` with `bun-version: 1.3.14`.
- Cache `~/.bun/install/cache` keyed on `bun.lock`.
- Replace `npm ci` → `bun install --frozen-lockfile`.
- Replace `npm run X` → `bun run X` (CI commands).
- If a service container for Postgres is configured, the PGlite-based test suite no longer needs it — remove unless e2e uses it. (E2E reset script `scripts/reset-e2e-db.ts` still connects to a real PG for Playwright; keep that.)

Commit:

```bash
git add .github/workflows/ci.yml
git commit -m "ci: migrate workflow to bun"
```

---

## Phase 8 — Docs

Sweep `README.md` and `CLAUDE.md`:

- `npm install` / `npm ci` → `bun install`
- `npm run X` → `bun run X`
- `node` → `bun`
- The CLAUDE.md `Don't run npm audit fix` paragraph: replace with the bun analog (`bun update`'s lockfile rewrite caveat if any — current bun behavior: `bun update` is fine; just note that `bun update --latest` major-bumps).

Dockerfile (if present): swap `node:22-bookworm` base image for `oven/bun:1.3-debian`, `npm ci` → `bun install --frozen-lockfile`, `CMD ["node", "build/index.js"]` → `CMD ["bun", "build/index.js"]`.

Commit:

```bash
git add README.md CLAUDE.md Dockerfile
git commit -m "docs: update for bun"
```

---

## Phase 9 — Verify end-to-end

Run in order, fix anything red:

```bash
bun run lint
bun run check
bun run build
bun test
bun run test:coverage   # confirm 100% threshold still holds
bun run test:e2e         # needs a real PG; skip locally if Docker isn't running
bun run dev              # smoke-check dev server boots
```

Commit anything that needed touching:

```bash
git commit -am "chore: verification fixes"
```

---

## Self-review

**Spec coverage:** Every decision from the question round maps to a phase. DB → 3, adapter → 4, test runner → 5, argon2 → 2. Toolchain (Bun install) → 1. Scripts/CI/docs → 6/7/8. Verify → 9. ✓

**Placeholders:** No "TBD"s; the `TODO bun:` markers in Phase 5e are _deliberate_ hand-fix markers introduced by the codemod and acknowledged in 5e.

**Type consistency:** `DB` type is `BunSQLDatabase<typeof schema>` in prod and `PgliteDatabase<typeof schema>` in tests. Both are structurally compatible with consumer code that takes a Drizzle handle; if a test ever needs to pass `testDb` somewhere typed as `DB`, the call site needs an assertion. Flag this in Phase 3 if it surfaces.

**Risks:**

- `bun:sql` connection params (`statement_timeout`) — bun:sql may not pass arbitrary keys through to libpq; verify in Phase 3, fall back to setting `SET statement_timeout` per session if needed.
- `svelte-adapter-bun` community maturity — pin to a known-working version.
- `mock.module` hoisting — handled in Phase 5e.
- PGlite migration semantics: PGlite is real PG, but its `pg_advisory_xact_lock` is in-process; for tests that's fine.
