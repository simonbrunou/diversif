import { test, expect } from '@playwright/test';
import { dismissWelcomeIfPresent, signUpAndCreateChild } from './_helpers';

test('texture picker defaults to age-appropriate value and surfaces on the feed', async ({
  page
}) => {
  // Child born 2025-09-15: ~8 months old today (2026-05-15) → default texture is "ecrasee"
  const childId = await signUpAndCreateChild(page, 'Emma', '2025-09-15');
  await page.goto(`/child/${childId}`);
  await dismissWelcomeIfPresent(page);

  // Navigate to the log page
  await page.goto(`/child/${childId}/log`);

  // Texture picker fieldset is visible (legend "Texture" is sr-only).
  // The log page has multiple fieldsets — filter by accessible name so we
  // don't trip Playwright's strict-mode multi-match guard.
  await expect(page.getByRole('group', { name: 'Texture' })).toBeVisible();

  // Fill in food via FoodCombobox
  await page.getByPlaceholder('Rechercher un aliment…').fill('Poire');
  await page
    .getByRole('button', { name: /^Poire/ })
    .first()
    .click();

  // Submit the log entry (texture default is already selected)
  await page.getByRole('button', { name: 'Noter ce repas' }).click();

  // Server redirects back to /child/<id> after a successful log
  await expect(page).toHaveURL(/\/child\/\d+(\?.*)?$/);

  // Navigate to the foods feed and verify the age-appropriate texture chip is visible.
  // For an 8-month-old the expected default is "ecrasee" → label "Écrasée".
  // getByText matches the underlying DOM text; CSS uppercases it visually.
  await page.goto(`/child/${childId}/foods`);
  await expect(page.getByText(/ÉCRASÉE/i)).toBeVisible();
});
