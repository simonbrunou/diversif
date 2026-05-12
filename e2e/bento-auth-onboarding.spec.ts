import { test, expect, type Page } from '@playwright/test';

test.use({ viewport: { width: 414, height: 896 } });

function unique(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

async function signUp(page: Page, email: string): Promise<void> {
  await page.goto('/signup');
  await page.getByLabel('Votre prénom').fill('Parent');
  await page.getByLabel('Adresse e-mail').fill(email);
  await page.getByLabel('Mot de passe').fill('hunter2-very-long');
  await page.getByLabel(/au moins 15 ans/i).check();
  await page.getByLabel(/conditions générales/i).check();
  await page.getByLabel(/politique de confidentialité/i).check();
  await page.getByRole('button', { name: /créer mon compte/i }).click();
  await expect(page).toHaveURL(/\/child\/new/);
}

test("signup lands on bento Aujourd'hui", async ({ page }) => {
  const email = `${unique('phase6')}@example.com`;
  await signUp(page, email);

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
  const email = `${unique('phase6')}@example.com`;
  await signUp(page, email);

  await page.getByLabel('Prénom').fill('Léo');
  await page.getByLabel('Date de naissance').fill('2025-10-01');
  await page.getByLabel('Inviter un co-parent maintenant').check();
  await page.getByRole('button', { name: /^créer$/i }).click();

  await expect(page).toHaveURL(/\/child\/\d+\?inviteCode=[A-Z0-9-]+$/i);
});
