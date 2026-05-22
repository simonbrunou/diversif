# Perf budget Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a CI-enforced bundle-size + static-asset budget so a regression like "added a 200KB dependency" or "checked in a 1MB hero image" fails CI instead of silently shipping.

**Architecture:** New Node script `scripts/check-bundle-size.mjs` reads thresholds from `scripts/bundle-budget.json`, walks `.svelte-kit/output/client/_app/immutable/` (JS chunks) + `static/` (committed assets), fails on any breach. New CI job `bundle-budget` builds the app and runs the script, in parallel with the existing lint / vitest / e2e jobs.

**Tech Stack:** Node ESM (stdlib only), SvelteKit (Vite build), GitHub Actions.

---

## Spec reference

See `docs/superpowers/specs/2026-05-22-perf-budget-design.md`.

## File map

**New:**

- `scripts/check-bundle-size.mjs` — the budget checker.
- `scripts/bundle-budget.json` — committed threshold values.

**Modified:**

- `package.json` — add `check:budget` npm script.
- `.github/workflows/ci.yml` — add `bundle-budget` job.

That's it. Tiny bundle.

---

## Task 1: Measure the baseline

This task is data-gathering — no commits. Output is the threshold numbers for Task 2's budget JSON.

**Files (read-only):**

- Read `.svelte-kit/output/client/_app/immutable/` (after a fresh build).
- Read `static/`.

- [ ] **Step 1: Build fresh from main**

```bash
git status --short  # confirm clean tree
npm run build 2>&1 | tail -10
```

Expected: build completes, last lines include `✔ done` from the adapter.

- [ ] **Step 2: Measure JS sizes**

```bash
echo "--- per-JS-chunk (sorted by size) ---"
find .svelte-kit/output/client/_app/immutable -name '*.js' -type f -printf '%s %p\n' | sort -rn | head -20

echo
echo "--- total JS ---"
find .svelte-kit/output/client/_app/immutable -name '*.js' -type f -printf '%s\n' | awk '{s+=$1} END {print s, "bytes (", s/1024, "KB )"}'

echo
echo "--- chunk count ---"
find .svelte-kit/output/client/_app/immutable -name '*.js' -type f | wc -l
```

Capture the output. Note:

- **largestChunk** = top entry from the sorted list (bytes).
- **totalJs** = the awk output.

- [ ] **Step 3: Measure static asset sizes**

```bash
echo "--- per-static-asset (sorted by size) ---"
find static -type f -printf '%s %p\n' | sort -rn | head

echo
echo "--- largest static asset ---"
find static -type f -printf '%s\n' | sort -rn | head -1
```

Capture **largestStaticAsset** = top entry (bytes).

- [ ] **Step 4: Compute thresholds (current × 1.2, with floors)**

Plug the captured values into:

```
maxJsChunkBytes    = ceil(largestChunk × 1.2)
maxTotalJsBytes    = ceil(totalJs × 1.2)
maxStaticAssetBytes = max(ceil(largestStaticAsset × 1.2), 200 * 1024)   # 200KB floor
```

Round each to the nearest 1024 (i.e., a whole KB count). Example: 67_432 bytes × 1.2 = 80_918.4 → round to 81_920 (= 80 × 1024).

Record the four numbers (maxJsChunkBytes, maxTotalJsBytes, maxStaticAssetBytes, plus the raw current values) for Task 2's JSON.

- [ ] **Step 5: No commit** — this task is measurement only.

---

## Task 2: Write `scripts/check-bundle-size.mjs`

**Files:**

- Create: `scripts/check-bundle-size.mjs`

- [ ] **Step 1: Write the script**

Create `scripts/check-bundle-size.mjs`:

