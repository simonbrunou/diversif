# UI Regression Coverage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a mobile-viewport Playwright project + responsive assertions so viewport-dependent bugs (the PR #179 → #180 class) are caught before merge.

**Architecture:** Two Playwright projects (`desktop`, `mobile`) sharing one Postgres. Tag-based test selection (`@responsive`, `@mobile-only`) keeps the mobile run small and focused. Modal/DetailSheet root gains a `data-side` attribute so e2e specs can assert resolved placement. Implementation is three independently mergeable commits: infrastructure, extend existing specs, new regression specs.

**Tech Stack:** Playwright + SvelteKit + bits-ui Dialog + Tailwind (md breakpoint = 768px). e2e suite already runs in CI with a Postgres service container.

---

## Spec reference

See `docs/superpowers/specs/2026-05-22-ui-regression-coverage-design.md`.

## File map

**Production (single touch):**

- Modify: `src/lib/components/ui/Modal.svelte` — add `data-side={resolvedSide}` to `DialogPrimitive.Content`.

**Config:**

- Modify: `playwright.config.ts` — add `mobile` project, bump `workers` to 2, add grep filters.

**Helpers:**

- Modify: `e2e/_helpers.ts` — add `uniqueForWorker`, `expectBottomSheet`, `expectNotBottomSheet` (renamed from `expectNotBottomSheet` in commit d3f0b47); rewrite `signUp` to use `uniqueForWorker`.

**Existing specs (tag + cleanup `test.use({ viewport })`):**

- Modify: `e2e/bento-discover.spec.ts`
- Modify: `e2e/bento-reaction-detail.spec.ts`
- Modify: `e2e/bento-shell.spec.ts`
- Modify: `e2e/bento-profil.spec.ts`
- Modify: `e2e/auth.spec.ts`

**New specs:**

- Create: `e2e/responsive-modals.spec.ts`
- Create: `e2e/responsive-allergen-sheet.spec.ts`

---

## Commit 1 — Infrastructure

### Task 1: Add `data-side` attribute to Modal root

**Files:**

- Modify: `src/lib/components/ui/Modal.svelte:120-136`
- Test: `src/lib/components/ui/Modal.test.ts`

- [ ] **Step 1: Add failing test for `data-side`**

Append to `src/lib/components/ui/Modal.test.ts` (look up the existing render helper in the file; below uses the typical Svelte-test pattern in this repo):

```ts
import { render } from '@testing-library/svelte';
import { expect, test } from 'vitest';
import Modal from './Modal.svelte';

test('exposes the resolved side as data-side', async () => {
  const { getByRole } = render(Modal, { props: { open: true, side: 'bottom', title: 't' } });
  const dialog = getByRole('dialog');
  expect(dialog.getAttribute('data-side')).toBe('bottom');
});
```

- [ ] **Step 2: Run test and confirm it fails**

Run: `npm test -- src/lib/components/ui/Modal.test.ts`
Expected: FAIL — `data-side` is `null`.

- [ ] **Step 3: Add the attribute**

In `src/lib/components/ui/Modal.svelte`, on the `<DialogPrimitive.Content>` element (around line 120), add `data-side={resolvedSide}` as a sibling of `class={cn(...)}`. Also add a static `data-dialog-overlay` attribute on the sibling `<DialogPrimitive.Overlay>` element so e2e specs can target the overlay independently (for outside-click dismiss assertions etc.):

```svelte
<DialogPrimitive.Overlay
  data-dialog-overlay
  class={cn(...)}
/>
<DialogPrimitive.Content
  data-side={resolvedSide}
  class={cn(
    'fixed z-50 grid w-full gap-4 border border-border bg-surface p-5 shadow-lifted duration-slow ease-spring data-[state=closed]:animate-out data-[state=open]:animate-in',
    resolvedSide === 'bottom' && 'touch-none',
    sideClasses[resolvedSide],
    className
  )}
  ...
```

