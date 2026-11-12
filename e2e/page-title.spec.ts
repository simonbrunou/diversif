import { test, expect, type Page } from '@playwright/test';
import {
  awaitHydration,
  birthDateMonthsAgo,
  createChild,
  openWithoutJavaScript,
  signUpAndCreateChild
} from './_helpers';

// A document names itself with its first <title>, so a page that served the
// app-wide title before its own read as the app-wide one without JavaScript
// (#483). Every page serves exactly one, and it is the page's own (#597).
const LOGIN_TITLE = 'Connexion';
const GUIDE_TITLE = 'Guide de la diversification alimentaire : bébé de 4 mois à 3 ans · Diversif';
const INVITE_TITLE = 'Invitation · Diversif';
// Fails the invite-code format check, so /join renders its error card for an
// anonymous visitor instead of redirecting to /signup.
const INVITE_PATH = '/join/nope';

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

  test('the invite page serves only its own title', async ({ browser, page }) => {
    const noJs = await openWithoutJavaScript(browser, page);
    try {
      await noJs.goto(INVITE_PATH);
      await expect(noJs.getByRole('heading', { name: 'Invitation', exact: true })).toBeVisible();
      await expect(headTitles(noJs)).toHaveCount(1);
      await expect(noJs).toHaveTitle(INVITE_TITLE);
    } finally {
      await noJs.context().close();
    }
  });

  test('a signed-in page serves only its own title, a child page with the name', async ({
    browser,
    page
  }) => {
    // A signup and three pages. Runs 400 and 403: 6.9 s, then 35.3 s
    // (timeout) and 28.8 s on the retry, on desktop (1.4 s locally). In run
    // 403 no other diversif E2E job ran, but cinder's test jobs shared the
    // runner.
    test.slow();
    const childId = await signUpAndCreateChild(page, 'Emma', birthDateMonthsAgo(8), 'title-own');
    const noJs = await openWithoutJavaScript(browser, page);
    try {
      await noJs.goto(`/child/${childId}/foods`);
      await expect(noJs.getByRole('heading', { name: 'Emma', exact: true })).toBeAttached();
      await expect(headTitles(noJs)).toHaveCount(1);
      await expect(noJs).toHaveTitle('Carnet : Emma · Diversif');

      // English punctuates the framing its own way: no space before the colon.
      await noJs.goto(`/en/child/${childId}/foods`);
      await expect(noJs.locator('html')).toHaveAttribute('lang', 'en');
      await expect(headTitles(noJs)).toHaveCount(1);
      await expect(noJs).toHaveTitle('Log: Emma · Diversif');

      await noJs.goto('/account/password');
      await expect(noJs.getByLabel('Mot de passe actuel', { exact: true })).toBeVisible();
      await expect(headTitles(noJs)).toHaveCount(1);
      await expect(noJs).toHaveTitle('Mot de passe · Diversif');
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

      // English punctuates the framing its own way: no space before the colon.
      await noJs.goto(`/en/child/${childId}/report`);
      await expect(noJs.locator('html')).toHaveAttribute('lang', 'en');
      await expect(noJs.getByRole('button', { name: /print/i })).toBeVisible();
      await expect(headTitles(noJs)).toHaveCount(1);
      await expect(noJs).toHaveTitle('Pediatrician summary: Emma · Diversif');
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
    await page.getByLabel('Adresse e-mail', { exact: true }).fill('nobody-title@example.com');
    await page.getByLabel('Mot de passe', { exact: true }).fill('wrong-pass');
    await page.getByRole('button', { name: 'Se connecter', exact: true }).click();
    await expect(page.getByRole('alert')).toHaveText('Adresse e-mail ou mot de passe incorrect.');
    await expect(page).toHaveTitle(LOGIN_TITLE);

    // A navigation that stays on the route does not remount the page.
    await followLink(page, '/login?e2e=title');
    await expect(page).toHaveURL(/\/login\?e2e=title$/);
    await expect(page).toHaveTitle(LOGIN_TITLE);

    await followLink(page, INVITE_PATH);
    await expect(page.getByRole('heading', { name: 'Invitation', exact: true })).toBeVisible();
    await expect(page).toHaveTitle(INVITE_TITLE);

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
    await expect(page).toHaveTitle(INVITE_TITLE);

    await page.goForward();
    await expect(page).toHaveURL(/\/guide$/);
    await expect(page).toHaveTitle(GUIDE_TITLE);

    await expect(page.locator('html[data-e2e-same-page]')).toHaveCount(1);
  });

  test("follows the child's name to another child's page on the same route", async ({ page }) => {
    const emmaId = await signUpAndCreateChild(page, 'Emma', birthDateMonthsAgo(8), 'title-kids');
    const leoId = await createChild(page, 'Léo', birthDateMonthsAgo(10));

    await page.goto(`/child/${emmaId}/foods`);
    await awaitHydration(page);
    await expect(page).toHaveTitle('Carnet : Emma · Diversif');
    await page.evaluate(() => document.documentElement.setAttribute('data-e2e-same-page', ''));

    // The same route with another id: SvelteKit keeps the page mounted.
    await followLink(page, `/child/${leoId}/foods`);
    await expect(page).toHaveURL(new RegExp(`/child/${leoId}/foods$`));
    await expect(page.getByRole('heading', { name: 'Léo', exact: true })).toBeAttached();
    await expect(page).toHaveTitle('Carnet : Léo · Diversif');

    await expect(page.locator('html[data-e2e-same-page]')).toHaveCount(1);
  });
});
