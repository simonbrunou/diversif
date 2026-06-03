import { beforeEach, describe, expect, it, mock } from 'bun:test';
import { testDb, resetTestDb } from '../../../../test/db';
import {
  captureFlow,
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
  // 9 months old
  const birth = new Date();
  birth.setMonth(birth.getMonth() - 9);
  const dateStr = `${birth.getFullYear()}-${String(birth.getMonth() + 1).padStart(2, '0')}-${String(birth.getDate()).padStart(2, '0')}`;
  const c = await seedChild({ createdBy: u.id, birthDate: dateStr });
  const m = await seedMembership({ userId: u.id, childId: c.id, role: 'owner' });
  return { u, c, m };
}

function loadFor({ u, c, m }: Awaited<ReturnType<typeof setup>>) {
  return load(
    makeRouteEvent({
      user: safeUser(u),
      memberships: [m],
      params: { id: String(c.id) },
      parent: async () => ({ child: { id: c.id, birthDate: c.birthDate } })
    }) as unknown as Parameters<typeof load>[0]
  );
}

async function insertFood(opts: {
  name: string;
  category: string;
  age: number;
  allergen?: string;
}) {
  return (
    await testDb
      .insert(foods)
      .values({
        name: opts.name,
        category: opts.category,
        isMajorAllergen: opts.allergen != null,
        allergenType: opts.allergen ?? null,
        suggestedAgeMonths: opts.age,
        notes: null,
        isCustom: false,
        customForChildId: null
      })
      .returning()
  )[0];
}

describe('child/[id]/suggestions load', () => {
  it('rejects guests with a redirect to /login', async () => {
    const { c } = await setup();
    const r = await captureFlow(() =>
      load(
        makeRouteEvent({
          user: null,
          params: { id: String(c.id) },
          parent: async () => ({ child: { id: c.id, birthDate: c.birthDate } })
        }) as unknown as Parameters<typeof load>[0]
      )
    );
    expect(r.kind).toBe('redirect');
  });

  it('rejects authenticated users without membership with 403', async () => {
    const { c } = await setup();
    const intruder = await seedUser({ email: 'intruder@example.com' });
    const r = await captureFlow(() =>
      load(
        makeRouteEvent({
          user: safeUser(intruder),
          memberships: [],
          params: { id: String(c.id) },
          parent: async () => ({ child: { id: c.id, birthDate: c.birthDate } })
        }) as unknown as Parameters<typeof load>[0]
      )
    );
    expect(r.kind).toBe('error');
    if (r.kind === 'error') expect(r.status).toBe(403);
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
          params: { id: 'not-a-number' },
          parent: async () => {
            throw new Error('parent() must not be reached when childId is invalid');
          }
        }) as unknown as Parameters<typeof load>[0]
      )
    );
    expect(r.kind).toBe('error');
    if (r.kind === 'error') expect(r.status).toBe(404);
  });

  it('returns priorityAllergens and others, age-appropriate', async () => {
    const ctx = await setup();
    const young = await insertFood({ name: 'Young', category: 'legumes', age: 4 });
    const old = await insertFood({ name: 'Old', category: 'fruits', age: 18 });
    const peanut = await insertFood({
      name: 'Beurre de cacahuète',
      category: 'allergenes',
      age: 6,
      allergen: 'arachide'
    });

    const out = await loadFor(ctx);

    expect(out.priorityAllergens.find((f) => f.id === peanut.id)).toBeDefined();
    expect(out.others.find((f) => f.id === young.id)).toBeDefined();
    expect(out.others.find((f) => f.id === old.id)).toBeUndefined();
    expect(typeof out.ageMonths).toBe('number');
  });

  it('excludes already-introduced foods + drops introduced allergens from priority', async () => {
    const ctx = await setup();
    const peanut = await insertFood({
      name: 'Beurre de cacahuète',
      category: 'allergenes',
      age: 6,
      allergen: 'arachide'
    });
    const egg = await insertFood({
      name: 'Œuf',
      category: 'oeufs',
      age: 6,
      allergen: 'oeuf'
    });

    await testDb.insert(foodEntries).values({
      childId: ctx.c.id,
      foodId: peanut.id,
      givenAt: new Date(),
      reaction: 'ras',
      notes: null,
      loggedBy: ctx.u.id,
      createdAt: new Date()
    });

    const out = await loadFor(ctx);

    // peanut already introduced : should not appear at all
    expect(out.priorityAllergens.find((f) => f.id === peanut.id)).toBeUndefined();
    expect(out.others.find((f) => f.id === peanut.id)).toBeUndefined();
    // egg still in priority : its allergen "oeuf" not yet introduced
    expect(out.priorityAllergens.find((f) => f.id === egg.id)).toBeDefined();
  });

  it('clamps minimum age threshold to 4 months', async () => {
    const u = await seedUser({ email: 'young@example.com' });
    const veryYoung = new Date();
    veryYoung.setMonth(veryYoung.getMonth() - 1);
    const dateStr = `${veryYoung.getFullYear()}-${String(veryYoung.getMonth() + 1).padStart(2, '0')}-${String(veryYoung.getDate()).padStart(2, '0')}`;
    const c = await seedChild({ createdBy: u.id, birthDate: dateStr });
    const m = await seedMembership({ userId: u.id, childId: c.id, role: 'owner' });
    const okFood = await insertFood({ name: 'Carotte', category: 'legumes', age: 4 });
    const out = await load(
      makeRouteEvent({
        user: safeUser(u),
        memberships: [m],
        params: { id: String(c.id) },
        parent: async () => ({ child: { id: c.id, birthDate: c.birthDate } })
      }) as unknown as Parameters<typeof load>[0]
    );
    expect(out.others.find((f) => f.id === okFood.id)).toBeDefined();
  });
});
