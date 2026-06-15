# Tooling & Hardening Audit — diversif

> **Mode:** report-first. No code, migrations, or databases were touched in this pass.
> **Date:** 2026-06-14 · **Commit basis:** `main` @ 4905b8f
> Every finding below is grounded in actual code (`file:line`) or real tool output. Inferences are marked as such.

## ⚠️ Three premise corrections (the brief vs. the repo)

The brief carried assumptions that the code contradicts. Surfacing these up front so the rest reads correctly:

1. **Not `better-sqlite3`.** The DB driver is **`bun:sqlite`** (`src/lib/server/db/index.ts:9`), the app runs under **Bun**, and the package manager is **Bun** (`bun.lock`, 204 KB). Commands below use `bun`/`bunx --bun`, not `npx`/`pnpm`.
2. **`drizzle-kit check` is already in CI.** Phase 5 asks to "recommend it for drift" — it already runs (`.github/workflows/ci.yml:24-25`). No action needed; noted for completeness.
3. **Error monitoring already exists.** `@sentry/sveltekit` is fully wired (`src/lib/sentry-init.server`, `handleError` in `src/hooks.server.ts:33`). The GlitchTip recommendation below is therefore a _DSN/endpoint swap_, not a from-scratch integration.

There is **no `HARDENING.md`** in the repo (the brief implied one might exist).

---

## 🔒 CRITICAL multi-tenant findings — called out first (as requested)

**None.** Tenant isolation is **sound.** A dedicated security trace of every tenant-scoped route, the guidance query layer, the invitation lifecycle, and GDPR export/delete found **no cross-tenant read or write path** (CRITICAL or HIGH).

The model that makes it sound:

- Tenant boundary = the **child/household**, granted by `memberships(userId, childId, role)` (`src/lib/server/db/schema.ts:74`).
- `locals.memberships` is loaded **once per request** from the session user (`src/hooks.server.ts` → `listMembershipsForUser`), and `requireChildContext` / `requireMembership` / `requireOwnership` (`src/lib/server/guards.ts:49-92`) re-resolve `childId` **from the validated URL param** against it before any data access.
- **No route reads `childId` from a form/body** — it's always the guarded URL param (verified by grep; zero hits).
- Nested `[entryId]` resources use a **compound `WHERE id = entryId AND childId = childId`** predicate, so the "member of child A passes child B's entryId" confusion attack returns 404 — and this class is already unit-tested (`child/[id]/foods/[entryId]/page.server.test.ts`).
- Invite codes: CSPRNG (`node:crypto.randomBytes`), 32-char ambiguity-free alphabet, length 6 (~1.07×10⁹ keyspace, **zero modulo bias** since 256 % 32 = 0), 7-day TTL, single-use via an **atomic `usedAt IS NULL`-conditioned UPDATE** that closes the concurrent-redemption race (`join/[code]/+page.server.ts:145-157`), plus rate limiting (20 / 5 min, per-IP **and** per-user).
- GDPR export/delete are strictly `user.id`-scoped; delete correctly preserves shared children and transfers ownership to the earliest-joined member when the sole owner leaves (`src/lib/server/gdpr.ts`).

Only three **LOW / defense-in-depth** items exist (M1–M3 in the checklist). They are latent-correctness/future-proofing, not live exploits.

---

## Phase 0 — Current-state inventory

