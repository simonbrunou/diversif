import { test, expect, type Page } from '@playwright/test';

test.use({ viewport: { width: 414, height: 896 } });

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

// Logs a food via the full /log page. The FAB now navigates there instead
// of opening an inline bottom sheet, so we drive the same FoodCombobox +
// ReactionPicker + submit flow that the HeroTile suggestion CTA uses.
async function logFoodWithReaction(
  page: Page,
  foodName: string,
  reactionLabel: string
): Promise<void> {
  await page.getByRole('button', { name: 'Enregistrer un aliment' }).click();
  await expect(page).toHaveURL(/\/child\/\d+\/log$/);
  await page.getByPlaceholder('Rechercher un aliment…').fill(foodName);
  await page
    .getByRole('button', { name: new RegExp(`^${foodName}`) })
    .first()
    .click();
  // ReactionPicker uses <label> elements; scope to the fieldset because the
  // severity-helper <details> panel below it echoes the same labels in <strong>
  // tags ("Comment choisir ?" copy on /log).
  await page.locator('fieldset').getByText(reactionLabel, { exact: true }).click();
  await page.getByRole('button', { name: 'Noter ce repas' }).click();
  // Server redirects back to /child/<id> after a successful log.
  await expect(page).toHaveURL(/\/child\/\d+(\?.*)?$/);
}

test('reaction-detail bento renders for non-RAS entry with all panels', async ({ page }) => {
  const childId = await signUpAndCreateChild(page, 'Léo', '2025-10-01');
  await page.goto(`/child/${childId}`);
  await dismissWelcomeIfPresent(page);

  await logFoodWithReaction(page, 'Poire', 'Réaction marquée');
  await page.goto(`/child/${childId}/foods`);

  await page.getByRole('link', { name: /Poire/i }).first().click();
  await expect(page).toHaveURL(/\/child\/\d+\/foods\/\d+$/);

  await expect(page.getByText(/On vous accompagne/)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Symptômes observés' })).toBeVisible();
  await expect(page.getByText(/Difficulté à respirer/)).toBeVisible();
  await expect(page.getByRole('button', { name: /Suivre 30 min/ })).toBeVisible();
});

test('add-symptom flow appends a row to the symptom list', async ({ page }) => {
  const childId = await signUpAndCreateChild(page, 'Léo', '2025-10-01');
  await page.goto(`/child/${childId}`);
  await dismissWelcomeIfPresent(page);

  await logFoodWithReaction(page, 'Poire', 'Réaction marquée');
  await page.goto(`/child/${childId}/foods`);
  await page.getByRole('link', { name: /Poire/i }).first().click();

  await page.getByRole('button', { name: 'Ajouter un symptôme' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByText('Rougeur', { exact: true }).click();
  await page.getByRole('button', { name: 'Enregistrer le symptôme' }).click();

  await expect(page.getByText('Rougeur', { exact: true })).toBeVisible();
});

test('print page renders without bento chrome and contains key strings', async ({ page }) => {
  const childId = await signUpAndCreateChild(page, 'Léo', '2025-10-01');
  await page.goto(`/child/${childId}`);
  await dismissWelcomeIfPresent(page);

  await logFoodWithReaction(page, 'Poire', 'Réaction marquée');
  await page.goto(`/child/${childId}/foods`);
  await page.getByRole('link', { name: /Poire/i }).first().click();
  await expect(page).toHaveURL(/\/child\/\d+\/foods\/\d+$/);

  const printUrl = page.url() + '/print';
  await page.goto(printUrl);

  await expect(page.getByRole('heading', { name: /Diversif/ })).toBeVisible();
  await expect(page.getByText(/pédiatre/i)).toBeVisible();
});
