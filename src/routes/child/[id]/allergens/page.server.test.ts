import { describe, it, expect, beforeEach, vi } from 'vitest';
import { testDb, resetTestDb } from '../../../../test/db';
import { makeRouteEvent, seedChild, seedUser } from '../../../../test/route';

vi.mock('$lib/server/db', () => ({ db: testDb }));

import { foodEntries, foods } from '$lib/server/db/schema';
import { ALLERGENS } from '$lib/utils/allergens';
import { load } from './+page.server';

beforeEach(() => {
  resetTestDb();
});

describe('child/[id]/allergens load', () => {
  it('returns every allergen with introduced=false when no entries', async () => {
    const u = await seedUser();
    const c = seedChild({ createdBy: u.id });
    const out = await load(
      makeRouteEvent({ params: { id: String(c.id) } }) as unknown as Parameters<typeof load>[0]
    );
    expect(out.allergens.length).toBe(ALLERGENS.length);
    expect(out.allergens.every((a) => !a.introduced)).toBe(true);
  });

  it('counts introductions and tracks first/last timestamps', async () => {
    const u = await seedUser();
    const c = seedChild({ createdBy: u.id });
    const food = testDb
      .insert(foods)
      .values({
        name: 'Œuf',
        category: 'oeufs',
        isMajorAllergen: true,
        allergenType: 'oeuf',
        suggestedAgeMonths: 6,
        notes: null,
        isCustom: false,
        customForChildId: null
      })
      .returning()
      .all()[0];
    const t1 = new Date('2024-06-01T10:00:00Z');
    const t2 = new Date('2024-07-15T10:00:00Z');
    testDb
      .insert(foodEntries)
      .values([
        {
          childId: c.id,
          foodId: food.id,
          givenAt: t1,
          reaction: 'ras',
          notes: null,
          loggedBy: u.id,
          createdAt: new Date()
        },
        {
          childId: c.id,
          foodId: food.id,
          givenAt: t2,
          reaction: 'ras',
          notes: null,
          loggedBy: u.id,
          createdAt: new Date()
        }
      ])
      .run();

    const out = await load(
      makeRouteEvent({ params: { id: String(c.id) } }) as unknown as Parameters<typeof load>[0]
    );
    const oeuf = out.allergens.find((a) => a.id === 'oeuf')!;
    expect(oeuf.introduced).toBe(true);
    expect(oeuf.count).toBe(2);
    expect(oeuf.firstIntroAt).toBe(t1.getTime());
    expect(oeuf.lastIntroAt).toBe(t2.getTime());
  });
});
