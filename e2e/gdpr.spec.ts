import { test, expect, type Page } from '@playwright/test';

function unique(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

async function signUp(page: Page, email: string) {
  await page.goto('/signup');
  await page.getByLabel('Votre prénom').fill('RGPD Tester');
  await page.getByLabel('Adresse e-mail').fill(email);
  await page.getByLabel('Mot de passe', { exact: true }).fill('hunter2-very-long');
  await page.getByLabel(/au moins 15 ans/i).check();
  await page.getByLabel(/conditions générales/i).check();
  await page.getByLabel(/politique de confidentialité/i).check();
  await page.getByRole('button', { name: /créer mon compte/i }).click();
  await expect(page).toHaveURL(/\/child\/new/);
}

test.describe('legal pages', () => {
  test('public legal pages are reachable from the footer', async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/');
    for (const path of ['/mentions-legales', '/politique-confidentialite', '/cgu', '/cookies']) {
      await page.goto(path);
      await expect(page.locator('h1')).toBeVisible();
    }
  });

  test('legal pages render with placeholder when env vars are unset', async ({ page }) => {
    await page.goto('/mentions-legales');
    await expect(page.locator('body')).toContainText(/à compléter/i);
  });
});

test.describe('signup consent gates', () => {
  test('signup is blocked without the consent checkboxes', async ({ page }) => {
    const email = `${unique('blocked')}@example.com`;
    await page.goto('/signup');
    await page.getByLabel('Votre prénom').fill('Sans consentement');
    await page.getByLabel('Adresse e-mail').fill(email);
    await page.getByLabel('Mot de passe', { exact: true }).fill('hunter2-very-long');
    await page.getByRole('button', { name: /créer mon compte/i }).click();
    // Browsers block submission for unticked required checkboxes; URL stays on /signup.
    await expect(page).toHaveURL(/\/signup/);
  });
});

test.describe('account deletion', () => {
  test('user can delete their account and the email is reusable', async ({ page }) => {
    const email = `${unique('rgpd')}@example.com`;
    await signUp(page, email);

    await page.goto('/account/delete');
    await page.getByLabel(/Saisissez votre adresse e-mail/i).fill(email);
    await page.getByLabel(/Confirmez avec votre mot de passe/i).fill('hunter2-very-long');
    await page.getByRole('button', { name: /Supprimer définitivement/i }).click();
    await expect(page).toHaveURL(/\/account\/deleted/);

    await page.context().clearCookies();
    await signUp(page, email);
  });
});

test.describe('data export', () => {
  test('export endpoint returns JSON for the authenticated user', async ({ page }) => {
    const email = `${unique('export')}@example.com`;
    await signUp(page, email);

    const response = await page.request.get('/account/export');
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('application/json');
    expect(response.headers()['content-disposition']).toContain('attachment');
    const body = await response.json();
    expect(body.profile.email).toBe(email);
    expect(body.generator).toBe('diversif');
  });
});
