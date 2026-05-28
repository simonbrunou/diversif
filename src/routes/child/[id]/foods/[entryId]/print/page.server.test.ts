import { beforeEach, describe, expect, it, mock } from 'bun:test';
import { testDb, resetTestDb } from '../../../../../../test/db';
import {
  makeRouteEvent,
  safeUser,
  seedChild,
  seedMembership,
  seedUser
} from '../../../../../../test/route';

mock.module('$lib/server/db', () => ({ db: testDb }));

import { foodEntries, foods, symptoms } from '$lib/server/db/schema';
import { load } from './+page.server';

beforeEach(async () => {
  await resetTestDb();
});

async function setup() {
  const u = await seedUser();
  const c = await seedChild({ createdBy: u.id });
  const m = await seedMembership({ userId: u.id, childId: c.id, role: 'owner' });
  const [pear] = await testDb
    .insert(foods)
    .values({
      name: 'Poire',
      category: 'fruits',
      isMajorAllergen: false,
      allergenType: null,
      suggestedAgeMonths: 4,
      notes: null,
      isCustom: false,
      customForChildId: null
    })
    .returning();
  const [entry] = await testDb
    .insert(foodEntries)
    .values({
      childId: c.id,
      foodId: pear.id,
      givenAt: new Date('2026-05-01T11:30:00Z'),
      reaction: 'reaction',
      notes: null,
      loggedBy: u.id,
      createdAt: new Date()
    })
    .returning();
  await testDb.insert(symptoms).values({
    foodEntryId: entry.id,
    childId: c.id,
    observedAt: new Date('2026-05-01T11:42:00Z'),
    label: 'rougeur',
    note: null,
    createdBy: u.id
  });
  return { u, c, m, pear, entry };
}

describe('print loader', () => {
  it('returns child name, food, symptoms, and generated_at (fr locale)', async () => {
    const ctx = await setup();
    const data = await load(
      makeRouteEvent({
        user: safeUser(ctx.u),
        memberships: [ctx.m],
        params: { id: String(ctx.c.id), entryId: String(ctx.entry.id) },
        url: 'http://localhost/'
      }) as unknown as Parameters<typeof load>[0]
    );
    expect(data.childName).toBe(ctx.c.name);
    expect(data.foodName).toBe('Poire');
    expect(data.symptoms).toHaveLength(1);
    expect(typeof data.generatedAt).toBe('string');
    expect(typeof data.months).toBe('number');
    // fr-FR date format contains a month name in French
    expect(data.givenAt).toMatch(/mai/i);
  });

  it('formats dates using en-GB when locale is en', async () => {
    const ctx = await setup();
    const data = await load(
      makeRouteEvent({
        user: safeUser(ctx.u),
        memberships: [ctx.m],
        params: { id: String(ctx.c.id), entryId: String(ctx.entry.id) },
        url: 'http://localhost/',
        locale: 'en'
      }) as unknown as Parameters<typeof load>[0]
    );
    expect(data.childName).toBe(ctx.c.name);
    expect(data.symptoms).toHaveLength(1);
    // en-GB date format contains an English month name
    expect(data.givenAt).toMatch(/May/i);
  });

  it('falls back to fr locale when locals.locale is undefined', async () => {
    const ctx = await setup();
    const event = makeRouteEvent({
      user: safeUser(ctx.u),
      memberships: [ctx.m],
      params: { id: String(ctx.c.id), entryId: String(ctx.entry.id) },
      url: 'http://localhost/'
    });
    // Override locale to undefined to exercise the ?? 'fr' fallback
    (event.locals as Record<string, unknown>).locale = undefined;
    const data = await load(event as unknown as Parameters<typeof load>[0]);
    expect(typeof data.givenAt).toBe('string');
    expect(data.givenAt).toMatch(/mai/i);
  });

  it('throws 404 when the entry does not belong to the child', async () => {
    const ctx = await setup();
    const otherChild = await seedChild({ createdBy: ctx.u.id, name: 'Maya' });
    const otherMembership = await seedMembership({
      userId: ctx.u.id,
      childId: otherChild.id,
      role: 'owner'
    });
    await expect(
      load(
        makeRouteEvent({
          user: safeUser(ctx.u),
          memberships: [otherMembership],
          params: { id: String(otherChild.id), entryId: String(ctx.entry.id) },
          url: 'http://localhost/'
        }) as unknown as Parameters<typeof load>[0]
      )
    ).rejects.toMatchObject({ status: 404 });
  });
});