| Tool category                        | Present?                                                                                    | Version / where                                               | Gaps                                                 |
| ------------------------------------ | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------- | ---------------------------------------------------- |
| **Runtime**                          | Bun                                                                                         | 1.3.14 (CI pin)                                               | —                                                    |
| **Framework**                        | SvelteKit + `adapter-node` (under Bun)                                                      | kit ^2.8, svelte ^5.55                                        | —                                                    |
| **DB driver**                        | `bun:sqlite` + Drizzle ORM                                                                  | drizzle-orm ^0.45, drizzle-kit ^0.31                          | single-connection WAL (fine for single-box)          |
| **DB client location**               | `src/lib/server/db/index.ts` (server-only)                                                  | —                                                             | no client leak (see dep-cruiser)                     |
| **Migrations**                       | Drizzle migrator, run at module init                                                        | `drizzle/000{0,1,2}_*.sql`                                    | applied in-process on boot; no separate migrate step |
| **Typecheck**                        | `svelte-check`                                                                              | ^4.0 (CI: `bun run check`)                                    | —                                                    |
| **Lint/format**                      | ESLint ^10 + Prettier + `eslint-plugin-drizzle` + i18n/contrast linters                     | `eslint.config.js`                                            | —                                                    |
| **Code-health gate**                 | **Fallow**                                                                                  | 2.96 (`.fallowrc.json`, CI `fallow-audit`, PR-only, new-only) | cyclomatic≤20 / cognitive≤15                         |
| **Unit/component tests**             | `bun test` (bun:sqlite `:memory:`) + `@testing-library/svelte` + happy-dom                  | ~193 test files, 100% coverage gate                           | no Vitest (deliberate)                               |
| **E2E**                              | Playwright (Chromium desktop + mobile)                                                      | ^1.59, `playwright.config.ts`                                 | **no cross-tenant denial spec**                      |
| **CI**                               | GitHub Actions, 5 jobs                                                                      | `.github/workflows/ci.yml`                                    | no knip / dep-cruiser job                            |
| **Drift check**                      | `drizzle-kit check`                                                                         | CI job ✓                                                      | already present                                      |
| **Error monitoring**                 | Sentry (`@sentry/sveltekit`)                                                                | ^10, EU region                                                | hosted SaaS (vs. self-host values)                   |
| **Backups**                          | VACUUM INTO → object storage **documented**; LXC vzdump → R2 daily (infra)                  | `DEPLOY.md`, `db:verify-backup`                               | off-box app-level cron is a **TODO** ("Schedule…")   |
| **Dead-code / dup / boundary tools** | none (knip, dependency-cruiser, jscpd not installed)                                        | —                                                             | candidates below                                     |
| **Auth**                             | Custom: argon2id (`Bun.password`) + hashed sessions + WebAuthn passkeys (`@simplewebauthn`) | —                                                             | small, well-tested (see Phase 3)                     |

---

## Phase 1 — Static analysis (tools actually run under `bunx --bun`)

### knip

`bunx --bun knip --config /tmp/knip.json --no-exit-code`

A **config is mandatory** — the bare run flagged all ~193 test files as "unused" (no bun-test entry config). With a tuned config: **0 unused files, 0 unused exports**, and every "unused dependency" (7 dev + 2 prod) was a **verified false positive** (CSS `@import`s in `app.css`, prettier plugins, the `node_modules/<bin>` Bun-shim script invocations, `happy-dom` via preload, `fallow` as a CI binary).

- **Genuine wins (2, trivial):** drop the `export` keyword on two file-local types — `PasskeyErrorKey` (`src/lib/auth/passkey-client.ts:21`) and the local `Severity` (`src/lib/server/guidance/reminders.ts:24`).
- **CI verdict:** ADOPT-IF-CONFIGURED only (committed `knip.json` + ignore list). Overlaps with the existing Fallow gate; **low priority.**

### dependency-cruiser — the server-in-client guard (highest-value rule)

`bunx --bun --package=dependency-cruiser depcruise --config /tmp/depcruise.cjs src`

Rule encoded: any module **not** under `src/lib/server/` and **not** a `*.server.{ts,js}` is forbidden from importing `drizzle-orm`, `bun:sqlite`, `$lib/server`, or `src/lib/server`.

**Result: `✔ no dependency violations found (607 modules, 1204 dependencies cruised)`** — zero violations. DB code does not leak toward the client bundle.

> **Supply-chain note:** bare `bunx depcruise` resolved a **dependency-confusion placeholder package** named `depcruise` (an Aikido stub with no usable code). You must invoke the tool as **`dependency-cruiser`** (or `--package=dependency-cruiser`), never `depcruise`. Encode this in any CI job.

- **CI verdict:** **ADOPT as a blocking gate.** It's a hard security/bundle invariant, it currently passes clean, and it catches a genuinely dangerous regression.

### jscpd

`bunx --bun jscpd src --min-lines 8`

Overall **5.52%** duplication (209 clones) — but **192 clones are in test files** (setup boilerplate); production code is **~0.4%**. Top _production_ clones worth a one-off refactor: passkey verify/challenge boilerplate (`passkeys/authentication/verify/+server.ts:32-46` ⇄ `passkeys/registration/verify/+server.ts:20-31`), the `log` load/form-action boilerplate (`child/[id]/log/+page.server.ts` ⇄ `…/log/[entryId]/+page.server.ts`), and fresh-auth action boilerplate.