- [ ] **Step 4: Verify test passes**

Run: `npm test -- src/lib/components/ui/Modal.test.ts`
Expected: PASS.

- [ ] **Step 5: Full unit test suite stays green**

Run: `npm test`
Expected: all tests pass.

---

### Task 2: Add helpers to `_helpers.ts`

**Files:**

- Modify: `e2e/_helpers.ts`

- [ ] **Step 1: Add `uniqueForWorker`**

In `e2e/_helpers.ts`, add below the existing `unique` function. Always include the worker index (Playwright sets `TEST_WORKER_INDEX` in every worker, including single-worker runs); default to `'0'` only as a belt-and-braces fallback for non-Playwright invocations:

```ts
/**
 * Like `unique()` but mixes in the Playwright worker index so two
 * projects running in parallel (e.g. desktop + mobile) can't collide
 * on the same email seed. Always includes the worker index — Playwright
 * sets TEST_WORKER_INDEX in every worker, including single-worker runs.
 */
export function uniqueForWorker(prefix: string): string {
  const w = process.env.TEST_WORKER_INDEX ?? '0';
  return `${unique(prefix)}-w${w}`;
}
```

- [ ] **Step 2: Switch `signUp` to use it**

In the existing `signUp` function (line ~10), change:

```ts
const email = `${unique(emailPrefix)}@example.com`;
```

to:

```ts
const email = `${uniqueForWorker(emailPrefix)}@example.com`;
```

- [ ] **Step 3: Add the `expectBottomSheet` / `expectNotBottomSheet` helpers**

Append to `e2e/_helpers.ts`. Both helpers locate the dialog via `getByRole('dialog')` (no `data-modal-root` wrapper required) and assert `data-side` directly:

```ts
/**
 * Assert the visible dialog rendered as a bottom-sheet (side="bottom",
 * the resolved side of "auto" on a sub-768px viewport).
 */
export async function expectBottomSheet(page: Page): Promise<void> {
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute('data-side', 'bottom');
}

/**
 * Assert the visible dialog rendered as anything other than a bottom-sheet
 * (top / right / left / center). Use this as the desktop-side counterpart
 * of `expectBottomSheet` — the exact desktop placement is a component-level
 * decision (e.g. side="auto" resolves to "center" on md+).
 *
 * Renamed from `expectNotBottomSheet` in commit d3f0b47 — the negated framing
 * matches how the helper is actually used in specs.
 */
export async function expectNotBottomSheet(page: Page): Promise<void> {
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute('data-side', /^(top|right|left|center)$/);
}
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/components/ui/Modal.svelte src/lib/components/ui/Modal.test.ts e2e/_helpers.ts
git commit -m "feat(ui): expose data-side on Modal root for e2e assertions"
```

---

### Task 3: Add `mobile` Playwright project

**Files:**

- Modify: `playwright.config.ts`

- [ ] **Step 1: Replace the `projects` array**

In `playwright.config.ts`, replace the existing `projects: [...]` block with:

```ts
projects: [
  {
    // Default project — runs every untagged spec at desktop viewport.
    // The negative-lookahead grep excludes specs explicitly tagged
    // @mobile-only (drag gestures, mobile-keyboard interactions).
    name: 'desktop',
    use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } },
    grep: /^(?!.*@mobile-only).*$/s
  },
  {
    // Mobile project — runs only specs tagged @responsive or @mobile-only.
    // iPhone 14 (390 × 844) is below Tailwind's md breakpoint (768px) so
    // side="auto" modals resolve to bottom-sheet behaviour.
    name: 'mobile',
    use: { ...devices['iPhone 14'] },
    grep: /@responsive|@mobile-only/
  }
  // WebKit project intentionally omitted: the signup helper does not
  // complete the post-signup redirect on Safari (pre-existing helper
  // incompatibility). `@media print` is engine-equivalent across modern
  // browsers; the Chromium pass covers the print stylesheet.
];
```

