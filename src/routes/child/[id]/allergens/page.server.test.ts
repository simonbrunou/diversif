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
import { ALLERGENS } from '$lib/utils/allergens';
import { load } from './+page.server';

beforeEach(async () => {
  await resetTestDb();
});

async function setup() {
  const u = await seedUser();
  const c = await seedChild({ createdBy: u.id });
  const m = await seedMembership({ userId: u.id, childId: c.id, role: 'owner' });
  return { u, c, m };
}

function loadFor({ u, c, m }: Awaited<ReturnType<typeof setup>>) {
  return load(
    makeRouteEvent({
      user: safeUser(u),
      memberships: [m],
      params: { id: String(c.id) }
    }) as unknown as Parameters<typeof load>[0]
  );
}

describe('child/[id]/allergens load', () => {
  it('rejects guests with a redirect to /login', async () => {
    const { c } = await setup();
    const r = await captureFlow(() =>
      load(
        makeRouteEvent({
          user: null,
          params: { id: String(c.id) }
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
          params: { id: 'not-a-number' }
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
          params: { id: 'not-a-number' }
        }) as unknown as Parameters<typeof load>[0]
      )
    );
    expect(r.kind).toBe('error');
    if (r.kind === 'error') expect(r.status).toBe(404);
  });

  it('rejects authenticated users without membership with 403', async () => {
    const { c } = await setup();
    const intruder = await seedUser({ email: 'intruder@example.com' });
    const r = await captureFlow(() =>
      load(
        makeRouteEvent({
          user: safeUser(intruder),
          memberships: [],
          params: { id: String(c.id) }
        }) as unknown as Parameters<typeof load>[0]
      )
    );
    expect(r.kind).toBe('error');
    if (r.kind === 'error') expect(r.status).toBe(403);
  });

  it('returns every allergen with introduced=false when no entries', async () => {
    const ctx = await setup();
    const out = await loadFor(ctx);
    expect(out.allergens.length).toBe(ALLERGENS.length);
    expect(out.allergens.every((a) => !a.introduced)).toBe(true);
  });

  it('counts introductions and tracks first/last timestamps', async () => {
    const ctx = await setup();
    const food = (
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
    const t1 = new Date('2024-06-01T10:00:00Z');
    const t2 = new Date('2024-07-15T10:00:00Z');
    await testDb.insert(foodEntries).values([
      {
        childId: ctx.c.id,
        foodId: food.id,
        givenAt: t1,
        reaction: 'ras',
        notes: null,
        loggedBy: ctx.u.id,
        createdAt: new Date()
      },
      {
        childId: ctx.c.id,
        foodId: food.id,
        givenAt: t2,
        reaction: 'ras',
        notes: null,
        loggedBy: ctx.u.id,
        createdAt: new Date()
      }
    ]);

    const out = await loadFor(ctx);
    const oeuf = out.allergens.find((a) => a.id === 'oeuf')!;
    expect(oeuf.introduced).toBe(true);
    expect(oeuf.count).toBe(2);
    expect(oeuf.firstIntroAt).toBe(t1.getTime());
    expect(oeuf.lastIntroAt).toBe(t2.getTime());
  });
});

describe('allergens load — bento redirect', () => {
  it('redirects to /foods?segment=allergens when bento is on', async () => {
    const u = await seedUser();
    const c = await seedChild({ createdBy: u.id, name: 'L' });
    const mem = await seedMembership({ userId: u.id, childId: c.id, role: 'owner' });
    const event = makeRouteEvent({
      user: safeUser(u),
      memberships: [mem],
      params: { id: String(c.id) },
      parent: async () => ({ bento: true })
    });
    const r = await captureFlow(() => load(event as unknown as Parameters<typeof load>[0]));
    expect(r.kind).toBe('redirect');
    if (r.kind === 'redirect') {
      expect(r.location).toBe(`/child/${c.id}/foods?segment=allergens`);
    }
  });

  it('falls through to legacy logic when bento is off', async () => {
    const u = await seedUser();
    const c = await seedChild({ createdBy: u.id, name: 'L' });
    const mem = await seedMembership({ userId: u.id, childId: c.id, role: 'owner' });
    const event = makeRouteEvent({
      user: safeUser(u),
      memberships: [mem],
      params: { id: String(c.id) },
      parent: async () => ({ bento: false })
    });
    const r = await captureFlow(() => load(event as unknown as Parameters<typeof load>[0]));
    expect(r.kind).not.toBe('redirect');
  });
});
