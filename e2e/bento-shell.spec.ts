import { test, expect, type Page } from '@playwright/test';

const BASE_URL = `http://localhost:${process.env.PORT ?? '4173'}`;

function unique(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

async function signUpAndCreateChild(page: Page, name: string, birthDate: string): Promise<string> {
  const email = `${unique('bento')}@example.com`;
  await page.goto('/signup');
  await page.getByLabel('Votre prénom').fill('Parent');
  await page.getByLabel('Email').fill(email);
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

test.describe('Bento shell — tab navigation', () => {
  test('switches between the four tabs with bento=1 cookie', async ({ page, context }) => {
    // Sign up + create a child first (no bento cookie yet — the chrome will be the legacy layout).
    const sevenMonthsAgo = new Date();
    sevenMonthsAgo.setMonth(sevenMonthsAgo.getMonth() - 7);
    const dateStr = sevenMonthsAgo.toISOString().slice(0, 10);
    const childId = await signUpAndCreateChild(page, 'Lulu', dateStr);

    // Now opt into the bento shell via cookie override.
    await context.addCookies([{ name: 'bento', value: '1', url: BASE_URL }]);

    // Reload to make the new shell render (the layout reads the cookie at SSR time).
    await page.goto(`/child/${childId}`);

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

  test('FAB opens log sheet, food saves, sheet closes', async ({ page, context }) => {
    // Sign up + create a child for this test.
    const sevenMonthsAgo = new Date();
    sevenMonthsAgo.setMonth(sevenMonthsAgo.getMonth() - 7);
    const dateStr = sevenMonthsAgo.toISOString().slice(0, 10);
    const childId = await signUpAndCreateChild(page, 'Mia', dateStr);

    await context.addCookies([{ name: 'bento', value: '1', url: BASE_URL }]);
    await page.goto(`/child/${childId}`);

    // Open the log sheet via the FAB.
    await page.getByRole('button', { name: 'Logger un aliment' }).click();

    // Sheet placeholder visible.
    const placeholder = '🔍 chercher un aliment…';
    await expect(page.getByPlaceholder(placeholder)).toBeVisible();

    // Search for "poire" — Poire is in the seeded FOODS catalog.
    await page.getByPlaceholder(placeholder).fill('poire');

    // Click the matching list item. The Command primitive renders <li role="option">.
    await page.getByRole('option', { name: /^Poire$/ }).click();

    // Submit.
    await page.getByRole('button', { name: 'Enregistrer' }).click();

    // Toast confirms save.
    await expect(page.getByText('Enregistré')).toBeVisible();

    // Sheet closed (placeholder no longer visible).
    await expect(page.getByPlaceholder(placeholder)).not.toBeVisible();

    // Recent feed on /child/<id> shows the new entry.
    await expect(page.getByText('Poire').first()).toBeVisible();
  });
});
