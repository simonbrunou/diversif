# i18n dead-key trim — design

**Date:** 2026-05-22
**Status:** draft
**Bundle:** B (second of a 4-bundle hardening sweep — see [Companion bundles](#companion-bundles))

## Goal

Remove unused i18n keys from `messages/fr.json` + `messages/en.json` (after Bundle 5's Carnet/Bilan rename left orphans), and add a CI gate so dead keys can't accumulate again.

Initial estimate (a rough `grep` for `m.X(`): **~92 unused candidates out of 557 keys (~16.5%)**. The real number will be lower after resolving dynamic-dispatch false positives.

## Non-goals

- Locale parity enforcement (fr ↔ en key sets). Currently both have 557 keys; future drift can be addressed separately.
- Modularizing `messages/*.json` into per-domain files. Paraglide compiles a flat key namespace and doesn't natively support split sources; benefit doesn't justify the build-step complexity.
- Touching the existing apostrophe linter (`scripts/lint-i18n.mjs`) — keeps its current contract.
- Adding new keys or rewording surviving keys. This bundle is pure removal + tooling.

## Architecture

**One PR, two logical units (commits):**

1. **Detection tool + dispatch-site annotations** — `scripts/check-i18n-unused.mjs` + any `// i18n-keep:` directives at sites that need them. CI is wired but no keys deleted yet, so the tool starts green from main minus the dead set (the actual deletion is the next commit).
2. **One-shot cleanup** — delete the confirmed-dead keys from both locale files in alphabetical order, preserving the existing JSON shape.

If the deletion list ends up large (≥ 50 keys), the PR may split into two commits but ships as a single PR.

## Detection algorithm

For each key K in `messages/fr.json`:

```
reachable = false
for file F in src/ excluding src/lib/paraglide/ and src/paraglide/:
  if F contains regex m\.K\(           → reachable
  else if F contains regex ['"]K['"]   → reachable (handles dynamic dispatch via `m[var]()` with K passed as literal)
  else if F contains // i18n-keep: ... K ... (whitespace-separated token list)  → reachable
if not reachable → dead
```

Exit 1 with the list of dead keys if any are found.

### Why all three checks

- **Direct call** (`m.K(`) — covers ~95% of usage.
- **String literal** (`'K'` / `"K"`) — covers dynamic dispatch where the key strings are members of a constants array or struct field. Example: `{ labelKey: 'chromeTabsAujourdhui' }` referenced later as `m[tab.labelKey]()`.
- **`// i18n-keep:` directive** — escape hatch for cases where the key is computed (e.g., `m[\`category${type}\`]()`with`type` not a literal). The directive lists the tokens that should be considered reachable at that site. Single source of truth, lives next to the code.

### What's excluded from the scan

- `src/lib/paraglide/`, `src/paraglide/` — paraglide's own generated output references every key.
- `messages/` itself.
- The `$schema` JSON-Schema reference key (treated specially, never flagged).

## Components

### `scripts/check-i18n-unused.mjs` (new)

A Node ESM script that:

1. Reads `messages/fr.json`, extracts keys (skipping `$schema`).
2. Walks `src/` recursively (skipping `paraglide`, `node_modules` directories), reading every `.ts` / `.js` / `.svelte` file.
3. Builds two structures:
   - A single concatenated "haystack" string of all source.
   - A set of tokens parsed from every `// i18n-keep: <tokens>` directive.
4. For each key, considers it reachable if any of the three regexes (call, literal, directive) match.
5. If any keys are unreachable, prints them and exits 1; otherwise prints a count and exits 0.

Pure stdlib, no dependencies. ~50 lines.

### `package.json` `lint:i18n` script

Extended to chain both checks:

```json
"lint:i18n": "node scripts/lint-i18n.mjs && node scripts/check-i18n-unused.mjs"
```

The existing `lint` script already invokes `lint:i18n`, so CI picks it up automatically.

### `messages/fr.json` + `messages/en.json`

Keys identified as truly dead are removed. Sort order and indentation preserved.

### `// i18n-keep:` directives (as needed)

Added at dispatch sites where keys can't be resolved by direct-call or literal-grep. Format:

```ts
// i18n-keep: token1 token2 token3
```

Whitespace-separated tokens after the directive prefix, single line, comment-style. Multiple directives allowed per file.

## Data flow

```
fr.json keys ──┐
               ├──► check-i18n-unused.mjs ──► [reachable | dead]
src/ scan  ────┤                                    │
               │                                    └──► exit 1 + diagnostic if any dead
i18n-keep  ────┘
```

Linear. Single pass over src/. No network or DB.

## Error handling

- Missing `messages/fr.json` → script throws (intentional).
- Malformed JSON → script throws (intentional).
- A `// i18n-keep:` directive listing a key that doesn't exist in fr.json → silently ignored. (Stale directives are noise but not failures; future enhancement could flag them.)
- A key string that appears inside a JS template literal that doesn't actually call paraglide (e.g., a CSS class name happening to match a key like `categoryFruits`) → counted as reachable. False-positive risk is small given key names are distinctively long and camelCase.

## Verification

1. **TDD the detector** — before scanning real keys, add a known-dead test key `_test_dead_key_brownieXYZ`. Run the script — must flag it. Remove the test key.
2. **Baseline scan on current main** — record the actual dead-key count. Compare against the rough 92 estimate.
3. **Iterate on `// i18n-keep:` directives** — work through dynamic-dispatch sites until the candidate list contains only genuinely dead keys.
4. **Delete + re-run** — script exits 0, lint pipeline green.
5. **Smoke** — `npm run dev` and visit signup, child/[id], child/[id]/guide, child/[id]/profil. Any deleted key referenced indirectly would render as a literal key name (paraglide fallback); a smoke run catches it.

## Rollout

- **Commit 1**: detection script + `package.json` wiring + any `// i18n-keep:` directives needed for dynamic dispatch sites. CI gate active but no keys removed.
- **Commit 2**: delete the dead keys from both locale files. CI re-validates green.

If the directive set ends up larger than a handful of files, those changes can land in Commit 2 alongside the deletion — but it's cleaner to set up the infrastructure first.

## Companion bundles

Bundle B of a 4-bundle hardening sweep:

- **Bundle A — UI regression coverage** (shipped on branch `feat/harden/bundle-a-ui-regression-coverage`, PR #189).
- **Bundle B — i18n trim** (this spec).
- **Bundle C — A11y audit** (separate spec).
- **Bundle D — Perf audit** (separate spec).

No cross-bundle dependencies; ships independently.
