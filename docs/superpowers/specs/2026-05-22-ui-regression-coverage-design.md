# UI regression coverage — design

**Date:** 2026-05-22
**Status:** draft
**Bundle:** A (first of a 4-bundle hardening sweep — see [Companion bundles](#companion-bundles))

## Goal

Catch the class of bug that produced PRs #179 → #180 (allergen sheet behaving wrong at mobile viewport, then needing scroll fix) _before merge_, without adding excessive CI time or test flake.

The bug class: **viewport-dependent UI behavior** — responsive placement (bottom-sheet vs side-sheet), scroll containment, mobile keyboard interference, breakpoint-dependent navigation chrome. Component tests miss these because they don't run in a real viewport.

## Non-goals

- Visual regression / screenshot snapshots. Considered and rejected: brittle (every legit visual change updates snapshots), high maintenance burden. May revisit if responsive assertions prove insufficient.
- Adding WebKit/Safari coverage. Existing config note explains why (signup helper doesn't complete the post-signup redirect on WebKit); keeping Chromium-only.
- Passkey browser-API mocking. Existing tests skip the WebAuthn ceremony; not changing.
- Full app responsive coverage. Only flows recently touched (Discover, allergen sheet, modal primitives, Carnet/Bilan, auth forms).

## Architecture

Two Playwright projects in `playwright.config.ts`:

```ts
projects: [
  {
    name: 'desktop',
    use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } },
    grep: /^(?!.*@mobile-only)/
  },
  {
    name: 'mobile',
    use: { ...devices['iPhone 14'] }, // 390 × 844
    grep: /@responsive|@mobile-only/
  }
];
```

Config changes:

- `workers: 2` (was 1)
- `fullyParallel: false` (unchanged — tests within a project stay serial)

Both projects share the same Postgres instance. Isolation is per-test via the existing `signUp` helper that creates a fresh user per test. To eliminate any cross-project email collision we add `uniqueForWorker(seed)` that mixes `process.env.TEST_WORKER_INDEX` into the email.

**Three test buckets via tags:**

| Bucket                 | Tag            | Desktop project | Mobile project |
| ---------------------- | -------------- | --------------- | -------------- |
| Desktop-only (default) | untagged       | runs            | skipped        |
| Responsive             | `@responsive`  | runs            | runs           |
| Mobile-only            | `@mobile-only` | skipped         | runs           |

The desktop `grep` is a negative lookahead so untagged specs run on desktop; the mobile `grep` is positive so only tagged specs run there. Net: mobile project stays small and focused.

## Components & specs

### Extending existing specs (add `@responsive` + mobile-aware assertions)

| Spec                                | Mobile additions                                                                                                                                                                                                                                                                                                                               |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `e2e/bento-discover.spec.ts`        | Grouped sections (Repères / À essayer / Apprendre) render at both viewports. Tap allergen card → sheet renders with `data-side="bottom"` on mobile and `data-side` ∈ `{top, right, left}` on desktop (the assertion is "not bottom"; the exact desktop side stays a component-level decision). Body scrolls when content overflows (#180 fix). |
| `e2e/bento-reaction-detail.spec.ts` | DetailSheet open/close + body scroll-lock across viewports.                                                                                                                                                                                                                                                                                    |
| `e2e/bento-shell.spec.ts`           | Bottom nav visible on mobile, side/top nav on desktop. Tab switches don't break scroll position.                                                                                                                                                                                                                                               |
| `e2e/bento-profil.spec.ts`          | Carnet/Bilan terminology (no "Stats"/"Streak" regressions). Form + destructive modals close cleanly at both viewports.                                                                                                                                                                                                                         |
| `e2e/auth.spec.ts`                  | Signup + signin forms submit at both viewports (mobile keyboard doesn't obscure submit button).                                                                                                                                                                                                                                                |

### New specs

| Spec                                    | Scope                                                                                                                                                                           |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `e2e/responsive-modals.spec.ts`         | Modal + ConfirmModal + DetailSheet primitives. One test per `side` (top/right/bottom/left/auto) verifying placement + dismiss behavior. `@responsive`.                          |
| `e2e/responsive-allergen-sheet.spec.ts` | Dedicated regression for #179 + #180. Opens allergen sheet, asserts placement matches viewport, scrolls body to bottom, dismisses via outside-click + Esc + drag (mobile only). |

### Helpers (`e2e/_helpers.ts`)

```ts
export function uniqueForWorker(seed: string): string {
  const w = process.env.TEST_WORKER_INDEX ?? '0';
  return `${seed}-w${w}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export async function expectBottomSheet(page: Page) {
  await expect(page.locator('[data-modal-root][data-side="bottom"]')).toBeVisible();
}

export async function expectSideSheet(page: Page) {
  const root = page.locator('[data-modal-root]');
  const side = await root.getAttribute('data-side');
  expect(['top', 'right', 'left']).toContain(side);
}
```

### Production code changes (minimal)

The Modal/DetailSheet root must expose its current `side` as a `data-side` attribute. If the component already passes `side` as a prop, this is a one-line addition to the root element. **This is the only production code change in the bundle.**

## Data flow

- Each test creates its own user via `signUp` (existing helper).
- DB reset runs once before all projects start (existing `scripts/reset-e2e-db.mjs`).
- Two workers run in parallel, one per project. Each worker uses `TEST_WORKER_INDEX` to disambiguate emails.
- No shared fixtures between projects.

## Error handling & flake budget

- Retry once on CI (`retries: process.env.CI ? 1 : 0` — unchanged).
- Any new spec that flakes > 1× in 5 local runs gets dropped before merge (no quarantine pool).
- If mobile project adds > 90s to CI wall-clock, drop the `@responsive` tag from the slowest 1–2 specs.

## Rollout — three commits

**Commit 1 — Infrastructure (no new tests):**

- Add `mobile` project to `playwright.config.ts` with grep filter.
- Bump `workers: 2`.
- Add `uniqueForWorker`, `expectBottomSheet`, `expectSideSheet` to `_helpers.ts`.
- Add `data-side` attribute to Modal/DetailSheet root.
- CI: mobile project runs as no-op pass (no specs tagged yet).

**Commit 2 — Extend existing specs:**

- Add `@responsive` to the 5 specs above.
- Add mobile/desktop assertions per the table.
- Verify CI green at both projects.

**Commit 3 — New regression specs:**

- `responsive-allergen-sheet.spec.ts` (the #179/#180 lock).
- `responsive-modals.spec.ts` (primitive coverage).

Each commit is independently mergeable.

## Verification

The load-bearing check that proves this works:

1. **Replay the broken commit.** `git checkout polish/allergen-dialog-bottomsheet` (PR #179's HEAD before #180 fixed scroll). Run `responsive-allergen-sheet.spec.ts`. **It must fail on the "body scrolls when content overflows" assertion.** If it passes, the assertion is theatre.
2. **Current main.** Full suite green on both projects.
3. **CI time budget.** Mobile project adds ≤90s on top of desktop. If exceeded, prune `@responsive` tags from slowest specs.
4. **Flake check.** Run new suite 5× locally; any non-deterministic failure blocks merge.

## Companion bundles

This bundle is the first of a 4-bundle hardening sweep planned 2026-05-22:

- **Bundle A — UI regression coverage** (this spec).
- **Bundle B — i18n trim**: dead-key sweep after Bundle 5's Carnet/Bilan rename; possibly modularize message files. Separate spec.
- **Bundle C — A11y audit**: axe + Lighthouse on main routes, fix violations. Separate spec.
- **Bundle D — Perf audit**: Lighthouse perf + bundle/image analysis. Separate spec.

Each gets its own spec → plan → implementation cycle. No cross-bundle dependencies; can be implemented in any order, but A is highest leverage given the #179 → #180 fallout.
