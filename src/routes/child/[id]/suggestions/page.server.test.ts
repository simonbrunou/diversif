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
  // 9 months old
  const birth = new Date();
  birth.setMonth(birth.getMonth() - 9);
  const dateStr = `${birth.getFullYear()}-${String(birth.getMonth() + 1).padStart(2, '0')}-${String(birth.getDate()).padStart(2, '0')}`;
  const c = seedChild({ createdBy: u.id, birthDate: dateStr });
  return { u, c };
}

function insertFood(opts: { name: string; category: string; age: number; allergen?: string }) {
  return testDb
    .insert(foods)
    .values({
      name: opts.name,
      category: opts.category,
      isMajorAllergen: opts.allergen != null,
      allergenType: opts.allergen ?? null,
      suggestedAgeMonths: opts.age,
      notes: null,
      isCustom: false,
      customForChildId: null
    })
    .returning()
    .all()[0];
}

describe('child/[id]/suggestions load', () => {
  it('returns priorityAllergens and others, age-appropriate', async () => {
    const { c } = await setup();
    const young = insertFood({ name: 'Young', category: 'legumes', age: 4 });
    const old = insertFood({ name: 'Old', category: 'fruits', age: 18 });
    const peanut = insertFood({
      name: 'Beurre de cacahuète',
      category: 'allergenes',
      age: 6,
      allergen: 'arachide'
    });

    const out = await load(
      makeRouteEvent({
        params: { id: String(c.id) },
        parent: async () => ({ child: { id: c.id, birthDate: c.birthDate } })
      }) as unknown as Parameters<typeof load>[0]
    );

    expect(out.priorityAllergens.find((f) => f.id === peanut.id)).toBeDefined();
    expect(out.others.find((f) => f.id === young.id)).toBeDefined();
    expect(out.others.find((f) => f.id === old.id)).toBeUndefined();

    // ignore unused variable warnings
    expect(typeof out.ageMonths).toBe('number');
  });

  it('excludes already-introduced foods + drops introduced allergens from priority', async () => {
    const { u, c } = await setup();
    const peanut = insertFood({
      name: 'Beurre de cacahuète',
      category: 'allergenes',
      age: 6,
      allergen: 'arachide'
    });
    const egg = insertFood({
      name: 'Œuf',
      category: 'oeufs',
      age: 6,
      allergen: 'oeuf'
    });

    testDb
      .insert(foodEntries)
      .values({
        childId: c.id,
        foodId: peanut.id,
        givenAt: new Date(),
        reaction: 'ras',
        notes: null,
        loggedBy: u.id,
        createdAt: new Date()
      })
      .run();

    const out = await load(
      makeRouteEvent({
        params: { id: String(c.id) },
        parent: async () => ({ child: { id: c.id, birthDate: c.birthDate } })
      }) as unknown as Parameters<typeof load>[0]
    );

    // peanut already introduced — should not appear at all
    expect(out.priorityAllergens.find((f) => f.id === peanut.id)).toBeUndefined();
    expect(out.others.find((f) => f.id === peanut.id)).toBeUndefined();
    // egg still in priority — its allergen "oeuf" not yet introduced
    expect(out.priorityAllergens.find((f) => f.id === egg.id)).toBeDefined();
  });

  it('clamps minimum age threshold to 4 months', async () => {
    const u = await seedUser();
    const veryYoung = new Date();
    veryYoung.setMonth(veryYoung.getMonth() - 1);
    const dateStr = `${veryYoung.getFullYear()}-${String(veryYoung.getMonth() + 1).padStart(2, '0')}-${String(veryYoung.getDate()).padStart(2, '0')}`;
    const c = seedChild({ createdBy: u.id, birthDate: dateStr });
    const okFood = insertFood({ name: 'Carotte', category: 'legumes', age: 4 });
    const out = await load(
      makeRouteEvent({
        params: { id: String(c.id) },
        parent: async () => ({ child: { id: c.id, birthDate: c.birthDate } })
      }) as unknown as Parameters<typeof load>[0]
    );
    expect(out.others.find((f) => f.id === okFood.id)).toBeDefined();
  });
});
