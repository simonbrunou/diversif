import { test, expect, type Page } from '@playwright/test';

test.use({ viewport: { width: 414, height: 896 } });

const BASE_URL = `http://localhost:${process.env.PORT ?? '4173'}`;

function unique(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

async function signUpAndCreateChild(page: Page, name: string, birthDate: string): Promise<string> {
  const email = `${unique('optin')}@example.com`;
  await page.goto('/signup');
  await page.getByLabel('Votre prénom').fill('Parent');
  await page.getByLabel('Adresse e-mail').fill(email);
  await page.getByLabel('Mot de passe').fill('hunter2-very-long');
  await page.getByLabel(/au moins 15 ans/i).check();
  await page.getByLabel(/conditions générales/i).check();
  await page.getByLabel(/politique de confidentialité/i).check();
  await page.getByRole('button', { name: /créer mon compte/i }).click();
  await expect(page).toHaveURL(/\/child\/new/);

  await page.getByLabel('Prénom').fill(name);
  await page.getByLabel('Date de naissance').fill(birthDate);
  await page.getByRole('button', { name: /^créer$/i }).click();
  await expect(page).toHaveURL(/\/child\/\d+(\?.*)?$/);

  const match = page.url().match(/\/child\/(\d+)/);
  if (!match) throw new Error('expected /child/<id>');
  return match[1];
}

async function dismissWelcomeIfPresent(page: Page): Promise<void> {
  const dismiss = page.getByRole('button', { name: 'Plus tard' });
  if (await dismiss.isVisible().catch(() => false)) {
    await dismiss.click();
    await expect(dismiss).not.toBeVisible();
  }
}

test('legacy user sees opt-in banner; clicking CTA switches to bento', async ({
  page,
  context
}) => {
  const childId = await signUpAndCreateChild(page, 'Léo', '2025-10-01');

  // Force legacy: overwrite the bento cookie with 0
  await context.addCookies([{ name: 'bento', value: '0', url: BASE_URL }]);
  await page.goto(`/child/${childId}`);
  await dismissWelcomeIfPresent(page);

  // Banner is visible in legacy branch
  await expect(page.getByText(/nouveau design est prêt/i)).toBeVisible();

  // Click the CTA — switches to bento
  await page.getByRole('button', { name: /Essayer le nouveau design/ }).click();
  await expect(page).toHaveURL(new RegExp(`/child/${childId}(\\?.*)?$`));

  // Bento chrome renders
  await expect(page.getByRole('button', { name: 'Enregistrer un aliment' })).toBeVisible();
});

test('dismissing the opt-in banner hides it without changing the design', async ({
  page,
  context
}) => {
  const childId = await signUpAndCreateChild(page, 'Léo', '2025-10-01');
  await context.addCookies([{ name: 'bento', value: '0', url: BASE_URL }]);
  await page.goto(`/child/${childId}`);
  await dismissWelcomeIfPresent(page);

  await page.getByRole('button', { name: 'Fermer le panneau' }).click();
  await expect(page.getByText(/nouveau design est prêt/i)).not.toBeVisible();

  // Reload — banner stays dismissed via the bento-opt-in-dismissed cookie
  await page.reload();
  await expect(page.getByText(/nouveau design est prêt/i)).not.toBeVisible();
});
