import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { dismissWelcomeIfPresent, signUpAndCreateChild } from './_helpers';

/**
 * a11y axe sweep — runs WCAG 2.1 AA + best-practice rules against every
 * public and auth-required route. Tagged @responsive so both the desktop
 * and mobile Playwright projects pick it up. The auth routes run as three
 * tests, one per route group (account pages, a child with no entries, a
 * child with entries); each signs up its own parent and sweeps its routes
 * one test.step per axe pass.
 *
 * The static-route sweep is a page.goto() + axe pass only, so it never
 * scans an open drawer/sheet or a FoodCombobox mid-interaction — those
 * DOM states are exercised by dedicated test.step blocks (the "Se
 * déconnecter partout" confirm dialog in the account test; ChildSwitcherDrawer,
 * FoodCombobox search + selection, TexturePicker tile selection and
 * AddSymptomSheet in the populated-child test), plus a standalone
 * AllergenInfoDialog test for the public /allergens route.
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

/**
 * axeSweep() after a click that starts a transition (a dialog opening, a
 * tile taking its selected ring). axe-core reads computed styles
 * synchronously, and without the 500ms wait it can sample colors mid
 * fade-in/zoom-in (Modal's `animate-in`), reporting a fabricated
 * low-contrast violation for a still-transitioning element. Same class of
 * flake already documented in dismissWelcomeIfPresent (_helpers.ts) — wait
 * for the entrance transition to settle before asserting, don't scan
 * mid-animation.
 */
async function axeSweepAfterTransition(page: Page): Promise<void> {
  await page.waitForTimeout(500);
  await axeSweep(page);
}

