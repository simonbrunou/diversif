import { beforeEach, describe, expect, it, mock } from 'bun:test';
import { testDb, resetTestDb } from '../../../../../test/db';
import {
  captureFlow,
  makeRouteEvent,
  safeUser,
  seedChild,
  seedMembership,
  seedUser
} from '../../../../../test/route';

mock.module('$lib/server/db', () => ({ db: testDb }));

import { foodEntries, foods } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { load, actions } from './+page.server';

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
  const entry = (
    await testDb
      .insert(foodEntries)
      .values({
        childId: c.id,
        foodId: food.id,
        givenAt: new Date('2024-06-01T10:00:00Z'),
        reaction: 'ras',
        notes: 'init',
        loggedBy: u.id,
        createdAt: new Date()
      })
      .returning()
  )[0];
  return { u, c, m, food, entry };
}

describe('child/[id]/log/[entryId] load', () => {
  it('errors 400 on invalid entryId', async () => {
    const { u, c, m } = await setup();
    const r = await captureFlow(() =>
      load(
        makeRouteEvent({
          user: safeUser(u),
          memberships: [m],
          params: { id: String(c.id), entryId: '0' },
          url: `http://localhost/child/${c.id}/log/0`
        }) as unknown as Parameters<typeof load>[0]
      )
    );
    expect(r.kind).toBe('error');
    if (r.kind === 'error') expect(r.status).toBe(400);
  });

  it('errors 404 on entryId not belonging to the child', async () => {
    const { u, c, m } = await setup();
    const r = await captureFlow(() =>
      load(
        makeRouteEvent({
          user: safeUser(u),
          memberships: [m],
          params: { id: String(c.id), entryId: '999999' },
          url: `http://localhost/child/${c.id}/log/999999`
        }) as unknown as Parameters<typeof load>[0]
      )
    );
    expect(r.kind).toBe('error');
    if (r.kind === 'error') expect(r.status).toBe(404);
  });

  it('returns the entry, food list and from=foods by default', async () => {
    const { u, c, m, entry } = await setup();
    const out = await load(
      makeRouteEvent({
        user: safeUser(u),
        memberships: [m],
        params: { id: String(c.id), entryId: String(entry.id) },
        url: `http://localhost/child/${c.id}/log/${entry.id}`
      }) as unknown as Parameters<typeof load>[0]
    );
    expect(out.entry.id).toBe(entry.id);
    expect(out.from).toBe('foods');
    expect(out.foods.length).toBeGreaterThan(0);
  });

  it('returns from=dashboard when ?from=dashboard', async () => {
    const { u, c, m, entry } = await setup();
    const out = await load(
      makeRouteEvent({
        user: safeUser(u),
        memberships: [m],
        params: { id: String(c.id), entryId: String(entry.id) },
        url: `http://localhost/child/${c.id}/log/${entry.id}?from=dashboard`
      }) as unknown as Parameters<typeof load>[0]
    );
    expect(out.from).toBe('dashboard');
  });

  it('returns from=detail when ?from=detail', async () => {
    const { u, c, m, entry } = await setup();
    const out = await load(
      makeRouteEvent({
        user: safeUser(u),
        memberships: [m],
        params: { id: String(c.id), entryId: String(entry.id) },
        url: `http://localhost/child/${c.id}/log/${entry.id}?from=detail`
      }) as unknown as Parameters<typeof load>[0]
    );
    expect(out.from).toBe('detail');
  });
});