- [ ] **Step 2: Bump workers**

In the same file, change:

```ts
workers: 1,
```

to:

```ts
// Two workers: one per project, so desktop and mobile run in parallel.
// `fullyParallel: false` is kept so tests within a project still run
// serially (the suite assumes one user per test, but several tests share
// the same Postgres database).
workers: 2,
```

- [ ] **Step 3: Verify both projects boot with the existing suite**

Run: `npm run test:e2e -- --list`
Expected: every existing spec listed under `[desktop]`; the `[mobile]` project lists 0 tests (none tagged yet).

- [ ] **Step 4: Run the desktop project end-to-end**

Run: `E2E_DATABASE_URL=postgres://diversif:diversif@localhost:5432/diversif_e2e npm run test:e2e -- --project=desktop`
Expected: every existing spec passes (this is the existing suite unchanged).

If Postgres is not running locally, document this in the commit message and rely on CI to verify.

- [ ] **Step 5: Commit**

```bash
git add playwright.config.ts
git commit -m "test(e2e): add mobile project + parallel workers"
```

---

## Commit 2 — Extend existing specs

### Task 4: `bento-discover.spec.ts` — convert to `@responsive`

**Files:**

- Modify: `e2e/bento-discover.spec.ts`

- [ ] **Step 1: Remove the file-level viewport override**

In `e2e/bento-discover.spec.ts:4`, delete:

```ts
test.use({ viewport: { width: 414, height: 896 } });
```

This let the file run mobile-only inside a single-project config. Now the mobile project handles viewport via `devices['iPhone 14']`; the desktop project gives the same specs a desktop viewport.

- [ ] **Step 2: Tag every test in the file with `@responsive`**

In the same file, change each `test('...', ...)` title to include `@responsive`:

```ts
test('Découvrir bento renders all four sections @responsive', async ({ page }) => { ... });
test('tapping a stage tile opens the StageDetailSheet @responsive', async ({ page }) => { ... });
test('the allergen sheet body actually scrolls on mobile @responsive @mobile-only', async ({ page }) => { ... });
```

The third test is mobile-specific (asserts the bottom-sheet body actually overflows — desktop renders it as a center modal with different sizing). Tag it `@mobile-only` so the desktop project skips it.

- [ ] **Step 3: Add a desktop-side companion assertion**

In the "tapping a stage tile" test, after `await expect(page.getByRole('dialog')).toBeVisible();`, add:

```ts
// On desktop the stage sheet is a center modal; on mobile it's a bottom-sheet.
// The data-side value depends on viewport — assert it's bottom on mobile,
// non-bottom otherwise. (Inferring the project at runtime via test.info()
// keeps the same spec valid in both projects.)
import { test as base } from '@playwright/test';
// (Move this import to the top of the file alongside the existing one)

const project = test.info().project.name;
if (project === 'mobile') {
  await expect(page.getByRole('dialog')).toHaveAttribute('data-side', 'bottom');
} else {
  const side = await page.getByRole('dialog').getAttribute('data-side');
  expect(side).not.toBe('bottom');
}
```

- [ ] **Step 4: Run both projects against this spec**

Run: `E2E_DATABASE_URL=postgres://... npm run test:e2e -- e2e/bento-discover.spec.ts`
Expected: 2 tests pass on desktop project, 3 tests pass on mobile project.

- [ ] **Step 5: Commit (deferred — bundled with Task 8)**

Don't commit yet; bundle with the other spec edits.

---

### Task 5: `bento-reaction-detail.spec.ts` — `@responsive`

**Files:**

- Modify: `e2e/bento-reaction-detail.spec.ts`

- [ ] **Step 1: Read the file to understand its current shape**

Open `e2e/bento-reaction-detail.spec.ts`. Note any existing `test.use({ viewport })` line and remove it.

- [ ] **Step 2: Tag each test `@responsive`**

Append `@responsive` to each test title.

- [ ] **Step 3: Add a DetailSheet `data-side` assertion**

