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
  await page.getByRole('button', { name: 'Enregistrer un repas', exact: true }).click();
  await expect(page).toHaveURL(/\/child\/\d+\/log$/);
  await page.getByPlaceholder('Rechercher un aliment…', { exact: true }).fill(foodName);
  await page
    .getByRole('button', { name: new RegExp(`^${foodName}`), exact: true })
    .first()
    .click();
  // ReactionPicker uses <label> elements; scope to the fieldset because the
  // severity-helper <details> panel below it echoes the same labels in <strong>
  // tags ("Comment choisir ?" copy on /log).
  await page.locator('fieldset').getByText(reactionLabel, { exact: true }).click();
  await page.getByRole('button', { name: 'Enregistrer', exact: true }).click();
  // Server redirects back to /child/<id> after a successful log.
  await expect(page).toHaveURL(/\/child\/\d+(\?.*)?$/);
}

test('reaction-detail bento renders for non-RAS entry with all panels @responsive', async ({
  page
}) => {
  // 1.7 s on desktop and 1.8 s on mobile locally. In CI, run 426: 28.7 s on
  // desktop, 29.1 s on mobile. Run 427's first attempt: 19.7 s on desktop,
  // 18.5 s on mobile. Run 428's first attempt: 12.8 s on desktop, 23.7 s on
  // mobile. Run 445's first attempt: 14.7 s on desktop, a timeout at 39.6 s
  // on mobile, then 29.7 s on the second try. In each of these runs, the
  // run's own unit job, its Docker build and cinder's test jobs shared the
  // runner, and no other diversif E2E job ran. Cinder's container jobs
  // shared it in runs 426, 427 and 445, sutom's test jobs in runs 427 and
  // 428.
  test.slow();
  const childId = await signUpAndCreateChild(page, 'Léo', '2025-10-01');
  await page.goto(`/child/${childId}`);
  await dismissWelcomeIfPresent(page);

  await logFoodWithReaction(page, 'Poire', 'Réaction marquée');
  await page.goto(`/child/${childId}/foods`);

  await page.getByRole('link', { name: /Poire/i }).first().click();
  await expect(page).toHaveURL(/\/child\/\d+\/foods\/\d+$/);

  await expect(page.getByText(/On vous accompagne/)).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Symptômes observés', exact: true })
  ).toBeVisible();
  const emergencyAlert = page.getByRole('alert');
  await expect(emergencyAlert).toContainText('Gêne respiratoire');
  await expect(emergencyAlert).toContainText(/15 ou le 112/);
});

test('add-symptom then delete-symptom via the confirm modal @responsive', async ({ page }) => {
  // 1.8 s on desktop and 1.9 s on mobile locally. In CI, run 426: a timeout
  // at 33.0 s on desktop, then 25.3 s on the second try, and 30.8 s on
  // mobile. Run 427's first attempt: a timeout on both tries on desktop
  // (34.5 s, then 38.1 s), 19.9 s on mobile. Run 428's first attempt: 22.5 s
  // on desktop, 28.2 s on mobile. In each of these runs, the run's own unit
  // job, its Docker build and cinder's test jobs shared the runner, and no
  // other diversif E2E job ran. Cinder's container jobs shared it in runs 426
  // and 427, sutom's test jobs in runs 427 and 428.
  test.slow();
  const childId = await signUpAndCreateChild(page, 'Léo', '2025-10-01');
  await page.goto(`/child/${childId}`);
  await dismissWelcomeIfPresent(page);

  await logFoodWithReaction(page, 'Poire', 'Réaction marquée');
  await page.goto(`/child/${childId}/foods`);
  await page.getByRole('link', { name: /Poire/i }).first().click();

  await page.getByRole('button', { name: 'Ajouter un symptôme', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expectDialogMatchesViewport(page);
  await page.getByText('Rougeur', { exact: true }).click();
  await page.getByRole('button', { name: 'Enregistrer le symptôme', exact: true }).click();

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
  // 1.6 s on desktop and on mobile locally. In CI, run 426: 27.6 s on
  // desktop, a timeout at 40.7 s on mobile, then 21.1 s on the second try.
  // Run 427's first attempt: 25.0 s on desktop, 17.5 s on mobile. Run 428's
  // first attempt: 22.2 s on desktop, a timeout on both tries on mobile
  // (39.5 s, then 38.4 s). In each of these runs, the run's own unit job, its
  // Docker build and cinder's test jobs shared the runner, and no other
  // diversif E2E job ran. Cinder's container jobs shared it in runs 426 and
  // 427, sutom's test jobs in runs 427 and 428.
  test.slow();
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
