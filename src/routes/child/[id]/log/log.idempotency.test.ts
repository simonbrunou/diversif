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
import { sql } from 'drizzle-orm';
import { actions } from './+page.server';

beforeEach(async () => {
  await resetTestDb();
});

async function setup() {
  const u = await seedUser();
  const c = await seedChild({ createdBy: u.id });
  const m = await seedMembership({ userId: u.id, childId: c.id, role: 'owner' });
  const food = (
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
  return { u, c, m, food };
}

describe('Idempotency-Key', () => {
  it('same key replay : only one food_entries row, both calls redirect to same location', async () => {
    const { u, c, m, food } = await setup();
    const formData = {
      foodId: String(food.id),
      givenAt: '2026-05-07T10:00:00.000Z',
      reaction: 'ras'
    };

    const r1 = await captureFlow(() =>
      actions.default!(
        makeRouteEvent({
          user: safeUser(u),
          memberships: [m],
          params: { id: String(c.id) },
          formData,
          headers: { 'Idempotency-Key': 'key-replay-1' }
        }) as unknown as Parameters<NonNullable<typeof actions.default>>[0]
      )
    );
    const r2 = await captureFlow(() =>
      actions.default!(
        makeRouteEvent({
          user: safeUser(u),
          memberships: [m],
          params: { id: String(c.id) },
          formData,
          headers: { 'Idempotency-Key': 'key-replay-1' }
        }) as unknown as Parameters<NonNullable<typeof actions.default>>[0]
      )
    );

    expect(r1.kind).toBe('redirect');
    expect(r2.kind).toBe('redirect');
    if (r1.kind === 'redirect' && r2.kind === 'redirect') {
      expect(r1.location).toBe(r2.location);
    }

    const count =
      (
        await testDb
          .select({ n: sql<number>`count(*)` })
          .from(foodEntries)
          .limit(1)
      )[0]?.n ?? 0;
    expect(Number(count)).toBe(1);
  });

  it('different keys, same form : two food_entries rows', async () => {
    const { u, c, m, food } = await setup();
    const formData = {
      foodId: String(food.id),
      givenAt: '2026-05-07T10:00:00.000Z',
      reaction: 'ras'
    };

    const r1 = await captureFlow(() =>
      actions.default!(
        makeRouteEvent({
          user: safeUser(u),
          memberships: [m],
          params: { id: String(c.id) },
          formData,
          headers: { 'Idempotency-Key': 'k-A' }
        }) as unknown as Parameters<NonNullable<typeof actions.default>>[0]
      )
    );
    const r2 = await captureFlow(() =>
      actions.default!(
        makeRouteEvent({
          user: safeUser(u),
          memberships: [m],
          params: { id: String(c.id) },
          formData,
          headers: { 'Idempotency-Key': 'k-B' }
        }) as unknown as Parameters<NonNullable<typeof actions.default>>[0]
      )
    );

    expect(r1.kind).toBe('redirect');
    expect(r2.kind).toBe('redirect');

    const count =
      (
        await testDb
          .select({ n: sql<number>`count(*)` })
          .from(foodEntries)
          .limit(1)
      )[0]?.n ?? 0;
    expect(Number(count)).toBe(2);
  });

  it('invalid Idempotency-Key (length 101) : returns 400', async () => {
    const { u, c, m, food } = await setup();
    const r = await captureFlow(() =>
      actions.default!(
        makeRouteEvent({
          user: safeUser(u),
          memberships: [m],
          params: { id: String(c.id) },
          formData: {
            foodId: String(food.id),
            givenAt: '2026-05-07T10:00:00.000Z',
            reaction: 'ras'
          },
          headers: { 'Idempotency-Key': 'x'.repeat(101) }
        }) as unknown as Parameters<NonNullable<typeof actions.default>>[0]
      )
    );
    expect(r.kind).toBe('return');
    if (r.kind === 'return') {
      expect((r.value as { status: number }).status).toBe(400);
    }
  });

  it('same key for different scope : second call returns 409', async () => {
    const { u, food } = await setup();
    const childA = await seedChild({ createdBy: u.id, birthDate: '2024-01-01' });
    const childB = await seedChild({ createdBy: u.id, birthDate: '2024-02-01' });
    const mA = await seedMembership({ userId: u.id, childId: childA.id, role: 'owner' });
    const mB = await seedMembership({ userId: u.id, childId: childB.id, role: 'owner' });

    const formData = {
      foodId: String(food.id),
      givenAt: '2026-05-07T10:00:00.000Z',
      reaction: 'ras'
    };

    const r1 = await captureFlow(() =>
      actions.default!(
        makeRouteEvent({
          user: safeUser(u),
          memberships: [mA, mB],
          params: { id: String(childA.id) },
          formData,
          headers: { 'Idempotency-Key': 'k1' }
        }) as unknown as Parameters<NonNullable<typeof actions.default>>[0]
      )
    );
    expect(r1.kind).toBe('redirect');

    const r2 = await captureFlow(() =>
      actions.default!(
        makeRouteEvent({
          user: safeUser(u),
          memberships: [mA, mB],
          params: { id: String(childB.id) },
          formData,
          headers: { 'Idempotency-Key': 'k1' }
        }) as unknown as Parameters<NonNullable<typeof actions.default>>[0]
      )
    );
    expect(r2.kind).toBe('return');
    if (r2.kind === 'return') {
      expect((r2.value as { status: number }).status).toBe(409);
    }
  });

  it('no header : existing behaviour : two calls produce two food_entries rows', async () => {
    const { u, c, m, food } = await setup();
    const formData = {
      foodId: String(food.id),
      givenAt: '2026-05-07T10:00:00.000Z',
      reaction: 'ras'
    };

    const r1 = await captureFlow(() =>
      actions.default!(
        makeRouteEvent({
          user: safeUser(u),
          memberships: [m],
          params: { id: String(c.id) },
          formData
        }) as unknown as Parameters<NonNullable<typeof actions.default>>[0]
      )
    );
    const r2 = await captureFlow(() =>
      actions.default!(
        makeRouteEvent({
          user: safeUser(u),
          memberships: [m],
          params: { id: String(c.id) },
          formData
        }) as unknown as Parameters<NonNullable<typeof actions.default>>[0]
      )
    );

    expect(r1.kind).toBe('redirect');
    expect(r2.kind).toBe('redirect');

    const count =
      (
        await testDb
          .select({ n: sql<number>`count(*)` })
          .from(foodEntries)
          .limit(1)
      )[0]?.n ?? 0;
    expect(Number(count)).toBe(2);
  });
});
