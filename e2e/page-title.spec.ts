import { test, expect, type Page } from '@playwright/test';
import {
  awaitHydration,
  birthDateMonthsAgo,
  openWithoutJavaScript,
  signUpAndCreateChild
} from './_helpers';

// A document names itself with its first <title>, so a page that served the
// app-wide title before its own read as the app-wide one without JavaScript
// (#483). Every page serves exactly one.
const APP_TITLE = 'Diversif · Diversification alimentaire bébé';
const LOGIN_TITLE = 'Connexion';
const GUIDE_TITLE = 'Guide de la diversification alimentaire : bébé de 4 mois à 3 ans · Diversif';
// Fails the invite-code format check, so /join renders its error card for an
// anonymous visitor instead of redirecting to /signup, which has a title.
const NO_TITLE_PATH = '/join/nope';

const headTitles = (page: Page) => page.locator('head > title');

/** A client-side navigation: SvelteKit routes a click on any anchor in the document. */
async function followLink(page: Page, href: string): Promise<void> {
  await page.evaluate((target) => {
    const link = document.createElement('a');
    link.href = target;
    document.body.append(link);
    link.click();
    link.remove();
  }, href);
}

test.describe('document title without JavaScript', () => {
  test('a page with Seo serves only its own title', async ({ browser, page }) => {
    const noJs = await openWithoutJavaScript(browser, page);
    try {
      await noJs.goto('/login');
      await expect(headTitles(noJs)).toHaveCount(1);
      await expect(noJs).toHaveTitle(LOGIN_TITLE);
    } finally {
      await noJs.context().close();
    }
  });

  // A guard rather than a repro: this page served one title before #483 too.
  test('a page without a title of its own serves only the app-wide title', async ({
    browser,
    page
  }) => {
    const noJs = await openWithoutJavaScript(browser, page);
    try {
      await noJs.goto(NO_TITLE_PATH);
      await expect(noJs.getByRole('heading', { name: 'Invitation', exact: true })).toBeVisible();
      await expect(headTitles(noJs)).toHaveCount(1);
      await expect(noJs).toHaveTitle(APP_TITLE);
    } finally {
      await noJs.context().close();
    }
  });

  test('the child report print page serves only its own title', async ({ browser, page }) => {
    const childId = await signUpAndCreateChild(page, 'Emma', birthDateMonthsAgo(8), 'title-nojs');
    const noJs = await openWithoutJavaScript(browser, page);
    try {
      await noJs.goto(`/child/${childId}/report`);
      await expect(noJs.getByRole('button', { name: /imprimer/i })).toBeVisible();
      await expect(headTitles(noJs)).toHaveCount(1);
      await expect(noJs).toHaveTitle('Bilan pour le pédiatre : Emma · Diversif');
    } finally {
      await noJs.context().close();
    }
  });
});

test.describe('document title with JavaScript', () => {
  test('follows the current page across client navigations', async ({ page }) => {
    await page.goto('/login');
    await awaitHydration(page);
    // A full reload would also serve the right title; this mark proves every
    // step below stayed a client navigation.
    await page.evaluate(() => document.documentElement.setAttribute('data-e2e-same-page', ''));

    // The first two steps pass on main too: they guard against a fix that
    // resets the title on every navigation. A refused login re-renders the
    // form on the same route.
    await page.getByLabel('Adresse e-mail').fill('nobody-title@example.com');
    await page.getByLabel('Mot de passe', { exact: true }).fill('wrong-pass');
    await page.getByRole('button', { name: 'Se connecter', exact: true }).click();
    await expect(page.getByRole('alert')).toHaveText('Adresse e-mail ou mot de passe incorrect.');
    await expect(page).toHaveTitle(LOGIN_TITLE);

    // A navigation that stays on the route does not remount the page.
    await followLink(page, '/login?e2e=title');
    await expect(page).toHaveURL(/\/login\?e2e=title$/);
    await expect(page).toHaveTitle(LOGIN_TITLE);

    await followLink(page, NO_TITLE_PATH);
    await expect(page.getByRole('heading', { name: 'Invitation', exact: true })).toBeVisible();
    await expect(page).toHaveTitle(APP_TITLE);

    await followLink(page, '/guide');
    await expect(page).toHaveURL(/\/guide$/);
    await expect(page).toHaveTitle(GUIDE_TITLE);

    await followLink(page, '/login');
    await expect(page).toHaveURL(/\/login$/);
    await expect(page).toHaveTitle(LOGIN_TITLE);

    await page.goBack();
    await expect(page).toHaveURL(/\/guide$/);
    await expect(page).toHaveTitle(GUIDE_TITLE);

    await page.goBack();
    await expect(page.getByRole('heading', { name: 'Invitation', exact: true })).toBeVisible();
    await expect(page).toHaveTitle(APP_TITLE);

    await page.goForward();
    await expect(page).toHaveURL(/\/guide$/);
    await expect(page).toHaveTitle(GUIDE_TITLE);

    await expect(page.locator('html[data-e2e-same-page]')).toHaveCount(1);
  });
});
