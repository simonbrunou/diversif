import { describe, it, expect, beforeEach, vi } from 'vitest';
import { testDb, resetTestDb } from '../../../../test/db';
import { makeRouteEvent, seedChild, seedUser } from '../../../../test/route';
import { PRIORITY_INTRODUCTION_ALLERGENS } from '$lib/utils/allergens';

vi.mock('$lib/server/db', () => ({ db: testDb }));

import { foodEntries, foods } from '$lib/server/db/schema';
import { load } from './+page.server';

beforeEach(async () => {
  await resetTestDb();
});

async function setup(opts: { ageMonths?: number } = {}) {
  const u = await seedUser();
  let birthDate = '2024-01-01';
  if (opts.ageMonths != null) {
    const now = new Date();
    const birth = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - opts.ageMonths, now.getUTCDate())
    );
    birthDate = birth.toISOString().slice(0, 10);
  }
  const c = await seedChild({ createdBy: u.id, birthDate });
  // Provide childId and foodId helpers for test convenience
  const food = await testDb
    .insert(foods)
    .values({
      name: '_setup_food',
      category: 'legumes',
      isMajorAllergen: false,
      allergenType: null,
      suggestedAgeMonths: 6,
      notes: null,
      isCustom: false,
      customForChildId: null
    })
    .returning();
  return {
    u,
    c,
    childId: c.id,
    foodId: food[0].id,
    testDb,
    locals: { user: u, memberships: [], sessionId: 'sess-id', locale: 'fr' as const }
  };
}

async function seedFood(name: string, category: string, allergen: string | null = null) {
  return (
    await testDb
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
  )[0];
}