/** axeSweepAfterTransition() once the dialog a click just opened is visible. */
async function axeSweepOpenDialog(page: Page): Promise<void> {
  await expect(page.getByRole('dialog')).toBeVisible();
  await axeSweepAfterTransition(page);
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

// The public-route sweep above only does page.goto() + axe on /allergens,
// so it never opens AllergenInfoDialog. Click an allergen tile to put the
// dialog into its actual open/populated DOM state before scanning.
test('a11y axe: AllergenInfoDialog open @responsive', async ({ page }) => {
  await page.goto('/allergens');
  await page.getByRole('button', { name: /Arachide/ }).click();
  await axeSweepOpenDialog(page);
});

// The signed-in surface was one test with test.slow() (90 s) until #477
// split it by route group, so that each group has its own budget and a
// timeout or a violation names the group. The single test ran out of its
// budget in CI runs 187, 192, 193, 194, 196, 244, 247 and 249. On the
// desktop project it took 45.4 s in run 251 and 1.2 min in run 253, with no
// other E2E job running, against 13.7 s locally.
//
// Each group keeps test.slow(). Locally the three tests below took 3.7 to
// 4.8 s, 6.1 to 7.5 s and 6.3 to 16.8 s. Runs 251 and 253 ran the single
// test 3.3 and 5.3 times slower than its 13.7 s locally.
test.describe('a11y axe — auth routes @responsive', () => {
  // The account test needs the child too: /account lists the parent's
  // children, and the single test swept it with one child.
  async function signUpForSweep(page: Page): Promise<string> {
    const childId = await signUpAndCreateChild(page, 'A11y', '2025-08-01');
    // Each test signs up a new parent, and each new account opens the
    // welcome modal: left open, it lands in the first axe pass.
    await dismissWelcomeIfPresent(page);
    return childId;
  }

  // Logs `query`'s first result matching `result` with « Réaction marquée »,
  // then waits for the redirect back to the dashboard.
  async function logWithReaction(
    page: Page,
    childId: string,
    query: string,
    result: RegExp
  ): Promise<void> {
    await page.goto(`/child/${childId}/log`);
    await page.getByPlaceholder('Rechercher un aliment…').fill(query);
    await page.getByRole('button', { name: result }).first().click();
    await page.locator('fieldset').getByText('Réaction marquée', { exact: true }).click();
    await page.getByRole('button', { name: 'Enregistrer', exact: true }).click();
    await expect(page).toHaveURL(/\/child\/\d+(\?.*)?$/);
  }

  async function sweepRoutes(page: Page, routes: string[]): Promise<void> {
    for (const r of routes) {
      await test.step(`axe ${r}`, async () => {
        await page.goto(r);
        await axeSweep(page);
      });
    }
  }

  test('walks the account pages', async ({ page }) => {
    test.slow();
    await signUpForSweep(page);

    await sweepRoutes(page, [
      '/account',
      '/account/profile',
      '/account/sessions',
      '/account/theme',
      '/account/delete'
    ]);

    await test.step('axe: "Se déconnecter partout" confirm dialog open', async () => {
      await page.goto('/account/sessions');
      await page.getByRole('button', { name: 'Se déconnecter partout' }).click();
      await axeSweepOpenDialog(page);
      await page.keyboard.press('Escape');
    });
  });

  test('walks a child with no entries', async ({ page }) => {
    test.slow();
    const childId = await signUpForSweep(page);

    await sweepRoutes(page, [
      '/child/new',
      `/child/${childId}`,
      `/child/${childId}/foods`,
      `/child/${childId}/foods?segment=allergens`,
      `/child/${childId}/foods?segment=categories`,
      `/child/${childId}/foods?segment=bilan`,
      `/child/${childId}/guide`,
      `/child/${childId}/log`,
      `/child/${childId}/report`
    ]);
  });

  test('walks a child with entries and its dialogs', async ({ page }) => {
    test.slow();
    const childId = await signUpForSweep(page);

    // The test above only ever visits a zero-entry dashboard, so it
    // structurally cannot see the one real violation that shows up once a
    // child has data: with no entries, AllergensSnapshot renders a plain
    // paragraph instead of its overflow-x-auto pill scroller, and that
    // scroller is where axe reports scrollable-region-focusable. Log an
    // allergen food with a non-RAS reaction so both the allergen pill strip
    // and the reaction pill render, then sweep the populated dashboard too
    // — the empty sweep above stays, since the empty state is real and
    // must stay covered.
    await test.step('axe: populated /child/<id> (allergen entry + reaction)', async () => {
      // "Œuf entier", not "Œuf": the category filter row contains a button
      // labelled "Œufs", which /^Œuf/ also matches — and it sorts before the
      // results, so .first() clicked the filter chip, left the combobox
      // unselected, and the submit bounced with "Choisissez un aliment".
      await logWithReaction(page, childId, 'Œuf entier', /^Œuf entier/);

      await page.goto(`/child/${childId}`);
      await axeSweep(page);
    });

    // The route sweeps only ever do page.goto() + axe — they never open a
    // drawer/sheet or type into FoodCombobox, so none of those DOM states
    // get scanned. Exercise each explicitly, with the entries above in place.
    await test.step('axe: ChildSwitcherDrawer open', async () => {
      await page.goto(`/child/${childId}`);
      await page.getByRole('button', { name: /changer/i }).click();
      await axeSweepOpenDialog(page);
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

    await test.step('axe: TexturePicker tile selected', async () => {
      // Put the picker into an actual selected state — clicking a
      // non-default tile — instead of relying on the age-derived default,
      // so the checked/ring-highlighted DOM state is what gets scanned.
      await page.locator('fieldset').getByText('Écrasée', { exact: true }).click();
      await expect(page.getByRole('radio', { name: 'Écrasée' })).toBeChecked();
      await axeSweepAfterTransition(page);
    });

    await test.step('axe: AddSymptomSheet open', async () => {
      // AddSymptomSheet only renders reachably for a non-RAS entry (the
      // "Ajouter un symptôme" trigger lives on ReactionDetailBento) — log
      // a real reaction, then navigate to its detail page and open the sheet.
      await logWithReaction(page, childId, 'poire', /^Poire/);

      await page.goto(`/child/${childId}/foods`);
      await page.getByRole('link', { name: /Poire/i }).first().click();
      await expect(page).toHaveURL(/\/child\/\d+\/foods\/\d+$/);

      await page.getByRole('button', { name: 'Ajouter un symptôme' }).click();
      await axeSweepOpenDialog(page);
    });
  });
});
