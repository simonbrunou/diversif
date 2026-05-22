# i18n dead-key trim Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a CI gate that fails when `messages/fr.json` contains keys not reachable from `src/`, then delete the existing dead keys (~92 candidates).

**Architecture:** New `scripts/check-i18n-unused.mjs` does a single-pass walk of `src/`, looks for each fr.json key as (a) a direct call `m.K(`, (b) a string literal `'K'` / `"K"`, or (c) a token listed in a nearby `// i18n-keep: …` directive. Wired into the existing `npm run lint:i18n`. Once the gate is in place and the dynamic-dispatch sites are annotated, dead keys get deleted from both locale files in a follow-up commit.

**Tech Stack:** Node ESM (stdlib only), paraglide, SvelteKit.

---

## Spec reference

See `docs/superpowers/specs/2026-05-22-i18n-deadkey-trim-design.md`.

## File map

**New:**

- `scripts/check-i18n-unused.mjs` — the detector.

**Modified:**

- `package.json` — chain the new script into `lint:i18n`.
- `messages/fr.json` — delete confirmed-dead keys.
- `messages/en.json` — delete the same keys (locale parity).
- Source files at dynamic-dispatch sites: a `// i18n-keep: …` directive listing the keys those sites need. Likely affected:
  - `src/lib/components/AppShellBento.svelte`
  - `src/lib/components/BottomNavBento.svelte`
  - `src/lib/components/bento/SymptomRow.svelte`
  - `src/lib/components/landing/LandingTrustBento.svelte`
  - (any others discovered during Task 3 — list in Task 3's report)

---

## Commit 1 — Detection infrastructure

### Task 1: Write the detector script (TDD)

**Files:**

- Create: `scripts/check-i18n-unused.mjs`

- [ ] **Step 1: Add a temporary test key to fr.json + en.json**

This is to TDD the detector — we want a known-dead key to trip it.

Open `messages/fr.json`. Find a stable spot near the bottom (just before the closing `}`, after the last alphabetically-sorted key). Insert:

```json
"_test_dead_key_brownieXYZ": "DELETE ME — used for TDD'ing scripts/check-i18n-unused.mjs",
```

Add the same line to `messages/en.json` to keep parity.

DO NOT commit yet — this key must come out at the end of the task.

- [ ] **Step 2: Create the detector script**

Write `scripts/check-i18n-unused.mjs` with this content (Node ESM, stdlib only):

```js
#!/usr/bin/env node
/**
 * check-i18n-unused: fails when any key in messages/fr.json is not
 * referenced from src/. A key is "referenced" if any of these patterns
 * matches in a .ts / .js / .svelte file under src/ (excluding generated
 * paraglide output):
 *
 *   1. Direct call:   m.KEY(
 *   2. String literal: 'KEY'  "KEY"  `KEY`
 *   3. Keep directive: // i18n-keep: KEY ...
 *
 * Run via `npm run lint:i18n`.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SRC = path.join(ROOT, 'src');
const EXCLUDED_DIRS = new Set(['paraglide', 'node_modules']);
const SOURCE_EXT = /\.(ts|js|svelte)$/;
const KEEP_DIRECTIVE = /\/\/\s*i18n-keep:\s*([^\n]+)/g;

const raw = fs.readFileSync(path.join(ROOT, 'messages/fr.json'), 'utf8');
const data = JSON.parse(raw);
const keys = Object.keys(data).filter((k) => k !== '$schema');

const sources = [];
const keepTokens = new Set();

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (EXCLUDED_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full);
    } else if (entry.isFile() && SOURCE_EXT.test(entry.name)) {
      const text = fs.readFileSync(full, 'utf8');
      sources.push(text);
      for (const match of text.matchAll(KEEP_DIRECTIVE)) {
        for (const token of match[1].trim().split(/\s+/)) {
          if (token) keepTokens.add(token);
        }
      }
    }
  }
}

walk(SRC);

const haystack = sources.join('\n');

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const dead = [];
for (const key of keys) {
  if (keepTokens.has(key)) continue;
  const k = escapeRegex(key);
  const callRe = new RegExp(`\\bm\\.${k}\\(`);
  const literalRe = new RegExp(`['"\`]${k}['"\`]`);
  if (callRe.test(haystack) || literalRe.test(haystack)) continue;
  dead.push(key);
}

if (dead.length > 0) {
  console.error(`Found ${dead.length} unused i18n key(s) in messages/fr.json:`);
  for (const k of dead) console.error(`  - ${k}`);
  console.error(
    '\nRemove them from messages/fr.json + messages/en.json, or annotate the\n' +
      'dispatch site with `// i18n-keep: <key1> <key2> …`.'
  );
  process.exit(1);
}

console.log(`i18n unused-keys OK (${keys.length} keys, all reachable).`);
```

- [ ] **Step 3: Run the script — confirm it flags the test key (and others)**

Run: `node scripts/check-i18n-unused.mjs`
Expected: exit code 1, output contains `_test_dead_key_brownieXYZ` as one of the dead keys (and ~91 others — that's the real backlog we'll clean up in Task 5).

Capture the count and save the list to `/tmp/dead-keys-baseline.txt` for Task 4:

```bash
node scripts/check-i18n-unused.mjs 2>&1 | grep '^  - ' | sed 's/^  - //' > /tmp/dead-keys-baseline.txt
wc -l /tmp/dead-keys-baseline.txt
```

- [ ] **Step 4: Remove the test key**

Delete the `_test_dead_key_brownieXYZ` line from both `messages/fr.json` and `messages/en.json`.

Re-run: `node scripts/check-i18n-unused.mjs`
Expected: exit 1 still, with the same dead-key list MINUS `_test_dead_key_brownieXYZ`.

Regenerate the baseline list:

```bash
node scripts/check-i18n-unused.mjs 2>&1 | grep '^  - ' | sed 's/^  - //' > /tmp/dead-keys-baseline.txt
wc -l /tmp/dead-keys-baseline.txt
```

- [ ] **Step 5: Do not commit yet** — Task 2 chains the script into `lint:i18n`, then both go in the same commit.

---

### Task 2: Wire the detector into `lint:i18n`

**Files:**

- Modify: `package.json`

- [ ] **Step 1: Read the existing `lint:i18n` script**

Run: `grep -A 1 '"lint:i18n"' package.json`

Currently: `"lint:i18n": "node scripts/lint-i18n.mjs"`.

- [ ] **Step 2: Chain the new check**

Edit `package.json`, change the `lint:i18n` value from:

```json
"lint:i18n": "node scripts/lint-i18n.mjs",
```

to:

```json
"lint:i18n": "node scripts/lint-i18n.mjs && node scripts/check-i18n-unused.mjs",
```

- [ ] **Step 3: Run the chained command**

Run: `npm run lint:i18n`
Expected: prints `i18n apostrophes OK`, then fails with the dead-key list (exit 1).

This proves the chain is wired correctly. The actual cleanup happens in later tasks; we're just confirming the gate fires.

- [ ] **Step 4: Commit Tasks 1 + 2 together (no key deletions yet)**

```bash
git checkout -b feat/harden/bundle-b-i18n-trim   # if not already on a feature branch
git add scripts/check-i18n-unused.mjs package.json
git status  # confirm only those two files staged
git commit -m "$(cat <<'EOF'
test(lint): add i18n unused-keys detector

Walks src/ and flags any messages/fr.json key not reached by:
  - direct call `m.K(`
  - string literal `'K'` / `"K"`
  - `// i18n-keep: K ...` directive

Chained into `npm run lint:i18n`. Gate is intentionally failing on
this commit — the ~92 dead-key cleanup lands in the next commit
once dynamic-dispatch sites have been annotated.

First commit of Bundle B (i18n dead-key trim). See spec:
docs/superpowers/specs/2026-05-22-i18n-deadkey-trim-design.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

Husky pre-commit runs lint-staged (prettier + eslint on staged files only), not the full `lint` script — so the commit will succeed even though `npm run lint:i18n` currently fails. DO NOT push this commit alone — Task 5 will land in the same push.

---

## Commit 2 — Resolve dispatch sites + clean up

### Task 3: Audit dynamic-dispatch sites

**Files:**

- Read (don't modify yet): `src/lib/components/AppShellBento.svelte`
- Read: `src/lib/components/BottomNavBento.svelte`
- Read: `src/lib/components/bento/SymptomRow.svelte`
- Read: `src/lib/components/landing/LandingTrustBento.svelte`
- Discover others via grep.

- [ ] **Step 1: For each known file, find the `m[...]` site and trace where the key strings come from**

For each file, locate the line that does `m[someVar]()` and identify:

- What variable is passed to `m[...]`?
- Where is that variable's value assigned?
- Are the assigned values plain string literals (e.g., `labelKey: 'chromeTabsAujourdhui'`) or computed expressions (e.g., template literals with `${}` interpolation)?

Capture the answer per file in a notepad — you'll use it in Task 4.

Example for `AppShellBento.svelte`:

```bash
grep -n 'labelKey\|m\[' src/lib/components/AppShellBento.svelte
```

Expected to see a `const tabs = [{ labelKey: 'chromeTabsAujourdhui', ... }, ...]` somewhere — those literals make the keys reachable via the detector's string-literal check, so no directive is needed.

- [ ] **Step 2: Categorize each dispatch site**

For each file, decide:

- **No directive needed** — every dispatched key appears as a string literal somewhere in the file (or another `src/` file that gets scanned).
- **Directive needed** — at least one dispatched key is computed and never appears literally. List those keys.

- [ ] **Step 3: Discover any other dispatch sites**

Run: `grep -rn 'm\[' src/lib src/routes 2>/dev/null | grep -v '/paraglide/'`

Each hit is a candidate. Inspect any that aren't already in the four listed above. Add them to the per-file plan.

- [ ] **Step 4: Produce the action list**

At the end of Task 3, you have a list like:

```
src/lib/components/AppShellBento.svelte: literals OK, no directive needed
src/lib/components/BottomNavBento.svelte: literals OK, no directive needed
src/lib/components/bento/SymptomRow.svelte: directive needed — keys: symptomFoo, symptomBar
src/lib/components/landing/LandingTrustBento.svelte: literals OK
src/lib/components/X.svelte: directive needed — keys: ...
```

Save this list locally — Task 4 will apply it. Don't commit anything; this task is exploratory.

---

### Task 4: Annotate dispatch sites with `// i18n-keep:`

**Files:**

- Modify: every file flagged "directive needed" in Task 3.

- [ ] **Step 1: For each "directive needed" file, add the directive**

Place the directive on the line directly above the `m[...]` call (or at the top of the relevant function, whichever reads more naturally). Format:

```ts
// i18n-keep: token1 token2 token3
m[someVar]();
```

Example: in `src/lib/components/bento/SymptomRow.svelte`, if the dispatched keys for severity are `symptomSeverityMild symptomSeverityModerate symptomSeverityMajor`, the dispatch site becomes:

```ts
// i18n-keep: symptomSeverityMild symptomSeverityModerate symptomSeverityMajor
return m[key]();
```

Use exact, current key names — copy them from `messages/fr.json` to avoid typos.

- [ ] **Step 2: Re-run the detector and confirm those keys leave the dead list**

```bash
node scripts/check-i18n-unused.mjs 2>&1 | grep '^  - ' | sed 's/^  - //' > /tmp/dead-keys-after-keeps.txt
diff /tmp/dead-keys-baseline.txt /tmp/dead-keys-after-keeps.txt
```

Expected: the diff shows only removals — the keys you added directives for.

If a key you annotated is still flagged, either:

- The directive line wasn't picked up (check the regex `// i18n-keep:` — must match exactly, single-line, comment-style).
- The token has a typo.

Fix and re-run.

- [ ] **Step 3: Confirm the residual list is genuinely dead**

Spot-check 5–10 keys from `/tmp/dead-keys-after-keeps.txt` by reading them. They should be obvious-looking dead keys from old features (e.g. Carnet/Bilan rename orphans, removed routes). If any look load-bearing, dig in:

```bash
for k in $(head /tmp/dead-keys-after-keeps.txt); do
  echo "=== $k ==="
  grep -rn "$k" --include='*.ts' --include='*.js' --include='*.svelte' src/ | head -3
done
```

If any key turns out to be used in a way the detector misses (e.g., a templated key with `${}` interpolation and no literal anywhere), add an `// i18n-keep: …` directive at the site and re-run.

- [ ] **Step 4: Do not commit yet** — Task 5 deletes the residual list in the same commit as these directives.

---

### Task 5: Delete the residual dead keys

**Files:**

- Modify: `messages/fr.json`
- Modify: `messages/en.json`

- [ ] **Step 1: Confirm the residual list**

```bash
node scripts/check-i18n-unused.mjs 2>&1 | grep '^  - ' | sed 's/^  - //' > /tmp/dead-keys-final.txt
wc -l /tmp/dead-keys-final.txt
```

Eyeball the list one more time. If anything still looks suspicious, stop and investigate — deleting a load-bearing key now means a paraglide-fallback string in production (the key name itself shown to users).

- [ ] **Step 2: Delete the keys from both locale files**

Use this script (run from repo root):

```bash
node -e "
const fs = require('fs');
const dead = fs.readFileSync('/tmp/dead-keys-final.txt', 'utf8').trim().split('\n').filter(Boolean);
for (const file of ['messages/fr.json', 'messages/en.json']) {
  const obj = JSON.parse(fs.readFileSync(file, 'utf8'));
  for (const k of dead) delete obj[k];
  fs.writeFileSync(file, JSON.stringify(obj, null, 2) + '\n');
}
console.log('Removed', dead.length, 'keys from each locale.');
"
```

This preserves the surviving keys' original insertion order (V8 maps preserve insertion order) and rewrites the file with 2-space indentation matching the existing style.

- [ ] **Step 3: Verify**

```bash
node scripts/check-i18n-unused.mjs
npm run lint:i18n
```

Expected: both green. `lint:i18n` prints "i18n apostrophes OK" then "i18n unused-keys OK (N keys, all reachable)" where N is `557 - len(dead)`.

- [ ] **Step 4: Run paraglide compile + typecheck**

```bash
npm run check
```

Expected: clean. (Paraglide compiles the trimmed messages; svelte-check verifies nothing references a deleted key.)

- [ ] **Step 5: Run unit tests**

```bash
npm test
```

Expected: all green. Any test that hardcoded a deleted key would fail here.

- [ ] **Step 6: Smoke-test the dev server (optional)**

```bash
npm run dev
```

In a separate terminal, hit the major routes that lean on paraglide:

```
/signup
/child/<id>
/child/<id>/guide
/child/<id>/profil
/
```

Look for any string that renders as a literal key name (paraglide's fallback when a key is missing). Stop the dev server when done.

If the dev server isn't available locally (no Postgres etc.), skip and rely on CI for the smoke check.

- [ ] **Step 7: Commit Tasks 3 + 4 + 5 together**

```bash
git status  # should show: messages/fr.json, messages/en.json, plus any files modified in Task 4
git add messages/fr.json messages/en.json
# Stage only the files touched by Task 4 — explicitly, not `git add src/`:
# git add src/lib/components/bento/SymptomRow.svelte   # example
git diff --cached --stat
git commit -m "$(cat <<'EOF'
i18n: remove dead keys + annotate dynamic-dispatch sites

Deletes <N> keys from messages/fr.json + messages/en.json that no
source file references (after annotating dynamic-dispatch sites with
`// i18n-keep:` directives so the detector can see them).

Mostly orphans from Bundle 5's Carnet/Bilan rename and earlier
feature removals.

`npm run lint:i18n` now passes green.

Second commit of Bundle B (i18n dead-key trim).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

Replace `<N>` with the actual number of keys deleted (from `wc -l /tmp/dead-keys-final.txt`).

---

## Task 6: Open the PR

- [ ] **Step 1: Push**

```bash
git push -u origin feat/harden/bundle-b-i18n-trim
```

- [ ] **Step 2: Open PR**

```bash
gh pr create --title "i18n: dead-key trim + CI gate (Bundle B)" --body "$(cat <<'EOF'
## Why

Bundle 5's Carnet/Bilan rename and earlier feature removals left ~92 unused keys in messages/fr.json. Without a CI gate they would keep accumulating.

## What

- **`scripts/check-i18n-unused.mjs`**: walks `src/` and flags any `messages/fr.json` key not reached via `m.K(`, string literal, or `// i18n-keep: K ...` directive.
- **`lint:i18n` chained**: `node scripts/lint-i18n.mjs && node scripts/check-i18n-unused.mjs`. CI fails if any key is unreachable.
- **`// i18n-keep:` directives**: added at dynamic-dispatch sites whose keys can't be resolved by literal grep.
- **Deletion**: <N> keys removed from both locale files.

## Spec + plan

- Spec: `docs/superpowers/specs/2026-05-22-i18n-deadkey-trim-design.md`
- Plan: `docs/superpowers/plans/2026-05-22-i18n-deadkey-trim.md`

Second of a 4-bundle hardening sweep (A: regression coverage — shipped in #189; C: a11y; D: perf).

## Test plan
- [ ] `npm run lint:i18n` green
- [ ] `npm run check` clean
- [ ] `npm test` all green
- [ ] Smoke: signup, /child/[id], /child/[id]/guide, /child/[id]/profil — no key-name literals visible

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3: Watch CI**

Run: `gh pr checks --watch`

Address any flake or unexpected failure before requesting review.
