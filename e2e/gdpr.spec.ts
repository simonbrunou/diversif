import { test, expect, type Page } from '@playwright/test';
import { awaitHydration, openWithoutJavaScript, signUp, SIGNUP_PASSWORD, unique } from './_helpers';

test.describe('legal pages', () => {
  test('public legal pages are reachable from the footer', async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/');
    for (const path of ['/mentions-legales', '/politique-confidentialite', '/cgu', '/cookies']) {
      await page.goto(path);
      await expect(page.locator('h1')).toBeVisible();
    }
  });

  test('legal pages render with placeholder when env vars are unset', async ({ page }) => {
    await page.goto('/mentions-legales');
    await expect(page.locator('body')).toContainText(/à compléter/i);
  });
});

test.describe('signup consent gates', () => {
  test('signup is blocked without the consent checkboxes', async ({ page }) => {
    const email = `${unique('blocked')}@example.com`;
    await page.goto('/signup');
    await awaitHydration(page);
    await page.getByLabel('Votre prénom').fill('Sans consentement');
    await page.getByLabel('Adresse e-mail').fill(email);
    await page.getByLabel('Mot de passe', { exact: true }).fill(SIGNUP_PASSWORD);
    await page.getByRole('button', { name: /créer mon compte/i }).click();
    // Browsers block submission for unticked required checkboxes; URL stays on /signup.
    await expect(page).toHaveURL(/\/signup/);
  });
});

const DELETE_SENTINEL = '/e2e-delete-sentinel';

const deleteButton = (page: Page) =>
  page.getByRole('button', { name: /Supprimer définitivement/i });

async function fillDeletionFields(page: Page, email: string, password = SIGNUP_PASSWORD) {
  await page.getByLabel(/Saisissez votre adresse e-mail/i).fill(email);
  await page.getByLabel(/Confirmez avec votre mot de passe/i).fill(password);
}

// Opens the hydrated deletion form and fills it, ready to submit. Hydrated,
// the button waits for the typed email and a password.
async function fillAccountDeletion(page: Page, email: string) {
  await page.goto('/account/delete');
  await awaitHydration(page);
  await expect(deleteButton(page)).toBeDisabled();
  await fillDeletionFields(page, email);
  await expect(deleteButton(page)).toBeEnabled();
}

// Same sentinel approach as the logout purge test in auth.spec.ts.
async function seedDeleteSentinel(page: Page) {
  await page.evaluate(async (url) => {
    const cache = await caches.open('pages');
    await cache.put(url, new Response('private'));
  }, DELETE_SENTINEL);
}

function deleteSentinelSurvives(page: Page) {
  return page.evaluate(async (url) => Boolean(await caches.match(url)), DELETE_SENTINEL);
}

test.describe('account deletion', () => {
  test('user can delete their account and the email is reusable', async ({ page }) => {
    const email = await signUp(page, 'rgpd', { displayName: 'RGPD Tester' });

    await fillAccountDeletion(page, email);
    await deleteButton(page).click();
    await expect(page).toHaveURL(/\/account\/deleted/, { timeout: 15_000 });

    await page.context().clearCookies();
    await signUp(page, 'rgpd', { displayName: 'RGPD Tester', email });
  });

  test('sends Clear-Site-Data and purges the pages cache on account deletion', async ({ page }) => {
    const email = await signUp(page, 'rgpd-purge');
    await fillAccountDeletion(page, email);
    await seedDeleteSentinel(page);
    // Record the server's Clear-Site-Data, then strip it so the browser
    // can't act on it, as Safari may not: only the client-side purge may then
    // remove the sentinel. Chromium under Playwright already ignores the
    // header on fulfilled responses; the strip keeps the test honest if that
    // changes. maxRedirects: 0 keeps a native 303 (should the form stop being
    // enhanced) visible to the browser instead of silently following it.
    let clearSiteData: string | undefined;
    await page.route(
      (url) => url.pathname === '/account/delete',
      async (route) => {
        if (route.request().method() !== 'POST') return route.continue();
        const response = await route.fetch({ maxRedirects: 0 });
        const headers = response.headers();
        clearSiteData = headers['clear-site-data'];
        delete headers['clear-site-data'];
        await route.fulfill({ response, headers });
      }
    );
    await deleteButton(page).click();
    await expect(page).toHaveURL(/\/account\/deleted/, { timeout: 15_000 });
    expect(clearSiteData).toBe('"cache", "storage"');
    // The root layout's authenticated→anonymous purge is fire-and-forget,
    // hence the poll.
    await expect.poll(() => deleteSentinelSurvives(page)).toBe(false);
  });
});

