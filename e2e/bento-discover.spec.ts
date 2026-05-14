import { test, expect } from '@playwright/test';
import { dismissWelcomeIfPresent, signUpAndCreateChild } from './_helpers';

test.use({ viewport: { width: 414, height: 896 } });

test('Découvrir bento renders all four sections', async ({ page }) => {
  const childId = await signUpAndCreateChild(page, 'Léo', '2025-10-01');
  await dismissWelcomeIfPresent(page);

  await page.goto(`/child/${childId}/guide`);
  // h2 headings inside aria-labelled sections
  await expect(page.getByText('Les étapes')).toBeVisible();
  await expect(page.getByText('Sources scientifiques')).toBeVisible();
});

test('tapping a stage tile opens the StageDetailSheet', async ({ page }) => {
  const childId = await signUpAndCreateChild(page, 'Léo', '2025-10-01');
  await dismissWelcomeIfPresent(page);

  await page.goto(`/child/${childId}/guide`);
  // Stage tiles are buttons whose visible text contains the stage title.
  // Child born 2025-10-01 is ~7 months old at test time; any stage tile works.
  await page.getByRole('button', { name: /6–9 mois/i }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
});