```js
#!/usr/bin/env node
/**
 * check-bundle-size: fails when the post-build artifact tree exceeds
 * thresholds in scripts/bundle-budget.json.
 *
 *   - Every JS file under .svelte-kit/output/client/_app/immutable/
 *     must be ≤ maxJsChunkBytes.
 *   - Sum of all those JS files must be ≤ maxTotalJsBytes.
 *   - Every file under static/ must be ≤ maxStaticAssetBytes.
 *
 * Run via `npm run check:budget` (which builds first), or directly
 * after `npm run build` via `node scripts/check-bundle-size.mjs`.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const CLIENT_DIR = path.join(ROOT, '.svelte-kit/output/client/_app/immutable');
const STATIC_DIR = path.join(ROOT, 'static');
const BUDGET_PATH = path.join(ROOT, 'scripts/bundle-budget.json');

function kb(bytes) {
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, files);
    } else if (entry.isFile()) {
      files.push({ path: full, size: fs.statSync(full).size });
    }
  }
  return files;
}

if (!fs.existsSync(CLIENT_DIR)) {
  console.error(
    `Build output not found at ${CLIENT_DIR}.\n` +
      `Run \`npm run build\` first, or use \`npm run check:budget\` which builds + checks together.`
  );
  process.exit(1);
}

let budget;
try {
  budget = JSON.parse(fs.readFileSync(BUDGET_PATH, 'utf8'));
} catch (err) {
  console.error(`Failed to read ${BUDGET_PATH}: ${err.message}`);
  process.exit(1);
}

const jsFiles = walk(CLIENT_DIR).filter((f) => f.path.endsWith('.js'));
const staticFiles = walk(STATIC_DIR);
const totalJs = jsFiles.reduce((s, f) => s + f.size, 0);

const violations = [];

for (const f of jsFiles) {
  if (f.size > budget.maxJsChunkBytes) {
    const rel = path.relative(ROOT, f.path);
    violations.push(`JS chunk too large: ${rel} (${kb(f.size)} > ${kb(budget.maxJsChunkBytes)})`);
  }
}

if (totalJs > budget.maxTotalJsBytes) {
  violations.push(`Total JS too large: ${kb(totalJs)} > ${kb(budget.maxTotalJsBytes)}`);
}

for (const f of staticFiles) {
  if (f.size > budget.maxStaticAssetBytes) {
    const rel = path.relative(ROOT, f.path);
    violations.push(
      `Static asset too large: ${rel} (${kb(f.size)} > ${kb(budget.maxStaticAssetBytes)})`
    );
  }
}

if (violations.length > 0) {
  console.error(`Bundle budget exceeded (${violations.length} violation(s)):`);
  for (const v of violations) console.error(`  - ${v}`);
  console.error(
    `\nIf the growth is intentional, bump scripts/bundle-budget.json with a\n` +
      `commit message that explains why. Otherwise, find the regression.`
  );
  process.exit(1);
}