In each test that opens the DetailSheet, after the dialog becomes visible, add:

```ts
const project = test.info().project.name;
if (project === 'mobile') {
  await expect(page.getByRole('dialog')).toHaveAttribute('data-side', 'bottom');
} else {
  await expect(page.getByRole('dialog')).not.toHaveAttribute('data-side', 'bottom');
}
```

- [ ] **Step 4: Run both projects against this spec**

Run: `npm run test:e2e -- e2e/bento-reaction-detail.spec.ts`
Expected: all tests pass on both projects.

---

### Task 6: `bento-shell.spec.ts` — `@responsive`

**Files:**

- Modify: `e2e/bento-shell.spec.ts`

- [ ] **Step 1: Tag every test `@responsive`** (and remove any file-level viewport override).

- [ ] **Step 2: Add nav-chrome assertion**

In whichever test verifies the bento shell loads, add (after the shell becomes visible):

```ts
const project = test.info().project.name;
const bottomNav = page.locator('[data-bento-bottom-nav]'); // matches the bottom nav landmark
const sideNav = page.locator('[data-bento-side-nav]');
if (project === 'mobile') {
  await expect(bottomNav).toBeVisible();
} else {
  await expect(sideNav).toBeVisible();
}
```

If these `data-*` attributes don't exist on the nav landmarks, ADD them to the bento shell component as part of this task. Look for the nav landmarks in `src/routes/(bento)/+layout.svelte` or the bento shell components and add the attribute on the wrapping element. (This is a second tiny prod code change — adding a hook for the e2e assertion.)

- [ ] **Step 3: Run both projects**

Run: `npm run test:e2e -- e2e/bento-shell.spec.ts`
Expected: tests pass on both projects.

---

### Task 7: `bento-profil.spec.ts` + `auth.spec.ts` — `@responsive`

**Files:**

- Modify: `e2e/bento-profil.spec.ts`
- Modify: `e2e/auth.spec.ts`

- [ ] **Step 1: Tag each test `@responsive`**

For both files, remove any `test.use({ viewport })` line and append `@responsive` to test titles.

- [ ] **Step 2: `bento-profil.spec.ts` — verify Carnet/Bilan terminology**

Add an explicit assertion (in whichever test loads the profil view):

```ts
// Bundle 5 canonicalisation: surface should say Carnet / Bilan, never Stats/Streak/Logger.
await expect(page.getByText(/\bStats\b/)).toHaveCount(0);
await expect(page.getByText(/\bStreak\b/)).toHaveCount(0);
await expect(page.getByText(/\bLogger\b/)).toHaveCount(0);
```

- [ ] **Step 3: `auth.spec.ts` — verify submit button is reachable on mobile**

In the signup test, after the form is filled but before submit, add:

```ts
const submitButton = page.getByRole('button', { name: /créer mon compte/i });
await expect(submitButton).toBeInViewport();
```

`toBeInViewport()` fails if the mobile keyboard would obscure the button at default scroll. This catches the "submit pushed below the fold" regression.

- [ ] **Step 4: Run both projects against both files**

Run: `npm run test:e2e -- e2e/bento-profil.spec.ts e2e/auth.spec.ts`
Expected: tests pass on both projects.

---

### Task 8: Commit the existing-spec edits

- [ ] **Step 1: Stage and commit**

```bash
git add e2e/bento-discover.spec.ts e2e/bento-reaction-detail.spec.ts e2e/bento-shell.spec.ts e2e/bento-profil.spec.ts e2e/auth.spec.ts src/routes/  # only if bento-shell needed nav attribute additions
git commit -m "test(e2e): tag responsive specs and add mobile-aware assertions"
```

If `src/routes/...` changed for the nav-attribute hooks, mention it in the commit body.

- [ ] **Step 2: Run the full mobile project as a sanity check**

Run: `npm run test:e2e -- --project=mobile`
Expected: every tagged test passes. Note total wall-clock time (for the CI budget check in Task 11).

