import { test, expect } from '@playwright/test';

function unique(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

test.describe('signup → onboarding', () => {
  test('signup creates an account and redirects to onboarding', async ({ page }) => {
    const email = `${unique('user')}@example.com`;
    await page.goto('/signup');
    await page.getByLabel('Votre prénom').fill('Test Parent');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Mot de passe').fill('hunter2-very-long');
    await page.getByRole('button', { name: /créer mon compte/i }).click();
    await expect(page).toHaveURL(/\/child\/new/);
  });

  test('rejects invalid login', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('nobody-12345@example.com');
    await page.getByLabel('Mot de passe').fill('wrong-pass');
    await page.getByRole('button', { name: /se connecter/i }).click();
    await expect(page.locator('body')).toContainText(/incorrect/i);
  });
});
