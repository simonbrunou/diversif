import { test, expect } from '@playwright/test';
import { uniqueForWorker } from './_helpers';

test.describe('signup → onboarding', () => {
  test('signup creates an account and redirects to onboarding @responsive', async ({ page }) => {
    const email = `${uniqueForWorker('user')}@example.com`;
    await page.goto('/signup');
    await page.getByLabel('Votre prénom').fill('Test Parent');
    await page.getByLabel('Adresse e-mail').fill(email);
    await page.getByLabel('Mot de passe', { exact: true }).fill('hunter2-very-long');
    await page.getByLabel(/au moins 15 ans/i).check();
    await page.getByLabel(/conditions générales/i).check();
    await page.getByLabel(/politique de confidentialité/i).check();
    const submitButton = page.getByRole('button', { name: /créer mon compte/i });
    await expect(submitButton).toBeInViewport();
    await submitButton.click();
    await expect(page).toHaveURL(/\/child\/new/);
  });

  test('rejects invalid login @responsive', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Adresse e-mail').fill('nobody-12345@example.com');
    await page.getByLabel('Mot de passe', { exact: true }).fill('wrong-pass');
    await page.getByRole('button', { name: 'Se connecter', exact: true }).click();
    await expect(page.locator('body')).toContainText(/incorrect/i);
  });
});
