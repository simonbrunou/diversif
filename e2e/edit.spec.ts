import { test, expect, type Page } from '@playwright/test';
import { awaitHydration, dismissWelcomeIfPresent, signUpAndCreateChild } from './_helpers';

// The edit page's four actions (update, delete, deleteMeal, removeIngredient)
// end to end, through the repas write module.

async function childOfEightMonths(page: Page): Promise<string> {
  const birthDate = new Date();
  birthDate.setMonth(birthDate.getMonth() - 8);
  const childId = await signUpAndCreateChild(page, 'Emma', birthDate.toISOString().slice(0, 10));
  await dismissWelcomeIfPresent(page);
  return childId;
}

async function logRepas(page: Page, childId: string, aliments: string[]): Promise<void> {
  await page.goto(`/child/${childId}/log`);
  await awaitHydration(page);
  for (const name of aliments) {
    await page.getByPlaceholder('Rechercher un aliment…').fill(name);
    await page
      .getByRole('button', { name: new RegExp(`^${name}`) })
      .first()
      .click();
  }
  await expect(page.locator('input[type="hidden"][name="foodId"]')).toHaveCount(aliments.length);
  await page.getByRole('button', { name: 'Enregistrer', exact: true }).click();
  // The dashboard strips the milestone query once it has celebrated.
  await expect(page).toHaveURL(new RegExp(`/child/${childId}(\\?.*)?$`));
}

// The id an edit link of the dashboard's recent feed points to.
async function feedEntryId(page: Page, childId: string, testId: string): Promise<string> {
  await page.goto(`/child/${childId}`);
  const href = await page.getByTestId(testId).first().getAttribute('href');
  const id = href?.match(/\/(?:foods|log)\/(\d+)/)?.[1];
  if (!id) throw new Error(`no entry link in ${href}`);
  return id;
}

function reactionOption(page: Page, name: string, value: string) {
  return page
    .locator('label')
    .filter({ has: page.locator(`input[name="${name}"][value="${value}"]`) });
}

test('edits a standalone repas and lands back on its detail page', async ({ page }) => {
  const childId = await childOfEightMonths(page);
  await logRepas(page, childId, ['Poire']);
  const entryId = await feedEntryId(page, childId, 'feed-row-detail');

  await page.goto(`/child/${childId}/log/${entryId}?from=detail`);
  await awaitHydration(page);
  await expect(page.getByRole('heading', { name: 'Modifier ce repas' })).toBeVisible();
  await reactionOption(page, 'reaction', 'inconfort').click();
  await page.getByLabel('Note').fill('A grimacé');
  await page.getByRole('button', { name: 'Enregistrer', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/child/${childId}/foods/${entryId}$`));

  await page.goto(`/child/${childId}/log/${entryId}`);
  await awaitHydration(page);
  await expect(page.locator('input[name="reaction"][value="inconfort"]')).toBeChecked();
  await expect(page.locator('input[name="reactionLoaded"]')).toHaveValue('inconfort');
  await expect(page.getByLabel('Note')).toHaveValue('A grimacé');

  // A refused edit stays on the editor with its error (same entry: the
  // layout's per-entry key must not remount and drop the form result), and
  // writes nothing.
  await page.getByLabel('Quand ?').fill('2099-01-01T10:00');
  await page.getByLabel('Note').fill('jamais enregistré');
  await page.getByRole('button', { name: 'Enregistrer', exact: true }).click();
  await expect(page.getByText('La date du repas ne peut pas être dans le futur.')).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/child/${childId}/log/${entryId}$`));
  await page.reload();
  await expect(page.getByLabel('Note')).toHaveValue('A grimacé');
});

test('edits a meal, removes an aliment, then deletes the meal', async ({ page }) => {
  const childId = await childOfEightMonths(page);
  await logRepas(page, childId, ['Poire', 'Pomme', 'Carotte']);
  const anchorId = await feedEntryId(page, childId, 'feed-row-edit');

  await page.goto(`/child/${childId}/log/${anchorId}?from=dashboard`);
  await awaitHydration(page);
  await expect(page.getByRole('heading', { name: 'Modifier le repas' })).toBeVisible();
  const remove = page.getByRole('button', { name: 'Retirer', exact: true });
  await expect(remove).toHaveCount(3);
  await page.getByLabel('Note').fill('Repas du midi');
  await page.getByRole('button', { name: 'Enregistrer', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/child/${childId}$`));

  // Remove the aliment the editor was opened on: it lands on a survivor.
  await page.goto(`/child/${childId}/log/${anchorId}`);
  await awaitHydration(page);
  await expect(page.getByLabel('Note')).toHaveValue('Repas du midi');
  await remove.first().click();
  const removeDialog = page.getByRole('dialog');
  await expect(removeDialog).toContainText('du repas ?');
  await removeDialog.getByRole('button', { name: 'Retirer', exact: true }).click();
  await expect(page).not.toHaveURL(new RegExp(`/log/${anchorId}$`));
  await expect(page).toHaveURL(new RegExp(`/child/${childId}/log/\\d+$`));
  await expect(remove).toHaveCount(2);

  await page.getByRole('button', { name: 'Supprimer le repas', exact: true }).click();
  const deleteDialog = page.getByRole('dialog');
  await deleteDialog.getByRole('button', { name: 'Supprimer le repas', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/child/${childId}/foods$`));
  await page.goto(`/child/${childId}`);
  await expect(page.getByTestId('feed-row-edit')).toHaveCount(0);
});
