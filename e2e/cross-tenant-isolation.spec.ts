import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { dismissWelcomeIfPresent, signUpAndCreateChild } from './_helpers';

// Cross-tenant data isolation (audit item T1). Unit tests already prove the
// guards in isolation (src/lib/server/guards.test.ts) and the nested-id
// confusion class (foods/[entryId]/page.server.test.ts). This e2e proves the
// thing unit tests cannot: that every *wired* route under /child/[id] actually
// mounts the membership guard end-to-end, so a guard accidentally dropped from
// a +page.server.ts prelude is caught. The tenant boundary is the child: a user
// with a valid session but no membership on child A must be denied every read
// and write against A's data.

// A birth date that keeps the child ~8 months old at run time, matching the
// proven logging specs (texture/bento-reaction-detail) so the seeded foods we
// search for stay age-appropriate.
function eightMonthsAgo(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - 8);
  return d.toISOString().slice(0, 10);
}

// Log one food via the /log page and return the new entry's id, parsed from
// the entry-detail URL reached through the foods feed.
async function logFoodAndGetEntryId(
  page: Page,
  childId: number,
  foodName = 'Poire'
): Promise<number> {
  await page.goto(`/child/${childId}/log`);
  await page.getByPlaceholder('Rechercher un aliment…').fill(foodName);
  await page
    .getByRole('button', { name: new RegExp(`^${foodName}`) })
    .first()
    .click();
  await page.getByRole('button', { name: 'Noter ce repas' }).click();
  // Successful log redirects back to /child/<id>.
  await expect(page).toHaveURL(/\/child\/\d+(\?.*)?$/);

  await page.goto(`/child/${childId}/foods`);
  await page
    .getByRole('link', { name: new RegExp(foodName, 'i') })
    .first()
    .click();
  await expect(page).toHaveURL(/\/child\/\d+\/foods\/\d+$/);
  const match = page.url().match(/\/foods\/(\d+)$/);
  if (!match) throw new Error(`Expected an entry-detail URL, got ${page.url()}`);
  return Number(match[1]);
}

test.describe('cross-tenant data isolation', () => {
  test('user B cannot read or mutate user A’s child data', async ({ browser }) => {
    // Two isolated contexts so the two sessions' cookies never bleed together.
    const ctxA: BrowserContext = await browser.newContext();
    const ctxB: BrowserContext = await browser.newContext();
    const pageA = await ctxA.newPage();
    const pageB = await ctxB.newPage();
    try {
      // User A: owner of child A with one logged food entry.
      const childIdA = Number(
        await signUpAndCreateChild(pageA, 'AliceKid', eightMonthsAgo(), 'tenantA')
      );
      await pageA.goto(`/child/${childIdA}`);
      await dismissWelcomeIfPresent(pageA);
      const entryIdA = await logFoodAndGetEntryId(pageA, childIdA);

      // User B: an unrelated parent with their OWN child B. B therefore has a
      // valid session and a membership — just not on child A.
      const childIdB = Number(
        await signUpAndCreateChild(pageB, 'BobKid', eightMonthsAgo(), 'tenantB')
      );
      await pageB.goto(`/child/${childIdB}`);
      await dismissWelcomeIfPresent(pageB);

      // 1. READ denial: every wired child-A route must return 403 and must
      //    never leak child A's name into the response body.
      const guardedPaths = [
        `/child/${childIdA}`,
        `/child/${childIdA}/foods`,
        `/child/${childIdA}/log`,
        `/child/${childIdA}/report`,
        `/child/${childIdA}/guide`,
        `/child/${childIdA}/suggestions`,
        `/child/${childIdA}/settings`,
        `/child/${childIdA}/foods/${entryIdA}`,
        `/child/${childIdA}/foods/${entryIdA}/print`
      ];
      for (const path of guardedPaths) {
        const res = await pageB.goto(path);
        expect(res?.status(), `GET ${path} must be forbidden for a non-member`).toBe(403);
        await expect(pageB.locator('body')).not.toContainText('AliceKid');
      }

      // 2. Nested-id confusion: B *is* a member of child B, so the layout guard
      //    passes — but child A's entry must not resolve under child B. The
      //    entry query is scoped by both id AND childId, so this is a 404.
      const confusion = await pageB.goto(`/child/${childIdB}/foods/${entryIdA}`);
      expect(confusion?.status(), 'child B + child A’s entry must 404, not leak').toBe(404);

      // 3. Mutation denial: B POSTs the dismissReminder action against child A.
      //    Set the Origin header to the app origin so SvelteKit's CSRF check
      //    passes — that way the 403 we assert is the authorization guard
      //    (requireChildContext), not an origin rejection. The request inherits
      //    ctxB's session cookie automatically.
      const origin = new URL(pageB.url()).origin;
      const actionRes = await pageB.request.post(`/child/${childIdA}?/dismissReminder`, {
        headers: { origin },
        form: { reminderKey: 'intro-allergenes' }
      });
      expect(actionRes.status(), 'POST dismissReminder on child A must be forbidden').toBe(403);
    } finally {
      await ctxA.close();
      await ctxB.close();
    }
  });
});