console.log(
  `Bundle budget OK (${kb(totalJs)} JS across ${jsFiles.length} chunks; ${staticFiles.length} static assets).`
);
```

- [ ] **Step 2: Don't commit yet** — Tasks 2 + 3 + 4 land in one commit.

---

## Task 3: Write `scripts/bundle-budget.json`

**Files:**

- Create: `scripts/bundle-budget.json`

- [ ] **Step 1: Plug Task 1's numbers into the JSON**

Create `scripts/bundle-budget.json` using the values captured in Task 1 step 4. Example shape (replace `<…>` placeholders with the real numbers, in BYTES):

```json
{
  "maxJsChunkBytes": <number>,
  "maxTotalJsBytes": <number>,
  "maxStaticAssetBytes": <number>
}
```

The static-asset value is `max(largestStaticAsset × 1.2, 204800)` — the 200 KB floor accommodates future PWA icons.

- [ ] **Step 2: Sanity-test the script locally**

```bash
node scripts/check-bundle-size.mjs
```

Expected: exit 0, output `Bundle budget OK (...)`.

If exit 1: the values are too tight. Either re-measure (the build output may have changed between measurement and now) or increase the threshold by another small bump.

- [ ] **Step 3: Don't commit yet.**

---

## Task 4: Add `check:budget` script + wire CI job

**Files:**

- Modify: `package.json`
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Add `check:budget` to `package.json` scripts**

Find the `"scripts"` block in `package.json`. Locate the existing `"check"` line:

```json
"check": "npm run paraglide && svelte-kit sync && svelte-check --tsconfig ./tsconfig.json --threshold warning",
```

Below it, add:

```json
"check:budget": "npm run build && node scripts/check-bundle-size.mjs",
```

- [ ] **Step 2: Sanity-test the new script**

```bash
npm run check:budget
```

Expected: builds the app (~10-20s), then prints `Bundle budget OK (...)`. Exit 0.

- [ ] **Step 3: Add the CI job**

Edit `.github/workflows/ci.yml`. Read the current shape first — there are 3 jobs (`lint-and-typecheck`, `unit-and-component`, `e2e`). Add a fourth job at the end of the `jobs:` map (same indentation level as the others):

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

Match the indentation of the surrounding jobs exactly.

- [ ] **Step 4: Verify the workflow YAML parses**

```bash
node -e "const yaml = require('yaml'); const fs = require('fs'); yaml.parse(fs.readFileSync('.github/workflows/ci.yml', 'utf8'));"
```

If the `yaml` module isn't a project dependency, use this instead (workflow YAML is a subset of YAML, so a simple grep-based sanity check suffices):

```bash
grep -E '^  [a-z-]+:$' .github/workflows/ci.yml
```

Expected: 4 lines, one per job — `lint-and-typecheck:`, `unit-and-component:`, `e2e:`, `bundle-budget:`. If `bundle-budget:` is missing or at the wrong indentation, fix it.

- [ ] **Step 5: Lint + typecheck stay green**

```bash
npm run lint
npm run check
```

Expected: pass. The new shell script doesn't go through eslint (`.mjs` files are picked up by prettier only).

- [ ] **Step 6: Commit Tasks 2 + 3 + 4 together**

```bash
git checkout -b feat/harden/bundle-d-perf-budget
git add scripts/check-bundle-size.mjs scripts/bundle-budget.json package.json .github/workflows/ci.yml
git status  # confirm exactly those 4 files
git commit -m "$(cat <<'EOF'
chore(perf): bundle-size + static-asset budget gate

Adds a Node script that walks the post-build artifact tree and the
static/ directory, asserting per-JS-chunk ≤ X, total JS ≤ Y, and
per-static-asset ≤ Z. Thresholds live in scripts/bundle-budget.json,
set to current baseline × 1.2 so the next "added a 200KB dep" / "5MB
PNG checked into static/" breach fails CI.

- scripts/check-bundle-size.mjs (new, stdlib-only Node ESM)
- scripts/bundle-budget.json (new, threshold table)
- package.json: `check:budget` script (build + check)
- .github/workflows/ci.yml: new `bundle-budget` job, runs in
  parallel with the existing three jobs (~30-45s wall-clock).

