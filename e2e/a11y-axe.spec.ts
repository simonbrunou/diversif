import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { dismissWelcomeIfPresent, signUpAndCreateChild } from './_helpers';

/**
 * a11y axe sweep — runs WCAG 2.1 AA + best-practice rules against every
 * public and auth-required route. Tagged @responsive so both the desktop
 * and mobile Playwright projects pick it up; auth routes share one signup
 * per worker via test.step for speed.
 *
 * The static-route sweep is a page.goto() + axe pass only, so it never
 * scans an open drawer/sheet or a FoodCombobox mid-interaction — those
 * DOM states are exercised by dedicated test.step blocks at the end of
 * the auth-routes test (ChildSwitcherDrawer, a confirm dialog, FoodCombobox
 * search + selection).
 *
 * Hard gate: any violation fails the test. The companion Lighthouse layer
 * (a11y/best-practices/SEO scores) was deferred — see the spec doc's
 * "Status" section for the playwright-lighthouse NO_FCP backstory.
 */

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'];

type AxeViolation = {
  id: string;
  impact: string | null | undefined;
  description: string;
  nodes: { target: string[]; failureSummary?: string }[];
};

function formatViolations(violations: AxeViolation[]): string {
  if (violations.length === 0) return 'no violations';
  return violations
    .map((v) => {
      const nodes = v.nodes
        .slice(0, 3)
        .map((n) => `      ${n.target.join(' ')}\n      ${n.failureSummary ?? ''}`)
        .join('\n');
      const more = v.nodes.length > 3 ? `\n      (+${v.nodes.length - 3} more nodes)` : '';
      return `  [${v.impact ?? 'minor'}] ${v.id} — ${v.description}\n${nodes}${more}`;
    })
    .join('\n');
}

async function axeSweep(page: Page): Promise<void> {
  const result = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  expect(result.violations, formatViolations(result.violations as AxeViolation[])).toEqual([]);
}

const PUBLIC_ROUTES = [
  '/',
  '/signup',
  '/login',
  '/cgu',
  '/mentions-legales',
  '/politique-confidentialite',
  '/cookies',
  '/guide',
  '/en/guide',
  '/allergens',
  '/sources',
  '/aide',
  '/offline'
];

for (const route of PUBLIC_ROUTES) {
  test(`a11y axe: ${route} @responsive`, async ({ page }) => {
    await page.goto(route);
    await axeSweep(page);
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
        await axeSweep(page);
      });
    }

    // The static-route sweep above only ever does page.goto() + axe — it
    // never opens a drawer/sheet or types into FoodCombobox, so none of
    // those DOM states get scanned. Exercise each explicitly.
    //
    // Every axeSweep() below that follows a dialog-open click waits 500ms
    // first: axe-core reads computed styles synchronously, and without the
    // wait it can sample colors mid fade-in/zoom-in (Modal's `animate-in`),
    // reporting a fabricated low-contrast violation for a still-transitioning
    // element. Same class of flake already documented in dismissWelcomeIfPresent
    // above (_helpers.ts) — wait for the entrance transition to settle before
    // asserting, don't scan mid-animation.
    await test.step('axe: ChildSwitcherDrawer open', async () => {
      await page.goto(`/child/${childId}`);
      await page.getByRole('button', { name: /changer/i }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await page.waitForTimeout(500);
      await axeSweep(page);
      await page.keyboard.press('Escape');
    });

    await test.step('axe: "Se déconnecter partout" confirm dialog open', async () => {
      await page.goto('/account/sessions');
      await page.getByRole('button', { name: 'Se déconnecter partout' }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await page.waitForTimeout(500);
      await axeSweep(page);
      await page.keyboard.press('Escape');
    });

    await test.step('axe: FoodCombobox search + selection', async () => {
      await page.goto(`/child/${childId}/log`);
      const search = page.getByPlaceholder('Rechercher un aliment…');
      await search.fill('poire');
      // The result-count live region (the companion a11y fix) should
      // announce a match count, not just silently re-render the list.
      // Scoped to `p[aria-live]` — svelte-sonner's toast region is also
      // aria-live="polite" and would otherwise make this locator ambiguous.
      await expect(page.locator('p[aria-live="polite"]')).toContainText(/trouv/i);
      await page
        .getByRole('button', { name: /^Poire/ })
        .first()
        .click();
      await axeSweep(page);
    });
  });
});
