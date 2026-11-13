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
    allergens: page.getByRole('region', { name: 'Suivi des allergènes', exact: true }),
    feed: page
      .locator('section')
      .filter({ has: page.getByRole('heading', { name: 'Derniers repas', exact: true }) }),
    nav: page.getByRole('navigation', { name: 'Raccourcis', exact: true })
  };
}

test('the lg tray leaves no band under the allergen strip or the stat tiles', async ({ page }) => {
  // 4.6 s locally, 17.4 s in CI run 595, where cinder's test jobs and the
  // run's own unit job shared the runner. It signs up and logs five repas.
  // The first bento-reaction-detail test took 7.2 s in run 595 and 28.7 s in
  // run 426, so a busier run can push this one past the 30 s default.
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

/**
 * #730: in a week with no new food and the streak at its record, the stat
 * tiles lose both optional lines, while seven allergens due again wrap the
 * allergen strip onto three rows of pills. The strip is then the taller module
 * of the row they share. From lg the stat tiles grow to the strip's height, so
 * no band opens between them and the destinations (38px on main).
 */
test.describe('an allergen strip taller than the stat tiles', () => {
  // The seed counts Paris calendar days, and the browser reads the typed
  // repas time in its own zone, which is UTC on CI.
  test.use({ timezoneId: 'Europe/Paris' });

  test('the lg stat tiles grow to the allergen strip', async ({ page }) => {
    // 4.1 s locally. It signs up and logs two repas, one of nine foods. The
    // #363 test above, with five repas, took 17.4 s in a busy CI run.
    test.slow();
    const childId = await signUpAndCreateChild(page, 'Jules', birthDateMonthsAgo(9));
    await dismissWelcomeIfPresent(page);
    // Every allergen was last given 8 Paris days ago. The seven priority ones
    // then read « à reproposer » (after 7 days), and Céleri-rave gives the
    // « 1 autre introduit » line. 8 days also keeps every first time out of
    // the 7 Paris days the weekly line counts. Today's repas holds a food
    // already known, so the streak, 1 day, equals its record.
    await logRepas(
      page,
      childId,
      [
        'Œuf entier',
        'Beurre de cacahuète',
        'Yaourt nature',
        'Pâtes',
        'Cabillaud',
        "Purée d'amande",
        'Tahin',
        'Céleri-rave',
        'Carotte'
      ],
      { givenAt: parisNoonDaysAgo(8) }
    );
    await logRepas(page, childId, ['Carotte']);
    await page.goto(`/child/${childId}`);
    await dismissWelcomeIfPresent(page);

    const modules = trayModules(page);
    // The seed state, which gives the widest band on main (38px). Each
    // optional line makes the stat tiles taller, and with both they outgrow
    // the strip (226px against 216px in #730's triage probe), so the checks
    // below would test nothing.
    await expect(modules.allergens.getByText('· à reproposer', { exact: true })).toHaveCount(7);
    await expect(modules.allergens.getByText('1 autre introduit', { exact: true })).toBeVisible();
    expect(await modules.stats.getByText(/cette semaine|^record ·/).count()).toBe(0);

    const tiles = ['Aliments', 'Régularité'].map((name) =>
      page.getByRole('article', { name, exact: true })
    );
    for (const width of [1024, 1280, 1440]) {
      await test.step(`${width}px`, async () => {
        await page.setViewportSize({ width, height: 900 });
        const [stats, allergens, feed, nav] = await Promise.all(
          [modules.stats, modules.allergens, modules.feed, modules.nav].map(measure)
        );
        expect(allergens.left, 'allergen strip beside the stat tiles').toBeGreaterThan(stats.right);
        expect(
          Math.abs(stats.bottom - allergens.bottom),
          'stat tiles bottom against the allergen strip bottom'
        ).toBeLessThanOrEqual(1);
        expect(
          Math.round(nav.top - stats.bottom),
          'gap between the stat tiles and the destinations'
        ).toBe(stats.marginBottom);
        expect(
          Math.round(feed.top - allergens.bottom),
          'gap between the allergen strip and the feed'
        ).toBe(allergens.marginBottom);

        // The two tiles share the extra height, and their content stays at
        // the top of each tile.
        const [aliments, regularite] = await Promise.all(tiles.map(tileSpace));
        expect(Math.abs(aliments.above), 'space above the Aliments content').toBeLessThanOrEqual(
          0.5
        );
        expect(
          Math.abs(regularite.above),
          'space above the Régularité content'
        ).toBeLessThanOrEqual(0.5);
        expect(
          Math.abs(aliments.below - regularite.below),
          'extra height of each tile'
        ).toBeLessThanOrEqual(1);
      });
    }
  });
});

// The Paris calendar date `days` before today, at noon, as a datetime-local
// value. Counted on the calendar rather than in 24-hour steps, which across a
// clock change can land on the wrong date late in the evening.
function parisNoonDaysAgo(days: number): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric'
  }).formatToParts(new Date());
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const day = new Date(Date.UTC(get('year'), get('month') - 1, get('day') - days));
  return `${day.toISOString().slice(0, 10)}T12:00`;
}

