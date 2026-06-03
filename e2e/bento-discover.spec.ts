import { test, expect } from '@playwright/test';
import {
  dismissWelcomeIfPresent,
  expectDialogMatchesViewport,
  signUpAndCreateChild
} from './_helpers';

test('Découvrir bento segments reveal each section @responsive', async ({ page }) => {
  const childId = await signUpAndCreateChild(page, 'Léo', '2025-10-01');
  await dismissWelcomeIfPresent(page);

  await page.goto(`/child/${childId}/guide`);
  // Repères is the default section: its "Les étapes" heading is visible, while
  // the "Apprendre" section's heading is not mounted yet. Target the heading
  // role so we don't also match the "Voir toutes les étapes" expander button.
  await expect(page.getByRole('heading', { name: 'Les étapes' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Sources scientifiques' })).toHaveCount(0);

  // Switching to the Apprendre tab swaps the visible section.
  await page.getByRole('link', { name: 'Apprendre' }).click();
  await expect(page.getByRole('heading', { name: 'Sources scientifiques' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Les étapes' })).toHaveCount(0);
});

test('tapping a stage tile opens the StageDetailSheet @responsive', async ({ page }) => {
  const childId = await signUpAndCreateChild(page, 'Léo', '2025-10-01');
  await dismissWelcomeIfPresent(page);

  await page.goto(`/child/${childId}/guide`);
  // Child born 2025-10-01 is ~8 months old at test time, so the 6–9 mois stage
  // is the current one and shows by default.
  await page.getByRole('button', { name: /6–9 mois/i }).click();
  await expectDialogMatchesViewport(page);
});
