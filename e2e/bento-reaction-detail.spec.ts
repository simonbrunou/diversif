import { test, expect, type Page } from '@playwright/test';
import {
  dismissWelcomeIfPresent,
  expectDialogMatchesViewport,
  signUpAndCreateChild
} from './_helpers';

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

test('reaction-detail bento renders for non-RAS entry with all panels @responsive', async ({
  page
}) => {
  const childId = await signUpAndCreateChild(page, 'Léo', '2025-10-01');
  await page.goto(`/child/${childId}`);
  await dismissWelcomeIfPresent(page);

  await logFoodWithReaction(page, 'Poire', 'Réaction marquée');
  await page.goto(`/child/${childId}/foods`);

  await page.getByRole('link', { name: /Poire/i }).first().click();
  await expect(page).toHaveURL(/\/child\/\d+\/foods\/\d+$/);

  await expect(page.getByText(/On vous accompagne/)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Symptômes observés' })).toBeVisible();
  const emergencyAlert = page.getByRole('alert');
  await expect(emergencyAlert).toContainText('Gêne respiratoire');
  await expect(emergencyAlert).toContainText(/15 ou le 112/);
});

test('add-symptom then delete-symptom via the confirm modal @responsive', async ({ page }) => {
  const childId = await signUpAndCreateChild(page, 'Léo', '2025-10-01');
  await page.goto(`/child/${childId}`);
  await dismissWelcomeIfPresent(page);

  await logFoodWithReaction(page, 'Poire', 'Réaction marquée');
  await page.goto(`/child/${childId}/foods`);
  await page.getByRole('link', { name: /Poire/i }).first().click();

  await page.getByRole('button', { name: 'Ajouter un symptôme' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expectDialogMatchesViewport(page);
  await page.getByText('Rougeur', { exact: true }).click();
  await page.getByRole('button', { name: 'Enregistrer le symptôme' }).click();

  // The sheet closes before the refreshed list renders, so the only
  // remaining "Rougeur" is the new list row.
  await expect(page.getByRole('dialog')).toBeHidden();
  const row = page.locator('li', { hasText: 'Rougeur' });
  await expect(row).toBeVisible();

  // Delete it through the ConfirmModal (replaced the native confirm()).
  await row.getByRole('button', { name: /Supprimer/ }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /^Supprimer/ })
    .click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(page.locator('li', { hasText: 'Rougeur' })).toHaveCount(0);
});

test('print page renders without bento chrome and contains key strings @responsive', async ({
  page
}) => {
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
