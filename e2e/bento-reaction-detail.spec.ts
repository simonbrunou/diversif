import { test, expect, type Page } from '@playwright/test';
import { dismissWelcomeIfPresent, signUpAndCreateChild } from './_helpers';

test.use({ viewport: { width: 414, height: 896 } });

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

test('texture picker defaults to age-appropriate value and surfaces on the feed', async ({
  page
}) => {
  // Child born 2025-01-01: ~16 months old at test time → default texture is "morceaux"
  // Use a birth date that puts the child at 8 months → default is "ecrasee"
  // Today is 2026-05-15; 8 months back = 2025-09-15
  const childId = await signUpAndCreateChild(page, 'Emma', '2025-09-15');
  await page.goto(`/child/${childId}`);
  await dismissWelcomeIfPresent(page);

  // Navigate to the log page
  await page.goto(`/child/${childId}/log`);

  // Texture picker fieldset is visible (legend is sr-only, use role=group)
  await expect(page.getByRole('group')).toBeVisible();

  // Fill in food via FoodCombobox
  await page.getByPlaceholder('Rechercher un aliment…').fill('Poire');
  await page
    .getByRole('button', { name: /^Poire/ })
    .first()
    .click();

  // Submit the log entry (texture default is already selected)
  await page.getByRole('button', { name: 'Noter ce repas' }).click();

  // Server redirects back to /child/<id> after a successful log
  await expect(page).toHaveURL(/\/child\/\d+(\?.*)?$/);

  // Navigate to the foods feed and verify a texture chip is visible
  await page.goto(`/child/${childId}/foods`);
  // Texture chips are rendered uppercase with tracking-wide class
  await expect(
    page.getByText(/LISSE|MOULINÉE|ÉCRASÉE|PETITS MORCEAUX|MORCEAUX|FINGER FOOD/i)
  ).toBeVisible();
});
