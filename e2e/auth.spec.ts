import { test, expect } from '@playwright/test';
import { awaitHydration, openWithoutJavaScript, signUp } from './_helpers';

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

  test('re-inserts the login alert on a second identical refusal, so it is announced again', async ({
    page
  }) => {
    // Real-browser check that a repeated refusal gets a new alert node (#470).
    // applyAction passes `form` through null between results, so this passes
    // even without FormError's `{#key form}`; it fails only against a FormError
    // that renders its alert element all the time. The key itself is covered
    // by FormError.test.ts.
    await page.goto('/login');
    await awaitHydration(page);
    // A full reload would also replace the alert; this mark proves the page stayed.
    await page.evaluate(() => document.documentElement.setAttribute('data-e2e-same-page', ''));
    const email = page.getByLabel('Adresse e-mail');
    const password = page.getByLabel('Mot de passe', { exact: true });
    const submit = page.getByRole('button', { name: 'Se connecter', exact: true });
    const refusal = 'Adresse e-mail ou mot de passe incorrect.';

    // An alert inserted with JavaScript leaves focus alone (#469). The submit
    // button turns disabled while the request runs, which drops focus to the
    // body, where an autofocused alert would take it.
    const alertHasFocus = () =>
      page.getByRole('alert').evaluate((el) => el === document.activeElement);

    await email.fill('nobody-reinsert@example.com');
    await password.fill('wrong-pass');
    await submit.click();
    await expect(page.getByRole('alert')).toHaveText(refusal);
    expect(await page.getByRole('alert').count()).toBe(1);
    expect(await alertHasFocus()).toBe(false);
    await page.getByRole('alert').evaluate((el) => el.setAttribute('data-e2e-first', ''));

    await password.fill('wrong-pass');
    await submit.click();
    await expect(page.locator('[role="alert"]:not([data-e2e-first])')).toHaveText(refusal);
    expect(await page.getByRole('alert').count()).toBe(1);
    expect(await alertHasFocus()).toBe(false);
    await expect(page.locator('html[data-e2e-same-page]')).toHaveCount(1);
  });
});

test.describe('login without JavaScript', () => {
  test('a refused login moves focus to the alert, so screen readers read it (#469)', async ({
    browser,
    page
  }) => {
    const noJs = await openWithoutJavaScript(browser, page);
    try {
      await noJs.goto('/login');
      await noJs.getByLabel('Adresse e-mail').fill('nobody-nojs@example.com');
      await noJs.getByLabel('Mot de passe', { exact: true }).fill('wrong-pass');
      await noJs.getByRole('button', { name: 'Se connecter', exact: true }).click();
      const alert = noJs.getByRole('alert');
      await expect(alert).toHaveText('Adresse e-mail ou mot de passe incorrect.');
      await expect(alert).toBeFocused();
    } finally {
      await noJs.context().close();
    }
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
