import { beforeEach, describe, expect, it } from 'bun:test';
import { testDb, resetTestDb } from '../../../test/db';
import { seedChild, seedUser } from '../../../test/route';
import { foodEntries, foods } from '#lib/server/db/schema.js';
import type { ReactionId } from '#lib/utils/reaction-values.js';
import { loadAllergenHistory } from './allergen-history';

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 0, 28, 12, 0, 0);

let childId: number;
let userId: number;

beforeEach(async () => {
  await resetTestDb();
  const u = await seedUser();
  const c = await seedChild({ createdBy: u.id, birthDate: '2025-06-01' });
  userId = u.id;
  childId = c.id;
});

async function seedFood(name: string, category: string, allergenType: string | null) {
  const [food] = await testDb
    .insert(foods)
    .values({
      name,
      category,
      isMajorAllergen: allergenType != null,
      allergenType,
      suggestedAgeMonths: 4,
      notes: null,
      isCustom: false,
      customForChildId: null
    })
    .returning();
  return food;
}

/** Logs `food` for the test child `daysAgo` days before NOW; returns the entry id. */
async function log(
  food: { id: number },
  reaction: ReactionId,
  daysAgo: number,
  forChild = childId
) {
  const [entry] = await testDb
    .insert(foodEntries)
    .values({
      childId: forChild,
      foodId: food.id,
      givenAt: new Date(NOW - daysAgo * DAY),
      reaction,
      notes: null,
      loggedBy: userId,
      createdAt: new Date(NOW)
    })
    .returning();
  return entry.id;
}

const history = () => loadAllergenHistory(testDb, childId, NOW);

describe('loadAllergenHistory: introduction', () => {
  it('counts a dairy food as an introduction to lait, but not butter, an allergenic fat', async () => {
    await log(await seedFood('Beurre', 'matieres_grasses', 'lait'), 'ras', 1);
    expect(history().isIntroduced('lait')).toBe(false);
    expect(history().isTolerated('lait')).toBe(false);

    await log(await seedFood('Fromage blanc', 'produits_laitiers', 'lait'), 'ras', 1);
    expect(history().isIntroduced('lait')).toBe(true);
    expect(history().isTolerated('lait')).toBe(true);
  });
});

describe('loadAllergenHistory: maintainQueue', () => {
  it('puts a dairy exposure from 8 days ago at the head, overdue', async () => {
    const fromage = await seedFood('Fromage blanc', 'produits_laitiers', 'lait');
    await log(fromage, 'ras', 8);

    expect(history().maintainQueue).toEqual([
      { id: 'lait', lastAt: NOW - 8 * DAY, daysSince: 8, overdue: true }
    ]);
  });

  it('never counts butter as a maintenance exposure, as a lone log or as the latest one (#373)', async () => {
    const beurre = await seedFood('Beurre', 'matieres_grasses', 'lait');
    await log(beurre, 'ras', 8);
    expect(history().maintainQueue).toEqual([]);

    await log(await seedFood('Fromage blanc', 'produits_laitiers', 'lait'), 'ras', 10);
    await log(beurre, 'ras', 1);
    expect(history().maintainQueue[0]).toMatchObject({ id: 'lait', daysSince: 10, overdue: true });
  });

  it('leaves out blocked and non-priority allergens', async () => {
    const oeuf = await seedFood('Œuf dur', 'oeufs', 'oeuf');
    await log(oeuf, 'reaction', 100);
    await log(oeuf, 'ras', 10);
    await log(await seedFood('Céleri-rave', 'legumes', 'celeri'), 'ras', 30);

    expect(history().maintainQueue).toEqual([]);
  });

  it('orders the most overdue first, ties by priority order, recent ones last and not overdue', async () => {
    await log(await seedFood('Fromage blanc', 'produits_laitiers', 'lait'), 'ras', 9);
    await log(await seedFood('Pain', 'feculents', 'gluten'), 'ras', 12);
    await log(await seedFood('Purée de cacahuète', 'allergenes', 'arachide'), 'ras', 9);
    await log(await seedFood('Saumon', 'poissons', 'poisson'), 'ras', 2);

    const queue = history().maintainQueue;
    expect(queue.map((c) => [c.id, c.daysSince, c.overdue])).toEqual([
      ['gluten', 12, true],
      // arachide before lait: given at the same instant, and
      // PRIORITY_INTRODUCTION_ALLERGENS lists it first.
      ['arachide', 9, true],
      ['lait', 9, true],
      ['poisson', 2, false]
    ]);
  });

  it('keeps one order all day long, the allergen given first at the head', async () => {
    // lait at 08:00 and oeuf at 10:00 (Paris), three days before. Between
    // 10:00 and 08:00 both read "3 jours"; the head must not switch to oeuf.
    await log(
      await seedFood('Fromage blanc', 'produits_laitiers', 'lait'),
      'ras',
      (NOW - Date.UTC(2026, 0, 25, 7, 0)) / DAY
    );
    await log(
      await seedFood('Œuf dur', 'oeufs', 'oeuf'),
      'ras',
      (NOW - Date.UTC(2026, 0, 25, 9, 0)) / DAY
    );
    const headAt = (now: number) => loadAllergenHistory(testDb, childId, now).maintainQueue[0];

    expect(headAt(Date.UTC(2026, 0, 28, 8, 0))).toMatchObject({ id: 'lait', daysSince: 3 });
    expect(headAt(Date.UTC(2026, 0, 28, 9, 30))).toMatchObject({ id: 'lait', daysSince: 3 });
  });

  it('turns overdue exactly at ALLERGEN_MAINTAIN_DAYS', async () => {
    const yaourt = await seedFood('Yaourt', 'produits_laitiers', 'lait');
    const sibling = await seedChild({ createdBy: userId, birthDate: '2025-06-01' });
    await log(yaourt, 'ras', 6);
    await log(yaourt, 'ras', 7, sibling.id);

    expect(history().maintainQueue[0].overdue).toBe(false);
    expect(loadAllergenHistory(testDb, sibling.id, NOW).maintainQueue[0].overdue).toBe(true);
  });
});

