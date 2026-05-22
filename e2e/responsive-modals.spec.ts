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
  // Modal.svelte tags the bits-ui Dialog overlay with `data-dialog-overlay`
  // so tests have a stable hook regardless of bits-ui internal markup
  // changes. Filtering on `data-state="open"` alone matched both the
  // overlay and the dialog title (bits-ui sets it on every descendant).
  // The dialog is centered on desktop and anchored bottom on mobile, so the
  // overlay's top-left corner is always outside its bounding box.
  await page.locator('[data-dialog-overlay]').click({ position: { x: 5, y: 5 } });
  await expect(page.getByRole('dialog')).not.toBeVisible();
});