- **CI verdict:** advisory only — **do not gate on %** (test boilerplate inflates it). Use the output for a one-time manual refactor.

---

## Phase 2 — Multi-tenant isolation

Sound (see the CRITICAL section at top). Routes confirmed SAFE: every load + action under `child/[id]/**` (`+layout`, page, foods, foods/[entryId], foods/[entryId]/print, log, log/[entryId], report, guide, suggestions, settings), `child/new`, the guidance/query layer, `account/export`, `account/delete`. The three LOW items are M1–M3 in the checklist.

## Phase 3 — Auth & sessions

**Current approach (custom, small, well-tested, strong):**

- **Passwords:** `Bun.password` argon2id (`memoryCost 19456, timeCost 2`), with a **decoy-hash timing-oracle defense** so "user doesn't exist" is wall-clock-indistinguishable from "wrong password" (`src/lib/server/auth.ts:52-80`).
- **Sessions:** 256-bit `randomBytes` token in an `httpOnly; SameSite=Lax; Secure(prod)` cookie; the DB stores only **`sha256(token)`** (`auth.ts:94`) — a stolen DB file yields no usable bearer tokens. 30-day expiry with sliding renewal inside a transaction. `invalidateSession` + `invalidateAllUserSessions` exist and are wired (logout, password change, `/account/sessions`).
- **Passkeys:** `@simplewebauthn/server` v13, extensively unit-tested (ceremony, challenges, rpid, helpers).

**Better Auth migration assessment (asked for, not performed):** **Recommend against, for now.** Better Auth is an excellent library, but here it would _add_ risk, not remove it: the existing auth is ~220 lines, fully covered, bun:sqlite-native, and already implements the subtle parts (hashed-at-rest sessions, timing-oracle defense, WebAuthn). Migrating would touch session storage + cookie wiring (`auth.ts`, `hooks.server.ts`), introduce Better Auth's own schema tables (a data migration for `users`/`sessions`/`passkeys`), and require re-validating the passkey flow against its plugin — a large, high-blast-radius change for marginal benefit pre-launch. Revisit only if you need social login / multi-factor / org features it provides out of the box.

## Phase 4 — Testing gaps

Coverage is broad (100% line gate; auth, passkeys, guards, child CRUD, food logging, symptoms, guidance, GDPR, rate-limit all tested). The **nested-id confusion class is already unit-tested**. The gaps are at the e2e/abuse layer — see T1–T4 in the checklist. **Vitest 4 browser mode + vitest-browser-svelte: recommend NOT adopting** — it fractures a deliberately Bun-monolithic toolchain (second runner, second config, 77 component files to port) for DOM fidelity that the existing Playwright specs (`responsive-modals`, `responsive-allergen-sheet`, `bento-shell`) already provide. Push any remaining real-DOM assertions into those e2e specs instead.

## Phase 5 — Migrations & data durability