// Space inside a tile's padding: above its first line and below its last.
function tileSpace(tile: Locator): Promise<{ above: number; below: number }> {
  return tile.evaluate((el) => {
    const box = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    const first = el.firstElementChild?.getBoundingClientRect();
    const last = el.lastElementChild?.getBoundingClientRect();
    if (!first || !last) throw new Error('a stat tile with no content');
    return {
      above: first.top - box.top - parseFloat(style.borderTopWidth) - parseFloat(style.paddingTop),
      below:
        box.bottom -
        parseFloat(style.borderBottomWidth) -
        parseFloat(style.paddingBottom) -
        last.bottom
    };
  });
}

/**
 * #737: the stat tiles render nothing until the first food is logged. From lg
 * the destinations then take the stat tiles' cell, column one rows 2 and 3,
 * beside the allergen strip, instead of starting under the strip's row with a
 * blank column one above them (152px in French on main).
 */
test('the lg tray puts the destinations beside the allergen strip when nothing is logged', async ({
  page
}) => {
  const childId = await signUpAndCreateChild(page, 'Maël', birthDateMonthsAgo(7));
  await dismissWelcomeIfPresent(page);
  // The seed state: nothing logged, so the stat tiles render nothing.
  expect(await page.getByRole('article', { name: 'Aliments', exact: true }).count()).toBe(0);

  const french = trayModules(page);
  async function expectBesideTheStrip(modules: Omit<ReturnType<typeof trayModules>, 'stats'>) {
    const [allergens, feed, nav] = await Promise.all(
      [modules.allergens, modules.feed, modules.nav].map(measure)
    );
    expect(nav.right, 'destinations in column one').toBeLessThan(allergens.left);
    expect(
      Math.abs(nav.top - allergens.top),
      'destinations top against the allergen strip top'
    ).toBeLessThanOrEqual(1);
    expect(
      Math.round(feed.top - allergens.bottom),
      'gap between the allergen strip and the feed'
    ).toBe(allergens.marginBottom);
    return { allergens, nav };
  }

  for (const width of [1024, 1280, 1440]) {
    await test.step(`${width}px`, async () => {
      await page.setViewportSize({ width, height: 900 });
      await expectBesideTheStrip(french);
    });
  }

  await test.step('destinations taller than the strip leave the feed in place', async () => {
    // Placed in row 2 alone, destinations taller than the strip grow that row
    // and push the feed down (60px with 200px destinations, in the triage
    // probe). Spanning rows 2 and 3, their extra height goes to row 3, which
    // starts where the feed does.
    await page.setViewportSize({ width: 1280, height: 900 });
    await french.nav.evaluate((el) => {
      (el as HTMLElement).style.minHeight = '200px';
    });
    const { allergens, nav } = await expectBesideTheStrip(french);
    expect(nav.bottom - nav.top, 'destinations taller than the strip').toBeGreaterThan(
      allergens.bottom + allergens.marginBottom - allergens.top
    );
    await french.nav.evaluate((el) => {
      (el as HTMLElement).style.minHeight = '';
    });
  });

  await test.step('nothing covers the moved destinations', async () => {
    await french.nav.getByRole('link', { name: 'Menu du jour', exact: true }).click();
    await expect(page).toHaveURL(`/child/${childId}/menu`);
    await expect(page.getByRole('heading', { name: 'Menu du jour', exact: true })).toBeVisible();
  });

  // Last, so that the English locale cannot carry over to a French step.
  await test.step('English, where the destinations are taller than the strip', async () => {
    await page.goto(`/en/child/${childId}`);
    await page.setViewportSize({ width: 1280, height: 900 });
    const { allergens, nav } = await expectBesideTheStrip({
      allergens: page.getByRole('region', { name: 'Allergen tracking', exact: true }),
      feed: page
        .locator('section')
        .filter({ has: page.getByRole('heading', { name: 'Latest meals', exact: true }) }),
      nav: page.getByRole('navigation', { name: 'Shortcuts', exact: true })
    });
    expect(nav.bottom - nav.top, 'destinations taller than the strip').toBeGreaterThan(
      allergens.bottom - allergens.top
    );
  });
});
