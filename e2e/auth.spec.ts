import { test, expect } from '@playwright/test';
import { signUp } from './_helpers';

test.describe('signup → onboarding', () => {
  test('signup creates an account and redirects to onboarding @responsive', async ({ page }) => {
    const submitButton = page.getByRole('button', { name: /créer mon compte/i });
    await signUp(page, 'user', {
      displayName: 'Test Parent',
      // Assert right before the click, after the form is filled — this is
      // what actually catches a mobile on-screen keyboard pushing the
      // submit button out of view.
      beforeSubmit: async () => {
        await expect(submitButton).toBeInViewport();
      }
    });
  });

  test('rejects invalid login @responsive', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Adresse e-mail').fill('nobody-12345@example.com');
    await page.getByLabel('Mot de passe', { exact: true }).fill('wrong-pass');
    await page.getByRole('button', { name: 'Se connecter', exact: true }).click();
    await expect(page.locator('body')).toContainText(/incorrect/i);
  });
});

test.describe('logout', () => {
  test('purges the service-worker pages cache on logout', async ({ page }) => {
    await signUp(page, 'logout');
    await page.goto('/account/sessions');
    // Seed a sentinel into the SW runtime cache : asserting on the sentinel
    // (instead of `caches.keys()`) keeps the test robust if the service
    // worker re-caches /login right after the redirect lands.
    await page.evaluate(async () => {
      const cache = await caches.open('pages');
      await cache.put('/e2e-logout-sentinel', new Response('private'));
    });
    await page.getByRole('button', { name: 'Se déconnecter', exact: true }).click();
    await expect(page).toHaveURL(/\/login/);
    // Covered by both layers: purgeBeforeSubmit deletes the 'pages' cache
    // before the POST, and the 303 carries Clear-Site-Data for Chromium.
    const sentinelSurvived = await page.evaluate(async () =>
      Boolean(await caches.match('/e2e-logout-sentinel'))
    );
    expect(sentinelSurvived).toBe(false);
  });
});
