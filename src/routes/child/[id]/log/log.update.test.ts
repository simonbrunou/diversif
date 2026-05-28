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
import { eq } from 'drizzle-orm';
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

describe('child/[id]/log texture field', () => {
  it('persists a valid texture when provided', async () => {
    const { u, c, m, food } = await setup();
    const event = makeRouteEvent({
      user: safeUser(u),
      memberships: [m],
      params: { id: String(c.id) },
      formData: {
        foodId: String(food.id),
        givenAt: new Date().toISOString(),
        reaction: 'ras',
        texture: 'ecrasee'
      }
    });
    await captureFlow(() =>
      actions.default!(event as unknown as Parameters<NonNullable<typeof actions.default>>[0])
    );
    const rows = await testDb.select().from(foodEntries).where(eq(foodEntries.childId, c.id));
    expect(rows[0].texture).toBe('ecrasee');
  });

  it('persists null texture when omitted', async () => {
    const { u, c, m, food } = await setup();
    const event = makeRouteEvent({
      user: safeUser(u),
      memberships: [m],
      params: { id: String(c.id) },
      formData: {
        foodId: String(food.id),
        givenAt: new Date().toISOString(),
        reaction: 'ras'
      }
    });
    await captureFlow(() =>
      actions.default!(event as unknown as Parameters<NonNullable<typeof actions.default>>[0])
    );
    const rows = await testDb.select().from(foodEntries).where(eq(foodEntries.childId, c.id));
    expect(rows[0].texture).toBeNull();
  });

  it('rejects an invalid texture value with 400', async () => {
    const { u, c, m, food } = await setup();
    const event = makeRouteEvent({
      user: safeUser(u),
      memberships: [m],
      params: { id: String(c.id) },
      formData: {
        foodId: String(food.id),
        givenAt: new Date().toISOString(),
        reaction: 'ras',
        texture: 'not-a-texture'
      }
    });
    const result = (await actions.default!(
      event as unknown as Parameters<NonNullable<typeof actions.default>>[0]
    )) as { status: number };
    expect(result).toMatchObject({ status: 400 });
  });

  it('rejects an empty texture value with 400', async () => {
    const { u, c, m, food } = await setup();
    const event = makeRouteEvent({
      user: safeUser(u),
      memberships: [m],
      params: { id: String(c.id) },
      formData: {
        foodId: String(food.id),
        givenAt: new Date().toISOString(),
        reaction: 'ras',
        texture: ''
      }
    });
    const result = (await actions.default!(
      event as unknown as Parameters<NonNullable<typeof actions.default>>[0]
    )) as { status: number };
    expect(result).toMatchObject({ status: 400 });
  });
});
