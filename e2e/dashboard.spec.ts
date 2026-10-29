import { test, expect } from '@playwright/test';
import { birthDateMonthsAgo, signUpAndCreateChild } from './_helpers';

test.describe('child dashboard golden path', () => {
  test('signup → create child → reach dashboard', async ({ page }) => {
    await signUpAndCreateChild(page, 'Lulu', birthDateMonthsAgo(7));
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
