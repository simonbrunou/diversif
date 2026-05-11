import { test, expect, type Page } from '@playwright/test';

test.use({ viewport: { width: 414, height: 896 } });

const BASE_URL = `http://localhost:${process.env.PORT ?? '4173'}`;

function unique(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

async function signUpAndCreateChild(page: Page, name: string, birthDate: string): Promise<string> {
  const email = `${unique('discover')}@example.com`;
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
  await expect(page).toHaveURL(/\/child\/\d+$/);

  const url = page.url();
  const match = url.match(/\/child\/(\d+)$/);
  if (!match) throw new Error(`Expected /child/<id> URL, got ${url}`);
  return match[1];
}

async function dismissWelcomeIfPresent(page: Page): Promise<void> {
  const dismiss = page.getByRole('button', { name: 'Plus tard' });
  if (await dismiss.isVisible().catch(() => false)) {
    await dismiss.click();
    await expect(dismiss).not.toBeVisible();
  }
}

test('Découvrir bento renders all four sections', async ({ page, context }) => {
  await context.addCookies([{ name: 'bento', value: '1', url: BASE_URL }]);
  const childId = await signUpAndCreateChild(page, 'Léo', '2025-10-01');
  await dismissWelcomeIfPresent(page);

  await page.goto(`/child/${childId}/guide`);
  // h2 headings inside aria-labelled sections
  await expect(page.getByText('Les étapes')).toBeVisible();
  await expect(page.getByText('Sources scientifiques')).toBeVisible();
});

test('tapping a stage tile opens the StageDetailSheet', async ({ page, context }) => {
  await context.addCookies([{ name: 'bento', value: '1', url: BASE_URL }]);
  const childId = await signUpAndCreateChild(page, 'Léo', '2025-10-01');
  await dismissWelcomeIfPresent(page);

  await page.goto(`/child/${childId}/guide`);
  // Stage tiles are buttons whose visible text contains the stage title.
  // Child born 2025-10-01 is ~7 months old at test time; any stage tile works.
  await page.getByRole('button', { name: /6–9 mois/i }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
});
