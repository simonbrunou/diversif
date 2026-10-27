import { test, expect, type Locator, type Page } from '@playwright/test';
import {
  awaitHydration,
  birthDateMonthsAgo,
  countText,
  openWithoutJavaScript,
  signUpAndCreateChild,
  SIGNUP_PASSWORD
} from './_helpers';

// Child settings shows each action's result next to its own form (#484).
// Two forms on the page have a « Enregistrer » button, and each card that
// shows a success keeps an empty status region, so locators are scoped to a
// form and successes are read by their text.

async function openSettings(page: Page, emailPrefix: string): Promise<string> {
  const childId = await signUpAndCreateChild(page, 'Lulu', birthDateMonthsAgo(7), emailPrefix);
  await page.goto(`/child/${childId}/settings`);
  await awaitHydration(page);
  return childId;
}

const childForm = (page: Page) => page.locator('form[action="?/updateChild"]');
const dietForm = (page: Page) => page.locator('form[action="?/setDiet"]');
const saveButton = (form: Locator) =>
  form.getByRole('button', { name: 'Enregistrer', exact: true });

// The browser's own `required` check would stop an empty name before the
// server could refuse it.
async function submitEmptyName(page: Page) {
  const name = childForm(page).getByLabel('Prénom', { exact: true });
  await name.evaluate((input) => input.removeAttribute('required'));
  await name.fill('');
  await saveButton(childForm(page)).click();
}

async function submitInviteDialog(page: Page, password: string) {
  await page.getByRole('button', { name: 'Générer un code', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Mot de passe', { exact: true }).fill(password);
  await dialog.getByRole('button', { name: 'Générer un code', exact: true }).click();
  return dialog;
}

test.describe('child settings messages without JavaScript', () => {
  test('the native forms say why a change was refused, or that it was saved', async ({
    browser,
    page
  }) => {
    const childId = await openSettings(page, 'settings-nojs');
    // Generating a code goes through a dialog, which needs JavaScript.
    const dialog = await submitInviteDialog(page, SIGNUP_PASSWORD);
    await expect(dialog).toBeHidden();
    await expect(page.getByRole('button', { name: 'Révoquer', exact: true })).toBeVisible();

    const noJs = await openWithoutJavaScript(browser, page);
    try {
      await noJs.goto(`/child/${childId}/settings`);
      await submitEmptyName(noJs);
      await expect(noJs.getByRole('alert')).toHaveText('Champs invalides.');

      await childForm(noJs).getByLabel('Prénom', { exact: true }).fill('Lola');
      await saveButton(childForm(noJs)).click();
      await expect(noJs.getByText('Enfant mis à jour.', { exact: true })).toBeVisible();
      await expect(noJs.getByRole('alert')).toHaveCount(0);
      await expect(childForm(noJs).getByLabel('Prénom', { exact: true })).toHaveValue('Lola');

      await dietForm(noJs).getByLabel('Végétarien').check();
      await saveButton(dietForm(noJs)).click();
      await expect(noJs.getByText('Régime alimentaire mis à jour.', { exact: true })).toBeVisible();
      await expect(dietForm(noJs).getByLabel('Végétarien')).toBeChecked();

      await noJs.getByRole('button', { name: 'Révoquer', exact: true }).click();
      await expect(noJs.getByText('Invitation révoquée.', { exact: true })).toBeVisible();
      await expect(noJs.getByRole('button', { name: 'Révoquer', exact: true })).toHaveCount(0);
    } finally {
      await noJs.context().close();
    }
  });
});

test.describe('child settings messages with JavaScript', () => {
  test('the child and diet forms show each result once', async ({ page }) => {
    await openSettings(page, 'settings-js');
    const childSave = saveButton(childForm(page));

    await submitEmptyName(page);
    await expect(page.getByRole('alert')).toHaveText('Champs invalides.');
    // The button reads « Enregistrer » again once the result has been
    // applied. Count right then.
    await expect(childSave).toBeEnabled();
    expect(await countText(page, 'Champs invalides.')).toBe(1);

    await childForm(page).getByLabel('Prénom', { exact: true }).fill('Lola');
    await childSave.click();
    await expect(page.getByText('Enfant mis à jour.', { exact: true })).toBeVisible();
    await expect(childSave).toBeEnabled();
    expect(await countText(page, 'Enfant mis à jour.')).toBe(1);
    expect(await countText(page, 'Champs invalides.')).toBe(0);

    const dietSave = saveButton(dietForm(page));
    await dietForm(page).getByLabel('Végétarien').check();
    await dietSave.click();
    await expect(page.getByText('Régime alimentaire mis à jour.', { exact: true })).toBeVisible();
    await expect(dietSave).toBeEnabled();
    expect(await countText(page, 'Régime alimentaire mis à jour.')).toBe(1);
    expect(await countText(page, 'Enfant mis à jour.')).toBe(0);
  });

  test('a refused code stays in its dialog, and a generated or revoked code shows once', async ({
    page
  }) => {
    await openSettings(page, 'settings-invite-js');

    // A refusal shows in the dialog, which stays open, and not on the page
    // behind it, not even after Cancel.
    const dialog = await submitInviteDialog(page, 'wrong-password-123');
    await expect(dialog.getByRole('alert')).toHaveText('Mot de passe actuel incorrect.');
    expect(await page.getByRole('alert').count()).toBe(1);
    expect(await countText(page, 'Mot de passe actuel incorrect.')).toBe(1);
    await dialog.getByRole('button', { name: 'Annuler', exact: true }).click();
    await expect(dialog).toBeHidden();
    expect(await countText(page, 'Mot de passe actuel incorrect.')).toBe(0);

    // The dialog closes before a generated code's result lands on the page.
    await submitInviteDialog(page, SIGNUP_PASSWORD);
    await expect(dialog).toBeHidden();
    await expect(page.getByText('Code généré.', { exact: true })).toBeVisible();
    expect(await countText(page, 'Code généré.')).toBe(1);

    // Revoking posts natively, so its result comes with a new page load.
    await page.getByRole('button', { name: 'Révoquer', exact: true }).click();
    await expect(page.getByText('Invitation révoquée.', { exact: true })).toBeVisible();
    await awaitHydration(page);
    expect(await countText(page, 'Invitation révoquée.')).toBe(1);
    expect(await countText(page, 'Code généré.')).toBe(0);
  });
});
