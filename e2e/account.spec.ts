import { test, expect, type Page } from '@playwright/test';
import { awaitHydration, openWithoutJavaScript, signUp, SIGNUP_PASSWORD } from './_helpers';

const NEW_PASSWORD = 'correct-horse-battery';

const changeButton = (page: Page) => page.getByRole('button', { name: 'Modifier', exact: true });

async function fillPasswordChange(page: Page, current: string) {
  await page.getByLabel('Mot de passe actuel', { exact: true }).fill(current);
  await page.getByLabel('Nouveau mot de passe', { exact: true }).fill(NEW_PASSWORD);
}

test.describe('account messages without JavaScript', () => {
  test('the password page says why a change was refused, then that it worked', async ({
    browser,
    page
  }) => {
    await signUp(page, 'password-nojs');
    const noJs = await openWithoutJavaScript(browser, page);
    try {
      await noJs.goto('/account/password');
      await fillPasswordChange(noJs, 'wrong-password-123');
      await changeButton(noJs).click();
      await expect(noJs.getByRole('alert')).toHaveText('Mot de passe actuel incorrect.');

      await fillPasswordChange(noJs, SIGNUP_PASSWORD);
      await changeButton(noJs).click();
      await expect(noJs.getByRole('status')).toHaveText('Mot de passe modifié.');
      await expect(noJs.getByRole('alert')).toHaveCount(0);
    } finally {
      await noJs.context().close();
    }
  });

  test('the profile page says why a name was refused, then that it was saved', async ({
    browser,
    page
  }) => {
    await signUp(page, 'profile-nojs');
    const noJs = await openWithoutJavaScript(browser, page);
    try {
      await noJs.goto('/account/profile');
      const name = noJs.getByLabel('Nom affiché');
      // The browser's own `required` check would stop an empty name before
      // the server could refuse it.
      await name.evaluate((input) => input.removeAttribute('required'));
      await name.fill('');
      await noJs.getByRole('button', { name: 'Enregistrer', exact: true }).click();
      await expect(noJs.getByRole('alert')).toHaveText('Nom invalide.');

      await noJs.getByLabel('Nom affiché').fill('Camille');
      await noJs.getByRole('button', { name: 'Enregistrer', exact: true }).click();
      await expect(noJs.getByRole('status')).toHaveText('Profil mis à jour.');
      // Reload before reading the field: the page rendered with the action
      // still shows the old name.
      await noJs.goto('/account/profile');
      await expect(noJs.getByLabel('Nom affiché')).toHaveValue('Camille');
    } finally {
      await noJs.context().close();
    }
  });
});

test.describe('account messages with JavaScript', () => {
  test('the password page shows each result once', async ({ page }) => {
    await signUp(page, 'password-js');
    await page.goto('/account/password');
    await awaitHydration(page);

    await fillPasswordChange(page, 'wrong-password-123');
    await changeButton(page).click();
    await expect(page.getByRole('alert')).toHaveText('Mot de passe actuel incorrect.');
    // The button reads « Modifier » again once the result has been applied.
    // Count right then: a toast would expire within 4 s and a retrying
    // assertion would wait it out (docs/agents/testing.md).
    await expect(changeButton(page)).toBeEnabled();
    expect(await page.getByText('Mot de passe actuel incorrect.').count()).toBe(1);

    await fillPasswordChange(page, SIGNUP_PASSWORD);
    await changeButton(page).click();
    await expect(page.getByRole('status')).toHaveText('Mot de passe modifié.');
    await expect(changeButton(page)).toBeEnabled();
    expect(await page.getByText('Mot de passe modifié.').count()).toBe(1);
    expect(await page.getByText('Mot de passe actuel incorrect.').count()).toBe(0);
  });
});
