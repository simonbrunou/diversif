# A11y audit — design

**Date:** 2026-05-22
**Status:** draft
**Bundle:** C (third of a 4-bundle hardening sweep — see [Companion bundles](#companion-bundles))

## Goal

Sweep every public + auth-required route with axe (WCAG 2.1 AA + best-practice) and Lighthouse (a11y + best-practices + SEO scores), fix every violation surfaced, then lock the gates in CI so future regressions are caught at PR time.

The Discover tab (`/child/[id]/guide`) is the highest-priority surface — the grouped layout from #178 and several new sections (recipes, seasonal foods, did-you-know, allergen sheet) have not had an a11y pass since they shipped.

## Non-goals

- Perf budget (Lighthouse perf is collected here but **not gated**; Bundle D hardens perf).
- Manual screen-reader passes. axe + Lighthouse miss some semantic issues only humans catch — out of scope for this bundle; we may queue follow-up issues if obvious gaps appear.
- Adding new features or restructuring components beyond what's needed to fix violations.

## Architecture

**Two-layer gate**, same target routes:

- **axe** via `@axe-core/playwright` in a new `e2e/a11y-axe.spec.ts`. WCAG 2.1 AA + best-practice rules. Fails CI on any violation.
- **Lighthouse** via `playwright-lighthouse` in `e2e/a11y-lighthouse.spec.ts`. Hard gate on accessibility ≥ 95, best-practices ≥ 95, SEO ≥ 95; perf collected but not gated.

Both run in the existing desktop + mobile Playwright projects (so we get a11y at both viewports for free). Auth routes use the existing `signUpAndCreateChild` helper — no separate cookie-injection trick needed since Lighthouse runs inside the Playwright browser context.

The two tools have ~30 % overlap on a11y rules but catch different things: axe is the rule-by-rule WCAG gate; Lighthouse catches console errors, deprecated APIs, broken images, SEO meta-tag misses.

## Components

### Route coverage

**Public (no auth) — 9 routes:**

- `/` (landing)
- `/signup`, `/login`
- `/cgu`, `/mentions-legales`, `/politique-confidentialite`, `/cookies` (legal)
- `/sources` (bibliography)
- `/offline` (PWA fallback)

**Auth-required — 14 routes:**

- `/account` (Profil bento)
- `/account/profile`, `/account/sessions`, `/account/theme`, `/account/delete`
- `/child/new`
- `/child/[id]` (Aujourd'hui)
- `/child/[id]/foods` (Carnet — default + `?segment=allergens`, `?segment=categories`, `?segment=bilan`)
- `/child/[id]/guide` (Découvrir — **highest priority**)
- `/child/[id]/log` (Log entry form)
- `/child/[id]/report` (Bilan pédiatre)

Reaction detail (`/child/[id]/log/[entryId]`) is intentionally out of scope here — reaching it requires creating a log entry first, which is more flow than a static audit warrants. Bundle A's `bento-reaction-detail.spec.ts` already exercises the page rendering; an a11y follow-up can be queued if its surface diverges.

Total: 23 routes × 2 viewports × 2 tools = 92 individual gate checks per push.

### `e2e/a11y-axe.spec.ts` (new)

Walks every route, runs `AxeBuilder.withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa','best-practice']).analyze()`, asserts `violations` is empty.

Shape:

```ts
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { dismissWelcomeIfPresent, signUpAndCreateChild } from './_helpers';

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'];

async function expectClean(page) {
  const result = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  expect(result.violations, formatAxeViolations(result.violations)).toEqual([]);
}

const PUBLIC_ROUTES = [
  '/',
  '/signup',
  '/login',
  '/cgu',
  '/mentions-legales',
  '/politique-confidentialite',
  '/cookies',
  '/sources',
  '/offline'
];

for (const route of PUBLIC_ROUTES) {
  test(`a11y axe: ${route} @responsive`, async ({ page }) => {
    await page.goto(route);
    await expectClean(page);
  });
}

test.describe('a11y axe — auth routes @responsive', () => {
  test('walks the signed-in surface', async ({ page }) => {
    const childId = await signUpAndCreateChild(page, 'A11y', '2025-08-01');
    await dismissWelcomeIfPresent(page);
    const routes = [
      '/account',
      '/account/profile',
      '/account/sessions',
      '/account/theme',
      '/account/delete',
      '/child/new',
      `/child/${childId}`,
      `/child/${childId}/foods`,
      `/child/${childId}/foods?segment=allergens`,
      `/child/${childId}/foods?segment=categories`,
      `/child/${childId}/foods?segment=bilan`,
      `/child/${childId}/guide`,
      `/child/${childId}/log`,
      `/child/${childId}/report`
    ];
    for (const r of routes) {
      await test.step(`axe ${r}`, async () => {
        await page.goto(r);
        await expectClean(page);
      });
    }
  });
});
```

Using `test.step` for auth routes lets them share one signup (faster) while still reporting per-route failures.

### `e2e/a11y-lighthouse.spec.ts` (new)

Parallel shape to the axe spec — same route list, but runs `playAudit({ page, thresholds: { accessibility: 95, 'best-practices': 95, seo: 95, performance: 0 } })`.

Lighthouse requires Chromium to launch with `--remote-debugging-port=9222`. The Playwright config gains a launch option for the a11y suite (passed via a project-level `launchOptions.args`).

Reports go to `lighthouse-reports/` (gitignored), uploaded as a CI artifact on failure.

### Production code changes — unknown until the audit runs

We don't know the violation set. Expected categories based on prior experience:

- **Color contrast** — chips, badges, segmented controls (e.g. `text-foreground/70` on `bg-surface-2` may fail 4.5:1)
- **Missing accessible names** — icon-only buttons (FAB, close buttons, switches)
- **Heading order** — `<h2>` followed by `<h2>` without semantic structure (especially in DiscoverBento groups)
- **Form-label associations** — implicit labels vs `<label for=>`, ARIA-described errors
- **Focus indicators** — `outline-none` without a replacement focus ring
- **Landmark roles** — `<main>` / `<nav>` / `<aside>` coverage

### Dependencies

```json
"@axe-core/playwright": "^4.x"
"playwright-lighthouse": "^4.x"
```

(Versions confirmed at install time.)

### Lighthouse config (`lighthouserc.cjs`, optional)

We're running Lighthouse INSIDE Playwright via `playwright-lighthouse`, so the dedicated `@lhci/cli` config isn't strictly required. We may still add `lighthouserc.cjs` to support `npm run lhci` for ad-hoc local runs against a single URL — useful when debugging a specific page outside the e2e suite. Optional, not blocking.

## Data flow

```
Playwright e2e ─► [a11y-axe.spec.ts]  ─► axe-core engine in page  ─► violations[] ─► assert empty
              ─► [a11y-lighthouse.spec.ts] ─► Lighthouse in same browser ─► category scores ─► assert ≥ 95
```

No new infrastructure beyond the existing Playwright + Postgres setup.

## Error handling

- **axe violations** — fail the test with a formatted multi-line message showing rule id + impact + nodes. Engineer reads the message + opens the page to fix.
- **Lighthouse score below threshold** — fail with the category + score + report path. HTML report is uploaded as a CI artifact for inspection.
- **Lighthouse infrastructure failure** (port collision, browser crash) — test fails with a clear message and points to the CI artifact.

## Rollout — two phases

**Phase 1 — Infrastructure with soft gates:**

1. Add `@axe-core/playwright` + `playwright-lighthouse` deps.
2. Scaffold `a11y-axe.spec.ts` + `a11y-lighthouse.spec.ts` with soft assertions (`expect.soft`) so the first PR doesn't fail itself.
3. Run locally, capture the baseline reports.
4. Commit: `chore(a11y): scaffold axe + lighthouse e2e specs (soft gates)`.

**Phase 2 — Fix violations, flip to hard gate:**

For each category of violation, ship a fix commit:

- `fix(a11y): color contrast on chips / segments`
- `fix(a11y): aria-labels on icon-only buttons`
- `fix(a11y): heading order in Discover groups`
- `fix(a11y): form-label associations`
- `fix(a11y): focus indicators after Bundle 1 ring removal`

Last commit flips both specs from `expect.soft` to `expect.toEqual([])` / hard threshold checks.

If the violation set ends up small, Phase 2 may be one commit; if large, multiple. Single PR (the bundle) but commits clustered by category.

## Verification

1. **Phase 1 baseline run** — record total violation counts per category. Document in PR description.
2. **Replay against a deliberately-broken state** — remove an `aria-label` from one button, confirm axe flags it. (Sanity check that the gate fires.)
3. **Phase 2 green run** — `npm run test:e2e -- a11y` exits 0, lighthouse-reports/ shows all categories ≥ 95.
4. **CI time budget** — axe + lighthouse add ~6-8 minutes to e2e wall-clock. If the suite exceeds 12 min total, drop Lighthouse from the lowest-priority routes (legal pages).
5. **Flake check** — run new specs 5× locally; any non-deterministic failure blocks merge.

## Companion bundles

Bundle C of a 4-bundle hardening sweep:

- **Bundle A — UI regression coverage** (shipped 2026-05-22, PR #189).
- **Bundle B — i18n dead-key trim** (shipped 2026-05-22, PR #190).
- **Bundle C — A11y audit** (this spec).
- **Bundle D — Perf audit** (separate spec) — will harden the Lighthouse perf score this bundle leaves soft.

No cross-bundle dependencies; ships independently.
