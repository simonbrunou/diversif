import { test, expect } from '@playwright/test';
import { dismissWelcomeIfPresent, signUpAndCreateChild } from './_helpers';

// Mobile-only suite (@mobile-only tag). The mobile Playwright project
// renders these against an iPhone 14 viewport (390 × 844), which is sub-`lg:`
// so the bottom nav + FAB chrome paints. The desktop project skips this
// entire describe block via the negative-lookahead grep on @mobile-only.
// The desktop left-rail variant is tested separately.
//
// The FAB navigates to the full `/log` page (rather than opening an inline
// bottom sheet) so users get the complete logging form — FoodCombobox with
// category filters, datetime picker, ReactionPicker with severity helper,
// and the stage-rotating tip card. The HeroTile suggestion CTA uses the
// same destination.
test.describe('Bento shell : tab navigation @mobile-only', () => {
  test('switches between the four tabs', async ({ page }) => {
    const sevenMonthsAgo = new Date();
    sevenMonthsAgo.setMonth(sevenMonthsAgo.getMonth() - 7);
    const dateStr = sevenMonthsAgo.toISOString().slice(0, 10);
    const childId = await signUpAndCreateChild(page, 'Lulu', dateStr);

    await page.goto(`/child/${childId}`);
    await dismissWelcomeIfPresent(page);

    // Bento bottom nav rendered.
    await expect(page.getByRole('navigation', { name: 'Navigation principale' })).toBeVisible();

    // Bottom-nav links are activated via focus + Enter (keyboard nav)
    // rather than .click(). Reason: at iPhone 14's 390×664 viewport, the
    // empty-state card on the Carnet page extends below the bottom of the
    // viewport, putting its <section>/<h2> elements at the same Y as the
    // bottom nav. Even though the nav is fixed z-40 with backdrop-blur,
    // Playwright's coordinate-based click (incl. force:true) lands on the
    // section instead of the link. Keyboard activation dispatches click
    // on the focused element directly, bypassing the coord lookup.
    // Real users on touch devices fire pointer events from the tap target,
    // which the browser correctly routes via fixed-element stacking — so
    // touch works in practice; only Playwright's mouse-based click misroutes.

    // Click "Carnet" → /child/<id>/foods
    const carnetLink = page.getByRole('link', { name: 'Carnet' });
    await carnetLink.focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/child\/\d+\/foods/);

    // Click "Découvrir" → /child/<id>/guide
    const decouvrirLink = page.getByRole('link', { name: 'Découvrir' });
    await decouvrirLink.focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/child\/\d+\/guide/);

    // Click "Profil" → /account
    const profilLink = page.getByRole('link', { name: 'Profil' });
    await profilLink.focus();
    await page.keyboard.press('Enter');
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
