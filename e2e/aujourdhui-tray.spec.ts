import { test, expect, type Locator, type Page } from '@playwright/test';
import {
  birthDateMonthsAgo,
  dismissWelcomeIfPresent,
  logRepas,
  signUpAndCreateChild
} from './_helpers';

/**
 * #363: from lg, the Aujourd'hui tray is two column stacks. The stat tiles sit
 * over the destinations in column one, the allergen strip over the feed in
 * columns two and three. When the stat tiles and the allergen strip shared one
 * row, the taller stat tiles left an empty band under the allergen strip,
 * before the feed.
 *
 * Each module carries the tray's vertical rhythm as its own margin-bottom
 * (mb-3), so "no band" means the next module starts one margin below.
 */

type Box = { top: number; bottom: number; left: number; right: number; marginBottom: number };

function measure(locator: Locator): Promise<Box> {
  return locator.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return {
      top: r.top,
      bottom: r.bottom,
      left: r.left,
      right: r.right,
      marginBottom: parseFloat(getComputedStyle(el).marginBottom)
    };
  });
}

function trayModules(page: Page) {
  return {
    // The stat tiles' own grid, which carries their mb-3.
    stats: page.getByRole('article', { name: 'Aliments', exact: true }).locator('..'),
    allergens: page.getByRole('region', { name: 'Suivi des allergènes' }),
    feed: page
      .locator('section')
      .filter({ has: page.getByRole('heading', { name: 'Derniers repas' }) }),
    nav: page.getByRole('navigation', { name: 'Raccourcis' })
  };
}

test('the lg tray leaves no band under the allergen strip or the stat tiles', async ({ page }) => {
  // 4.6 s locally. It signs up and logs five repas, and the bento-reaction-
  // detail tests, which sign up and log one, took 12 to 30 s in busy CI runs.
  test.slow();
  const childId = await signUpAndCreateChild(page, 'Léonie', birthDateMonthsAgo(7));
  await dismissWelcomeIfPresent(page);
  // An allergen with a reaction gives the allergen strip a pill row. Five
  // separate repas fill the feed's five rows, so the feed is taller than
  // column one below the allergen strip, and a feed placed in rows 3 and 4
  // alone pushes the destinations down.
  await logRepas(page, childId, ['Œuf entier'], { reaction: 'Réaction marquée' });
  for (const aliment of ['Poire', 'Pomme', 'Carotte', 'Banane']) {
    await logRepas(page, childId, [aliment]);
  }
  await page.goto(`/child/${childId}`);
  await dismissWelcomeIfPresent(page);

  const modules = trayModules(page);
  for (const width of [1024, 1280, 1440]) {
    await test.step(`${width}px`, async () => {
      await page.setViewportSize({ width, height: 900 });
      const [stats, allergens, feed, nav] = await Promise.all(
        [modules.stats, modules.allergens, modules.feed, modules.nav].map(measure)
      );
      // The lg tray is on: the allergen strip sits beside the stat tiles.
      expect(allergens.left, 'allergen strip beside the stat tiles').toBeGreaterThan(stats.right);
      expect(
        Math.round(feed.top - allergens.bottom),
        'gap between the allergen strip and the feed'
      ).toBe(allergens.marginBottom);
      expect(
        Math.round(nav.top - stats.bottom),
        'gap between the stat tiles and the destinations'
      ).toBe(stats.marginBottom);
    });
  }

  await test.step('a phone keeps one column in DOM order', async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    const boxes = await Promise.all(
      [modules.stats, modules.allergens, modules.feed, modules.nav].map(measure)
    );
    const gaps = boxes.slice(1).map((box, i) => Math.round(box.top - boxes[i].bottom));
    expect(gaps).toEqual([boxes[0].marginBottom, boxes[1].marginBottom, boxes[2].marginBottom]);
    expect(new Set(boxes.map((box) => Math.round(box.left))).size).toBe(1);
  });
});