---

## Commit 3 — New regression specs

### Task 9: `responsive-modals.spec.ts` — Modal primitive coverage

**Files:**

- Create: `e2e/responsive-modals.spec.ts`

- [ ] **Step 1: Write the spec**

Create `e2e/responsive-modals.spec.ts`:

```ts
import { test, expect } from '@playwright/test';
import {
  signUpAndCreateChild,
  dismissWelcomeIfPresent,
  expectBottomSheet,
  expectNotBottomSheet
} from './_helpers';

/**
 * Locks the Modal primitive's resolved-side behaviour against the two
 * project viewports. Uses the bento-profil settings view as a stable
 * carrier — it opens a Modal with side="auto" via the "Modifier le profil"
 * action, which is the most common Modal usage in the app.
 */
test('Modal side=auto resolves correctly across viewports @responsive', async ({ page }) => {
  const childId = await signUpAndCreateChild(page, 'Lou', '2025-08-01');
  await dismissWelcomeIfPresent(page);

  await page.goto(`/child/${childId}/profil`);

  // Open the edit-child modal. Adjust the button name if the real one differs;
  // verify against the running app and update before merging.
  await page.getByRole('button', { name: /modifier le profil/i }).click();
  await expect(page.getByRole('dialog')).toBeVisible();

  const project = test.info().project.name;
  if (project === 'mobile') {
    await expectBottomSheet(page);
  } else {
    await expectNotBottomSheet(page);
  }
});

test('Esc dismisses the modal on every viewport @responsive', async ({ page }) => {
  const childId = await signUpAndCreateChild(page, 'Lou', '2025-08-01');
  await dismissWelcomeIfPresent(page);

  await page.goto(`/child/${childId}/profil`);
  await page.getByRole('button', { name: /modifier le profil/i }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
});

test('outside-click dismisses the modal on every viewport @responsive', async ({ page }) => {
  const childId = await signUpAndCreateChild(page, 'Lou', '2025-08-01');
  await dismissWelcomeIfPresent(page);

  await page.goto(`/child/${childId}/profil`);
  await page.getByRole('button', { name: /modifier le profil/i }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  // The bits-ui overlay covers the rest of the screen; clicking it dismisses.
  await page
    .locator('[data-state="open"]')
    .first()
    .click({ position: { x: 5, y: 5 }, force: true });
  await expect(page.getByRole('dialog')).not.toBeVisible();
});
```

- [ ] **Step 2: Verify the carrier button name**

Before running, search for the "Modifier le profil" button or the actual edit-action label:

```bash
grep -r 'Modifier le profil\|profilEdit\|editProfile' src/lib/paraglide/messages | head
```

Adjust the `getByRole('button', { name: ... })` selector to match what the running app actually renders.

- [ ] **Step 3: Run on both projects**

Run: `npm run test:e2e -- e2e/responsive-modals.spec.ts`
Expected: all three tests pass on both projects.

---

### Task 10: `responsive-allergen-sheet.spec.ts` — the #179/#180 lock

**Files:**

- Create: `e2e/responsive-allergen-sheet.spec.ts`

- [ ] **Step 1: Write the spec**

Create `e2e/responsive-allergen-sheet.spec.ts`:

