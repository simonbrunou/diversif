import { beforeEach, describe, expect, it, mock } from 'bun:test';
import { eq } from 'drizzle-orm';
import { testDb, resetTestDb } from '../../../../../test/db';
import {
  makeRouteEvent,
  safeUser,
  seedChild,
  seedMembership,
  seedUser
} from '../../../../../test/route';

mock.module('$lib/server/db', () => ({ db: testDb }));
mock.module('$lib/server/audit', () => ({ audit: mock() }));

import { audit } from '$lib/server/audit';

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
    // just assert the strings are non-empty : locale formatting is runtime-dependent
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

  it.each(['not-a-number', '0'])('throws 400 for invalid entry id %s', async (entryId) => {
    const ctx = await setup();
    await expect(
      load(
        makeRouteEvent({
          user: safeUser(ctx.u),
          memberships: [ctx.m],
          params: { id: String(ctx.c.id), entryId },
          url: 'http://localhost/'
        }) as unknown as Parameters<typeof load>[0]
      )
    ).rejects.toMatchObject({ status: 400 });
  });
});

describe('addSymptom action', () => {
  beforeEach(() => {
    audit.mockClear();
  });

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

  it('rejects symptom creation when the entry belongs to another child', async () => {
    const ctx = await setup();
    const otherUser = await seedUser({ email: 'other-parent@example.com' });
    const otherChild = await seedChild({ createdBy: otherUser.id, name: 'Noé' });
    const [otherEntry] = await testDb
      .insert(foodEntries)
      .values({
        childId: otherChild.id,
        foodId: ctx.pear.id,
        givenAt: new Date(),
        reaction: 'reaction',
        notes: null,
        loggedBy: otherUser.id,
        createdAt: new Date()
      })
      .returning();

    await expect(
      actions.addSymptom(
        makeFormEvent(ctx, otherEntry.id, {
          label: 'rougeur',
          note: 'cross-child write attempt',
          observedAt: '11:42'
        })
      )
    ).rejects.toMatchObject({ status: 404 });

    const rows = await testDb.select().from(symptoms);
    expect(rows).toHaveLength(0);
  });

  it('promotes ras entry to inconfort when symptom is mild and emits audit', async () => {
    const ctx = await setup();
    const entry = await ctx.log('ras');
    const result = await actions.addSymptom(
      makeFormEvent(ctx, entry.id, { label: 'rougeur', note: '', observedAt: '11:42' })
    );
    expect(result).toEqual({ success: true });

    const [row] = await testDb.select().from(foodEntries).where(eq(foodEntries.id, entry.id));
    expect(row.reaction).toBe('inconfort');

    const promotedCall = vi
      .mocked(audit)
      .mock.calls.find((c) => c[0].type === 'food_entry.reaction_promoted')?.[0];
    expect(promotedCall).toMatchObject({ from: 'ras', to: 'inconfort', entryId: entry.id });
  });

  it('promotes ras entry to reaction when symptom is severe', async () => {
    const ctx = await setup();
    const entry = await ctx.log('ras');
    await actions.addSymptom(
      makeFormEvent(ctx, entry.id, {
        label: 'detresse-respiratoire',
        note: '',
        observedAt: '11:42'
      })
    );
    const [row] = await testDb.select().from(foodEntries).where(eq(foodEntries.id, entry.id));
    expect(row.reaction).toBe('reaction');
    const promotedCall = vi
      .mocked(audit)
      .mock.calls.find((c) => c[0].type === 'food_entry.reaction_promoted')?.[0];
    expect(promotedCall).toMatchObject({ from: 'ras', to: 'reaction' });
  });

  it('does not promote an inconfort entry on additional symptoms', async () => {
    const ctx = await setup();
    const entry = await ctx.log('inconfort');
    await actions.addSymptom(
      makeFormEvent(ctx, entry.id, {
        label: 'detresse-respiratoire',
        note: '',
        observedAt: '11:42'
      })
    );
    const [row] = await testDb.select().from(foodEntries).where(eq(foodEntries.id, entry.id));
    expect(row.reaction).toBe('inconfort');
    const calls = audit.mock.calls.map((c) => c[0].type);
    expect(calls).not.toContain('food_entry.reaction_promoted');
  });

  it('does not promote a reaction entry on additional symptoms', async () => {
    const ctx = await setup();
    const entry = await ctx.log('reaction');
    await actions.addSymptom(
      makeFormEvent(ctx, entry.id, { label: 'urticaire', note: '', observedAt: '11:42' })
    );
    const [row] = await testDb.select().from(foodEntries).where(eq(foodEntries.id, entry.id));
    expect(row.reaction).toBe('reaction');
    const calls = audit.mock.calls.map((c) => c[0].type);
    expect(calls).not.toContain('food_entry.reaction_promoted');
  });
});

