import { beforeEach, describe, expect, it, test, mock } from 'bun:test';
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
import * as schema from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { newId } from '$lib/offline/uuid';
import type { Membership, SafeUser } from '$lib/types';
import type { ReactionId } from '$lib/utils/reaction-values';
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

  it('bumps updatedAt on a successful edit so the change is not silent', async () => {
    const { u, c, m, food, entry } = await setup();
    // Pin updatedAt to a fixed point in the past so the post-edit comparison is
    // deterministic (no reliance on wall-clock advancing within the test tick).
    const past = new Date('2024-01-01T00:00:00Z');
    await testDb.update(foodEntries).set({ updatedAt: past }).where(eq(foodEntries.id, entry.id));

    const event = makeRouteEvent({
      user: safeUser(u),
      memberships: [m],
      params: { id: String(c.id), entryId: String(entry.id) },
      formData: {
        foodId: String(food.id),
        givenAt: '2024-06-02T10:00',
        reaction: 'inconfort'
      }
    });
    await captureFlow(() =>
      actions.update!(event as unknown as Parameters<NonNullable<typeof actions.update>>[0])
    );

    const [row] = await testDb.select().from(foodEntries).where(eq(foodEntries.id, entry.id));
    expect(row.reaction).toBe('inconfort');
    expect(row.updatedAt).toBeInstanceOf(Date);
    expect(row.updatedAt!.getTime()).toBeGreaterThan(past.getTime());
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

describe('child/[id]/log/[entryId] meal mode', () => {
  // Populated by seedMeal() for each test — every meal-mode test seeds its own
  // user/child/meal, so these are assigned (not module-level fixtures) before
  // each read.
  let user!: SafeUser;
  let memberships!: Membership[];

  // Seeds a child + one meal of `reactions.length` ingredients sharing a
  // mealId (mirrors the production insert path in log/+page.server.ts, which
  // mints mealId via the same newId() helper). Returns the pieces each test
  // needs; `user`/`memberships` are assigned onto the enclosing closure so
  // callers can pass them straight into makeRouteEvent.
  async function seedMeal(reactions: ReactionId[]) {
    const u = await seedUser();
    user = safeUser(u);
    const child = await seedChild({ createdBy: u.id });
    const m = await seedMembership({ userId: u.id, childId: child.id, role: 'owner' });
    memberships = [m];

    const m1 = newId();
    const ids: number[] = [];
    for (const [i, reaction] of reactions.entries()) {
      const food = (
        await testDb
          .insert(foods)
          .values({
            name: `Ingrédient ${i}`,
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
            childId: child.id,
            foodId: food.id,
            givenAt: new Date('2024-06-01T10:00:00Z'),
            reaction,
            loggedBy: u.id,
            createdAt: new Date(),
            updatedAt: new Date(),
            mealId: m1
          })
          .returning()
      )[0];
      ids.push(entry.id);
    }
    return { child, m1, ids };
  }

  test('meal-mode update writes shared fields to all siblings and does not touch unchanged reactions', async () => {
    const { child, m1, ids } = await seedMeal(['ras', 'ras']); // helper: 2-ingredient meal, both ras
    // promote one sibling out-of-band (simulates a symptom)
    await testDb
      .update(schema.foodEntries)
      .set({ reaction: 'reaction' })
      .where(eq(schema.foodEntries.id, ids[1]));
    const ev = makeRouteEvent({
      user,
      memberships,
      params: { id: String(child.id), entryId: String(ids[0]) },
      formData: {
        givenAt: new Date().toISOString(),
        texture: 'lisse',
        notes: 'x',
        // each ingredient submits reaction == reactionLoaded (nothing changed), so
        // the dirty-only guard issues zero reaction writes
        [`reaction.${ids[0]}`]: 'ras',
        [`reactionLoaded.${ids[0]}`]: 'ras',
        [`reaction.${ids[1]}`]: 'reaction',
        [`reactionLoaded.${ids[1]}`]: 'reaction'
      }
    });
    await captureFlow(() => actions.update(ev as never));
    const rows = await testDb
      .select()
      .from(schema.foodEntries)
      .where(eq(schema.foodEntries.mealId, m1));
    expect(rows.every((r) => r.notes === 'x' && r.texture === 'lisse')).toBe(true);
    expect(rows.find((r) => r.id === ids[1])!.reaction).toBe('reaction'); // promotion preserved
  });

  test('meal-mode update rejects notes over 2000 chars and leaves siblings unchanged', async () => {
    const { child, m1, ids } = await seedMeal(['ras', 'ras']);
    const longNotes = 'x'.repeat(2001);
    const ev = makeRouteEvent({
      user,
      memberships,
      params: { id: String(child.id), entryId: String(ids[0]) },
      formData: {
        givenAt: new Date().toISOString(),
        notes: longNotes,
        [`reaction.${ids[0]}`]: 'ras',
        [`reactionLoaded.${ids[0]}`]: 'ras',
        [`reaction.${ids[1]}`]: 'ras',
        [`reactionLoaded.${ids[1]}`]: 'ras'
      }
    });
    const r = await captureFlow(() => actions.update(ev as never));
    expect(r.kind).toBe('return');
    if (r.kind === 'return') {
      expect((r.value as { status: number }).status).toBe(400);
    }
    const rows = await testDb
      .select()
      .from(schema.foodEntries)
      .where(eq(schema.foodEntries.mealId, m1));
    expect(rows.every((row) => row.notes === null)).toBe(true);
  });

  test('a stale date-only edit does not clobber a concurrently-promoted reaction', async () => {
    const { child, m1, ids } = await seedMeal(['ras', 'ras']);
    // The form loaded with both at 'ras'. A co-parent then promotes sibling ids[1].
    await testDb
      .update(schema.foodEntries)
      .set({ reaction: 'reaction' })
      .where(eq(schema.foodEntries.id, ids[1]));
    // The user submits the stale form: date/notes changed, reactions still the LOADED 'ras'.
    const ev = makeRouteEvent({
      user,
      memberships,
      params: { id: String(child.id), entryId: String(ids[0]) },
      formData: {
        givenAt: new Date().toISOString(),
        notes: 'new note',
        [`reaction.${ids[0]}`]: 'ras',
        [`reactionLoaded.${ids[0]}`]: 'ras',
        [`reaction.${ids[1]}`]: 'ras',
        [`reactionLoaded.${ids[1]}`]: 'ras'
      }
    });
    await captureFlow(() => actions.update(ev as never));
    const rows = await testDb
      .select()
      .from(schema.foodEntries)
      .where(eq(schema.foodEntries.mealId, m1));
    // Shared field applied to all; the promotion on ids[1] survived (guarded WHERE reaction='ras' no-op).
    expect(rows.every((r) => r.notes === 'new note')).toBe(true);
    expect(rows.find((r) => r.id === ids[1])!.reaction).toBe('reaction');
  });

  test('a genuine reaction edit that raced a promotion no-ops on the guarded WHERE (does not overwrite the promotion)', async () => {
    // Distinguishing test for the optimistic guard: unlike the two tests above
    // (which submit reaction == reactionLoaded, so the dirty-only `submitted
    // !== loaded` check short-circuits and NO update is ever issued), here the
    // user genuinely CHANGES ids[1]'s reaction, so an UPDATE *is* attempted —
    // and the `eq(reaction, loaded)` term is the only thing that stops it from
    // clobbering the concurrent promotion. Delete that term and this test goes
    // red (survivor becomes 'inconfort').
    const { child, m1, ids } = await seedMeal(['ras', 'ras']);
    // The form loaded with both at 'ras'. A co-parent then promotes ids[1] to
    // 'reaction' (a symptom fired) after the form was rendered.
    await testDb
      .update(schema.foodEntries)
      .set({ reaction: 'reaction' })
      .where(eq(schema.foodEntries.id, ids[1]));
    // The user, unaware, edits ids[1]'s reaction from its LOADED 'ras' to
    // 'inconfort'. submitted('inconfort') !== loaded('ras') ⇒ a write is
    // attempted; but the guard's WHERE reaction='ras' matches nothing (the row
    // is now 'reaction'), so the stale demote no-ops and the promotion stands.
    const ev = makeRouteEvent({
      user,
      memberships,
      params: { id: String(child.id), entryId: String(ids[0]) },
      formData: {
        givenAt: new Date().toISOString(),
        [`reaction.${ids[0]}`]: 'ras',
        [`reactionLoaded.${ids[0]}`]: 'ras',
        [`reaction.${ids[1]}`]: 'inconfort',
        [`reactionLoaded.${ids[1]}`]: 'ras'
      }
    });
    await captureFlow(() => actions.update(ev as never));
    const rows = await testDb
      .select()
      .from(schema.foodEntries)
      .where(eq(schema.foodEntries.mealId, m1));
    // The promotion survives: not the stale 'inconfort' the form tried to write,
    // and not the original 'ras' either.
    expect(rows.find((r) => r.id === ids[1])!.reaction).toBe('reaction');
  });

  test('removeIngredient down to one nulls the survivor mealId', async () => {
    const { child, ids } = await seedMeal(['ras', 'ras']);
    const ev = makeRouteEvent({
      user,
      memberships,
      params: { id: String(child.id), entryId: String(ids[0]) },
      formData: { removeId: String(ids[0]) }
    });
    await captureFlow(() => actions.removeIngredient(ev as never));
    const survivor = (
      await testDb.select().from(schema.foodEntries).where(eq(schema.foodEntries.id, ids[1]))
    )[0];
    expect(survivor.mealId).toBeNull();
  });

  test('deleteMeal removes all siblings', async () => {
    const { child, m1, ids } = await seedMeal(['ras', 'ras', 'ras']);
    const ev = makeRouteEvent({
      user,
      memberships,
      params: { id: String(child.id), entryId: String(ids[0]) },
      formData: {}
    });
    await captureFlow(() => actions.deleteMeal(ev as never));
    const rows = await testDb
      .select()
      .from(schema.foodEntries)
      .where(eq(schema.foodEntries.mealId, m1));
    expect(rows.length).toBe(0);
  });

  test('removeIngredient on the anchor redirects to a surviving entry, not a 404', async () => {
    const { child, ids } = await seedMeal(['ras', 'ras', 'ras']);
    const ev = makeRouteEvent({
      user,
      memberships,
      params: { id: String(child.id), entryId: String(ids[0]) },
      formData: { removeId: String(ids[0]) } // remove the anchor itself
    });
    const res = await captureFlow(() => actions.removeIngredient(ev as never));
    expect(res.kind).toBe('redirect');
    if (res.kind === 'redirect') {
      expect(res.location).not.toContain(`/log/${ids[0]}`);
      expect(res.location).toContain(`/log/${ids[1]}`);
    }
  });
});
