import { test, expect } from '@playwright/test';
import { dismissWelcomeIfPresent, signUpAndCreateChild } from './_helpers';

test('Profil bento renders all five sections @responsive', async ({ page }) => {
  await signUpAndCreateChild(page, 'Léo', '2025-10-01');
  await dismissWelcomeIfPresent(page);

  await page.goto('/account');
  await expect(page.getByRole('heading', { name: 'Vos enfants' })).toBeVisible();
  // exact: true to disambiguate from the sr-only "Mon compte" h1 the shell
  // emits on /account for screen readers.
  await expect(page.getByRole('heading', { name: 'Compte', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Vos données (RGPD)' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Légal' })).toBeVisible();

  // Bundle 5 canonicalisation: surface should say Carnet / Bilan, never the
  // English-leaning Stats / Streak / Logger.
  await expect(page.getByText(/\bStats\b/)).toHaveCount(0);
  await expect(page.getByText(/\bStreak\b/)).toHaveCount(0);
  await expect(page.getByText(/\bLogger\b/)).toHaveCount(0);
});

test('Profil shows the seeded child name @responsive', async ({ page }) => {
  await signUpAndCreateChild(page, 'Léo', '2025-10-01');
  await dismissWelcomeIfPresent(page);

  await page.goto('/account');
  await expect(page.getByRole('link', { name: /Léo/ })).toBeVisible();
});
