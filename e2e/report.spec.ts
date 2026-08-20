import { test, expect } from '@playwright/test';
import { dismissWelcomeIfPresent, signUpAndCreateChild } from './_helpers';

test.describe('Bilan pour le pédiatre — print', () => {
  test('hides app chrome and shows the printed footer under print emulation', async ({ page }) => {
    // 8-month-old via dynamic birth date — avoids time-bomb regressions.
    const today = new Date();
    const birthDate = new Date(today);
    birthDate.setMonth(birthDate.getMonth() - 8);
    const birthDateStr = birthDate.toISOString().slice(0, 10);
    const childId = await signUpAndCreateChild(page, 'Emma', birthDateStr);
    await page.goto(`/child/${childId}`);
    await dismissWelcomeIfPresent(page);

    await page.goto(`/child/${childId}/report`);
    await page.emulateMedia({ media: 'print' });

    // App chrome (SharedTopBar, sidebar, bottom-nav, FAB) must be hidden in print.
    await expect(page.locator('[data-no-print]').first()).toBeHidden();

    // The toolbar div that wraps the Imprimer button carries print:hidden —
    // the button itself should therefore be hidden.
    await expect(page.getByRole('button', { name: /imprimer/i })).toBeHidden();

    // The print-only footer stamp must now be visible.
    await expect(page.getByText(/Imprimé le/)).toBeVisible();

    // Restore screen media so the rest of the suite isn't affected.
    await page.emulateMedia({ media: 'screen' });
  });
});