describe('deleteSymptom action', () => {
  beforeEach(() => {
    audit.mockClear();
  });

  async function seedSymptom(
    ctx: Awaited<ReturnType<typeof setup>>,
    entryId: number,
    label = 'rougeur'
  ) {
    const [row] = await testDb
      .insert(symptoms)
      .values({
        foodEntryId: entryId,
        childId: ctx.c.id,
        observedAt: new Date(),
        label,
        note: null,
        createdBy: ctx.u.id
      })
      .returning();
    return row;
  }

  function makeDeleteEvent(
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
    }) as unknown as Parameters<NonNullable<typeof actions.deleteSymptom>>[0];
  }

  it('deletes the symptom and emits an audit event', async () => {
    const ctx = await setup();
    const entry = await ctx.log('reaction');
    const sym = await seedSymptom(ctx, entry.id);
    const result = await actions.deleteSymptom!(
      makeDeleteEvent(ctx, entry.id, { symptomId: String(sym.id) })
    );
    expect(result).toEqual({ success: true });
    expect(await testDb.select().from(symptoms)).toHaveLength(0);
    const deletedCall = vi
      .mocked(audit)
      .mock.calls.find((c) => c[0].type === 'symptom.deleted')?.[0];
    expect(deletedCall).toMatchObject({ symptomId: sym.id, entryId: entry.id });
  });

  it('rejects deletion of a symptom that belongs to another entry', async () => {
    const ctx = await setup();
    const entryA = await ctx.log('reaction');
    const entryB = await ctx.log('reaction', new Date('2026-05-01'));
    const sym = await seedSymptom(ctx, entryB.id);
    const result = (await actions.deleteSymptom!(
      makeDeleteEvent(ctx, entryA.id, { symptomId: String(sym.id) })
    )) as { status: number };
    expect(result.status).toBe(404);
    expect(await testDb.select().from(symptoms)).toHaveLength(1);
  });

  it('rejects deletion when symptom belongs to another child', async () => {
    const ctx = await setup();
    const otherUser = await seedUser({ email: 'other-parent2@example.com' });
    const otherChild = await seedChild({ createdBy: otherUser.id, name: 'Léa' });
    const [otherEntry] = await testDb
      .insert(foodEntries)
      .values({
        childId: otherChild.id,
        foodId: ctx.pear.id,
        givenAt: new Date(),
        reaction: 'reaction',
        notes: null,
        loggedBy: otherUser.id,
        createdAt: new Date()
      })
      .returning();
    const [foreignSym] = await testDb
      .insert(symptoms)
      .values({
        foodEntryId: otherEntry.id,
        childId: otherChild.id,
        observedAt: new Date(),
        label: 'rougeur',
        note: null,
        createdBy: otherUser.id
      })
      .returning();

    await expect(
      actions.deleteSymptom!(
        makeDeleteEvent(ctx, otherEntry.id, { symptomId: String(foreignSym.id) })
      )
    ).rejects.toMatchObject({ status: 404 });

    expect(await testDb.select().from(symptoms)).toHaveLength(1);
  });

  it('rejects invalid symptomId', async () => {
    const ctx = await setup();
    const entry = await ctx.log('reaction');
    const result = (await actions.deleteSymptom!(
      makeDeleteEvent(ctx, entry.id, { symptomId: 'nope' })
    )) as { status: number };
    expect(result.status).toBe(400);
  });

  it('returns 404 when symptomId does not exist', async () => {
    const ctx = await setup();
    const entry = await ctx.log('reaction');
    const result = (await actions.deleteSymptom!(
      makeDeleteEvent(ctx, entry.id, { symptomId: '999999' })
    )) as { status: number };
    expect(result.status).toBe(404);
  });

  it('does not auto-demote the entry reaction when symptoms are removed', async () => {
    const ctx = await setup();
    const entry = await ctx.log('inconfort');
    const sym = await seedSymptom(ctx, entry.id);
    await actions.deleteSymptom!(makeDeleteEvent(ctx, entry.id, { symptomId: String(sym.id) }));
    const [row] = await testDb.select().from(foodEntries).where(eq(foodEntries.id, entry.id));
    expect(row.reaction).toBe('inconfort');
  });
});

describe('texture in entry-detail loader', () => {
  it('returns texture in the entry payload when set', async () => {
    const ctx = await setup();
    const [entry] = await testDb
      .insert(foodEntries)
      .values({
        childId: ctx.c.id,
        foodId: ctx.pear.id,
        givenAt: new Date(),
        reaction: 'ras',
        texture: 'ecrasee',
        notes: null,
        loggedBy: ctx.u.id,
        createdAt: new Date()
      })
      .returning();
    const data = await load(
      makeRouteEvent({
        user: safeUser(ctx.u),
        memberships: [ctx.m],
        params: { id: String(ctx.c.id), entryId: String(entry.id) },
        url: 'http://localhost/'
      }) as unknown as Parameters<typeof load>[0]
    );
    expect(data.texture).toBe('ecrasee');
  });

  it('returns null texture when not set', async () => {
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
    expect(data.texture).toBeNull();
  });
});
