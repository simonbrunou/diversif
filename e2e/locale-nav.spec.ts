import { expect, test } from '@playwright/test';
import { dismissWelcomeIfPresent, signUpAndCreateChild } from './_helpers';

/**
 * Regression: the EN locale must keep the child navigation. currentChildId
 * derives from route params, which only exist if paraglide's reroute maps
 * /en/child/:id onto the /child/[id] route — if that chain breaks, the EN
 * app renders without tabs, FAB or rail (a dead end). Also pins that the
 * tab hrefs stay locale-prefixed instead of flipping users back to FR.
 */
test('EN locale keeps the child navigation with /en-prefixed tabs @responsive', async ({
  page
}) => {
  const childId = await signUpAndCreateChild(page, 'Léa', '2025-08-01');
  await dismissWelcomeIfPresent(page);

  await page.goto(`/en/child/${childId}`);
  // The Carnet/Log tab renders in the rail (desktop) or bottom nav (mobile) —
  // both are in the DOM, only one is visible per viewport. Either way its
  // href must keep the /en prefix.
  const carnetTab = page.locator(`a[href="/en/child/${childId}/foods"]:visible`);
  await expect(carnetTab).toHaveCount(1);
});