describe('loadAllergenHistory: statuses', () => {
  const status = (id: string) => history().statuses.find((s) => s.id === id)!;

  it('lists all 12 tracked allergens with their labels, untried ones as todo', async () => {
    const statuses = history().statuses;
    expect(statuses).toHaveLength(12);
    expect(statuses.every((s) => s.state === 'todo' && s.triedCount === 0)).toBe(true);
    expect(status('oeuf')).toEqual({
      id: 'oeuf',
      label: 'Œuf',
      triedCount: 0,
      lastTried: null,
      daysSinceLastTried: null,
      state: 'todo',
      worstEntryId: null
    });
  });

  it('fades a priority allergen once it is overdue, never a non-priority one', async () => {
    await log(await seedFood('Fromage blanc', 'produits_laitiers', 'lait'), 'ras', 8);
    await log(await seedFood('Saumon', 'poissons', 'poisson'), 'ras', 6);
    await log(await seedFood('Céleri-rave', 'legumes', 'celeri'), 'ras', 30);

    expect(status('lait')).toMatchObject({ state: 'fading', daysSinceLastTried: 8, triedCount: 1 });
    expect(status('poisson').state).toBe('cleared');
    expect(status('celeri').state).toBe('cleared');
  });

  it('shows the worst outcome over staleness, and counts symptoms on a fat but not a plain fat', async () => {
    const beurre = await seedFood('Beurre', 'matieres_grasses', 'lait');
    await log(beurre, 'ras', 1);
    await log(beurre, 'inconfort', 20);
    await log(await seedFood('Fromage blanc', 'produits_laitiers', 'lait'), 'ras', 10);
    const sesame = await seedFood('Tahini', 'allergenes', 'sesame');
    await log(sesame, 'inconfort', 4);
    await log(sesame, 'reaction', 3);

    expect(status('lait')).toMatchObject({
      state: 'inconfort',
      triedCount: 2,
      daysSinceLastTried: 10
    });
    expect(status('sesame').state).toBe('reaction');
  });

  it('formats lastTried as the Europe/Paris civil day, not UTC, for a just-after-midnight log', async () => {
    // 2026-01-10T00:20:00+01:00 (CET) is still UTC-Jan-9: the parent logged it on the 10th.
    const justAfterMidnight = Date.UTC(2026, 0, 9, 23, 20, 0);
    await log(
      await seedFood('Purée de cacahuète', 'allergenes', 'arachide'),
      'ras',
      (NOW - justAfterMidnight) / DAY
    );

    expect(status('arachide').lastTried).toBe('10/01/26');
  });

  describe('worstEntryId', () => {
    it('points at the reaction entry even when a later log went fine', async () => {
      const tahini = await seedFood('Tahini', 'allergenes', 'sesame');
      await log(tahini, 'ras', 27);
      const reaction = await log(tahini, 'reaction', 26);
      await log(tahini, 'ras', 25);
      expect(status('sesame').worstEntryId).toBe(reaction);
    });

    it('prefers a reaction over a later inconfort', async () => {
      const tahini = await seedFood('Tahini', 'allergenes', 'sesame');
      const reaction = await log(tahini, 'reaction', 27);
      await log(tahini, 'inconfort', 26);
      expect(status('sesame').worstEntryId).toBe(reaction);
    });

    it('breaks a same-severity tie with the most recent entry, whatever the insert order', async () => {
      const tahini = await seedFood('Tahini', 'allergenes', 'sesame');
      const newer = await log(tahini, 'inconfort', 26);
      await log(tahini, 'inconfort', 27);
      expect(status('sesame').worstEntryId).toBe(newer);
    });

    it('is null when nothing went wrong, so no pill offers a dead link', async () => {
      await log(await seedFood('Tahini', 'allergenes', 'sesame'), 'ras', 27);
      expect(status('sesame').worstEntryId).toBeNull();
    });
  });
});

