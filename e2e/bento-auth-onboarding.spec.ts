import { test, expect } from '@playwright/test';
import { signUp } from './_helpers';

test.use({ viewport: { width: 414, height: 896 } });

test("signup lands on bento Aujourd'hui", async ({ page }) => {
  await signUp(page, 'phase6');

  // Onboarding form renders the bento variant
  await expect(page.getByLabel('Prénom')).toBeVisible();
  await expect(page.getByLabel('Inviter un co-parent maintenant')).toBeVisible();

  // Complete onboarding without invite
  await page.getByLabel('Prénom').fill('Léo');
  await page.getByLabel('Date de naissance').fill('2025-10-01');
  await page.getByRole('button', { name: /^créer$/i }).click();

  await expect(page).toHaveURL(/\/child\/\d+$/);

  // Bento chrome renders
  await expect(page.getByRole('button', { name: 'Enregistrer un aliment' })).toBeVisible();
});

test('onboarding with inviteCoparent generates a code visible in the redirect query', async ({
  page
}) => {
  await signUp(page, 'phase6');

  await page.getByLabel('Prénom').fill('Léo');
  await page.getByLabel('Date de naissance').fill('2025-10-01');
  await page.getByLabel('Inviter un co-parent maintenant').check();
  await page.getByRole('button', { name: /^créer$/i }).click();

  await expect(page).toHaveURL(/\/child\/\d+\?inviteCode=[A-Z0-9-]+$/i);
});
