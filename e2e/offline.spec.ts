import { test, expect } from '@playwright/test';
import { signUpAndCreateChild } from './_helpers';

// Smoke: when navigator.onLine is false, the log form's enhanced submit
// handler must short-circuit, write to IDB, and surface the queued toast.
// The replay-on-online path is exhaustively covered by unit tests for
// queue.ts and the idempotency endpoint; we don't re-verify it end-to-end.
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
  // patching it directly keeps the page alive so use:enhance can cancel()
  // and route through the queue.
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'onLine', { get: () => false, configurable: true });
  });

  await page.getByRole('button', { name: /noter ce repas/i }).click();

  await expect(
    page.getByText('Enregistré hors-ligne, sera synchronisé.', { exact: false })
  ).toBeVisible({ timeout: 8000 });

  // After the queued toast, the page navigates back to the child dashboard.
  await expect(page).toHaveURL(/\/child\/\d+$/, { timeout: 8000 });

  // Verify the row was written to IDB. This is the durability contract that
  // matters for the offline UX : the entry survives until flush picks it up.
  const dbCount = await page.evaluate(async () => {
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
  expect(dbCount).toBeGreaterThanOrEqual(1);
});

// The offline fallback page (/offline) is available as a SvelteKit route for
// users to visit directly, but cannot be served as a navigation fallback in
// generateSW mode: Workbox's navigateFallback option serves the fallback for
// ALL navigations (online and offline), which breaks SSR apps. Selective
// offline-only fallback requires injectManifest mode with a custom
// setCatchHandler — a future improvement tracked separately.