- **Drift check:** `drizzle-kit check` already gates CI (`ci.yml:24`). ✓
- **Destructive-op scan:** migration history is **safe**. `0001` is purely additive (`ADD COLUMN` + idempotent backfill). `0002` is `DELETE FROM sessions` — a _data_ wipe, but **intentional and documented** (session-format change; users simply re-auth), not a schema drop. No dropped columns/tables, no un-backfilled changes.
- **Durability:** WAL + `synchronous=NORMAL` + `busy_timeout=5000` + `foreign_keys=ON`, single connection (`db/index.ts:43-46`) — correct for a single-box SQLite deployment. Migrations run in-process on boot, wrapped in a Sentry-reported try/catch.
- **Backup recommendation (note it; don't configure):** DEPLOY.md _documents_ a `VACUUM INTO` → object-storage cron + `db:verify-backup`, but actually **scheduling it is an open TODO** (DEPLOY.md:99). For a single-file DB holding other families' data, adopt **Litestream** for continuous streaming replication to an S3-compatible target (R2): it's strictly better than daily snapshots (point-in-time recovery, seconds of RPO vs. up to 24h), needs no app changes, and **WAL mode — already enabled — is its prerequisite.** Keep the documented `VACUUM INTO` snapshot as the pre-deploy belt-and-braces. ⚠️ Backups taken _before_ the session-hashing migration contain raw session tokens — handle as a secrets file until they age out (DEPLOY.md:103 already flags this).

## Phase 6 — Observability & CI

- **Error monitoring → GlitchTip:** Sentry SDK is already integrated, and GlitchTip is **Sentry-SDK-wire-compatible**, so adopting it for data-sovereignty is a low-effort swap: point the runtime `SENTRY_DSN`/`PUBLIC_SENTRY_DSN` at a self-hosted GlitchTip instance and **add its ingest origin to the CSP `connect-src`** (`svelte.config.js:38-47`, currently allow-lists `*.ingest.*.sentry.io`). The hook wiring (`handleError`, `sentry-init.server`, the Vite plugin) stays as-is. _Inference:_ GlitchTip doesn't support every Sentry feature (e.g. Seer/AI, some performance views), but for error capture it's a drop-in.
- **CI gate:** the existing `ci.yml` already gates lint → typecheck → drizzle-drift → Fallow → 100%-coverage unit → Playwright e2e → bundle-budget. The brief's proposed chain (`svelte-check → knip → dependency-cruiser → vitest → playwright`) is **mostly already present**; the only true additions are dependency-cruiser (adopt) and knip (optional). So the proposal is an **additive job**, not a replacement — see C1 below for the exact YAML.

---

## ✅ Prioritized checklist (severity · effort · rationale · exact change)

> No CRITICAL/HIGH security defects exist. "HIGH" here = highest-value pre-launch hardening, since the most important property (tenant isolation) deserves an automated safety net even though it's currently correct.

| #      | Sev  | Eff | Item                                                  | Rationale                                                                                                                                                                                                                                    | Exact command / file change                                                                                                                                                                                                                                                                                                                                                                           |
| ------ | ---- | --- | ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **T1** | HIGH | M   | Cross-tenant isolation **e2e** spec                   | The one test that catches a guard accidentally dropped from a `+page.server.ts` prelude — protects the #1 property end-to-end.                                                                                                               | New `e2e/cross-tenant-isolation.spec.ts`: user B (valid session, no membership on child A) `goto`s `/child/<A>`, `/child/<A>/foods`, `/child/<A>/foods/<entryA>`, `/child/<A>/settings` → assert 403/blocked + child A's name absent; POST `addSymptom`/`removeMember` against A with B's cookies → 403/404 and assert no row created; B's own-child-foreign-entry `/child/<B>/foods/<entryA>` → 404. |
| **C1** | HIGH | S   | Adopt **dependency-cruiser** as a blocking CI gate    | Hard security/bundle invariant (DB out of the browser); currently 0 violations; cheap.                                                                                                                                                       | Commit `.dependency-cruiser.cjs` (the `no-server-in-client` rule). Add a CI job (see snippet below). **Invoke as `dependency-cruiser`, never `depcruise`.**                                                                                                                                                                                                                                           |
| **T2** | MED  | S   | Invitation **abuse-case** route tests                 | Expired / already-redeemed / owner-self-redeem / sequential double-redeem all funnel through one generic error and aren't independently asserted.                                                                                            | Add to `src/routes/join/[code]/page.server.test.ts`: expired row (`expiresAt` in past) → error/`fail(400)`; `usedAt` set → treated inactive; owner redeems own code → 303, no dup membership, invite not consumed; same code POSTed twice → 2nd `fail(400)`. Plus a direct `createInvitationForChild` test forcing 5 collisions → `null`.                                                             |
| **M1** | MED  | S   | Re-check `expiresAt` inside the **claim transaction** | Defense-in-depth: the atomic UPDATE checks `code` + `usedAt IS NULL` but not `expiresAt` (`join/[code]/+page.server.ts:147-150`). Not exploitable today (µs read→write gap), but latent.                                                     | Add `gt(invitations.expiresAt, now)` to the UPDATE `.where(and(...))`.                                                                                                                                                                                                                                                                                                                                |
| **M2** | MED  | M   | Make symptom helpers **self-scoped by childId**       | `insertSymptom` / `listSymptomsByEntry` trust the caller to pre-verify entry ownership (`src/lib/server/db/symptoms.ts:22,79,93`). Safe today (every caller guards first), but a future caller forgetting the precheck = cross-tenant write. | Add `childId` param to `listSymptomsByEntry`/`countNthExposition` and an `id=foodEntryId AND childId=childId` assertion inside `insertSymptom`.                                                                                                                                                                                                                                                       |
| **B1** | MED  | S   | **Schedule the off-box backup** (currently a TODO)    | DEPLOY.md documents the method but scheduling is unfinished; this DB holds other families' data.                                                                                                                                             | Recommended: deploy **Litestream** → R2 (continuous, WAL already on); keep the `VACUUM INTO` pre-deploy snapshot. Note only — don't configure this pass.                                                                                                                                                                                                                                              |
| **O1** | LOW  | S   | Swap Sentry → **self-hosted GlitchTip**               | Matches the project's data-sovereignty values; SDK-compatible, near-zero code change.                                                                                                                                                        | Point `SENTRY_DSN`/`PUBLIC_SENTRY_DSN` at GlitchTip; add its origin to CSP `connect-src` in `svelte.config.js`.                                                                                                                                                                                                                                                                                       |
| **M3** | LOW  | S   | Explicit guard in `report`/`guide` loads              | They rely on the layout guard via `await parent()` — correct today, but the only routes without an in-file guard.                                                                                                                            | Add `requireChildContext(locals, params)` to `child/[id]/report/+page.server.ts` and `…/guide/+page.server.ts` for auditability.                                                                                                                                                                                                                                                                      |
| **C2** | LOW  | S   | knip with committed config (advisory)                 | 0 real findings today, but a config-pinned run is a cheap files/exports regression gate. Overlaps Fallow.                                                                                                                                    | Commit `knip.json` (SvelteKit entries + `*.test.ts` + `scripts/**`; ignore fonts/tailwind/prettier-plugins/svelte-check/prettier/fallow/happy-dom). Non-blocking job.                                                                                                                                                                                                                                 |
| **Q1** | LOW  | S   | One-off dedup of production clones                    | ~0.4% prod duplication; a handful worth collapsing.                                                                                                                                                                                          | Extract shared passkey verify/challenge helper; extract the `log` load/form-action boilerplate. Not a CI gate.                                                                                                                                                                                                                                                                                        |
| **Q2** | LOW  | S   | Drop `export` on 2 file-local types                   | knip's only genuine win.                                                                                                                                                                                                                     | `PasskeyErrorKey` (`passkey-client.ts:21`), local `Severity` (`reminders.ts:24`).                                                                                                                                                                                                                                                                                                                     |

### C1 — proposed additive CI job (GitHub Actions + Bun)

```yaml
static-boundaries:
  name: Architecture boundaries (server-in-client guard)
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v6
    - uses: oven-sh/setup-bun@v2
      with:
        bun-version: 1.3.14
    - run: bun install --frozen-lockfile
    - run: bun run paraglide && bun --bun node_modules/@sveltejs/kit/src/cli.js sync
    # Pin the package name: bare `depcruise` resolves a dependency-confusion stub.
    - run: bunx --bun --package=dependency-cruiser depcruise --config .dependency-cruiser.cjs --no-cache src
```

(Add `dependency-cruiser` as a pinned `devDependency` rather than relying on `bunx` fetch, mirroring how Fallow is pinned — see `ci.yml:48-50`.)

---

## If I had time for only 3 things before launch

1. **T1 — ship the cross-tenant isolation e2e.** Isolation is currently correct, but it's the property whose silent regression would be most catastrophic (leaking another family's child/health data). An automated end-to-end denial test is the cheapest insurance for the highest-stakes invariant.
2. **C1 — wire dependency-cruiser's server-in-client rule into CI as a blocking gate.** It passes clean today; making it a gate permanently prevents the most dangerous bundle/security regression (DB client reaching the browser) at near-zero cost.
3. **B1 — actually schedule the off-box backup (Litestream → R2).** A single-file SQLite DB holding multiple families' data with only a _documented-but-unscheduled_ backup is the biggest operational risk at launch. WAL is already on, so Litestream is low-effort and gives point-in-time recovery.

---

_Stopping here. No files other than this report were created or modified; no code/migrations/DB were touched. Awaiting your go-ahead before implementing anything._
