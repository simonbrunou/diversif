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
  const carrot = testDb
    .insert(foods)
    .values({
      name: 'Carotte',
      category: 'legumes',
      isMajorAllergen: false,
      allergenType: null,
      suggestedAgeMonths: 4,
      notes: null,
      isCustom: false,
      customForChildId: null
    })
    .returning()
    .all()[0];
  const apple = testDb
    .insert(foods)
    .values({
      name: 'Pomme',
      category: 'fruits',
      isMajorAllergen: false,
      allergenType: null,
      suggestedAgeMonths: 4,
      notes: null,
      isCustom: false,
      customForChildId: null
    })
    .returning()
    .all()[0];
  const log = (foodId: number, reaction: 'ras' | 'inconfort' | 'reaction', daysAgo = 0) =>
    testDb
      .insert(foodEntries)
      .values({
        childId: c.id,
        foodId,
        givenAt: new Date(Date.now() - daysAgo * 86400_000),
        reaction,
        notes: null,
        loggedBy: u.id,
        createdAt: new Date()
      })
      .run();
  return { u, c, carrot, apple, log };
}

describe('child/[id]/foods load', () => {
  it('returns all entries when no filter', async () => {
    const { c, carrot, apple, log } = await setup();
    log(carrot.id, 'ras', 1);
    log(apple.id, 'ras', 2);
    const out = await load(
      makeRouteEvent({
        params: { id: String(c.id) },
        url: `http://localhost/child/${c.id}/foods`
      }) as unknown as Parameters<typeof load>[0]
    );
    expect(out.entries.length).toBe(2);
    expect(out.filters).toEqual({ q: '', category: '', reaction: '', repeat: false });
  });

  it('filters by category', async () => {
    const { c, carrot, apple, log } = await setup();
    log(carrot.id, 'ras', 1);
    log(apple.id, 'ras', 2);
    const out = await load(
      makeRouteEvent({
        params: { id: String(c.id) },
        url: `http://localhost/child/${c.id}/foods?category=fruits`
      }) as unknown as Parameters<typeof load>[0]
    );
    expect(out.entries.length).toBe(1);
    expect(out.entries[0].foodName).toBe('Pomme');
  });

  it('filters by reaction', async () => {
    const { c, carrot, apple, log } = await setup();
    log(carrot.id, 'ras', 1);
    log(apple.id, 'inconfort', 2);
    const out = await load(
      makeRouteEvent({
        params: { id: String(c.id) },
        url: `http://localhost/child/${c.id}/foods?reaction=inconfort`
      }) as unknown as Parameters<typeof load>[0]
    );
    expect(out.entries.map((e) => e.foodName)).toEqual(['Pomme']);
  });

  it('ignores reaction filter for unknown values', async () => {
    const { c, carrot, log } = await setup();
    log(carrot.id, 'ras', 1);
    const out = await load(
      makeRouteEvent({
        params: { id: String(c.id) },
        url: `http://localhost/child/${c.id}/foods?reaction=bogus`
      }) as unknown as Parameters<typeof load>[0]
    );
    expect(out.entries.length).toBe(1);
  });

  it('filters by text query (q)', async () => {
    const { c, carrot, apple, log } = await setup();
    log(carrot.id, 'ras', 1);
    log(apple.id, 'ras', 2);
    const out = await load(
      makeRouteEvent({
        params: { id: String(c.id) },
        url: `http://localhost/child/${c.id}/foods?q=pom`
      }) as unknown as Parameters<typeof load>[0]
    );
    expect(out.entries.map((e) => e.foodName)).toEqual(['Pomme']);
  });

  it('repeat=1 with no candidates returns empty', async () => {
    const { c } = await setup();
    const out = await load(
      makeRouteEvent({
        params: { id: String(c.id) },
        url: `http://localhost/child/${c.id}/foods?repeat=1`
      }) as unknown as Parameters<typeof load>[0]
    );
    expect(out.entries).toEqual([]);
    expect(out.filters.repeat).toBe(true);
  });

  it('repeat=1 includes only foods given <=2 times with worst <= inconfort', async () => {
    const { c, carrot, apple, log } = await setup();
    // carrot: 1 ras → candidate
    log(carrot.id, 'ras', 1);
    // apple: 3 ras → not candidate (count > 2)
    log(apple.id, 'ras', 1);
    log(apple.id, 'ras', 2);
    log(apple.id, 'ras', 3);
    const out = await load(
      makeRouteEvent({
        params: { id: String(c.id) },
        url: `http://localhost/child/${c.id}/foods?repeat=1`
      }) as unknown as Parameters<typeof load>[0]
    );
    expect(out.entries.every((e) => e.foodName === 'Carotte')).toBe(true);
  });

  it('shows "Compte supprimé" for entries whose logger was deleted', async () => {
    const { c, carrot } = await setup();
    testDb
      .insert(foodEntries)
      .values({
        childId: c.id,
        foodId: carrot.id,
        givenAt: new Date(),
        reaction: 'ras',
        notes: null,
        loggedBy: null,
        createdAt: new Date()
      })
      .run();
    const out = await load(
      makeRouteEvent({
        params: { id: String(c.id) },
        url: `http://localhost/child/${c.id}/foods`
      }) as unknown as Parameters<typeof load>[0]
    );
    expect(out.entries).toHaveLength(1);
    expect(out.entries[0].loggedByName).toBe('Compte supprimé');
  });
});
