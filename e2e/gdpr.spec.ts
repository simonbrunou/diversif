import { test, expect, type Page } from '@playwright/test';
import { awaitHydration, signUp, unique } from './_helpers';

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
    await page.getByLabel('Mot de passe', { exact: true }).fill('hunter2-very-long');
    await page.getByRole('button', { name: /créer mon compte/i }).click();
    // Browsers block submission for unticked required checkboxes; URL stays on /signup.
    await expect(page).toHaveURL(/\/signup/);
  });
});

const DELETE_SENTINEL = '/e2e-delete-sentinel';

// Opens the hydrated deletion form and fills it, ready to submit.
async function fillAccountDeletion(page: Page, email: string) {
  await page.goto('/account/delete');
  await awaitHydration(page);
  await page.getByLabel(/Saisissez votre adresse e-mail/i).fill(email);
  await page.getByLabel(/Confirmez avec votre mot de passe/i).fill('hunter2-very-long');
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
    await page.getByRole('button', { name: /Supprimer définitivement/i }).click();
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
    // changes. maxRedirects: 0 keeps a native 303 (form no longer enhanced)
    // visible to the browser instead of silently following it.
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
    await page.getByRole('button', { name: /Supprimer définitivement/i }).click();
    await expect(page).toHaveURL(/\/account\/deleted/, { timeout: 15_000 });
    expect(clearSiteData).toBe('"cache", "storage"');
    // The root layout's authenticated→anonymous purge is fire-and-forget,
    // hence the poll.
    await expect.poll(() => deleteSentinelSurvives(page)).toBe(false);
  });

  test('Clear-Site-Data alone wipes the pages cache on account deletion', async ({ page }) => {
    const email = await signUp(page, 'rgpd-header');
    await fillAccountDeletion(page, email);
    await seedDeleteSentinel(page);
    // Native submit, as without JS: form.submit() skips use:enhance, the 303
    // loads /account/deleted as a fresh document and the root layout never
    // sees an authenticated→anonymous transition, so only the header can
    // remove the sentinel.
    await page.evaluate(() => {
      (document.getElementById('confirmEmail') as HTMLInputElement).form!.submit();
    });
    await expect(page).toHaveURL(/\/account\/deleted/, { timeout: 15_000 });
    await expect.poll(() => deleteSentinelSurvives(page)).toBe(false);
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