// The right to erasure must not depend on JavaScript loading (#453).
test.describe('account deletion without JavaScript', () => {
  test('deletes the account, and Clear-Site-Data alone wipes the pages cache', async ({
    browser,
    page
  }) => {
    const email = await signUp(page, 'rgpd-nojs');
    const noJs = await openWithoutJavaScript(browser, page);
    try {
      await noJs.goto('/account/delete');
      await seedDeleteSentinel(noJs);
      await fillDeletionFields(noJs, email);
      const deletion = noJs.waitForResponse(
        (r) => r.request().method() === 'POST' && new URL(r.url()).pathname === '/account/delete'
      );
      await deleteButton(noJs).click();
      const response = await deletion;
      expect(response.status()).toBe(303);
      // headerValue reads the raw headers; headers() drops security ones.
      expect(await response.headerValue('clear-site-data')).toBe('"cache", "storage"');
      await expect(noJs).toHaveURL(/\/account\/deleted/, { timeout: 15_000 });
      // With JavaScript off the root layout's client-side purge never runs,
      // so only the header can have removed the sentinel.
      await expect.poll(() => deleteSentinelSurvives(noJs)).toBe(false);

      // The account is gone: its password no longer signs in.
      await noJs.goto('/login');
      await noJs.getByLabel('Adresse e-mail').fill(email);
      await noJs.getByLabel('Mot de passe', { exact: true }).fill(SIGNUP_PASSWORD);
      await noJs.getByRole('button', { name: 'Se connecter', exact: true }).click();
      await expect(noJs.getByRole('alert')).toHaveText('Adresse e-mail ou mot de passe incorrect.');
      await expect(noJs).toHaveURL(/\/login(?:[?#]|$)/);
    } finally {
      await noJs.context().close();
    }
  });

  test('a refused deletion shows why on the re-rendered page and keeps the account', async ({
    browser,
    page
  }) => {
    const email = await signUp(page, 'rgpd-nojs-refused');
    const noJs = await openWithoutJavaScript(browser, page);
    try {
      await noJs.goto('/account/delete');
      await fillDeletionFields(noJs, 'autre@example.com');
      await deleteButton(noJs).click();
      await expect(noJs.getByRole('alert')).toHaveText(
        'Saisissez votre adresse e-mail exacte pour confirmer.'
      );
      // A server-rendered alert takes focus, so screen readers read it (#469).
      await expect(noJs.getByRole('alert')).toBeFocused();
      // The wrong address stays, so it can be corrected; the password never does (#471).
      const emailField = noJs.getByLabel(/Saisissez votre adresse e-mail/i);
      const passwordField = noJs.getByLabel(/Confirmez avec votre mot de passe/i);
      await expect(emailField).toHaveValue('autre@example.com');
      await expect(passwordField).toHaveValue('');

      await fillDeletionFields(noJs, email, 'wrong-password-123');
      await deleteButton(noJs).click();
      await expect(noJs.getByRole('alert')).toHaveText('Mot de passe actuel incorrect.');
      await expect(noJs.getByRole('alert')).toBeFocused();
      await expect(emailField).toHaveValue(email);
      await expect(passwordField).toHaveValue('');

      // Deleting the account would have ended this session too.
      await noJs.goto('/account/delete');
      await expect(noJs).toHaveURL(/\/account\/delete$/);
      await expect(deleteButton(noJs)).toBeEnabled();
    } finally {
      await noJs.context().close();
    }
  });
});

test.describe('data export', () => {
  test('export endpoint returns JSON for the authenticated user', async ({ page }) => {
    const email = await signUp(page, 'export', { displayName: 'RGPD Tester' });

    const response = await page.request.get('/account/export');
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('application/json');
    expect(response.headers()['content-disposition']).toContain('attachment');
    const body = await response.json();
    expect(body.profile.email).toBe(email);
    expect(body.generator).toBe('diversif');
  });
});
