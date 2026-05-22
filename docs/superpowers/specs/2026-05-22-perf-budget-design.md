# Perf budget — design

**Date:** 2026-05-22
**Status:** draft
**Bundle:** D (fourth and final of the hardening sweep — see [Companion bundles](#companion-bundles))

## Goal

Gate every PR with a deterministic bundle-size + static-asset budget so a regression like "added a 200KB dependency" or "checked in a 1MB hero image" fails CI instead of silently shipping. Thresholds locked to the current baseline + 20% headroom.

## Non-goals

- **Lighthouse perf score** — Bundle C established that `playwright-lighthouse` returns NO_FCP on every JS-driven SvelteKit route. The same compat issue blocks a Lighthouse-driven perf gate. Queued as a separate future bundle if the budget script proves insufficient; would likely need `@lhci/cli` standalone with cookie-injection for auth routes.
- **Real-user monitoring / Sentry RUM alerts** — Sentry is wired but adding alerting thresholds is operational work, not CI gating.
- **Bundle composition analysis** (which dep contributes which bytes) — useful for triage when a budget breach lands, but not a hard gate. Can be added on demand via `npx rollup-plugin-visualizer` or similar.
- **Source-map / treeshaking effectiveness checks** — more advanced; out of scope.

## Architecture

A new Node script `scripts/check-bundle-size.mjs` runs against the post-build `.svelte-kit/output/client/_app/immutable/` tree and `static/`, comparing file sizes to thresholds in a committed `scripts/bundle-budget.json`. CI runs it in a dedicated `bundle-budget` job (parallel with lint+typecheck / vitest / e2e). Exit non-zero on any threshold breach with a clear diagnostic.

Threshold strategy: **current baseline × 1.2** (20% headroom). The budget JSON is the single source of truth — committed to the repo, updated by hand when intentional growth happens (with a commit message explaining why).

## Components

### `scripts/check-bundle-size.mjs` (new)

A Node ESM script that:

1. Reads `scripts/bundle-budget.json`.
2. Walks `.svelte-kit/output/client/_app/immutable/` collecting `.js` file sizes.
3. Walks `static/` collecting every asset file size.
4. Asserts:
   - Every JS file ≤ `maxJsChunkBytes`.
   - Sum of JS files ≤ `maxTotalJsBytes`.
   - Every static asset ≤ `maxStaticAssetBytes`.
5. On breach: prints a per-violation diagnostic + exits 1. On pass: prints a one-line summary + exits 0.

Pure stdlib, ~80 lines. Handles missing build directory (exit 1 with "run npm run build first" hint).

### `scripts/bundle-budget.json` (new)

```json
{
  "maxJsChunkBytes": <baseline × 1.2>,
  "maxTotalJsBytes": <baseline × 1.2>,
  "maxStaticAssetBytes": <baseline × 1.2 OR 200 KB floor, whichever is larger>
}
```

Values filled in at implementation time from the actual measured baseline. The static-asset floor (200 KB) accommodates future PWA icons up to reasonable sizes without churning the budget.

### `package.json` (modified)

New script:

```json
"check:budget": "npm run build && node scripts/check-bundle-size.mjs"
```

NOT chained into `lint` — `lint` runs on every commit via husky, and a full Vite build (~10-20s) on every commit is too slow. The budget check runs only in CI and on-demand locally.

### `.github/workflows/ci.yml` (modified)

New job `bundle-budget`:

```yaml
bundle-budget:
  name: Bundle size budget
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: '24'
        cache: 'npm'
    - run: npm ci
    - run: npm run build
    - run: node scripts/check-bundle-size.mjs
```

Runs in parallel with the existing four jobs; adds ~30-45s to CI wall-clock.

### Pre-push hook (`.husky/pre-push`) — no change

The pre-push hook does NOT run `check:budget`. Reason: the hook already runs `npm test:e2e` which builds the app. Wiring the budget check into the pre-push hook would re-build (slow), and skipping the build means stale artifacts. CI catches the breach; the hook stays focused on lint+check+test+e2e. Documented in the hook script if it grows confusing.

## Data flow

```
post-build .svelte-kit/output/client/_app/immutable/  ─┐
static/                                               ─┼──► check-bundle-size.mjs ──► exit 0 | exit 1 + diagnostic
scripts/bundle-budget.json                            ─┘
```

Linear. Single pass. No external systems, no network.

## Error handling

- **Missing build directory** (`.svelte-kit/output/client/...`): exit 1 with `run npm run build first`.
- **Malformed budget JSON**: exit 1 with a JSON-parse error and the offending path.
- **A category breach**: exit 1 with each violation listed (path + actual size + threshold). The diagnostic ends with a hint about updating `scripts/bundle-budget.json` if intentional.
- **No violations**: exit 0 with `Bundle budget OK (N KB JS across X chunks; Y static assets)`.

## Verification

1. **Establish baseline** — run `npm run build` on `main`, capture the actual sizes of largest JS chunk, total JS, largest static asset. Compute `baseline × 1.2`, commit those values to `bundle-budget.json`.
2. **Pass on current main** — run `node scripts/check-bundle-size.mjs` against the current build, must exit 0 with the summary line.
3. **Replay against bloat** — temporarily import a large dep (e.g., add `import 'lodash'` to a route that doesn't need it) or check in a 5MB PNG into `static/`, re-build, re-run the script — must exit 1 with a clear diagnostic naming the offender.
4. **Revert + re-pass** — remove the temporary bloat, re-run, exit 0 again.
5. **CI integration** — confirm the `bundle-budget` job runs on the Bundle D PR and either passes (budget honored) or fails (budget exceeded).

## Rollout — single PR, three commits

**Commit 1 — Script + budget JSON + CI job:**

- Add `scripts/check-bundle-size.mjs`.
- Add `scripts/bundle-budget.json` with the measured baseline + 20%.
- Add `bundle-budget` job to `.github/workflows/ci.yml`.
- Add `check:budget` to `package.json` scripts.

**Commit 2 — (only if needed) — fix any baseline overshoot:**
If during step 1 the budget JSON values are NICE round numbers AND the current build fits cleanly, this commit may be unnecessary. If we discover an unexpectedly large chunk during baseline measurement (e.g., paraglide-generated `messages.js` is bigger than expected), fix it before locking the budget.

**Commit 3 — (only if needed) — verification replay:**
The replay in §Verification step 3 is a local-only step; nothing to commit. Documented in the PR description.

## Companion bundles

Bundle D of a 4-bundle hardening sweep — the final one:

- **Bundle A — UI regression coverage** (shipped, PR #189).
- **Bundle B — i18n dead-key trim** (shipped, PR #190).
- **Bundle C — A11y audit** (in flight, PR #191).
- **Bundle D — Perf budget** (this spec).

No cross-bundle dependencies; ships independently. Closes the hardening sweep.
