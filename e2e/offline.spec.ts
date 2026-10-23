import { test, expect, type Page } from '@playwright/test';
import { awaitHydration, signUpAndCreateChild } from './_helpers';

// Rows waiting in the offline queue's IndexedDB store.
function queuedRows(page: Page): Promise<number> {
  return page.evaluate(async () => {
    const dbReq = indexedDB.open('diversif-offline');
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      dbReq.onsuccess = () => resolve(dbReq.result);
      dbReq.onerror = () => reject(dbReq.error);
    });
    return new Promise<number>((resolve, reject) => {
      const tx = db.transaction('log', 'readonly');
      const req = tx.objectStore('log').count();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  });
}

// Smoke: when navigator.onLine is false, the log form's durable submit
// (src/lib/offline/submit.ts) must short-circuit, write to IDB, and surface
// the queued toast. The replay-on-online path is covered by the unit tests
// in src/lib/offline/, which replay against the real log action; end to end
// we only check that the layout turns a replay into the repas's milestone
// toast ("a queued first repas is celebrated when it replays on reconnect").
test('queues a log submission while offline', async ({ page }) => {
  const sevenMonthsAgo = new Date();
  sevenMonthsAgo.setMonth(sevenMonthsAgo.getMonth() - 7);
  const childId = await signUpAndCreateChild(
    page,
    'Lulu',
    sevenMonthsAgo.toISOString().slice(0, 10),
    'offline'
  );

  await page.goto(`/child/${childId}/log`);

  const firstFoodBtn = page.locator('ul button[type="button"]').first();
  await firstFoodBtn.waitFor({ state: 'visible', timeout: 8000 });
  await firstFoodBtn.click();
  await expect(page.locator('input[name="foodId"]')).toBeAttached({ timeout: 3000 });

  // Patch navigator.onLine to false. context.setOffline drops connections at
  // the network layer, but our offline path is gated on the JS property:
  // patching it directly keeps the page alive so the submit skips the
  // network and routes through the queue.
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'onLine', { get: () => false, configurable: true });
  });

  // Anchored: the submit is now exactly "Enregistrer", while the rail CTA and
  // the mobile FAB both carry "Enregistrer un repas".
  await page.getByRole('button', { name: /^enregistrer$/i }).click();

  await expect(
    page.getByText('Enregistré hors-ligne, sera synchronisé.', { exact: false })
  ).toBeVisible({ timeout: 8000 });

  // After the queued toast, the page navigates back to the child dashboard.
  await expect(page).toHaveURL(/\/child\/\d+$/, { timeout: 8000 });

  // Verify the row was written to IDB. This is the durability contract that
  // matters for the offline UX : the entry survives until flush picks it up.
  expect(await queuedRows(page)).toBeGreaterThanOrEqual(1);
});

// Regression for the F-P4 audit finding: a request that fails at the
// transport layer while navigator.onLine is still true (weak signal,
// DNS blip, connected-but-no-internet wifi, timeout…) must NOT wipe the
// form via SvelteKit's error boundary. It should degrade to the same
// durable offline queue as the true-offline path above.
test('a transport failure while online queues the entry instead of wiping the form', async ({
  page
}) => {
  const sevenMonthsAgo = new Date();
  sevenMonthsAgo.setMonth(sevenMonthsAgo.getMonth() - 7);
  const childId = await signUpAndCreateChild(
    page,
    'Mimi',
    sevenMonthsAgo.toISOString().slice(0, 10),
    'flaky'
  );

  await page.goto(`/child/${childId}/log`);

  const firstFoodBtn = page.locator('ul button[type="button"]').first();
  await firstFoodBtn.waitFor({ state: 'visible', timeout: 8000 });
  await firstFoodBtn.click();
  await expect(page.locator('input[name="foodId"]')).toBeAttached({ timeout: 3000 });

  // navigator.onLine stays true throughout — this is the "flaky but
  // reportedly online" case the true-offline precheck above can't catch.
  // Abort the log POST at the network layer so the browser's fetch()
  // rejects: the durable submit reads that as an unreachable server.
  await page.route(`**/child/${childId}/log`, (route) => {
    if (route.request().method() === 'POST') {
      return route.abort('failed');
    }
    return route.continue();
  });

  await page.getByRole('button', { name: /^enregistrer$/i }).click();

  // Must degrade to the offline-queue toast, never the error boundary.
  await expect(
    page.getByText('Enregistré hors-ligne, sera synchronisé.', { exact: false })
  ).toBeVisible({ timeout: 8000 });
  await expect(page.getByText(/erreur/i)).toHaveCount(0);

  // Still navigates back to the dashboard rather than an error page.
  await expect(page).toHaveURL(/\/child\/\d+$/, { timeout: 8000 });

  expect(await queuedRows(page)).toBeGreaterThanOrEqual(1);
});

