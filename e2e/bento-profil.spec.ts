import { test, expect } from '@playwright/test';
import { dismissWelcomeIfPresent, signUpAndCreateChild } from './_helpers';

test.use({ viewport: { width: 414, height: 896 } });

test('Profil bento renders all five sections', async ({ page }) => {
  await signUpAndCreateChild(page, 'Léo', '2025-10-01');
  await dismissWelcomeIfPresent(page);

  await page.goto('/account');
  await expect(page.getByRole('heading', { name: 'Vos enfants' })).toBeVisible();
  // exact: true to skip the retained legacy /account headings ("Mon compte",
  // "Supprimer mon compte") that share the prefix.
  await expect(page.getByRole('heading', { name: 'Compte', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Vos données (RGPD)' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Légal' })).toBeVisible();
});

test('Profil shows the seeded child name', async ({ page }) => {
  await signUpAndCreateChild(page, 'Léo', '2025-10-01');
  await dismissWelcomeIfPresent(page);

  await page.goto('/account');
  await expect(page.getByRole('link', { name: /Léo/ })).toBeVisible();
});