describe('loadAllergenHistory: bilanRows', () => {
  it('orders priority allergens first, each group alphabetical in French', () => {
    expect(history().bilanRows.map((r) => [r.label, r.isPriority])).toEqual([
      ['Arachide', true],
      ['Fruits à coque', true],
      ['Gluten', true],
      ['Lait', true],
      ['Œuf', true],
      ['Poisson', true],
      ['Sésame', true],
      ['Céleri', false],
      ['Crustacés', false],
      ['Mollusques', false],
      ['Moutarde', false],
      ['Soja', false]
    ]);
  });

  it('reports exposures, first and last dates, and the worst reaction of introduced allergens', async () => {
    const oeuf = await seedFood('Œuf dur', 'oeufs', 'oeuf');
    await log(oeuf, 'ras', 20);
    await log(oeuf, 'inconfort', 15);
    await log(oeuf, 'ras', 5);
    const row = (id: string) => history().bilanRows.find((r) => r.id === id);

    expect(row('oeuf')).toEqual({
      id: 'oeuf',
      label: 'Œuf',
      isPriority: true,
      status: 'introduced',
      worst: 'inconfort',
      exposures: 3,
      firstGivenAt: NOW - 20 * DAY,
      lastGivenAt: NOW - 5 * DAY
    });
    expect(row('lait')).toMatchObject({
      status: 'untested',
      worst: null,
      exposures: 0,
      firstGivenAt: null,
      lastGivenAt: null
    });
  });

  it('counts an allergenic fat only when it carried symptoms', async () => {
    const beurre = await seedFood('Beurre', 'matieres_grasses', 'lait');
    await log(beurre, 'ras', 3);
    expect(history().bilanRows.find((r) => r.id === 'lait')).toMatchObject({
      status: 'untested',
      exposures: 0
    });

    await log(beurre, 'reaction', 2);
    expect(history().bilanRows.find((r) => r.id === 'lait')).toMatchObject({
      status: 'introduced',
      worst: 'reaction',
      exposures: 1
    });
  });
});

describe('loadAllergenHistory: isExposureFood', () => {
  it('accepts an allergen-tagged food, but neither an allergenic fat nor an untagged food', () => {
    const h = history();
    expect(h.isExposureFood({ allergenType: 'lait', category: 'produits_laitiers' })).toBe(true);
    expect(h.isExposureFood({ allergenType: 'lait', category: 'matieres_grasses' })).toBe(false);
    expect(h.isExposureFood({ allergenType: null, category: 'legumes' })).toBe(false);
  });
});

describe('loadAllergenHistory: blocking (#373)', () => {
  it('blocks an allergen after inconfort or réaction on any food, a fat included', async () => {
    await log(await seedFood('Beurre', 'matieres_grasses', 'lait'), 'inconfort', 3);
    await log(await seedFood('Œuf dur', 'oeufs', 'oeuf'), 'ras', 9);
    await log(await seedFood('Omelette', 'oeufs', 'oeuf'), 'reaction', 2);

    const h = history();
    expect(h.isBlocked('lait')).toBe(true);
    expect(h.isBlocked('oeuf')).toBe(true);
    // Symptoms count as an exposure: a blocked allergen is never "still to introduce".
    expect(h.isIntroduced('lait')).toBe(true);
    // The milestone rule stays its own question: lait was never given without symptoms.
    expect(h.isTolerated('lait')).toBe(false);
    expect(h.isTolerated('oeuf')).toBe(true);
    expect(h.isBlocked('arachide')).toBe(false);
  });

  it("reads only this child's entries", async () => {
    const other = await seedChild({ createdBy: userId, birthDate: '2025-06-01' });
    await log(
      await seedFood('Beurre de cacahuète', 'allergenes', 'arachide'),
      'reaction',
      1,
      other.id
    );

    expect(history().isBlocked('arachide')).toBe(false);
    expect(history().isIntroduced('arachide')).toBe(false);
    expect(loadAllergenHistory(testDb, other.id, NOW).isBlocked('arachide')).toBe(true);
  });
});
