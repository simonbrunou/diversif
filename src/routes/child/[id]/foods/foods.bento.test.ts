import { beforeEach, describe, expect, it, mock, setSystemTime } from 'bun:test';
import { testDb, resetTestDb } from '../../../../test/db';
import {
  makeRouteEvent,
  safeUser,
  seedChild,
  seedMembership,
  seedUser
} from '../../../../test/route';

mock.module('$lib/server/db', () => ({ db: testDb }));

import { foodEntries, foods } from '$lib/server/db/schema';
import { load } from './+page.server';

beforeEach(async () => {
  await resetTestDb();
});

async function setup() {
  const u = await seedUser();
  const c = await seedChild({ createdBy: u.id });
  const m = await seedMembership({ userId: u.id, childId: c.id, role: 'owner' });
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
  const apple = (
    await testDb
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
  )[0];
  const log = async (foodId: number, reaction: 'ras' | 'inconfort' | 'reaction', daysAgo = 0) => {
    await testDb.insert(foodEntries).values({
      childId: c.id,
      foodId,
      givenAt: new Date(Date.now() - daysAgo * 86400_000),
      reaction,
      notes: null,
      loggedBy: u.id,
      createdAt: new Date()
    });
  };
  return { u, c, m, carrot, apple, log };
}

type SetupCtx = Awaited<ReturnType<typeof setup>>;
function loadFor(ctx: SetupCtx, url: string) {
  return load(
    makeRouteEvent({
      user: safeUser(ctx.u),
      memberships: [ctx.m],
      params: { id: String(ctx.c.id) },
      url
    }) as unknown as Parameters<typeof load>[0]
  );
}

