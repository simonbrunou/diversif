import { test, expect, type Page } from '@playwright/test';

function unique(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

async function signUpAndCreateChild(page: Page, name: string, birthDate: string) {
  const email = `${unique('e2e')}@example.com`;
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
}

test.describe('child dashboard golden path', () => {
  test('signup → create child → reach dashboard', async ({ page }) => {
    const sevenMonthsAgo = new Date();
    sevenMonthsAgo.setMonth(sevenMonthsAgo.getMonth() - 7);
    const dateStr = sevenMonthsAgo.toISOString().slice(0, 10);
    await signUpAndCreateChild(page, 'Lulu', dateStr);
    await expect(page.locator('body')).toContainText('Lulu');
  });

  test('public landing page renders for guests', async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/');
    await expect(page.locator('body')).toContainText(/diversifier en confiance/i);
  });

  test('public guide is reachable for guests', async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/guide');
    await expect(page.locator('body')).toContainText(/règles/i);
  });

  test('public sources page lists references', async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/sources');
    await expect(page.locator('body')).toContainText(/santé publique france|hcsp/i);
  });
});
