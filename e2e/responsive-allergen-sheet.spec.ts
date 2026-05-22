import { test, expect, type Page } from '@playwright/test';
import {
  dismissWelcomeIfPresent,
  expectDialogMatchesViewport,
  signUpAndCreateChild
} from './_helpers';

/**
 * Regression lock for PRs #179 + #180:
 * - #179: AllergenInfoDialog must render as a bottom-sheet on mobile,
 *   not a centered modal.
 * - #180: The dialog body must scroll when content overflows the 70vh
 *   max-height (without the inner overflow-y-auto wrapper, the sources
 *   block and close button are unreachable on mobile).
 * Plus standard dismiss flows (Esc, drag-to-dismiss on mobile only).
 */

const openAllergenSheet = async (page: Page, childId: string): Promise<void> => {
  await page.goto(`/child/${childId}/guide`);
  // Tap the first priority allergen tile (e.g. "Œuf"). The tile's accessible
  // name is "<label> — <state>"; AllergenPassport always renders the priority
  // set, so any priority allergen works.
  await page.getByRole('button', { name: /Œuf/i }).first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
};

test('allergen sheet placement matches viewport @responsive', async ({ page }) => {
  const childId = await signUpAndCreateChild(page, 'Léo', '2025-10-01');
  await dismissWelcomeIfPresent(page);
  await openAllergenSheet(page, childId);
  await expectDialogMatchesViewport(page);
});

test('allergen sheet body scrolls when content overflows (regression for #180) @mobile-only', async ({
  page
}) => {
  // The fix lives inside Modal.svelte's `scrollableBody` branch
  // (max-h-[70vh] overflow-y-auto wrapper). If that wrapper is removed,
  // scrollHeight and clientHeight collapse and this assertion fails.
  const childId = await signUpAndCreateChild(page, 'Léo', '2025-10-01');
  await dismissWelcomeIfPresent(page);
  await openAllergenSheet(page, childId);

  const dialog = page.getByRole('dialog');
  const overflow = await dialog.evaluate((el) => {
    const scroller = el.querySelector('.max-h-\\[70vh\\].overflow-y-auto');
    if (!scroller) return { found: false, scrollable: false };
    return {
      found: true,
      scrollable: scroller.scrollHeight > scroller.clientHeight
    };
  });
  expect(overflow.found).toBe(true);
  expect(overflow.scrollable).toBe(true);
});

test('drag-to-dismiss closes the bottom-sheet @mobile-only', async ({ page }) => {
  const childId = await signUpAndCreateChild(page, 'Léo', '2025-10-01');
  await dismissWelcomeIfPresent(page);
  await openAllergenSheet(page, childId);

  const grabber = page.locator('[data-sheet-grabber]');
  await expect(grabber).toBeVisible();

  const box = await grabber.boundingBox();
  if (!box) throw new Error('grabber has no bounding box');
  const startX = box.x + box.width / 2;
  const startY = box.y + box.height / 2;
  // Drag 300px down — past the dismiss threshold.
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX, startY + 300, { steps: 10 });
  await page.mouse.up();

  await expect(page.getByRole('dialog')).not.toBeVisible();
});

test('Esc dismisses the sheet on every viewport @responsive', async ({ page }) => {
  const childId = await signUpAndCreateChild(page, 'Léo', '2025-10-01');
  await dismissWelcomeIfPresent(page);
  await openAllergenSheet(page, childId);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
});