describe('child/[id]/foods load', () => {
  it('aggregates duplicate food logs and tracks worst reaction', async () => {
    const ctx = await setup();
    // Three entries for the same food:
    //   1st (givenAt 05-03): 'reaction' → seeded first in the map via the else branch
    //   2nd (givenAt 05-02): 'inconfort' → hits if (existing), severity < existing.status → false arm of the > check
    //   3rd (givenAt 05-01): 'ras'       → hits if (existing), severity < existing.status → false arm again
    // The DESC orderBy means the most-recent row populates the map first, so subsequent
    // rows always have lower severity and exercise the false-branch of the condition.
    await testDb.insert(foodEntries).values([
      {
        childId: ctx.c.id,
        foodId: ctx.carrot.id,
        reaction: 'reaction',
        givenAt: new Date('2026-05-03T10:00:00Z'),
        notes: null,
        loggedBy: ctx.u.id,
        createdAt: new Date()
      },
      {
        childId: ctx.c.id,
        foodId: ctx.carrot.id,
        reaction: 'inconfort',
        givenAt: new Date('2026-05-02T10:00:00Z'),
        notes: null,
        loggedBy: ctx.u.id,
        createdAt: new Date()
      },
      {
        childId: ctx.c.id,
        foodId: ctx.carrot.id,
        reaction: 'ras',
        givenAt: new Date('2026-05-01T10:00:00Z'),
        notes: null,
        loggedBy: ctx.u.id,
        createdAt: new Date()
      }
    ]);
    // Apple covers the inverse branch: the loader iterates rows in DESC
    // givenAt order, so the most-recent (ras) populates the map first. The
    // older (reaction) entry then hits if (existing) AND severity > existing.status
    // : TRUE arm of the severity check, escalating the stored status.
    await testDb.insert(foodEntries).values([
      {
        childId: ctx.c.id,
        foodId: ctx.apple.id,
        reaction: 'ras',
        givenAt: new Date('2026-05-04T10:00:00Z'),
        notes: null,
        loggedBy: ctx.u.id,
        createdAt: new Date()
      },
      {
        childId: ctx.c.id,
        foodId: ctx.apple.id,
        reaction: 'reaction',
        givenAt: new Date('2026-05-03T08:00:00Z'),
        notes: null,
        loggedBy: ctx.u.id,
        createdAt: new Date()
      }
    ]);
    const out = await loadFor(ctx, `http://localhost/child/${ctx.c.id}/foods`);
    if (!('bentoFoods' in out)) throw new Error('expected bentoFoods in load result');
    const carrotEntry = out.bentoFoods.find((f) => f.name === 'Carotte');
    expect(carrotEntry).toBeDefined();
    expect(carrotEntry!.tried).toBe(3);
    expect(carrotEntry!.status).toBe('reaction');
    const appleEntry = out.bentoFoods.find((f) => f.name === 'Pomme');
    expect(appleEntry).toBeDefined();
    expect(appleEntry!.tried).toBe(2);
    expect(appleEntry!.status).toBe('reaction');
  });

  it('bentoFoods includes lastEntryId pointing to the most-recent entry row', async () => {
    const ctx = await setup();
    // Insert two entries for carrot; the most-recent one (2026-05-03) should
    // be captured as lastEntryId because rows come back DESC givenAt.
    const [older] = await testDb
      .insert(foodEntries)
      .values({
        childId: ctx.c.id,
        foodId: ctx.carrot.id,
        reaction: 'ras',
        givenAt: new Date('2026-05-01T10:00:00Z'),
        notes: null,
        loggedBy: ctx.u.id,
        createdAt: new Date()
      })
      .returning();
    const [newer] = await testDb
      .insert(foodEntries)
      .values({
        childId: ctx.c.id,
        foodId: ctx.carrot.id,
        reaction: 'inconfort',
        givenAt: new Date('2026-05-03T10:00:00Z'),
        notes: null,
        loggedBy: ctx.u.id,
        createdAt: new Date()
      })
      .returning();

    const out = await loadFor(ctx, `http://localhost/child/${ctx.c.id}/foods`);
    if (!('bentoFoods' in out)) throw new Error('expected bentoFoods in load result');
    const carrotEntry = out.bentoFoods.find((f) => f.name === 'Carotte');
    expect(carrotEntry).toBeDefined();
    // lastEntryId must be the newer (higher givenAt) entry, not the older one
    expect(carrotEntry!.lastEntryId).toBe(newer.id);
    expect(carrotEntry!.lastEntryId).not.toBe(older.id);
  });

  it('bentoFoods lastEntryId is null for foods with no entries', async () => {
    // No entries seeded : bentoFoods should be empty but the field definition
    // allows null; verify the loader doesn't crash on an empty result set.
    const ctx = await setup();
    const out = await loadFor(ctx, `http://localhost/child/${ctx.c.id}/foods`);
    if (!('bentoFoods' in out)) throw new Error('expected bentoFoods in load result');
    expect(out.bentoFoods).toHaveLength(0);
  });

  it('bentoAllergens reports todo + null lastTried when the child has no entries', async () => {
    const ctx = await setup();
    const out = await loadFor(ctx, `http://localhost/child/${ctx.c.id}/foods`);
    if (!('bentoAllergens' in out)) throw new Error('expected bentoAllergens in load result');
    expect(out.bentoAllergens.length).toBeGreaterThanOrEqual(7);
    for (const a of out.bentoAllergens) {
      expect(a.state).toBe('todo');
      expect(a.triedCount).toBe(0);
      expect(a.lastTried).toBeNull();
    }
  });

  it('bentoAllergens reports cleared for each priority allergen tried once with ras', async () => {
    const ctx = await setup();
    const { PRIORITY_INTRODUCTION_ALLERGENS } = await import('$lib/utils/allergens');
    // Seed one food per priority allergen, each with a single 'ras' entry.
    for (const id of PRIORITY_INTRODUCTION_ALLERGENS) {
      const [food] = await testDb
        .insert(foods)
        .values({
          name: `Food-${id}`,
          category: 'autres',
          isMajorAllergen: true,
          allergenType: id,
          suggestedAgeMonths: 6,
          notes: null,
          isCustom: false,
          customForChildId: null
        })
        .returning();
      await testDb.insert(foodEntries).values({
        childId: ctx.c.id,
        foodId: food.id,
        givenAt: new Date(Date.now() - 1 * 86400_000),
        reaction: 'ras',
        notes: null,
        loggedBy: ctx.u.id,
        createdAt: new Date()
      });
    }
    const out = await loadFor(ctx, `http://localhost/child/${ctx.c.id}/foods`);
    if (!('bentoAllergens' in out)) throw new Error('expected bentoAllergens in load result');
    for (const id of PRIORITY_INTRODUCTION_ALLERGENS) {
      const a = out.bentoAllergens.find((x) => x.id === id);
      expect(a).toBeDefined();
      expect(a!.state).toBe('cleared');
      expect(a!.triedCount).toBe(1);
      expect(a!.lastTried).not.toBeNull();
    }
  });

  it('bentoAllergens flips state to reaction when any entry for that allergen reacted', async () => {
    const ctx = await setup();
    const [peanutFood] = await testDb
      .insert(foods)
      .values({
        name: 'Arachide grillée',
        category: 'autres',
        isMajorAllergen: true,
        allergenType: 'arachide',
        suggestedAgeMonths: 6,
        notes: null,
        isCustom: false,
        customForChildId: null
      })
      .returning();
    // One ras entry plus one reaction entry : should escalate to 'reaction'.
    await testDb.insert(foodEntries).values([
      {
        childId: ctx.c.id,
        foodId: peanutFood.id,
        givenAt: new Date('2026-05-08T10:00:00Z'),
        reaction: 'ras',
        notes: null,
        loggedBy: ctx.u.id,
        createdAt: new Date()
      },
      {
        childId: ctx.c.id,
        foodId: peanutFood.id,
        givenAt: new Date('2026-05-09T10:00:00Z'),
        reaction: 'reaction',
        notes: null,
        loggedBy: ctx.u.id,
        createdAt: new Date()
      }
    ]);
    const out = await loadFor(ctx, `http://localhost/child/${ctx.c.id}/foods`);
    if (!('bentoAllergens' in out)) throw new Error('expected bentoAllergens in load result');
    const peanut = out.bentoAllergens.find((a) => a.id === 'arachide');
    expect(peanut).toBeDefined();
    expect(peanut!.state).toBe('reaction');
    expect(peanut!.triedCount).toBe(2);
    // lastTried tracks the most-recent givenAt, regardless of reaction severity.
    expect(peanut!.lastTried).toBe('09/05/26');
  });

  it('weeklyEntries returns a 7-length array bucketed by day with today last', async () => {
    // Freeze Date so seeding (Date.now() - daysAgo), the load (new Date() in
    // loadWeeklyEntries), and the assertion all see the same wall clock —
    // without the freeze, a UTC midnight rollover between any pair flakes
    // both the bucket counts and the anchorUtc equality.
    setSystemTime(new Date()); /* [bun-test] was useFakeTimers({ toFake: ['Date'] }) */
    setSystemTime(new Date('2026-05-15T12:00:00Z'));
    try {
      const ctx = await setup();
      // Seed 5 entries across the last 3 days:
      //   - 2 today
      //   - 2 yesterday
      //   - 1 two days ago
      // Also seed one entry 30 days ago to confirm out-of-window entries are excluded.
      await ctx.log(ctx.carrot.id, 'ras', 0);
      await ctx.log(ctx.carrot.id, 'ras', 0);
      await ctx.log(ctx.apple.id, 'ras', 1);
      await ctx.log(ctx.apple.id, 'ras', 1);
      await ctx.log(ctx.carrot.id, 'ras', 2);
      await ctx.log(ctx.carrot.id, 'ras', 30);
      const out = await loadFor(ctx, `http://localhost/child/${ctx.c.id}/foods`);
      if (!('weeklyEntries' in out)) throw new Error('expected weeklyEntries in load result');
      expect(out.weeklyEntries.counts).toHaveLength(7);
      expect(out.weeklyEntries.counts.reduce((s, n) => s + n, 0)).toBe(5);
      expect(out.weeklyEntries.counts[6]).toBe(2); // today
      expect(out.weeklyEntries.counts[5]).toBe(2); // yesterday
      expect(out.weeklyEntries.counts[4]).toBe(1); // two days ago
      expect(out.weeklyEntries.anchorUtc).toBe(Date.UTC(2026, 4, 15));
    } finally {
      setSystemTime(null);
    }
  });

  describe('bentoAllergens fading state', () => {
    async function setupEgg() {
      const base = await setup();
      const egg = (
        await testDb
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
      )[0];
      const celery = (
        await testDb
          .insert(foods)
          .values({
            name: 'Céleri',
            category: 'legumes',
            isMajorAllergen: false,
            allergenType: 'celeri',
            suggestedAgeMonths: 9,
            notes: null,
            isCustom: false,
            customForChildId: null
          })
          .returning()
      )[0];
      return { ...base, egg, celery };
    }

    it("returns 'fading' for a priority allergen logged at least 7 days ago with no reaction", async () => {
      const ctx = await setupEgg();
      await ctx.log(ctx.egg.id, 'ras', /* daysAgo */ 7);
      const res = await loadFor(ctx, 'http://x/child/1/foods?segment=allergens');
      const oeuf = res.bentoAllergens.find((a: { id: string }) => a.id === 'oeuf');
      expect(oeuf?.state).toBe('fading');
      expect(oeuf?.daysSinceLastTried).toBe(7);
    });

    it("returns 'cleared' for a priority allergen logged less than 7 days ago", async () => {
      const ctx = await setupEgg();
      await ctx.log(ctx.egg.id, 'ras', 6);
      const res = await loadFor(ctx, 'http://x/child/1/foods?segment=allergens');
      const oeuf = res.bentoAllergens.find((a: { id: string }) => a.id === 'oeuf');
      expect(oeuf?.state).toBe('cleared');
    });

    it("keeps 'inconfort' state instead of treating the allergen as cleared", async () => {
      const ctx = await setupEgg();
      await ctx.log(ctx.egg.id, 'inconfort', 8);
      const res = await loadFor(ctx, 'http://x/child/1/foods?segment=allergens');
      const oeuf = res.bentoAllergens.find((a: { id: string }) => a.id === 'oeuf');
      expect(oeuf?.state).toBe('inconfort');
    });

    it("keeps 'reaction' state even if last log is > 7 days ago (reaction trumps fading)", async () => {
      const ctx = await setupEgg();
      await ctx.log(ctx.egg.id, 'reaction', 8);
      const res = await loadFor(ctx, 'http://x/child/1/foods?segment=allergens');
      const oeuf = res.bentoAllergens.find((a: { id: string }) => a.id === 'oeuf');
      expect(oeuf?.state).toBe('reaction');
    });

    it("does not mark non-priority allergens (céleri) as 'fading' regardless of gap", async () => {
      const ctx = await setupEgg();
      await ctx.log(ctx.celery.id, 'ras', 30);
      const res = await loadFor(ctx, 'http://x/child/1/foods?segment=allergens');
      const celeri = res.bentoAllergens.find((a: { id: string }) => a.id === 'celeri');
      expect(celeri?.state).toBe('cleared');
    });

    it("returns 'todo' for a priority allergen never logged", async () => {
      const ctx = await setupEgg();
      const res = await loadFor(ctx, 'http://x/child/1/foods?segment=allergens');
      const arachide = res.bentoAllergens.find((a: { id: string }) => a.id === 'arachide');
      expect(arachide?.state).toBe('todo');
    });
  });

  it('repeat=1 early-return branch still emits bentoAllergens + weeklyEntries', async () => {
    // Seed an entry that satisfies the allergen/weekly queries but make the
    // repeat candidate query return zero : by recording 3 entries for the
    // only food, the worst-<=1 / n-<=2 predicate excludes it, forcing the
    // ids.length === 0 branch. The new fields must still populate.
    const ctx = await setup();
    const [milk] = await testDb
      .insert(foods)
      .values({
        name: 'Lait infantile',
        category: 'produits_laitiers',
        isMajorAllergen: true,
        allergenType: 'lait',
        suggestedAgeMonths: 4,
        notes: null,
        isCustom: false,
        customForChildId: null
      })
      .returning();
    await testDb.insert(foodEntries).values([
      {
        childId: ctx.c.id,
        foodId: milk.id,
        givenAt: new Date(Date.now() - 1 * 86400_000),
        reaction: 'ras',
        notes: null,
        loggedBy: ctx.u.id,
        createdAt: new Date()
      },
      {
        childId: ctx.c.id,
        foodId: milk.id,
        givenAt: new Date(Date.now() - 2 * 86400_000),
        reaction: 'ras',
        notes: null,
        loggedBy: ctx.u.id,
        createdAt: new Date()
      },
      {
        childId: ctx.c.id,
        foodId: milk.id,
        givenAt: new Date(Date.now() - 3 * 86400_000),
        reaction: 'ras',
        notes: null,
        loggedBy: ctx.u.id,
        createdAt: new Date()
      }
    ]);
    const out = await loadFor(ctx, `http://localhost/child/${ctx.c.id}/foods?repeat=1`);
    expect(out.entries).toEqual([]);
    if (!('bentoAllergens' in out))
      throw new Error('expected bentoAllergens in repeat-empty branch');
    if (!('weeklyEntries' in out)) throw new Error('expected weeklyEntries in repeat-empty branch');
    const lait = out.bentoAllergens.find((a) => a.id === 'lait');
    expect(lait).toBeDefined();
    expect(lait!.state).toBe('cleared');
    expect(lait!.triedCount).toBe(3);
    expect(out.weeklyEntries.counts).toHaveLength(7);
    expect(out.weeklyEntries.counts.reduce((s, n) => s + n, 0)).toBe(3);
  });
});
