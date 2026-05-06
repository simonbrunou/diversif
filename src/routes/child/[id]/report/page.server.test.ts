import { describe, it, expect, beforeEach, vi } from 'vitest';
import { testDb, resetTestDb } from '../../../../test/db';
import { makeRouteEvent, seedChild, seedUser } from '../../../../test/route';

vi.mock('$lib/server/db', () => ({ db: testDb }));

import { foodEntries, foods } from '$lib/server/db/schema';
import { load } from './+page.server';

beforeEach(() => {
  resetTestDb();
});

async function setup() {
  const u = await seedUser();
  const c = seedChild({ createdBy: u.id });
  return { u, c };
}

function seedFood(name: string, category: string, allergen: string | null = null) {
  return testDb
    .insert(foods)
    .values({
      name,
      category,
      isMajorAllergen: allergen != null,
      allergenType: allergen,
      suggestedAgeMonths: 6,
      notes: null,
      isCustom: false,
      customForChildId: null
    })
    .returning()
    .all()[0];
}

function logEntry(
  childId: number,
  foodId: number,
  userId: number,
  givenAt: Date,
  reaction: 'ras' | 'inconfort' | 'reaction' = 'ras',
  notes: string | null = null
) {
  return testDb
    .insert(foodEntries)
    .values({
      childId,
      foodId,
      givenAt,
      reaction,
      notes,
      loggedBy: userId,
      createdAt: new Date()
    })
    .returning()
    .all()[0];
}

describe('child/[id]/report load', () => {
  it('returns zeroed totals and empty groups for a fresh child', async () => {
    const { c } = await setup();
    const event = makeRouteEvent({
      parent: async () => ({ child: { id: c.id, birthDate: c.birthDate } })
    });
    const out = await load(event as unknown as Parameters<typeof load>[0]);
    expect(out.totals.foods).toBe(0);
    expect(out.totals.entries).toBe(0);
    expect(out.totals.allergensIntroduced).toBe(0);
    expect(out.categoryGroups).toEqual([]);
    expect(out.notable).toEqual([]);
    // Every priority allergen is reported as untested.
    expect(out.allergens.every((a) => a.status === 'untested')).toBe(true);
  });

  it('aggregates per-food (count, first/last, worst reaction) and groups by category', async () => {
    const { u, c } = await setup();
    const carrot = seedFood('Carotte', 'legumes');
    const apple = seedFood('Pomme', 'fruits');

    logEntry(c.id, carrot.id, u.id, new Date('2024-05-01T10:00:00Z'), 'ras');
    logEntry(c.id, carrot.id, u.id, new Date('2024-05-08T10:00:00Z'), 'inconfort');
    logEntry(c.id, apple.id, u.id, new Date('2024-05-10T10:00:00Z'), 'ras');

    const event = makeRouteEvent({
      parent: async () => ({ child: { id: c.id, birthDate: c.birthDate } })
    });
    const out = await load(event as unknown as Parameters<typeof load>[0]);

    expect(out.totals.foods).toBe(2);
    expect(out.totals.entries).toBe(3);

    const legumes = out.categoryGroups.find((g) => g.id === 'legumes');
    expect(legumes?.foods.length).toBe(1);
    expect(legumes?.foods[0].exposures).toBe(2);
    expect(legumes?.foods[0].worstReaction).toBe('inconfort');
    expect(legumes?.foods[0].firstGivenAt).toBeLessThan(legumes!.foods[0].lastGivenAt);
  });

  it('marks only introduced allergens as such and bubbles the worst reaction to the row', async () => {
    const { u, c } = await setup();
    const peanut = seedFood('Beurre cacahuète', 'allergenes', 'arachide');
    logEntry(c.id, peanut.id, u.id, new Date('2024-05-01T10:00:00Z'), 'ras');
    logEntry(c.id, peanut.id, u.id, new Date('2024-05-05T10:00:00Z'), 'inconfort');

    const event = makeRouteEvent({
      parent: async () => ({ child: { id: c.id, birthDate: c.birthDate } })
    });
    const out = await load(event as unknown as Parameters<typeof load>[0]);

    const arachide = out.allergens.find((a) => a.id === 'arachide');
    expect(arachide?.status).toBe('introduced');
    expect(arachide?.exposures).toBe(2);
    expect(arachide?.worst).toBe('inconfort');

    const oeuf = out.allergens.find((a) => a.id === 'oeuf');
    expect(oeuf?.status).toBe('untested');
    expect(oeuf?.exposures).toBe(0);
    expect(oeuf?.worst).toBeNull();

    expect(out.totals.allergensIntroduced).toBe(1);
  });

  it('returns every non-RAS entry in the notable timeline (no silent cap)', async () => {
    const { u, c } = await setup();
    const f = seedFood('Pomme', 'fruits');
    const N = 35; // larger than the previous 30-entry cap we removed
    const start = Date.UTC(2024, 4, 1, 10);
    const DAY = 24 * 60 * 60 * 1000;
    for (let i = 0; i < N; i++) {
      logEntry(c.id, f.id, u.id, new Date(start + i * DAY), 'inconfort');
    }
    const event = makeRouteEvent({
      parent: async () => ({ child: { id: c.id, birthDate: c.birthDate } })
    });
    const out = await load(event as unknown as Parameters<typeof load>[0]);
    expect(out.notable.length).toBe(N);
  });

  it('surfaces only non-RAS reactions in the notable timeline and includes notes', async () => {
    const { u, c } = await setup();
    const banana = seedFood('Banane', 'fruits');
    const fish = seedFood('Saumon', 'poissons', 'poisson');

    logEntry(c.id, banana.id, u.id, new Date('2024-05-01T10:00:00Z'), 'ras', 'OK au petit déj');
    logEntry(c.id, fish.id, u.id, new Date('2024-05-02T10:00:00Z'), 'reaction', 'urticaire 30min');

    const event = makeRouteEvent({
      parent: async () => ({ child: { id: c.id, birthDate: c.birthDate } })
    });
    const out = await load(event as unknown as Parameters<typeof load>[0]);

    expect(out.notable.length).toBe(1);
    expect(out.notable[0].foodName).toBe('Saumon');
    expect(out.notable[0].notes).toBe('urticaire 30min');
  });
});