describe('child/[id]/log/[entryId] update action', () => {
  it('updates the entry and redirects to /foods by default', async () => {
    const { u, c, m, entry, food } = await setup();
    const event = makeRouteEvent({
      user: safeUser(u),
      memberships: [m],
      params: { id: String(c.id), entryId: String(entry.id) },
      formData: {
        foodId: String(food.id),
        givenAt: '2024-06-02T10:00',
        reaction: 'inconfort',
        notes: 'updated',
        from: ''
      }
    });
    const r = await captureFlow(() =>
      actions.update!(event as unknown as Parameters<NonNullable<typeof actions.update>>[0])
    );
    expect(r.kind).toBe('redirect');
    if (r.kind === 'redirect') expect(r.location).toBe(`/child/${c.id}/foods`);
    const fresh = (
      await testDb.select().from(foodEntries).where(eq(foodEntries.id, entry.id)).limit(1)
    )[0];
    expect(fresh?.reaction).toBe('inconfort');
    expect(fresh?.notes).toBe('updated');
  });

  it('redirects to dashboard when from=dashboard', async () => {
    const { u, c, m, entry, food } = await setup();
    const event = makeRouteEvent({
      user: safeUser(u),
      memberships: [m],
      params: { id: String(c.id), entryId: String(entry.id) },
      formData: {
        foodId: String(food.id),
        givenAt: '2024-06-02T10:00',
        reaction: 'ras',
        from: 'dashboard'
      }
    });
    const r = await captureFlow(() =>
      actions.update!(event as unknown as Parameters<NonNullable<typeof actions.update>>[0])
    );
    expect(r.kind).toBe('redirect');
    if (r.kind === 'redirect') expect(r.location).toBe(`/child/${c.id}`);
  });

  it('redirects back to /foods/[entryId] when from=detail', async () => {
    const { u, c, m, entry, food } = await setup();
    const event = makeRouteEvent({
      user: safeUser(u),
      memberships: [m],
      params: { id: String(c.id), entryId: String(entry.id) },
      formData: {
        foodId: String(food.id),
        givenAt: '2024-06-02T10:00',
        reaction: 'ras',
        from: 'detail'
      }
    });
    const r = await captureFlow(() =>
      actions.update!(event as unknown as Parameters<NonNullable<typeof actions.update>>[0])
    );
    expect(r.kind).toBe('redirect');
    if (r.kind === 'redirect') expect(r.location).toBe(`/child/${c.id}/foods/${entry.id}`);
  });

  it('fails on invalid date', async () => {
    const { u, c, m, entry, food } = await setup();
    const event = makeRouteEvent({
      user: safeUser(u),
      memberships: [m],
      params: { id: String(c.id), entryId: String(entry.id) },
      formData: {
        foodId: String(food.id),
        givenAt: 'not-a-date',
        reaction: 'ras'
      }
    });
    const r = (await actions.update!(
      event as unknown as Parameters<NonNullable<typeof actions.update>>[0]
    )) as { status: number; data: { error: string } };
    expect(r.status).toBe(400);
    expect(r.data.error).toMatch(/date/i);
  });

  it('fails when neither foodId nor customFood.name provided', async () => {
    const { u, c, m, entry } = await setup();
    const event = makeRouteEvent({
      user: safeUser(u),
      memberships: [m],
      params: { id: String(c.id), entryId: String(entry.id) },
      formData: { givenAt: '2024-06-02T10:00', reaction: 'ras' }
    });
    const r = (await actions.update!(
      event as unknown as Parameters<NonNullable<typeof actions.update>>[0]
    )) as { status: number; data: { error: string } };
    expect(r.status).toBe(400);
  });

  it('fails when foodId not accessible', async () => {
    const { u, c, m, entry } = await setup();
    const other = await seedChild({ createdBy: u.id, birthDate: '2023-01-01' });
    const otherFood = (
      await testDb
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
    )[0];
    const event = makeRouteEvent({
      user: safeUser(u),
      memberships: [m],
      params: { id: String(c.id), entryId: String(entry.id) },
      formData: {
        foodId: String(otherFood.id),
        givenAt: '2024-06-02T10:00',
        reaction: 'ras'
      }
    });
    const r = (await actions.update!(
      event as unknown as Parameters<NonNullable<typeof actions.update>>[0]
    )) as { status: number; data: { error: string } };
    expect(r.status).toBe(400);
  });

  it('fails when customFood.name is whitespace-only (no foodId, trimmed empty)', async () => {
    const { u, c, m, entry } = await setup();
    const event = makeRouteEvent({
      user: safeUser(u),
      memberships: [m],
      params: { id: String(c.id), entryId: String(entry.id) },
      formData: {
        'customFood.name': '   ',
        givenAt: '2024-06-02T10:00',
        reaction: 'ras'
      }
    });
    const r = (await actions.update!(
      event as unknown as Parameters<NonNullable<typeof actions.update>>[0]
    )) as { status: number; data: { error: string } };
    expect(r.status).toBe(400);
    expect(r.data.error).toMatch(/aliment/i);
  });

  it('creates a custom food with default category=autre when category unknown', async () => {
    const { u, c, m, entry } = await setup();
    const event = makeRouteEvent({
      user: safeUser(u),
      memberships: [m],
      params: { id: String(c.id), entryId: String(entry.id) },
      formData: {
        'customFood.name': 'Plat surprise',
        'customFood.category': 'unknown-category',
        givenAt: '2024-06-02T10:00',
        reaction: 'ras'
      }
    });
    const r = await captureFlow(() =>
      actions.update!(event as unknown as Parameters<NonNullable<typeof actions.update>>[0])
    );
    expect(r.kind).toBe('redirect');
    const created = (
      await testDb.select().from(foods).where(eq(foods.name, 'Plat surprise')).limit(1)
    )[0];
    expect(created!.category).toBe('autre');
  });

  it('creates a custom food when customFood.name provided and no foodId', async () => {
    const { u, c, m, entry } = await setup();
    const event = makeRouteEvent({
      user: safeUser(u),
      memberships: [m],
      params: { id: String(c.id), entryId: String(entry.id) },
      formData: {
        'customFood.name': 'Velouté maison',
        'customFood.category': 'legumes',
        givenAt: '2024-06-02T10:00',
        reaction: 'ras'
      }
    });
    const r = await captureFlow(() =>
      actions.update!(event as unknown as Parameters<NonNullable<typeof actions.update>>[0])
    );
    expect(r.kind).toBe('redirect');
    const created = (
      await testDb.select().from(foods).where(eq(foods.name, 'Velouté maison')).limit(1)
    )[0];
    expect(created).toBeDefined();
  });
});

