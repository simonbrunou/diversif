import { test, expect, type Page } from '@playwright/test';

test.use({ viewport: { width: 414, height: 896 } });

const BASE_URL = `http://localhost:${process.env.PORT ?? '4173'}`;

function unique(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

async function signUpAndCreateChild(page: Page, name: string, birthDate: string): Promise<string> {
  const email = `${unique('reaction')}@example.com`;
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

async function logFood(page: Page, foodName: string, reaction: 'OK' | 'inconfort' | 'réaction') {
  await page.getByRole('button', { name: /Enregistrer un aliment/i }).click();
  await page.getByRole('searchbox').fill(foodName);
  await page.getByRole('option', { name: foodName }).first().click();
  await page.getByRole('button', { name: new RegExp(reaction, 'i') }).click();
  await page.getByRole('button', { name: 'Enregistrer', exact: true }).click();
}

test('reaction-detail bento renders for non-RAS entry with all panels', async ({
  page,
  context
}) => {
  await context.addCookies([{ name: 'bento', value: '1', url: BASE_URL }]);
  const childId = await signUpAndCreateChild(page, 'Léo', '2025-10-01');
  await dismissWelcomeIfPresent(page);

  await logFood(page, 'Poire', 'réaction');
  await page.goto(`/child/${childId}/foods`);

  await page.getByRole('link', { name: /Poire/i }).first().click();
  await expect(page).toHaveURL(/\/child\/\d+\/foods\/\d+$/);

  await expect(page.getByText(/On vous accompagne/)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Symptômes observés' })).toBeVisible();
  await expect(page.getByText(/Respirez/)).toBeVisible();
  await expect(page.getByText(/Difficulté à respirer/)).toBeVisible();
  await expect(page.getByRole('button', { name: /Suivre 30 min/ })).toBeVisible();
});

test('add-symptom flow appends a row to the symptom list', async ({ page, context }) => {
  await context.addCookies([{ name: 'bento', value: '1', url: BASE_URL }]);
  const childId = await signUpAndCreateChild(page, 'Léo', '2025-10-01');
  await dismissWelcomeIfPresent(page);

  await logFood(page, 'Poire', 'réaction');
  await page.goto(`/child/${childId}/foods`);
  await page.getByRole('link', { name: /Poire/i }).first().click();

  await page.getByRole('button', { name: 'Ajouter un symptôme' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByText('Rougeur', { exact: true }).click();
  await page.getByRole('button', { name: 'Enregistrer le symptôme' }).click();

  await expect(page.getByText('Rougeur', { exact: true })).toBeVisible();
});

test('print page renders without bento chrome and contains key strings', async ({
  page,
  context
}) => {
  await context.addCookies([{ name: 'bento', value: '1', url: BASE_URL }]);
  const childId = await signUpAndCreateChild(page, 'Léo', '2025-10-01');
  await dismissWelcomeIfPresent(page);

  await logFood(page, 'Poire', 'réaction');
  await page.goto(`/child/${childId}/foods`);
  await page.getByRole('link', { name: /Poire/i }).first().click();

  const url = page.url();
  const printUrl = url + '/print';
  await page.goto(printUrl);

  await expect(page.getByRole('heading', { name: /Diversif/ })).toBeVisible();
  await expect(page.getByText(/pédiatre/i)).toBeVisible();
});
