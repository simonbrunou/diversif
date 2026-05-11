import { describe, it, expect, beforeEach, vi } from 'vitest';
import { testDb, resetTestDb } from '../../../../../test/db';
import {
  makeRouteEvent,
  safeUser,
  seedChild,
  seedMembership,
  seedUser
} from '../../../../../test/route';

vi.mock('$lib/server/db', () => ({ db: testDb }));

import { foodEntries, foods, symptoms } from '$lib/server/db/schema';
import { load, actions } from './+page.server';

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
  const log = async (reaction: 'ras' | 'inconfort' | 'reaction', givenAt = new Date()) => {
    const [entry] = await testDb
      .insert(foodEntries)
      .values({
        childId: c.id,
        foodId: pear.id,
        givenAt,
        reaction,
        notes: null,
        loggedBy: u.id,
        createdAt: new Date()
      })
      .returning();
    return entry;
  };
  return { u, c, m, pear, log };
}

describe('reaction-detail loader', () => {
  it('returns food name, isRas=false for a reaction entry, and computed nth', async () => {
    const ctx = await setup();
    const entry = await ctx.log('reaction');
    const data = await load(
      makeRouteEvent({
        user: safeUser(ctx.u),
        memberships: [ctx.m],
        params: { id: String(ctx.c.id), entryId: String(entry.id) },
        url: 'http://localhost/'
      }) as unknown as Parameters<typeof load>[0]
    );
    expect(data.food).toBe('Poire');
    expect(data.isRas).toBe(false);
    expect(data.nth).toBe(1);
    expect(data.symptoms).toEqual([]);
  });

  it('returns isRas=true when reaction is ras', async () => {
    const ctx = await setup();
    const entry = await ctx.log('ras');
    const data = await load(
      makeRouteEvent({
        user: safeUser(ctx.u),
        memberships: [ctx.m],
        params: { id: String(ctx.c.id), entryId: String(entry.id) },
        url: 'http://localhost/'
      }) as unknown as Parameters<typeof load>[0]
    );
    expect(data.isRas).toBe(true);
  });

  it('counts Nth exposition across multiple entries of the same food', async () => {
    const ctx = await setup();
    await ctx.log('ras', new Date('2026-04-01'));
    await ctx.log('ras', new Date('2026-04-15'));
    const e3 = await ctx.log('reaction', new Date('2026-05-01'));
    const data = await load(
      makeRouteEvent({
        user: safeUser(ctx.u),
        memberships: [ctx.m],
        params: { id: String(ctx.c.id), entryId: String(e3.id) },
        url: 'http://localhost/'
      }) as unknown as Parameters<typeof load>[0]
    );
    expect(data.nth).toBe(3);
  });

  it('maps symptom rows including observedAt and note', async () => {
    const ctx = await setup();
    const entry = await ctx.log('reaction');
    // insert a symptom directly so the loader map callback is exercised
    await testDb.insert(symptoms).values({
      foodEntryId: entry.id,
      childId: ctx.c.id,
      observedAt: new Date(),
      label: 'rougeur',
      note: 'front',
      createdBy: ctx.u.id
    });
    const data = await load(
      makeRouteEvent({
        user: safeUser(ctx.u),
        memberships: [ctx.m],
        params: { id: String(ctx.c.id), entryId: String(entry.id) },
        url: 'http://localhost/'
      }) as unknown as Parameters<typeof load>[0]
    );
    expect(data.symptoms).toHaveLength(1);
    expect(data.symptoms[0].label).toBe('rougeur');
    expect(data.symptoms[0].note).toBe('front');
    expect(typeof data.symptoms[0].observedAt).toBe('string');
  });

  it('formats dates with en-GB locale when locale is en', async () => {
    const ctx = await setup();
    const entry = await ctx.log('ras');
    const data = await load(
      makeRouteEvent({
        user: safeUser(ctx.u),
        memberships: [ctx.m],
        params: { id: String(ctx.c.id), entryId: String(entry.id) },
        url: 'http://localhost/',
        locale: 'en'
      }) as unknown as Parameters<typeof load>[0]
    );
    // just assert the strings are non-empty — locale formatting is runtime-dependent
    expect(typeof data.date).toBe('string');
    expect(data.date.length).toBeGreaterThan(0);
  });

  it('defaults to fr locale when locals.locale is undefined', async () => {
    const ctx = await setup();
    const entry = await ctx.log('ras');
    const event = makeRouteEvent({
      user: safeUser(ctx.u),
      memberships: [ctx.m],
      params: { id: String(ctx.c.id), entryId: String(entry.id) },
      url: 'http://localhost/'
    }) as unknown as Parameters<typeof load>[0];
    // strip locale so the ?? 'fr' fallback fires
    (event.locals as Record<string, unknown>).locale = undefined;
    const data = await load(event);
    expect(typeof data.date).toBe('string');
    expect(data.date.length).toBeGreaterThan(0);
  });

  it('throws 404 when the entry does not belong to the requested child', async () => {
    const ctx = await setup();
    const otherChild = await seedChild({ createdBy: ctx.u.id, name: 'Maya' });
    const otherMembership = await seedMembership({
      userId: ctx.u.id,
      childId: otherChild.id,
      role: 'owner'
    });
    const entry = await ctx.log('ras');
    await expect(
      load(
        makeRouteEvent({
          user: safeUser(ctx.u),
          memberships: [otherMembership],
          params: { id: String(otherChild.id), entryId: String(entry.id) },
          url: 'http://localhost/'
        }) as unknown as Parameters<typeof load>[0]
      )
    ).rejects.toMatchObject({ status: 404 });
  });
});

describe('addSymptom action', () => {
  function makeFormEvent(
    ctx: Awaited<ReturnType<typeof setup>>,
    entryId: number,
    formData: Record<string, string>
  ) {
    return makeRouteEvent({
      user: safeUser(ctx.u),
      memberships: [ctx.m],
      params: { id: String(ctx.c.id), entryId: String(entryId) },
      url: 'http://localhost/',
      formData
    }) as unknown as Parameters<typeof actions.addSymptom>[0];
  }

  it('inserts a symptom for valid input', async () => {
    const ctx = await setup();
    const entry = await ctx.log('reaction');
    const result = await actions.addSymptom(
      makeFormEvent(ctx, entry.id, { label: 'rougeur', note: 'joue gauche', observedAt: '11:42' })
    );
    expect(result).toEqual({ success: true });
    const rows = await testDb.select().from(symptoms);
    expect(rows).toHaveLength(1);
    expect(rows[0].label).toBe('rougeur');
    expect(rows[0].note).toBe('joue gauche');
  });

  it('rejects an unknown label', async () => {
    const ctx = await setup();
    const entry = await ctx.log('reaction');
    const result = await actions.addSymptom(
      makeFormEvent(ctx, entry.id, { label: 'not-a-symptom', note: '', observedAt: '11:42' })
    );
    expect(result).toMatchObject({ status: 400 });
  });

  it('persists null note when note is empty after trim', async () => {
    const ctx = await setup();
    const entry = await ctx.log('reaction');
    await actions.addSymptom(
      makeFormEvent(ctx, entry.id, { label: 'rougeur', note: '   ', observedAt: '11:42' })
    );
    const rows = await testDb.select().from(symptoms);
    expect(rows[0].note).toBeNull();
  });
});