async function logEntry(
  childId: number,
  foodId: number,
  userId: number,
  givenAt: Date,
  reaction: 'ras' | 'inconfort' | 'reaction' = 'ras',
  notes: string | null = null
) {
  return (
    await testDb
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
  )[0];
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
    const carrot = await seedFood('Carotte', 'legumes');
    const apple = await seedFood('Pomme', 'fruits');

    await logEntry(c.id, carrot.id, u.id, new Date('2024-05-01T10:00:00Z'), 'ras');
    await logEntry(c.id, carrot.id, u.id, new Date('2024-05-08T10:00:00Z'), 'inconfort');
    await logEntry(c.id, apple.id, u.id, new Date('2024-05-10T10:00:00Z'), 'ras');

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
    const peanut = await seedFood('Beurre cacahuète', 'allergenes', 'arachide');
    await logEntry(c.id, peanut.id, u.id, new Date('2024-05-01T10:00:00Z'), 'ras');
    await logEntry(c.id, peanut.id, u.id, new Date('2024-05-05T10:00:00Z'), 'inconfort');

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
    const f = await seedFood('Pomme', 'fruits');
    const N = 35; // larger than the previous 30-entry cap we removed
    const start = Date.UTC(2024, 4, 1, 10);
    const DAY = 24 * 60 * 60 * 1000;
    for (let i = 0; i < N; i++) {
      await logEntry(c.id, f.id, u.id, new Date(start + i * DAY), 'inconfort');
    }
    const event = makeRouteEvent({
      parent: async () => ({ child: { id: c.id, birthDate: c.birthDate } })
    });
    const out = await load(event as unknown as Parameters<typeof load>[0]);
    expect(out.notable.length).toBe(N);
  });

  it('surfaces only non-RAS reactions in the notable timeline and includes notes', async () => {
    const { u, c } = await setup();
    const banana = await seedFood('Banane', 'fruits');
    const fish = await seedFood('Saumon', 'poissons', 'poisson');

    await logEntry(
      c.id,
      banana.id,
      u.id,
      new Date('2024-05-01T10:00:00Z'),
      'ras',
      'OK au petit déj'
    );
    await logEntry(
      c.id,
      fish.id,
      u.id,
      new Date('2024-05-02T10:00:00Z'),
      'reaction',
      'urticaire 30min'
    );

    const event = makeRouteEvent({
      parent: async () => ({ child: { id: c.id, birthDate: c.birthDate } })
    });
    const out = await load(event as unknown as Parameters<typeof load>[0]);

    expect(out.notable.length).toBe(1);
    expect(out.notable[0].foodName).toBe('Saumon');
    expect(out.notable[0].notes).toBe('urticaire 30min');
  });

  it('aggregates allergens from a mixed entries fixture', async () => {
    const { u, c } = await setup();
    const oeuf = await seedFood('Œuf', 'proteines', 'oeuf');
    const arachide = await seedFood('Arachide', 'proteines', 'arachide');
    const carotte = await seedFood('Carotte', 'legumes', null);

    // 3 oeuf entries: ras, inconfort, ras → worst=inconfort, exposures=3
    await logEntry(c.id, oeuf.id, u.id, new Date('2026-04-01'), 'ras');
    await logEntry(c.id, oeuf.id, u.id, new Date('2026-04-15'), 'inconfort');
    await logEntry(c.id, oeuf.id, u.id, new Date('2026-05-01'), 'ras');
    // 1 arachide entry: reaction → worst=reaction, exposures=1
    await logEntry(c.id, arachide.id, u.id, new Date('2026-04-20'), 'reaction');
    // 2 non-allergen entries: should NOT appear in allergens output
    await logEntry(c.id, carotte.id, u.id, new Date('2026-04-10'), 'ras');
    await logEntry(c.id, carotte.id, u.id, new Date('2026-04-12'), 'ras');

    const data = await load(
      makeRouteEvent({
        user: u,
        params: { id: String(c.id) },
        parent: async () => ({ child: c })
      }) as unknown as Parameters<typeof load>[0]
    );

    const oeufRow = data.allergens.find((a) => a.id === 'oeuf');
    expect(oeufRow).toMatchObject({
      status: 'introduced',
      worst: 'inconfort',
      exposures: 3,
      firstGivenAt: new Date('2026-04-01').getTime(),
      lastGivenAt: new Date('2026-05-01').getTime()
    });

    const arachideRow = data.allergens.find((a) => a.id === 'arachide');
    expect(arachideRow).toMatchObject({
      status: 'introduced',
      worst: 'reaction',
      exposures: 1
    });

    const lait = data.allergens.find((a) => a.id === 'lait');
    expect(lait).toMatchObject({ status: 'untested', worst: null, exposures: 0 });
  });

  it('orders allergens priority-first, then non-priority, alphabetical within each group', async () => {
    const { c } = await setup();
    const event = makeRouteEvent({
      parent: async () => ({ child: c })
    });
    const data = await load(event as unknown as Parameters<typeof load>[0]);
    const priorityIds = new Set(PRIORITY_INTRODUCTION_ALLERGENS);
    // Every priority allergen comes before any non-priority allergen.
    const firstNonPriority = data.allergens.findIndex((a) => !priorityIds.has(a.id));
    if (firstNonPriority === -1) {
      // No non-priority allergens — vacuously ordered. Still check priority order.
    } else {
      for (let i = 0; i < firstNonPriority; i++) {
        expect(priorityIds.has(data.allergens[i].id)).toBe(true);
      }
      for (let i = firstNonPriority; i < data.allergens.length; i++) {
        expect(priorityIds.has(data.allergens[i].id)).toBe(false);
      }
    }
    // Within the priority group, check alphabetical (fr) order.
    const priorityRows = data.allergens.filter((a) => priorityIds.has(a.id));
    for (let i = 1; i < priorityRows.length; i++) {
      expect(
        priorityRows[i - 1].label.localeCompare(priorityRows[i].label, 'fr')
      ).toBeLessThanOrEqual(0);
    }
    // Within the non-priority group, check alphabetical (fr) order.
    const nonPriorityRows = data.allergens.filter((a) => !priorityIds.has(a.id));
    for (let i = 1; i < nonPriorityRows.length; i++) {
      expect(
        nonPriorityRows[i - 1].label.localeCompare(nonPriorityRows[i].label, 'fr')
      ).toBeLessThanOrEqual(0);
    }
  });

  it('flags isPriority on every allergen row', async () => {
    const { c } = await setup();
    const event = makeRouteEvent({
      parent: async () => ({ child: c })
    });
    const data = await load(event as unknown as Parameters<typeof load>[0]);
    for (const row of data.allergens) {
      expect(row.isPriority).toBe(
        (PRIORITY_INTRODUCTION_ALLERGENS as readonly string[]).includes(row.id)
      );
    }
  });

  it('returns the current diversification stage based on child age', async () => {
    const ctx = await setup({ ageMonths: 10 });
    const event = makeRouteEvent({
      parent: async () => ({ child: ctx.c })
    });
    const data = await load(event as unknown as Parameters<typeof load>[0]);
    expect(data.stage.id).toBe('9-12');
    expect(data.stage.title).toBeTruthy();
    expect(data.stage.textures).toBeTruthy();
  });

  it('returns the most-advanced non-finger texture logged', async () => {
    const ctx = await setup({ ageMonths: 10 });
    await testDb.insert(foodEntries).values([
      {
        childId: ctx.childId,
        foodId: ctx.foodId,
        givenAt: new Date(),
        reaction: 'ras',
        texture: 'lisse',
        createdAt: new Date(),
        loggedBy: ctx.u.id
      },
      {
        childId: ctx.childId,
        foodId: ctx.foodId,
        givenAt: new Date(),
        reaction: 'ras',
        texture: 'ecrasee',
        createdAt: new Date(),
        loggedBy: ctx.u.id
      },
      {
        childId: ctx.childId,
        foodId: ctx.foodId,
        givenAt: new Date(),
        reaction: 'ras',
        texture: 'finger',
        createdAt: new Date(),
        loggedBy: ctx.u.id
      }
    ]);
    const event = makeRouteEvent({
      parent: async () => ({ child: ctx.c })
    });
    const data = await load(event as unknown as Parameters<typeof load>[0]);
    expect(data.mostAdvancedTexture).toBe('ecrasee'); // finger is parallel/opt-in — excluded
  });

  it('returns null mostAdvancedTexture when no texture is logged', async () => {
    const ctx = await setup({ ageMonths: 7 });
    const event = makeRouteEvent({
      parent: async () => ({ child: ctx.c })
    });
    const data = await load(event as unknown as Parameters<typeof load>[0]);
    expect(data.mostAdvancedTexture).toBeNull();
  });
});
