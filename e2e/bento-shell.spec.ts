import { test, expect, type Page } from '@playwright/test';

function unique(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

async function signUpAndCreateChild(page: Page, name: string, birthDate: string): Promise<string> {
  const email = `${unique('bento')}@example.com`;
  await page.goto('/signup');
  await page.getByLabel('Votre prénom').fill('Parent');
  await page.getByLabel('Adresse e-mail').fill(email);
  await page.getByLabel('Mot de passe').fill('hunter2-very-long');
  await page.getByLabel(/au moins 15 ans/i).check();
  await page.getByLabel(/conditions générales/i).check();
  await page.getByLabel(/politique de confidentialité/i).check();
  await page.getByRole('button', { name: /créer mon compte/i }).click();
  await expect(page).toHaveURL(/\/child\/new/);

  await page.getByLabel('Prénom').fill(name);
  await page.getByLabel('Date de naissance').fill(birthDate);
  await page.getByRole('button', { name: /^créer$/i }).click();
  await expect(page).toHaveURL(/\/child\/\d+$/);

  // Capture the child ID from the resulting URL
  const url = page.url();
  const match = url.match(/\/child\/(\d+)$/);
  if (!match) throw new Error(`Expected /child/<id> URL, got ${url}`);
  return match[1];
}

// New accounts auto-open a 3-step welcome modal whose backdrop (Dialog.svelte
// renders a `fixed inset-0 z-50` div) intercepts pointer events on the bento
// chrome below. Dismissing it via the "Plus tard" form button posts to the
// reminders endpoint and persists `showWelcomeDialog=false` for the session,
// so subsequent navigations stay clean.
async function dismissWelcomeIfPresent(page: Page): Promise<void> {
  const dismiss = page.getByRole('button', { name: 'Plus tard' });
  if (await dismiss.isVisible().catch(() => false)) {
    await dismiss.click();
    await expect(dismiss).not.toBeVisible();
  }
}

// Force a sub-`lg:` viewport so the mobile chrome (BottomNavBento + FAB) is
// rendered/visible. Playwright's default chromium project uses Desktop Chrome
// (1280×720) which crosses the `lg:` breakpoint and switches to the desktop
// left-rail variant — those elements (`Navigation latérale`, `+ Logger` text)
// are tested separately. This block targets the mobile flow.
test.describe('Bento shell — tab navigation', () => {
  test.use({ viewport: { width: 414, height: 896 } });

  test('switches between the four tabs', async ({ page }) => {
    const sevenMonthsAgo = new Date();
    sevenMonthsAgo.setMonth(sevenMonthsAgo.getMonth() - 7);
    const dateStr = sevenMonthsAgo.toISOString().slice(0, 10);
    const childId = await signUpAndCreateChild(page, 'Lulu', dateStr);

    await page.goto(`/child/${childId}`);
    await dismissWelcomeIfPresent(page);

    // Bento bottom nav rendered.
    await expect(page.getByRole('navigation', { name: 'Navigation principale' })).toBeVisible();

    // Click "Carnet" → /child/<id>/foods
    await page.getByRole('link', { name: 'Carnet' }).click();
    await expect(page).toHaveURL(/\/child\/\d+\/foods/);

    // Click "Découvrir" → /child/<id>/guide
    await page.getByRole('link', { name: 'Découvrir' }).click();
    await expect(page).toHaveURL(/\/child\/\d+\/guide/);

    // Click "Profil" → /account
    await page.getByRole('link', { name: 'Profil' }).click();
    await expect(page).toHaveURL(/\/account/);
  });

  test('FAB opens log sheet, food saves, sheet closes', async ({ page }) => {
    // Sign up + create a child for this test.
    const sevenMonthsAgo = new Date();
    sevenMonthsAgo.setMonth(sevenMonthsAgo.getMonth() - 7);
    const dateStr = sevenMonthsAgo.toISOString().slice(0, 10);
    const childId = await signUpAndCreateChild(page, 'Mia', dateStr);

    await page.goto(`/child/${childId}`);
    await dismissWelcomeIfPresent(page);

    // Open the log sheet via the FAB.
    await page.getByRole('button', { name: 'Enregistrer un aliment' }).click();

    // Sheet placeholder visible.
    const placeholder = '🔍 chercher un aliment…';
    await expect(page.getByPlaceholder(placeholder)).toBeVisible();

    // Search for "poire" — Poire is in the seeded FOODS catalog.
    await page.getByPlaceholder(placeholder).fill('poire');

    // Click the matching list item. The Command primitive renders <li role="option">.
    await page.getByRole('option', { name: /^Poire$/ }).click();

    // Submit. Use exact match so this doesn't collide with the HeroTile
    // CTA ('Enregistrer Avocat') or the FAB ('Enregistrer un aliment').
    await page.getByRole('button', { name: 'Enregistrer', exact: true }).click();

    // Toast confirms save.
    await expect(page.getByText('Enregistré')).toBeVisible();

    // Sheet closed (placeholder no longer visible).
    await expect(page.getByPlaceholder(placeholder)).not.toBeVisible();

    // Recent feed on /child/<id> shows the new entry.
    await expect(page.getByText('Poire').first()).toBeVisible();
  });

  test('Carnet Allergènes segment is reachable via URL', async ({ page }) => {
    const sevenMonthsAgo = new Date();
    sevenMonthsAgo.setMonth(sevenMonthsAgo.getMonth() - 7);
    const dateStr = sevenMonthsAgo.toISOString().slice(0, 10);
    const childId = await signUpAndCreateChild(page, 'Sam', dateStr);

    await page.goto(`/child/${childId}/foods`);
    await dismissWelcomeIfPresent(page);

    // Click the Allergènes segment link.
    await page.getByRole('link', { name: 'Allergènes' }).click();
    await expect(page).toHaveURL(/\/child\/\d+\/foods\?segment=allergens/);
  });
});
