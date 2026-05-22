import { test, expect } from '@playwright/test';
import {
  dismissWelcomeIfPresent,
  expectDialogMatchesViewport,
  signUpAndCreateChild
} from './_helpers';

test('Découvrir bento renders all four sections @responsive', async ({ page }) => {
  const childId = await signUpAndCreateChild(page, 'Léo', '2025-10-01');
  await dismissWelcomeIfPresent(page);

  await page.goto(`/child/${childId}/guide`);
  // h2 headings inside aria-labelled sections
  await expect(page.getByText('Les étapes')).toBeVisible();
  await expect(page.getByText('Sources scientifiques')).toBeVisible();
});

test('tapping a stage tile opens the StageDetailSheet @responsive', async ({ page }) => {
  const childId = await signUpAndCreateChild(page, 'Léo', '2025-10-01');
  await dismissWelcomeIfPresent(page);

  await page.goto(`/child/${childId}/guide`);
  // Stage tiles are buttons whose visible text contains the stage title.
  // Child born 2025-10-01 is ~7 months old at test time; any stage tile works.
  await page.getByRole('button', { name: /6–9 mois/i }).click();
  await expectDialogMatchesViewport(page);
});

test('the allergen sheet body actually scrolls on mobile @responsive @mobile-only', async ({
  page
}) => {
  // Runs only on the mobile project (@mobile-only). The allergen tiles each open
  // AllergenInfoDialog as a bottom-sheet (side="auto"). The dialog body has
  // enough content (why / how-to-offer / first-signs / severe-signs / sources)
  // to overflow the 70vh max-height. This regression test catches the case
  // where the inner wrapper is missing the max-h-[70vh] + overflow-y-auto
  // pair — content would clip and the user would have no way to reach the
  // sources or the close button.
  const childId = await signUpAndCreateChild(page, 'Léo', '2025-10-01');
  await dismissWelcomeIfPresent(page);

  await page.goto(`/child/${childId}/guide`);
  // Tap the first priority allergen tile (e.g. "Œuf"). The tile's accessible
  // name is "<label> — <state>", and the AllergenPassport always renders the
  // priority set, so any priority allergen works.
  await page.getByRole('button', { name: /Œuf/i }).first().click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();

  // Find the scroll container inside the dialog and assert it actually
  // overflows (scrollHeight > clientHeight) — i.e., the fix is needed and
  // present. If the wrapper drops the max-h + overflow-y-auto, scrollHeight
  // and clientHeight collapse to the same value and this fails.
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
