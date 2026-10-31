import { test, expect, type Page } from '@playwright/test';
import { awaitHydration } from './_helpers';

// Boot recovery (src/lib/boot-recovery.ts): when the root layout chunk fails
// to load, SvelteKit never starts. The page reloads once, and a failure that
// lasts, or an offline browser, gets a banner instead of a dead page. Only a
// real browser runs the inline bootstrap, so this is the test that proves the
// listener is in place before kit.start().

// A service worker would answer the chunk from its precache, around the route.
test.use({ serviceWorkers: 'block' });

const ROOT_LAYOUT_CHUNK = '**/_app/immutable/nodes/0.*.js';
const BANNER_TEXT = 'Impossible de joindre le serveur';

/** Fails the root layout chunk the first `times` it is requested. */
async function failRootLayout(page: Page, times: number) {
  let failed = 0;
  await page.route(ROOT_LAYOUT_CHUNK, (route) =>
    failed++ < times ? route.abort('failed') : route.continue()
  );
}

/** Counts top-level document loads, i.e. the first visit plus every reload. */
function countDocumentLoads(page: Page) {
  const loads = { count: 0 };
  page.on('request', (request) => {
    if (request.isNavigationRequest() && request.frame() === page.mainFrame()) loads.count++;
  });
  return loads;
}

test('reloads once when the root layout chunk fails, then starts', async ({ page }) => {
  await failRootLayout(page, 1);
  const loads = countDocumentLoads(page);

  await page.goto('/');

  await awaitHydration(page);
  expect(loads.count).toBe(2);
  // eslint-disable-next-line e2e/exact-get-by-text -- an absence check: BANNER_TEXT starts the banner's longer message
  await expect(page.getByText(BANNER_TEXT)).toHaveCount(0);
});

test('shows the banner after one reload when the chunk keeps failing', async ({ page }) => {
  await failRootLayout(page, Infinity);
  const loads = countDocumentLoads(page);

  await page.goto('/');

  await expect(page.getByRole('alert').filter({ hasText: BANNER_TEXT })).toBeVisible();
  // No further reload once the banner is up.
  await page.waitForTimeout(1000);
  expect(loads.count).toBe(2);
});

test('shows the banner without reloading when the browser is offline', async ({ page }) => {
  // context.setOffline would fail the page itself; boot recovery reads the property.
  await page.addInitScript(() =>
    Object.defineProperty(navigator, 'onLine', { get: () => false, configurable: true })
  );
  await failRootLayout(page, Infinity);
  const loads = countDocumentLoads(page);

  await page.goto('/');

  await expect(page.getByRole('alert').filter({ hasText: BANNER_TEXT })).toBeVisible();
  await page.waitForTimeout(1000);
  expect(loads.count).toBe(1);
});