```ts
import { test, expect } from '@playwright/test';
import { signUpAndCreateChild, dismissWelcomeIfPresent, expectBottomSheet } from './_helpers';

test.describe('@responsive allergen sheet', () => {
  test('opens as a bottom-sheet on mobile, side/center on desktop', async ({ page }) => {
    const childId = await signUpAndCreateChild(page, 'Léo', '2025-10-01');
    await dismissWelcomeIfPresent(page);

    await page.goto(`/child/${childId}/guide`);
    await page.getByRole('button', { name: /Œuf/i }).first().click();
    await expect(page.getByRole('dialog')).toBeVisible();

    const project = test.info().project.name;
    if (project === 'mobile') {
      await expectBottomSheet(page);
    } else {
      await expect(page.getByRole('dialog')).not.toHaveAttribute('data-side', 'bottom');
    }
  });

  test('body scrolls when content overflows (regression for #180)', async ({ page }) => {
    const childId = await signUpAndCreateChild(page, 'Léo', '2025-10-01');
    await dismissWelcomeIfPresent(page);

    await page.goto(`/child/${childId}/guide`);
    await page.getByRole('button', { name: /Œuf/i }).first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // The fix lives inside Modal.svelte's `scrollableBody` branch
    // (max-h-[70vh] overflow-y-auto wrapper). If that wrapper is removed,
    // scrollHeight and clientHeight collapse and this assertion fails.
    const overflow = await dialog.evaluate((el) => {
      const scroller = el.querySelector('.max-h-\\[70vh\\].overflow-y-auto');
      if (!scroller) return { found: false, scrollable: false };
      return { found: true, scrollable: scroller.scrollHeight > scroller.clientHeight };
    });
    expect(overflow.found).toBe(true);
    expect(overflow.scrollable).toBe(true);
  });

  test('@mobile-only — drag-to-dismiss closes the bottom-sheet', async ({ page }) => {
    const childId = await signUpAndCreateChild(page, 'Léo', '2025-10-01');
    await dismissWelcomeIfPresent(page);

    await page.goto(`/child/${childId}/guide`);
    await page.getByRole('button', { name: /Œuf/i }).first().click();
    const grabber = page.locator('[data-sheet-grabber]');
    await expect(grabber).toBeVisible();

    const box = await grabber.boundingBox();
    if (!box) throw new Error('grabber has no bounding box');
    const startX = box.x + box.width / 2;
    const startY = box.y + box.height / 2;
    // Drag 300px down — well past the dismiss threshold.
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX, startY + 300, { steps: 10 });
    await page.mouse.up();

    await expect(page.getByRole('dialog')).not.toBeVisible();
  });

  test('Esc dismisses the sheet on every viewport @responsive', async ({ page }) => {
    const childId = await signUpAndCreateChild(page, 'Léo', '2025-10-01');
    await dismissWelcomeIfPresent(page);

    await page.goto(`/child/${childId}/guide`);
    await page.getByRole('button', { name: /Œuf/i }).first().click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).not.toBeVisible();
  });
});
```

Note: the `test.describe('@responsive ...')` description prefix is what the project grep matches against. Tests inside inherit the tag for filtering purposes; the `@mobile-only` test gets both tags so the desktop project skips it.

- [ ] **Step 2: Migrate the existing scroll regression**

The existing test `the allergen sheet body actually scrolls on mobile` in `bento-discover.spec.ts` is now redundant with the test above. **Delete it** from `bento-discover.spec.ts` to avoid duplicate coverage.

- [ ] **Step 3: Run on both projects**

Run: `npm run test:e2e -- e2e/responsive-allergen-sheet.spec.ts`
Expected: 4 tests pass on mobile (all of them), 2 tests pass on desktop (the two non-mobile-only ones).

- [ ] **Step 4: Commit**

```bash
git add e2e/responsive-modals.spec.ts e2e/responsive-allergen-sheet.spec.ts e2e/bento-discover.spec.ts
git commit -m "test(e2e): new responsive regression specs for Modal + allergen sheet"
```

---

## Task 11: Verification — the load-bearing check

This is the step that proves the suite actually catches the bug class it's designed for. **Do not skip.**

- [ ] **Step 1: Locate the broken commit**

```bash
git log --oneline polish/allergen-dialog-bottomsheet 2>/dev/null || git log --all --oneline --grep='allergen.*bottom' | head
```

Identify the commit SHA of PR #179's HEAD before PR #180 fixed scroll.

- [ ] **Step 2: Set up a replay worktree at the broken commit**

```bash
git worktree add ../diversif-bug-replay <broken-sha>
```

