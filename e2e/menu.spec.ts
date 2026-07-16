import { test, expect } from '@playwright/test';
import { dismissWelcomeIfPresent, signUpAndCreateChild } from './_helpers';

// A birth date that keeps the child ~8 months old at run time — lands in the
// '6-9' stage, which uses the full-day meal templates (matin/midi/goûter/
// soir) rather than the <4-month "milk only" branch, matching the pattern
// used by cross-tenant-isolation.spec.ts / report.spec.ts.
function eightMonthsAgo(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - 8);
  return d.toISOString().slice(0, 10);
}

function twoMonthsAgo(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - 2);
  return d.toISOString().slice(0, 10);
}

test.describe('menu du jour', () => {
  test('reachable from the dashboard and shows a real day menu', async ({ page }) => {
    const childId = await signUpAndCreateChild(page, 'Nino', eightMonthsAgo());
    await page.goto(`/child/${childId}`);
    await dismissWelcomeIfPresent(page);

    await page.getByRole('link', { name: 'Menu du jour' }).click();
    await expect(page).toHaveURL(`/child/${childId}/menu`);
    await expect(page.getByRole('heading', { name: 'Menu du jour' })).toBeVisible();

    // The quantities card and at least one meal slot render from the seeded
    // catalog even with no food logged yet (full-variety discover slots).
    await expect(page.getByText('Combien lui donner ?')).toBeVisible();
    await expect(page.getByText('Matin', { exact: true })).toBeVisible();

    // Clicking a suggested food routes into the log flow for that food,
    // proving MenuDay's per-item links are actually wired end to end.
    const foodLink = page.locator('main a[href*="/log?foodId="]').first();
    await expect(foodLink).toBeVisible();
    await foodLink.click();
    await expect(page).toHaveURL(new RegExp(`/child/${childId}/log\\?foodId=\\d+$`));
  });

  test('shows the milk-only message for a child under 4 months', async ({ page }) => {
    const childId = await signUpAndCreateChild(page, 'Tiny', twoMonthsAgo());
    await page.goto(`/child/${childId}/menu`);

    await expect(page.getByText('Le lait reste le repas principal à cet âge.')).toBeVisible();
  });
});
