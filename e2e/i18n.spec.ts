import { expect, test } from '@playwright/test';

test.describe('i18n smoke', () => {
  test('FR default lands on / with lang=fr', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
  });

  test('EN switcher click flips lang and copy', async ({ page }) => {
    await page.goto('/');
    const enLink = page.getByRole('link', { name: /^en$/i }).first();
    await expect(enLink).toBeVisible();
    await enLink.click();
    await expect(page).toHaveURL(/\/en\/?$/);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  });

  test('FR-only banner appears on /en/mentions-legales', async ({ page }) => {
    await page.goto('/en/mentions-legales');
    const banner = page.locator('aside[role="note"]');
    await expect(banner).toContainText(/only available in French|french law/i);
  });

  test('FR-only page does NOT show banner on FR URL', async ({ page }) => {
    await page.goto('/mentions-legales');
    const banner = page.locator('aside[role="note"]');
    await expect(banner).toHaveCount(0);
  });
});