- [ ] **Step 3: Copy the new regression spec into the broken tree**

The spec needs to test against the _broken_ component code but with the _new_ test logic, so we copy the file across, not switch the branch:

```bash
cp e2e/responsive-allergen-sheet.spec.ts ../diversif-bug-replay/e2e/
cp e2e/_helpers.ts ../diversif-bug-replay/e2e/  # needs uniqueForWorker + expectBottomSheet
cp playwright.config.ts ../diversif-bug-replay/  # needs the mobile project
```

Note: the broken tree won't have the `data-side` attribute on Modal, so the assertion `expectBottomSheet` (which reads `data-side`) will fail for a different reason than the scroll bug. Patch in the attribute first:

```bash
# In the broken worktree, manually add data-side={resolvedSide} to Modal.svelte
# (see Task 1, Step 3 — same edit) so the spec can reach the scroll assertion.
$EDITOR ../diversif-bug-replay/src/lib/components/ui/Modal.svelte
```

- [ ] **Step 4: Run the regression spec against the broken tree**

```bash
cd ../diversif-bug-replay
npm ci
E2E_DATABASE_URL=postgres://diversif:diversif@localhost:5432/diversif_e2e_replay npm run test:e2e -- --project=mobile e2e/responsive-allergen-sheet.spec.ts
```

(Use a separate DB so it doesn't fight with the main worktree.)

Expected: the **"body scrolls when content overflows (regression for #180)"** test FAILS — because the broken commit's `AllergenInfoDialog` doesn't pass `scrollableBody` to Modal, so the inner `max-h-[70vh].overflow-y-auto` wrapper isn't present and `querySelector` returns null. If the test _passes_ against the broken commit, the assertion is wrong — go back to Task 10 and fix it before merging.

- [ ] **Step 5: Clean up the worktree**

```bash
cd /home/sbrn/Projects/diversif
git worktree remove ../diversif-bug-replay
```

- [ ] **Step 6: Run current main**

```bash
npm run test:e2e
```

Expected: both projects green.

- [ ] **Step 7: Time budget check**

Read the mobile project wall-clock from the previous run. If mobile added > 90s on top of desktop, drop `@responsive` from the slowest 1–2 specs (likely the largest fixture-heavy ones — `bento-shell.spec.ts` is a candidate). Re-run to confirm budget. Document the time delta in the final PR description.

- [ ] **Step 8: Flake check**

```bash
for i in 1 2 3 4 5; do echo "=== run $i ==="; npm run test:e2e -- --project=mobile; done
```

Expected: 5/5 green. Any single flake on the new specs blocks merge — investigate the root cause and fix or delete the offending test.

---

## Task 12: Final review + ship

- [ ] **Step 1: Re-read the spec**

`docs/superpowers/specs/2026-05-22-ui-regression-coverage-design.md`. Confirm every section is covered by a task above.

- [ ] **Step 2: Open the PR**

Use `/commit-commands:commit-push-pr` or:

```bash
gh pr create --title "test(e2e): mobile-viewport regression coverage (Bundle A)" --body "$(cat <<'EOF'
## Summary
- Add mobile Playwright project (iPhone 14) alongside existing Chrome project.
- Tag responsive specs `@responsive` so both projects run them; `@mobile-only` for gestures.
- Expose `data-side` on Modal root + new helpers for viewport-aware assertions.
- New regression specs for Modal primitives + allergen sheet (locks PRs #179/#180).

## Test plan
- [ ] desktop project green
- [ ] mobile project green
- [ ] regression test FAILS on the PR #179 HEAD commit (verifies the suite catches the bug)
- [ ] CI wall-clock delta < 90s

## Spec
docs/superpowers/specs/2026-05-22-ui-regression-coverage-design.md

🤖 Generated with Claude Code
EOF
)"
```

- [ ] **Step 3: Watch CI**

After push, run `gh pr checks --watch`. Address any flake or unexpected failure before requesting review.
