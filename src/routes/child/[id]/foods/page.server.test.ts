import { describe, it, expect, beforeEach, vi } from 'vitest';
import { testDb, resetTestDb } from '../../../../test/db';
import {
  captureFlow,
  makeRouteEvent,
  safeUser,
  seedChild,
  seedMembership,
  seedUser
} from '../../../../test/route';

vi.mock('$lib/server/db', () => ({ db: testDb }));

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
  it('rejects guests with a redirect to /login', async () => {
    const { c } = await setup();
    const r = await captureFlow(() =>
      load(
        makeRouteEvent({
          user: null,
          params: { id: String(c.id) },
          url: `http://localhost/child/${c.id}/foods`
        }) as unknown as Parameters<typeof load>[0]
      )
    );
    expect(r.kind).toBe('redirect');
  });

  it('redirects guests to /login even when the URL has a malformed id', async () => {
    const r = await captureFlow(() =>
      load(
        makeRouteEvent({
          user: null,
          params: { id: 'not-a-number' },
          url: `http://localhost/child/abc/foods`
        }) as unknown as Parameters<typeof load>[0]
      )
    );
    expect(r.kind).toBe('redirect');
  });

  it('rejects non-numeric child IDs with 404 before any query or membership check', async () => {
    const ctx = await setup();
    const r = await captureFlow(() =>
      load(
        makeRouteEvent({
          user: safeUser(ctx.u),
          memberships: [ctx.m],
          params: { id: 'not-a-number' },
          url: `http://localhost/child/abc/foods`
        }) as unknown as Parameters<typeof load>[0]
      )
    );
    expect(r.kind).toBe('error');
    if (r.kind === 'error') expect(r.status).toBe(404);
  });

  it('rejects authenticated users without membership with 403', async () => {
    const ctx = await setup();
    const intruder = await seedUser({ email: 'intruder@example.com' });
    const r = await captureFlow(() =>
      load(
        makeRouteEvent({
          user: safeUser(intruder),
          memberships: [],
          params: { id: String(ctx.c.id) },
          url: `http://localhost/child/${ctx.c.id}/foods`
        }) as unknown as Parameters<typeof load>[0]
      )
    );
    expect(r.kind).toBe('error');
    if (r.kind === 'error') expect(r.status).toBe(403);
  });

  it('returns all entries when no filter', async () => {
    const ctx = await setup();
    await ctx.log(ctx.carrot.id, 'ras', 1);
    await ctx.log(ctx.apple.id, 'ras', 2);
    const out = await loadFor(ctx, `http://localhost/child/${ctx.c.id}/foods`);
    expect(out.entries.length).toBe(2);
    expect(out.filters).toEqual({ q: '', category: '', reaction: '', repeat: false });
  });

  it('filters by category', async () => {
    const ctx = await setup();
    await ctx.log(ctx.carrot.id, 'ras', 1);
    await ctx.log(ctx.apple.id, 'ras', 2);
    const out = await loadFor(ctx, `http://localhost/child/${ctx.c.id}/foods?category=fruits`);
    expect(out.entries.length).toBe(1);
    expect(out.entries[0].foodName).toBe('Pomme');
  });

  it('filters by reaction', async () => {
    const ctx = await setup();
    await ctx.log(ctx.carrot.id, 'ras', 1);
    await ctx.log(ctx.apple.id, 'inconfort', 2);
    const out = await loadFor(ctx, `http://localhost/child/${ctx.c.id}/foods?reaction=inconfort`);
    expect(out.entries.map((e) => e.foodName)).toEqual(['Pomme']);
  });

  it('ignores reaction filter for unknown values', async () => {
    const ctx = await setup();
    await ctx.log(ctx.carrot.id, 'ras', 1);
    const out = await loadFor(ctx, `http://localhost/child/${ctx.c.id}/foods?reaction=bogus`);
    expect(out.entries.length).toBe(1);
  });

  it('filters by text query (q)', async () => {
    const ctx = await setup();
    await ctx.log(ctx.carrot.id, 'ras', 1);
    await ctx.log(ctx.apple.id, 'ras', 2);
    const out = await loadFor(ctx, `http://localhost/child/${ctx.c.id}/foods?q=pom`);
    expect(out.entries.map((e) => e.foodName)).toEqual(['Pomme']);
  });

  it('repeat=1 with no candidates returns empty', async () => {
    const ctx = await setup();
    const out = await loadFor(ctx, `http://localhost/child/${ctx.c.id}/foods?repeat=1`);
    expect(out.entries).toEqual([]);
    expect(out.filters.repeat).toBe(true);
  });

  it('repeat=1 includes only foods given <=2 times with worst <= inconfort', async () => {
    const ctx = await setup();
    await ctx.log(ctx.carrot.id, 'ras', 1);
    await ctx.log(ctx.apple.id, 'ras', 1);
    await ctx.log(ctx.apple.id, 'ras', 2);
    await ctx.log(ctx.apple.id, 'ras', 3);
    const out = await loadFor(ctx, `http://localhost/child/${ctx.c.id}/foods?repeat=1`);
    expect(out.entries.every((e) => e.foodName === 'Carotte')).toBe(true);
  });

  it('shows "Compte supprimé" for entries whose logger was deleted', async () => {
    const ctx = await setup();
    await testDb.insert(foodEntries).values({
      childId: ctx.c.id,
      foodId: ctx.carrot.id,
      givenAt: new Date(),
      reaction: 'ras',
      notes: null,
      loggedBy: null,
      createdAt: new Date()
    });
    const out = await loadFor(ctx, `http://localhost/child/${ctx.c.id}/foods`);
    expect(out.entries).toHaveLength(1);
    expect(out.entries[0].loggedByName).toBe('Compte supprimé');
  });

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
    // — TRUE arm of the severity check, escalating the stored status.
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
    // No entries seeded — bentoFoods should be empty but the field definition
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
        givenAt: new Date('2026-05-10T10:00:00Z'),
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
      expect(a!.lastTried).toBe('10/05/26');
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
    // One ras entry plus one reaction entry — should escalate to 'reaction'.
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
    expect(out.weeklyEntries).toHaveLength(7);
    expect(out.weeklyEntries.reduce((s, n) => s + n, 0)).toBe(5);
    expect(out.weeklyEntries[6]).toBe(2); // today
    expect(out.weeklyEntries[5]).toBe(2); // yesterday
    expect(out.weeklyEntries[4]).toBe(1); // two days ago
  });

  it('repeat=1 early-return branch still emits bentoAllergens + weeklyEntries', async () => {
    // Seed an entry that satisfies the allergen/weekly queries but make the
    // repeat candidate query return zero — by recording 3 entries for the
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
    expect(out.weeklyEntries).toHaveLength(7);
    expect(out.weeklyEntries.reduce((s, n) => s + n, 0)).toBe(3);
  });
});