// The replay redirect carries the milestone flags the dashboard reads after
// an online log. A first repas logged offline must still be celebrated when
// the queue replays it, even with a second queued repas replaying right
// behind it, not reduced to "Synchronisé." toasts.
test('a queued first repas is celebrated when it replays on reconnect', async ({ page }) => {
  const sevenMonthsAgo = new Date();
  sevenMonthsAgo.setMonth(sevenMonthsAgo.getMonth() - 7);
  const childId = await signUpAndCreateChild(
    page,
    'Nino',
    sevenMonthsAgo.toISOString().slice(0, 10),
    'replay'
  );

  await page.goto(`/child/${childId}/log`);
  // Patched once: the second repas is reached by client-side navigation,
  // which keeps the patch, while a full page load would reset it.
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'onLine', { get: () => false, configurable: true });
  });

  // Poire is not an allergen, so the first repas reaches the first-repas
  // milestone and the second one reaches none.
  const queuePoire = async () => {
    await page.getByPlaceholder('Rechercher un aliment…').fill('Poire');
    await page
      .getByRole('button', { name: /^Poire/ })
      .first()
      .click();
    await page.getByRole('button', { name: /^enregistrer$/i }).click();
    await expect(page).toHaveURL(/\/child\/\d+$/, { timeout: 8000 });
  };
  await queuePoire();
  // The dashboard opens its welcome dialog over the log CTA.
  await page.getByRole('dialog').getByRole('button', { name: 'Fermer' }).click();
  await page.getByRole('link', { name: /enregistrer un premier repas/i }).click();
  await queuePoire();
  expect(await queuedRows(page)).toBe(2);

  // Back online: the layout's 'online' listener flushes the queue.
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'onLine', { get: () => true, configurable: true });
    window.dispatchEvent(new Event('online'));
  });

  // Both repas have replayed before the toasts are checked, so a toast the
  // second one would add can't arrive after the assertions. The absence check
  // counts once instead of retrying: toHaveCount(0) would wait out the 4 s
  // toast and pass after a "Synchronisé." toast has come and gone.
  await expect.poll(() => queuedRows(page), { timeout: 8000 }).toBe(0);
  await expect(page.getByText('Premier repas noté.')).toBeVisible();
  expect(await page.getByText('Synchronisé.', { exact: true }).count()).toBe(0);
});

// Every open tab flushes the queue on reconnect, and only one of them may
// replay a queued repas: the other tab replaying it too toasted the same
// milestone twice (#452).
test('two open tabs replay a queued repas once and celebrate it once', async ({
  page,
  context
}) => {
  const sevenMonthsAgo = new Date();
  sevenMonthsAgo.setMonth(sevenMonthsAgo.getMonth() - 7);
  const childId = await signUpAndCreateChild(
    page,
    'Lino',
    sevenMonthsAgo.toISOString().slice(0, 10),
    'twotabs'
  );

  // The second tab opens before the repas is queued: its mount flush would
  // otherwise replay the row on load, before any reconnect.
  const other = await context.newPage();
  await other.goto(`/child/${childId}`);
  await awaitHydration(other);
  await page.goto(`/child/${childId}/log`);
  for (const p of [page, other]) {
    await p.evaluate(() => {
      Object.defineProperty(navigator, 'onLine', { get: () => false, configurable: true });
    });
  }

  await page.getByPlaceholder('Rechercher un aliment…').fill('Poire');
  await page
    .getByRole('button', { name: /^Poire/ })
    .first()
    .click();
  await page.getByRole('button', { name: /^enregistrer$/i }).click();
  await expect(page).toHaveURL(/\/child\/\d+$/, { timeout: 8000 });
  expect(await queuedRows(page)).toBe(1);

  // Every replay after the first waits until the server has answered the
  // first one. A second replay then gets the stored redirect, the path that
  // celebrated the repas again, instead of a 409 that only retries it on the
  // next minute's flush.
  const replayers = new Set<Page>();
  let firstAnswered: Promise<void> | null = null;
  await context.route(`**/child/${childId}/log`, async (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    replayers.add(route.request().frame().page());
    if (firstAnswered) {
      await firstAnswered;
      return route.continue();
    }
    let answered = () => {};
    firstAnswered = new Promise((resolve) => (answered = resolve));
    const response = await route.fetch();
    answered();
    await route.fulfill({ response });
  });

  await Promise.all(
    [page, other].map((p) =>
      p.evaluate(() => {
        Object.defineProperty(navigator, 'onLine', { get: () => true, configurable: true });
        window.dispatchEvent(new Event('online'));
      })
    )
  );

  // A tab toasts once its own pass ends, after the queue drained. Wait for
  // the toast in every tab that replayed, then count once: a retrying
  // toHaveCount would let a duplicate expire after 4 s and pass.
  await expect.poll(() => queuedRows(page), { timeout: 8000 }).toBe(0);
  for (const p of replayers) await expect(p.getByText('Premier repas noté.')).toBeVisible();
  const toasts = async (text: string, exact: boolean) =>
    (await page.getByText(text, { exact }).count()) +
    (await other.getByText(text, { exact }).count());
  expect(await toasts('Premier repas noté.', false)).toBe(1);
  expect(await toasts('Synchronisé.', true)).toBe(0);
  expect(replayers.size).toBe(1);
});

// The offline fallback page (/offline) is a prerendered SvelteKit route. The
// service worker (src/service-worker/index.ts) serves it only when a
// navigation's own strategy fails (PrecacheFallbackPlugin), never as a global
// navigateFallback: that would answer ALL navigations, online and offline,
// and break this SSR app.
