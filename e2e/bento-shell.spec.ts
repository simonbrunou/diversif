import { test, expect } from '@playwright/test';
import { dismissWelcomeIfPresent, signUpAndCreateChild } from './_helpers';

// Force a sub-`lg:` viewport so the mobile chrome (BottomNavBento + FAB) is
// rendered/visible. Playwright's default chromium project uses Desktop Chrome
// (1280×720) which crosses the `lg:` breakpoint and switches to the desktop
// left-rail variant : those elements (`Navigation latérale`, `+ Logger` text)
// are tested separately. This block targets the mobile flow.
//
// The FAB navigates to the full `/log` page (rather than opening an inline
// bottom sheet) so users get the complete logging form — FoodCombobox with
// category filters, datetime picker, ReactionPicker with severity helper,
// and the stage-rotating tip card. The HeroTile suggestion CTA uses the
// same destination.
test.describe('Bento shell : tab navigation', () => {
  test.use({ viewport: { width: 414, height: 896 } });

  test('switches between the four tabs', async ({ page }) => {
    const sevenMonthsAgo = new Date();
    sevenMonthsAgo.setMonth(sevenMonthsAgo.getMonth() - 7);
    const dateStr = sevenMonthsAgo.toISOString().slice(0, 10);
    const childId = await signUpAndCreateChild(page, 'Lulu', dateStr);

    await page.goto(`/child/${childId}`);
    await dismissWelcomeIfPresent(page);

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

  test('FAB navigates to log page, food saves, returns to home with the entry', async ({
    page
  }) => {
    const sevenMonthsAgo = new Date();
    sevenMonthsAgo.setMonth(sevenMonthsAgo.getMonth() - 7);
    const dateStr = sevenMonthsAgo.toISOString().slice(0, 10);
    const childId = await signUpAndCreateChild(page, 'Mia', dateStr);

    await page.goto(`/child/${childId}`);
    await dismissWelcomeIfPresent(page);

    // FAB navigates to the full /log page rather than opening a sheet.
    await page.getByRole('button', { name: 'Enregistrer un aliment' }).click();
    await expect(page).toHaveURL(/\/child\/\d+\/log$/);
    await expect(page.getByRole('heading', { name: 'Noter un repas' })).toBeVisible();

    // FoodCombobox search.
    await page.getByPlaceholder('Rechercher un aliment…').fill('poire');
    // The combobox renders selectable foods as <button> rows, not role=option.
    await page
      .getByRole('button', { name: /^Poire/ })
      .first()
      .click();

    await page.getByRole('button', { name: 'Noter ce repas' }).click();

    // Server redirects back to /child/<id>; recent feed surfaces the new entry.
    await expect(page).toHaveURL(/\/child\/\d+(\?.*)?$/);
    await expect(page.getByText('Poire').first()).toBeVisible();
  });

  test('Carnet Allergènes segment is reachable via URL', async ({ page }) => {
    const sevenMonthsAgo = new Date();
    sevenMonthsAgo.setMonth(sevenMonthsAgo.getMonth() - 7);
    const dateStr = sevenMonthsAgo.toISOString().slice(0, 10);
    const childId = await signUpAndCreateChild(page, 'Sam', dateStr);

    await page.goto(`/child/${childId}/foods`);
    await dismissWelcomeIfPresent(page);

    // Click the Allergènes segment link.
    await page.getByRole('link', { name: 'Allergènes' }).click();
    await expect(page).toHaveURL(/\/child\/\d+\/foods\?segment=allergens/);
  });
});