describe('child/[id]/log/[entryId] texture edit', () => {
  it('updates texture on edit submit', async () => {
    const { u, c, m, entry, food } = await setup();
    // seed the entry with an initial texture
    await testDb.update(foodEntries).set({ texture: 'lisse' }).where(eq(foodEntries.id, entry.id));

    const event = makeRouteEvent({
      user: safeUser(u),
      memberships: [m],
      params: { id: String(c.id), entryId: String(entry.id) },
      formData: {
        foodId: String(food.id),
        givenAt: '2024-06-02T10:00',
        reaction: 'ras',
        notes: '',
        texture: 'ecrasee'
      }
    });
    await captureFlow(() =>
      actions.update!(event as unknown as Parameters<NonNullable<typeof actions.update>>[0])
    );
    const [row] = await testDb
      .select()
      .from(foodEntries)
      .where(eq(foodEntries.id, entry.id))
      .limit(1);
    expect(row.texture).toBe('ecrasee');
  });

  it('clears texture when form submits empty string', async () => {
    const { u, c, m, entry, food } = await setup();
    // seed the entry with an initial texture
    await testDb.update(foodEntries).set({ texture: 'lisse' }).where(eq(foodEntries.id, entry.id));

    const event = makeRouteEvent({
      user: safeUser(u),
      memberships: [m],
      params: { id: String(c.id), entryId: String(entry.id) },
      formData: {
        foodId: String(food.id),
        givenAt: '2024-06-02T10:00',
        reaction: 'ras',
        notes: '',
        texture: ''
      }
    });
    await captureFlow(() =>
      actions.update!(event as unknown as Parameters<NonNullable<typeof actions.update>>[0])
    );
    const [row] = await testDb
      .select()
      .from(foodEntries)
      .where(eq(foodEntries.id, entry.id))
      .limit(1);
    expect(row.texture).toBeNull();
  });
});

describe('child/[id]/log/[entryId] delete action', () => {
  it('deletes the entry and redirects to /foods by default', async () => {
    const { u, c, m, entry } = await setup();
    const event = makeRouteEvent({
      user: safeUser(u),
      memberships: [m],
      params: { id: String(c.id), entryId: String(entry.id) },
      formData: {}
    });
    const r = await captureFlow(() =>
      actions.delete!(event as unknown as Parameters<NonNullable<typeof actions.delete>>[0])
    );
    expect(r.kind).toBe('redirect');
    if (r.kind === 'redirect') expect(r.location).toBe(`/child/${c.id}/foods`);
    const fresh = (
      await testDb.select().from(foodEntries).where(eq(foodEntries.id, entry.id)).limit(1)
    )[0];
    expect(fresh).toBeUndefined();
  });

  it('redirects to dashboard when from=dashboard', async () => {
    const { u, c, m, entry } = await setup();
    const event = makeRouteEvent({
      user: safeUser(u),
      memberships: [m],
      params: { id: String(c.id), entryId: String(entry.id) },
      formData: { from: 'dashboard' }
    });
    const r = await captureFlow(() =>
      actions.delete!(event as unknown as Parameters<NonNullable<typeof actions.delete>>[0])
    );
    expect(r.kind).toBe('redirect');
    if (r.kind === 'redirect') expect(r.location).toBe(`/child/${c.id}`);
  });

  it('redirects to /foods after delete even when from=detail', async () => {
    // After delete, the detail page would 404 -- /foods is the safe fallback.
    const { u, c, m, entry } = await setup();
    const event = makeRouteEvent({
      user: safeUser(u),
      memberships: [m],
      params: { id: String(c.id), entryId: String(entry.id) },
      formData: { from: 'detail' }
    });
    const r = await captureFlow(() =>
      actions.delete!(event as unknown as Parameters<NonNullable<typeof actions.delete>>[0])
    );
    expect(r.kind).toBe('redirect');
    if (r.kind === 'redirect') expect(r.location).toBe(`/child/${c.id}/foods`);
  });
});
