import { beforeEach, describe, expect, it } from 'bun:test';
import { resetTestDb } from '../../../test/db';
import { seedChild } from '../../../test/route';
import {
  entryRow,
  entryRows,
  expectRefusal,
  form,
  ok,
  seedFood,
  seedRepasChild
} from '../../../test/repas';
import {
  deleteEntry,
  deleteMeal,
  logRepas,
  readRepas,
  removeIngredient,
  type RepasContext
} from './index';

beforeEach(async () => {
  await resetTestDb();
});

function logged(ctx: RepasContext, foodId: number | number[]) {
  const result = ok(
    logRepas(ctx, form({ foodId, givenAt: '2024-06-01T10:00:00.000Z', reaction: 'ras' }), null)
  );
  if (result.replayed) throw new Error('a fresh key cannot replay');
  return result.entryIds;
}

async function meal(count: number) {
  const seeded = await seedRepasChild();
  const others = [];
  for (let i = 1; i < count; i++) others.push(await seedFood({ name: `Ingrédient ${i}` }));
  return { ...seeded, ids: logged(seeded.ctx, [seeded.carotte.id, ...others.map((f) => f.id)]) };
}

async function siblingOf(ctx: RepasContext, userId: number): Promise<RepasContext> {
  const sibling = await seedChild({ createdBy: userId });
  return { ...ctx, childId: sibling.id };
}

describe('removeIngredient', () => {
  it('removes one aliment and lands on the lowest surviving entry', async () => {
    const { ctx, ids } = await meal(3);
    // Removing the entry the editor was opened on must not land on it (404).
    expect(removeIngredient(ctx, ids[0], form({ removeId: ids[0] }))).toEqual({
      ok: true,
      landOn: ids[1]
    });
    expect(readRepas(ctx, ids[1])?.meal?.members.map((m) => m.id)).toEqual([ids[1], ids[2]]);
  });

  it('turns the last survivor into a standalone entry', async () => {
    const { ctx, ids } = await meal(2);
    expect(removeIngredient(ctx, ids[0], form({ removeId: ids[1] }))).toEqual({
      ok: true,
      landOn: ids[0]
    });
    expect(entryRow(ids[0])?.mealId).toBeNull();
    expect(entryRow(ids[1])).toBeUndefined();
  });

  it('removes nothing when the aliment already left the meal', async () => {
    const { ctx, ids, child } = await meal(2);
    const [other] = logged(ctx, (await seedFood({ name: 'Pomme' })).id);
    expect(removeIngredient(ctx, ids[0], form({ removeId: other }))).toEqual({
      ok: true,
      landOn: ids[0]
    });
    expect(entryRows(child.id)).toHaveLength(3);
  });

  it('never removes another child’s entry posted as removeId', async () => {
    const { ctx, ids, user, carotte } = await meal(2);
    const sibling = await siblingOf(ctx, user.id);
    const [theirs] = logged(sibling, carotte.id);
    expect(removeIngredient(ctx, ids[0], form({ removeId: theirs }))).toEqual({
      ok: true,
      landOn: ids[0]
    });
    expect(readRepas(sibling, theirs)).not.toBeNull();
    expect(readRepas(ctx, ids[0])?.meal?.members.map((m) => m.id)).toEqual(ids);
  });

  it('refuses a standalone entry or a malformed removeId', async () => {
    const { ctx, ids, carotte } = await meal(2);
    const [single] = logged(ctx, carotte.id);
    expectRefusal(
      removeIngredient(ctx, single, form({ removeId: single })),
      400,
      'errorsLogInvalidRequest'
    );
    for (const removeId of ['', 'abc', '1.5']) {
      expectRefusal(
        removeIngredient(ctx, ids[0], form({ removeId })),
        400,
        'errorsLogInvalidRequest'
      );
    }
    expectRefusal(removeIngredient(ctx, ids[0], form({})), 400, 'errorsLogInvalidRequest');
    expect(readRepas(ctx, single)).not.toBeNull();
  });

  it('refuses another child’s entry as not found', async () => {
    const { ctx, ids, user } = await meal(2);
    expectRefusal(
      removeIngredient(await siblingOf(ctx, user.id), ids[0], form({ removeId: ids[0] })),
      404,
      'errorsFoodEntryNotFound'
    );
  });
});

describe('deleteEntry', () => {
  it('deletes a standalone entry', async () => {
    const { ctx, carotte, child } = await seedRepasChild();
    const [entryId] = logged(ctx, carotte.id);
    ok(deleteEntry(ctx, entryId));
    expect(entryRows(child.id)).toEqual([]);
  });

  it('turns a meal’s last survivor into a standalone entry', async () => {
    const { ctx, ids } = await meal(2);
    ok(deleteEntry(ctx, ids[1]));
    expect(entryRow(ids[0])?.mealId).toBeNull();
  });

  it('refuses another child’s entry as not found', async () => {
    const { ctx, carotte, user } = await seedRepasChild();
    const [entryId] = logged(ctx, carotte.id);
    expectRefusal(
      deleteEntry(await siblingOf(ctx, user.id), entryId),
      404,
      'errorsFoodEntryNotFound'
    );
  });
});

describe('deleteMeal', () => {
  it('deletes every aliment of the meal, from any of them', async () => {
    const { ctx, ids, child, carotte } = await meal(3);
    const [kept] = logged(ctx, carotte.id);
    ok(deleteMeal(ctx, ids[1]));
    expect(entryRows(child.id).map((r) => r.id)).toEqual([kept]);
  });

  it('refuses a standalone entry, or another child’s entry', async () => {
    const { ctx, carotte, user } = await seedRepasChild();
    const [entryId] = logged(ctx, carotte.id);
    expectRefusal(deleteMeal(ctx, entryId), 400, 'errorsLogMealNotFound');
    expectRefusal(
      deleteMeal(await siblingOf(ctx, user.id), entryId),
      404,
      'errorsFoodEntryNotFound'
    );
    expect(readRepas(ctx, entryId)).not.toBeNull();
  });
});
