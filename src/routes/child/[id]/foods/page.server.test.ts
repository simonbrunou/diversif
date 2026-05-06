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

beforeEach(() => {
  resetTestDb();
});

async function setup() {
  const u = await seedUser();
  const c = seedChild({ createdBy: u.id });
  const m = seedMembership({ userId: u.id, childId: c.id, role: 'owner' });
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
    ctx.log(ctx.carrot.id, 'ras', 1);
    ctx.log(ctx.apple.id, 'ras', 2);
    const out = await loadFor(ctx, `http://localhost/child/${ctx.c.id}/foods`);
    expect(out.entries.length).toBe(2);
    expect(out.filters).toEqual({ q: '', category: '', reaction: '', repeat: false });
  });

  it('filters by category', async () => {
    const ctx = await setup();
    ctx.log(ctx.carrot.id, 'ras', 1);
    ctx.log(ctx.apple.id, 'ras', 2);
    const out = await loadFor(ctx, `http://localhost/child/${ctx.c.id}/foods?category=fruits`);
    expect(out.entries.length).toBe(1);
    expect(out.entries[0].foodName).toBe('Pomme');
  });

  it('filters by reaction', async () => {
    const ctx = await setup();
    ctx.log(ctx.carrot.id, 'ras', 1);
    ctx.log(ctx.apple.id, 'inconfort', 2);
    const out = await loadFor(ctx, `http://localhost/child/${ctx.c.id}/foods?reaction=inconfort`);
    expect(out.entries.map((e) => e.foodName)).toEqual(['Pomme']);
  });

  it('ignores reaction filter for unknown values', async () => {
    const ctx = await setup();
    ctx.log(ctx.carrot.id, 'ras', 1);
    const out = await loadFor(ctx, `http://localhost/child/${ctx.c.id}/foods?reaction=bogus`);
    expect(out.entries.length).toBe(1);
  });

  it('filters by text query (q)', async () => {
    const ctx = await setup();
    ctx.log(ctx.carrot.id, 'ras', 1);
    ctx.log(ctx.apple.id, 'ras', 2);
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
    // carrot: 1 ras → candidate
    ctx.log(ctx.carrot.id, 'ras', 1);
    // apple: 3 ras → not candidate (count > 2)
    ctx.log(ctx.apple.id, 'ras', 1);
    ctx.log(ctx.apple.id, 'ras', 2);
    ctx.log(ctx.apple.id, 'ras', 3);
    const out = await loadFor(ctx, `http://localhost/child/${ctx.c.id}/foods?repeat=1`);
    expect(out.entries.every((e) => e.foodName === 'Carotte')).toBe(true);
  });

  it('shows "Compte supprimé" for entries whose logger was deleted', async () => {
    const ctx = await setup();
    testDb
      .insert(foodEntries)
      .values({
        childId: ctx.c.id,
        foodId: ctx.carrot.id,
        givenAt: new Date(),
        reaction: 'ras',
        notes: null,
        loggedBy: null,
        createdAt: new Date()
      })
      .run();
    const out = await loadFor(ctx, `http://localhost/child/${ctx.c.id}/foods`);
    expect(out.entries).toHaveLength(1);
    expect(out.entries[0].loggedByName).toBe('Compte supprimé');
  });
});