Closes the 4-bundle hardening sweep (A: regression coverage #189,
B: i18n trim #190, C: a11y #191, D: this one).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

Husky pre-commit will run lint-staged.

---

## Task 5: Replay against deliberate bloat (verification)

This task confirms the gate actually fires when something exceeds the budget. No commit at the end — just sanity.

- [ ] **Step 1: Inject a large fake dep**

Pick a route that the user almost never sees during normal traffic — `/cookies` is a good throwaway. Edit `src/routes/cookies/+page.svelte` and add a fake bloat import at the top of the `<script>` block:

```ts
// TEMPORARY for budget gate replay — DO NOT COMMIT
const fakeBloat = new Uint8Array(500_000).map((_, i) => i & 0xff);
console.log('fake bloat size:', fakeBloat.length);
```

(500KB of synthetic data Vite must inline because it's a runtime computation.)

- [ ] **Step 2: Re-build and run the script**

```bash
npm run build 2>&1 | tail -3
node scripts/check-bundle-size.mjs
echo "exit=$?"
```

Expected: exit 1, with a `JS chunk too large: ... > <threshold>` violation naming the cookies route's chunk.

If the script exits 0 with the bloat in place, the budget is set too loose. Tighten it (re-do Task 1's calc on the broken commit and lower the threshold accordingly) before continuing.

- [ ] **Step 3: Revert the bloat**

```bash
git checkout -- src/routes/cookies/+page.svelte
npm run build 2>&1 | tail -3
node scripts/check-bundle-size.mjs
echo "exit=$?"
```

Expected: exit 0, `Bundle budget OK (...)` again.

- [ ] **Step 4: No commit** — this was a local-only verification.

---

## Task 6: Push + open PR

- [ ] **Step 1: Push**

```bash
git push -u origin feat/harden/bundle-d-perf-budget
```

Pre-push hook runs the full local suite (~2 min). The new budget script ISN'T in the hook (per spec — too slow to run on every push), but lint + check + vitest + e2e still gate the push.

If the pre-push hook fails for any reason: investigate before retrying. Don't `SKIP_PUSH_TESTS=1` unless you have a clear understanding why.

- [ ] **Step 2: Open PR**

```bash
gh pr create --title "perf: bundle-size + static-asset budget (Bundle D)" --body "$(cat <<'EOF'
## Why

The 3 previous hardening bundles (regression coverage #189, i18n trim #190, a11y #191) sit on a pre-existing build size that nobody was actively defending. This bundle adds the gate so any future "added a 200KB dep" / "5MB PNG in static/" regression fails CI instead of merging silently.

## What

- **`scripts/check-bundle-size.mjs`** — pure-stdlib Node script that walks the post-build artifact tree + `static/` and asserts:
  - Every JS file ≤ `maxJsChunkBytes`
  - Sum of JS files ≤ `maxTotalJsBytes`
  - Every static asset ≤ `maxStaticAssetBytes`
- **`scripts/bundle-budget.json`** — threshold table, locked to current baseline × 1.2 (with a 200 KB floor for static assets to accommodate future PWA icons).
- **`npm run check:budget`** — builds + checks together. Standalone, not chained into `lint` (too slow for every commit).
- **CI**: new `bundle-budget` job runs in parallel with the existing three (~30-45s added wall-clock).

## Verified locally

- `npm run check:budget` exits 0 on the current build.
- Deliberate bloat replay: temporarily inlined a 500 KB Uint8Array in `/cookies` — script flagged the chunk and exited 1 with a clear diagnostic. Reverted, exit 0 again.

## Spec + plan

- Spec: `docs/superpowers/specs/2026-05-22-perf-budget-design.md`
- Plan: `docs/superpowers/plans/2026-05-22-perf-budget.md`

Closes the 4-bundle hardening sweep.

## Test plan
- [x] `npm run check:budget` exit 0 on current main
- [x] `npm run check:budget` exit 1 with bloat injected
- [x] CI `bundle-budget` job runs + passes

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3: Watch CI**

`gh pr checks --watch`. The new `bundle-budget` job should appear and pass. Address any issue before requesting review.

---

## Self-review

**Spec coverage check** (against `docs/superpowers/specs/2026-05-22-perf-budget-design.md`):

- ✅ `scripts/check-bundle-size.mjs` — Task 2
- ✅ `scripts/bundle-budget.json` — Task 3
- ✅ `check:budget` npm script — Task 4
- ✅ CI `bundle-budget` job — Task 4
- ✅ Threshold strategy: baseline × 1.2 with 200 KB static floor — Task 1
- ✅ Pre-push hook NOT changed (per spec) — Task 6 step 1 mentions this
- ✅ Verification replay against deliberate bloat — Task 5
- ✅ Lighthouse perf intentionally out of scope — covered in PR body

**Placeholder scan:** Task 3 step 1 shows the JSON with `<number>` placeholders, but these are explicitly to be filled with Task 1's measured values. The plan tells the engineer exactly what to compute. No "TBD" / "TODO" in any step that should be doing work.

**Type consistency:**

- `maxJsChunkBytes`, `maxTotalJsBytes`, `maxStaticAssetBytes` used identically in spec, script, and JSON example.
- Script path `scripts/check-bundle-size.mjs` consistent throughout.
- Budget path `scripts/bundle-budget.json` consistent throughout.
- CI job name `bundle-budget` consistent.
