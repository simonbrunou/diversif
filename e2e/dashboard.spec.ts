import { test, expect } from '@playwright/test';
import { signUpAndCreateChild } from './_helpers';

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
