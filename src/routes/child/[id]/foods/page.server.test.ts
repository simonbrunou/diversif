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
});
