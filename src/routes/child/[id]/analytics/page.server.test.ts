import { describe, it, expect, beforeEach, vi } from 'vitest';
import { testDb, resetTestDb } from '../../../../test/db';
import { makeRouteEvent, seedChild, seedUser } from '../../../../test/route';

vi.mock('$lib/server/db', () => ({ db: testDb }));

import { foodEntries, foods } from '$lib/server/db/schema';
import { load } from './+page.server';

beforeEach(async () => {
  await resetTestDb();
});

describe('child/[id]/analytics load', () => {
  it('returns 12 buckets and the diversity denominator for a fresh child', async () => {
    const u = await seedUser();
    const c = await seedChild({ createdBy: u.id });
    const event = makeRouteEvent({
      parent: async () => ({ child: { id: c.id, birthDate: c.birthDate } })
    });
    const out = await load(event as unknown as Parameters<typeof load>[0]);
    expect(out.weeks).toBe(12);
    expect(out.buckets).toHaveLength(12);
    expect(out.totalCategories).toBeGreaterThan(0);
  });

  it('reflects logged entries in the most recent bucket', async () => {
    const u = await seedUser();
    const c = await seedChild({ createdBy: u.id });
    const carrot = (
      await testDb
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
    )[0];
    // 1s in the past so the entry is unambiguously inside the rightmost
    // bucket window (which is half-open `[now-7d, now)`).
    await testDb.insert(foodEntries).values({
      childId: c.id,
      foodId: carrot.id,
      givenAt: new Date(Date.now() - 1000),
      reaction: 'ras',
      notes: null,
      loggedBy: u.id,
      createdAt: new Date()
    });

    const event = makeRouteEvent({
      parent: async () => ({ child: { id: c.id, birthDate: c.birthDate } })
    });
    const out = await load(event as unknown as Parameters<typeof load>[0]);
    const last = out.buckets[out.buckets.length - 1];
    expect(last.introductions).toBe(1);
    expect(last.reactions.ras).toBe(1);
    expect(last.cumulativeCategories).toBe(1);
  });
});
