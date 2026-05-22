import { test, expect, type Page } from '@playwright/test';
import {
  dismissWelcomeIfPresent,
  expectDialogMatchesViewport,
  signUpAndCreateChild
} from './_helpers';

/**
 * Locks the Modal primitive's resolved-side behaviour and standard dismiss
 * flows across both project viewports. The carrier is the "stage tile" on
 * /child/<id>/guide, which opens StageDetailSheet — a production wiring of
 * DetailSheet (side="auto"), so we exercise the real Modal/portal/overlay
 * stack rather than a synthetic test page.
 */

const openCarrier = async (page: Page, childId: string): Promise<void> => {
  await page.goto(`/child/${childId}/guide`);
  // Children born 2025-08-01 are ~9 months old at test time; the "6–9 mois"
  // stage tile is always rendered by the bento. Same pattern as
  // bento-discover.spec.ts.
  await page.getByRole('button', { name: /6–9 mois/i }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
};

test('side="auto" resolves to bottom on mobile, non-bottom on desktop @responsive', async ({
  page
}) => {
  const childId = await signUpAndCreateChild(page, 'Lou', '2025-08-01');
  await dismissWelcomeIfPresent(page);
  await openCarrier(page, childId);
  await expectDialogMatchesViewport(page);
});

test('Esc dismisses the modal on every viewport @responsive', async ({ page }) => {
  const childId = await signUpAndCreateChild(page, 'Lou', '2025-08-01');
  await dismissWelcomeIfPresent(page);
  await openCarrier(page, childId);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
});

test('outside-click dismisses the modal on every viewport @responsive', async ({ page }) => {
  const childId = await signUpAndCreateChild(page, 'Lou', '2025-08-01');
  await dismissWelcomeIfPresent(page);
  await openCarrier(page, childId);
  // bits-ui mounts the Dialog overlay as a sibling of the content inside the
  // portal — both share `data-state="open"`. Click the overlay (the only
  // open-state node that is not the dialog itself) to trigger interactOutside.
  // The dialog is centered on desktop and anchored bottom on mobile, so the
  // overlay's top-left corner is always outside its bounding box.
  await page
    .locator('[data-state="open"]:not([role="dialog"])')
    .click({ position: { x: 5, y: 5 } });
  await expect(page.getByRole('dialog')).not.toBeVisible();
});
