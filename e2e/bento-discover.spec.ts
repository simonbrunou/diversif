import { test } from '@playwright/test';
import {
  dismissWelcomeIfPresent,
  expectDialogMatchesViewport,
  signUpAndCreateChild
} from './_helpers';

test('tapping a stage tile opens the StageDetailSheet @responsive', async ({ page }) => {
  const childId = await signUpAndCreateChild(page, 'Léo', '2025-10-01');
  await dismissWelcomeIfPresent(page);

  await page.goto(`/child/${childId}/guide`);
  // Child born 2025-10-01 is ~8 months old at test time, so the 6–9 mois stage
  // is the current one and shows by default.
  await page.getByRole('button', { name: /6–9 mois/i }).click();
  await expectDialogMatchesViewport(page);
});
