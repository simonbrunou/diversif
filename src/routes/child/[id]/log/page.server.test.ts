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
import { eq } from 'drizzle-orm';
import { load, actions } from './+page.server';

beforeEach(() => {
  resetTestDb();
});

async function setup() {
  const u = await seedUser();
  const c = seedChild({ createdBy: u.id });
  const m = seedMembership({ userId: u.id, childId: c.id, role: 'owner' });
  const food = testDb
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
  return { u, c, m, food };
}

describe('child/[id]/log load', () => {
  it('redirects guests', async () => {
    const r = await captureFlow(() =>
      load(
        makeRouteEvent({
          user: null,
          params: { id: '1' }
        }) as unknown as Parameters<typeof load>[0]
      )
    );
    expect(r.kind).toBe('redirect');
  });

  it('returns the food list (global + custom for this child)', async () => {
    const { u, c, m } = await setup();
    // Add a custom food for THIS child + a custom food for ANOTHER child
    const otherChild = seedChild({ createdBy: u.id, birthDate: '2023-01-01' });
    testDb
      .insert(foods)
      .values([
        {
          name: 'Mon plat',
          category: 'autre',
          isMajorAllergen: false,
          allergenType: null,
          suggestedAgeMonths: 0,
          notes: null,
          isCustom: true,
          customForChildId: c.id
        },
        {
          name: 'Plat ailleurs',
          category: 'autre',
          isMajorAllergen: false,
          allergenType: null,
          suggestedAgeMonths: 0,
          notes: null,
          isCustom: true,
          customForChildId: otherChild.id
        }
      ])
      .run();
    const out = await load(
      makeRouteEvent({
        user: safeUser(u),
        memberships: [m],
        params: { id: String(c.id) }
      }) as unknown as Parameters<typeof load>[0]
    );
    const names = out.foods.map((f) => f.name);
    expect(names).toContain('Carotte');
    expect(names).toContain('Mon plat');
    expect(names).not.toContain('Plat ailleurs');
  });
});

describe('child/[id]/log default action', () => {
  it('fails when neither foodId nor customFood.name provided', async () => {
    const { u, c, m } = await setup();
    const event = makeRouteEvent({
      user: safeUser(u),
      memberships: [m],
      params: { id: String(c.id) },
      formData: { givenAt: '2024-06-01T10:00', reaction: 'ras' }
    });
    const r = (await actions.default!(
      event as unknown as Parameters<NonNullable<typeof actions.default>>[0]
    )) as { status: number; data: { error: string } };
    expect(r.status).toBe(400);
  });

  it('fails on invalid date string', async () => {
    const { u, c, m, food } = await setup();
    const event = makeRouteEvent({
      user: safeUser(u),
      memberships: [m],
      params: { id: String(c.id) },
      formData: {
        foodId: String(food.id),
        givenAt: 'not-a-date',
        reaction: 'ras'
      }
    });
    const r = (await actions.default!(
      event as unknown as Parameters<NonNullable<typeof actions.default>>[0]
    )) as { status: number; data: { error: string } };
    expect(r.status).toBe(400);
    expect(r.data.error).toMatch(/date/i);
  });

  it('fails when foodId references an inaccessible food', async () => {
    const { u, c, m } = await setup();
    // Create a custom food for a different child
    const other = seedChild({ createdBy: u.id, birthDate: '2023-01-01' });
    const otherFood = testDb
      .insert(foods)
      .values({
        name: 'Autre',
        category: 'autre',
        isMajorAllergen: false,
        allergenType: null,
        suggestedAgeMonths: 0,
        notes: null,
        isCustom: true,
        customForChildId: other.id
      })
      .returning()
      .all()[0];
    const event = makeRouteEvent({
      user: safeUser(u),
      memberships: [m],
      params: { id: String(c.id) },
      formData: {
        foodId: String(otherFood.id),
        givenAt: '2024-06-01T10:00',
        reaction: 'ras'
      }
    });
    const r = (await actions.default!(
      event as unknown as Parameters<NonNullable<typeof actions.default>>[0]
    )) as { status: number; data: { error: string } };
    expect(r.status).toBe(400);
    expect(r.data.error).toMatch(/introuvable/i);
  });

  it('logs an entry from the global catalog and redirects', async () => {
    const { u, c, m, food } = await setup();
    const event = makeRouteEvent({
      user: safeUser(u),
      memberships: [m],
      params: { id: String(c.id) },
      formData: {
        foodId: String(food.id),
        givenAt: '2024-06-01T10:00',
        reaction: 'ras',
        notes: ' some notes '
      }
    });
    const r = await captureFlow(() =>
      actions.default!(event as unknown as Parameters<NonNullable<typeof actions.default>>[0])
    );
    expect(r.kind).toBe('redirect');
    if (r.kind === 'redirect') {
      expect(r.location).toContain(`/child/${c.id}?logged=1`);
      expect(r.location).toContain('first=1');
      expect(r.location).toContain('categories=1');
      expect(r.location).toContain('prevCategories=0');
    }
    const entries = testDb.select().from(foodEntries).all();
    expect(entries.length).toBe(1);
    expect(entries[0].notes).toBe('some notes');
  });

  it('creates a custom food when only customFood.name is provided (and uses "autre" category by default)', async () => {
    const { u, c, m } = await setup();
    const event = makeRouteEvent({
      user: safeUser(u),
      memberships: [m],
      params: { id: String(c.id) },
      formData: {
        'customFood.name': 'Couscous maison',
        'customFood.category': 'unknown-category',
        givenAt: '2024-06-01T10:00',
        reaction: 'ras'
      }
    });
    const r = await captureFlow(() =>
      actions.default!(event as unknown as Parameters<NonNullable<typeof actions.default>>[0])
    );
    expect(r.kind).toBe('redirect');
    const created = testDb.select().from(foods).where(eq(foods.name, 'Couscous maison')).get();
    expect(created).toBeDefined();
    expect(created!.isCustom).toBe(true);
    expect(created!.customForChildId).toBe(c.id);
    expect(created!.category).toBe('autre');
  });

  it('fails when customFood.name is whitespace-only (no foodId, trimmed empty)', async () => {
    const { u, c, m } = await setup();
    const event = makeRouteEvent({
      user: safeUser(u),
      memberships: [m],
      params: { id: String(c.id) },
      formData: {
        'customFood.name': '   ',
        givenAt: '2024-06-01T10:00',
        reaction: 'ras'
      }
    });
    const r = (await actions.default!(
      event as unknown as Parameters<NonNullable<typeof actions.default>>[0]
    )) as { status: number; data: { error: string } };
    expect(r.status).toBe(400);
    expect(r.data.error).toMatch(/aliment/i);
  });

  it('creates a custom food in a known category', async () => {
    const { u, c, m } = await setup();
    const event = makeRouteEvent({
      user: safeUser(u),
      memberships: [m],
      params: { id: String(c.id) },
      formData: {
        'customFood.name': 'Crêpe',
        'customFood.category': 'feculents',
        givenAt: '2024-06-01T10:00',
        reaction: 'ras'
      }
    });
    await captureFlow(() =>
      actions.default!(event as unknown as Parameters<NonNullable<typeof actions.default>>[0])
    );
    const created = testDb.select().from(foods).where(eq(foods.name, 'Crêpe')).get();
    expect(created!.category).toBe('feculents');
  });
});
