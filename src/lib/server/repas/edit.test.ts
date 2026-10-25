import { beforeEach, describe, expect, it } from 'bun:test';
import { eq, sql } from 'drizzle-orm';
import { testDb, resetTestDb } from '../../../test/db';
import { seedChild } from '../../../test/route';
import {
  entryRow,
  entryRows,
  expectRefusal,
  form,
  ok,
  promote,
  recently,
  seedFood,
  seedRepasChild
} from '../../../test/repas';
import { foods } from '#lib/server/db/schema.js';
import { insertSymptom } from '#lib/server/db/symptoms.js';
import { editRepas, logRepas, readRepas, type RepasContext } from './index';

beforeEach(async () => {
  await resetTestDb();
});

const LOGGED_AT = '2024-06-01T10:00:00.000Z';

function logged(ctx: RepasContext, foodId: number | number[], extra: Record<string, string> = {}) {
  const result = ok(logRepas(ctx, form({ foodId, givenAt: LOGGED_AT, reaction: 'ras', ...extra })));
  if (result.replayed) throw new Error('a fresh key cannot replay');
  return result.entryIds;
}

// A standalone entry for Carotte, logged RAS with a note.
async function standalone() {
  const seeded = await seedRepasChild();
  const [entryId] = logged(seeded.ctx, seeded.carotte.id, { notes: 'init' });
  return { ...seeded, entryId };
}

// A meal of `count` aliments, all logged RAS.
async function meal(count = 2) {
  const seeded = await seedRepasChild();
  const others = [];
  for (let i = 1; i < count; i++) others.push(await seedFood({ name: `Ingrédient ${i}` }));
  const ids = logged(seeded.ctx, [seeded.carotte.id, ...others.map((f) => f.id)]);
  return { ...seeded, ids, mealId: entryRow(ids[0])?.mealId as string };
}

// What the single-entry edit form posts, as loaded for a RAS entry.
function entryForm(foodId: number, fields: Record<string, string> = {}) {
  return form({ foodId, givenAt: recently(), reaction: 'ras', reactionLoaded: 'ras', ...fields });
}

// What the meal edit form posts: per aliment, the picked and the loaded reaction.
function mealForm(
  reactions: Record<number, [string, string]>,
  fields: Record<string, string> = {}
) {
  const posted: Record<string, string> = { givenAt: recently(), ...fields };
  for (const [id, [to, loaded]] of Object.entries(reactions)) {
    posted[`reaction.${id}`] = to;
    posted[`reactionLoaded.${id}`] = loaded;
  }
  return form(posted);
}

describe('readRepas', () => {
  it('reads a standalone entry with no meal', async () => {
    const { ctx, entryId, carotte } = await standalone();
    expect(readRepas(ctx, entryId)).toEqual({
      entry: {
        id: entryId,
        foodId: carotte.id,
        givenAt: new Date(LOGGED_AT),
        reaction: 'ras',
        texture: null,
        notes: 'init'
      },
      meal: null
    });
  });

  it('reads every aliment of a meal, in logging order, from any of them', async () => {
    const { ctx, ids, mealId } = await meal(3);
    promote(ids[2], 'inconfort');
    expect(readRepas(ctx, ids[1])?.meal).toEqual({
      mealId,
      members: [
        { id: ids[0], foodId: entryRow(ids[0])!.foodId, foodName: 'Carotte', reaction: 'ras' },
        { id: ids[1], foodId: entryRow(ids[1])!.foodId, foodName: 'Ingrédient 1', reaction: 'ras' },
        {
          id: ids[2],
          foodId: entryRow(ids[2])!.foodId,
          foodName: 'Ingrédient 2',
          reaction: 'inconfort'
        }
      ]
    });
  });

  it('reads a row with a stale lone mealId as a standalone entry', async () => {
    const { ctx, entryId } = await standalone();
    testDb.run(sql`update food_entries set meal_id = 'lone' where id = ${entryId}`);
    expect(readRepas(ctx, entryId)?.meal).toBeNull();
  });

  it('does not read another child’s entry', async () => {
    const { user, entryId } = await standalone();
    const sibling = await seedChild({ createdBy: user.id });
    expect(readRepas({ childId: sibling.id }, entryId)).toBeNull();
  });
});

describe('editRepas: a standalone entry', () => {
  it('updates the aliment, date, reaction, texture and notes and bumps updatedAt', async () => {
    const { ctx, entryId } = await standalone();
    const pomme = await seedFood({ name: 'Pomme', category: 'fruits' });
    const past = new Date('2024-01-01T00:00:00Z');
    testDb.run(sql`update food_entries set updated_at = ${past.getTime()} where id = ${entryId}`);

    ok(
      editRepas(
        ctx,
        entryId,
        entryForm(pomme.id, {
          givenAt: '2024-06-02T10:00:00.000Z',
          reaction: 'inconfort',
          texture: 'ecrasee',
          notes: ' mangé à moitié '
        })
      )
    );

    expect(readRepas(ctx, entryId)?.entry).toEqual({
      id: entryId,
      foodId: pomme.id,
      givenAt: new Date('2024-06-02T10:00:00.000Z'),
      reaction: 'inconfort',
      texture: 'ecrasee',
      notes: 'mangé à moitié'
    });
    expect(entryRow(entryId)!.updatedAt!.getTime()).toBeGreaterThan(past.getTime());
  });

  it('clears the texture and the notes when the form posts them empty', async () => {
    const { ctx, entryId, carotte } = await standalone();
    ok(editRepas(ctx, entryId, entryForm(carotte.id, { texture: 'lisse' })));
    ok(editRepas(ctx, entryId, entryForm(carotte.id, { texture: '', notes: '' })));
    expect(readRepas(ctx, entryId)?.entry).toMatchObject({ texture: null, notes: null });
  });

  it('switches to a new custom aliment, created in the same transaction', async () => {
    const { ctx, entryId, child } = await standalone();
    const fields = { givenAt: recently(), reaction: 'ras', 'customFood.category': 'legumes' };
    ok(editRepas(ctx, entryId, form({ ...fields, 'customFood.name': 'Velouté maison' })));
    const custom = testDb.select().from(foods).where(eq(foods.customForChildId, child.id)).get();
    expect(custom).toMatchObject({ name: 'Velouté maison', category: 'legumes' });
    expect(readRepas(ctx, entryId)?.entry.foodId).toBe(custom!.id);
  });

  it('rolls the new custom aliment back when the edit is refused or fails', async () => {
    const { ctx, entryId, child } = await standalone();
    const fields = { reaction: 'ras', 'customFood.name': 'Purée orpheline' };
    expectRefusal(
      editRepas(ctx, entryId, form({ ...fields, givenAt: '2099-01-01T10:00' })),
      400,
      'errorsLogDateFuture'
    );

    testDb.run(
      sql`CREATE TRIGGER tmp_abort_update BEFORE UPDATE ON food_entries
          WHEN NEW.notes = '__simulated_fail__'
          BEGIN SELECT RAISE(ABORT, 'simulated entry-update failure'); END`
    );
    try {
      expect(() =>
        editRepas(
          ctx,
          entryId,
          form({ ...fields, givenAt: recently(), notes: '__simulated_fail__' })
        )
      ).toThrow();
    } finally {
      testDb.run(sql`DROP TRIGGER IF EXISTS tmp_abort_update`);
    }

    expect(testDb.select().from(foods).where(eq(foods.customForChildId, child.id)).all()).toEqual(
      []
    );
    expect(readRepas(ctx, entryId)?.entry.notes).toBe('init');
  });

  it('refuses an invalid edit and leaves the entry unchanged', async () => {
    const { ctx, entryId, carotte, user } = await standalone();
    const sibling = await seedChild({ createdBy: user.id, birthDate: '2023-01-01' });
    const theirs = await seedFood({ name: 'Leur plat', customForChildId: sibling.id });
    const before = readRepas(ctx, entryId);
    const cases: [FormData, Parameters<typeof expectRefusal>[2]][] = [
      [entryForm(carotte.id, { givenAt: 'not-a-date' }), 'errorsLogDateInvalid'],
      [entryForm(carotte.id, { givenAt: '2099-01-01T10:00' }), 'errorsLogDateFuture'],
      [entryForm(carotte.id, { givenAt: '2023-06-01T10:00' }), 'errorsLogDateBeforeBirth'],
      [entryForm(carotte.id, { reaction: 'pas-une-reaction' }), 'errorsAuthBadInput'],
      [entryForm(carotte.id, { texture: 'pas-une-texture' }), 'errorsLogTextureInvalid'],
      [entryForm(carotte.id, { notes: 'x'.repeat(2001) }), 'errorsLogNoteTooLong'],
      [entryForm(theirs.id), 'errorsLogFoodNotFound'],
      [form({ givenAt: recently(), reaction: 'ras' }), 'errorsLogNoFoodSelected'],
      [
        form({ 'customFood.name': '  ', givenAt: recently(), reaction: 'ras' }),
        'errorsLogNoFoodSelected'
      ],
      // A standalone entry holds one aliment.
      [entryForm(carotte.id, { 'customFood.name': 'Compote' }), 'errorsAuthBadInput'],
      [form({ foodId: carotte.id, givenAt: recently() }), 'errorsAuthBadInput']
    ];
    for (const [posted, errorKey] of cases) {
      expectRefusal(editRepas(ctx, entryId, posted), 400, errorKey);
    }
    expect(readRepas(ctx, entryId)).toEqual(before);
  });

  it('refuses another child’s entry as not found', async () => {
    const { ctx, entryId, carotte, user } = await standalone();
    const sibling = await seedChild({ createdBy: user.id });
    expectRefusal(
      editRepas({ ...ctx, childId: sibling.id }, entryId, entryForm(carotte.id)),
      404,
      'errorsFoodEntryNotFound'
    );
  });
});

describe('editRepas: the reaction a symptom promoted (#421)', () => {
  // A co-parent adds a symptom to the repas after the edit form was loaded
  // with the entry at RAS: insertSymptom promotes it to inconfort, or to
  // reaction for a severe symptom.
  async function promotedAfterLoad(label: 'rougeur' | 'gonflement' = 'rougeur') {
    const seeded = await standalone();
    await insertSymptom({
      foodEntryId: seeded.entryId,
      childId: seeded.child.id,
      observedAt: new Date(),
      label,
      note: null,
      createdBy: seeded.user.id,
      currentReaction: 'ras'
    });
    expect(entryRow(seeded.entryId)?.reaction).toBe(label === 'rougeur' ? 'inconfort' : 'reaction');
    return seeded;
  }

  it('refuses a stale form’s reaction change that is less severe than the promotion, and writes nothing', async () => {
    const { ctx, entryId } = await promotedAfterLoad('gonflement');
    const before = readRepas(ctx, entryId);
    const pomme = await seedFood({ name: 'Pomme', category: 'fruits' });
    const refused = editRepas(
      ctx,
      entryId,
      entryForm(pomme.id, {
        givenAt: '2024-06-02T10:00:00.000Z',
        reaction: 'inconfort',
        reactionLoaded: 'ras',
        texture: 'lisse',
        notes: 'jamais enregistré'
      })
    );
    expect(refused).toEqual({
      ok: false,
      status: 409,
      errorKey: 'errorsLogReactionChanged',
      reactions: { [entryId]: 'reaction' }
    });
    expect(readRepas(ctx, entryId)).toEqual(before);
  });

  it('keeps the promoted reaction when a stale form edits the time, aliment or notes', async () => {
    const { ctx, entryId } = await promotedAfterLoad();
    const pomme = await seedFood({ name: 'Pomme', category: 'fruits' });
    ok(editRepas(ctx, entryId, entryForm(pomme.id, { notes: 'heure corrigée' })));
    expect(readRepas(ctx, entryId)?.entry).toMatchObject({
      foodId: pomme.id,
      notes: 'heure corrigée',
      reaction: 'inconfort'
    });
  });

  // #445: the more severe of the parent's choice and the promotion wins.
  it('writes a stale form’s reaction change that is more severe than the promotion', async () => {
    const { ctx, entryId, carotte } = await promotedAfterLoad();
    ok(
      editRepas(
        ctx,
        entryId,
        entryForm(carotte.id, { reaction: 'reaction', reactionLoaded: 'ras' })
      )
    );
    expect(readRepas(ctx, entryId)?.entry.reaction).toBe('reaction');
  });

  it('saves a stale form that picked the promoted reaction itself', async () => {
    const { ctx, entryId, carotte } = await promotedAfterLoad();
    ok(
      editRepas(
        ctx,
        entryId,
        entryForm(carotte.id, { reaction: 'inconfort', reactionLoaded: 'ras', notes: 'vu' })
      )
    );
    expect(readRepas(ctx, entryId)?.entry).toMatchObject({ reaction: 'inconfort', notes: 'vu' });
  });

  it('writes a reaction the parent deliberately changed', async () => {
    const { ctx, entryId, carotte } = await promotedAfterLoad();
    // Reloaded form: it now loads inconfort, and the parent picks reaction.
    ok(
      editRepas(
        ctx,
        entryId,
        entryForm(carotte.id, { reaction: 'reaction', reactionLoaded: 'inconfort' })
      )
    );
    expect(readRepas(ctx, entryId)?.entry.reaction).toBe('reaction');
  });

  it('compares against the stored reaction when the form predates the loaded field', async () => {
    const { ctx, entryId, carotte } = await standalone();
    const posted = form({ foodId: carotte.id, givenAt: recently(), reaction: 'inconfort' });
    ok(editRepas(ctx, entryId, posted));
    expect(readRepas(ctx, entryId)?.entry.reaction).toBe('inconfort');
  });
});

describe('editRepas: a meal', () => {
  it('writes the shared fields to every aliment and leaves unchanged reactions alone', async () => {
    const { ctx, ids, child } = await meal(2);
    promote(ids[1], 'reaction');
    ok(
      editRepas(
        ctx,
        ids[0],
        mealForm(
          { [ids[0]]: ['ras', 'ras'], [ids[1]]: ['reaction', 'reaction'] },
          { givenAt: '2024-06-02T12:00:00.000Z', texture: 'lisse', notes: ' x ' }
        )
      )
    );
    expect(entryRows(child.id).map((r) => [r.givenAt, r.texture, r.notes, r.reaction])).toEqual([
      [new Date('2024-06-02T12:00:00.000Z'), 'lisse', 'x', 'ras'],
      [new Date('2024-06-02T12:00:00.000Z'), 'lisse', 'x', 'reaction']
    ]);
  });

  it('writes each reaction the parent changed', async () => {
    const { ctx, ids } = await meal(3);
    ok(
      editRepas(
        ctx,
        ids[2],
        mealForm({ [ids[0]]: ['inconfort', 'ras'], [ids[2]]: ['reaction', 'ras'] })
      )
    );
    expect(readRepas(ctx, ids[0])?.meal?.members.map((m) => m.reaction)).toEqual([
      'inconfort',
      'ras',
      'reaction'
    ]);
  });

  it('keeps a reaction promoted after the form loaded when the stale form leaves it alone', async () => {
    const { ctx, ids } = await meal(2);
    promote(ids[1], 'reaction');
    // Submitted == loaded: the parent didn't touch that reaction.
    ok(editRepas(ctx, ids[0], mealForm({ [ids[1]]: ['ras', 'ras'] }, { notes: 'new note' })));
    expect(readRepas(ctx, ids[1])?.meal?.members[1].reaction).toBe('reaction');
  });

  // #445, per aliment: the more severe of the parent's choice and the promotion wins.
  it('writes a stale form’s change that is more severe than the promotion, and leaves an equal one alone', async () => {
    const { ctx, ids, child } = await meal(3);
    promote(ids[0], 'inconfort');
    promote(ids[1], 'inconfort');
    ok(
      editRepas(
        ctx,
        ids[0],
        mealForm({ [ids[0]]: ['reaction', 'ras'], [ids[1]]: ['inconfort', 'ras'] })
      )
    );
    expect(entryRows(child.id).map((r) => r.reaction)).toEqual(['reaction', 'inconfort', 'ras']);
  });

  it('refuses a stale form’s change that is less severe than the promotion, and writes nothing', async () => {
    const { ctx, ids, child } = await meal(3);
    promote(ids[0], 'inconfort');
    promote(ids[2], 'reaction');
    const before = entryRows(child.id);
    // ids[0]'s escalation alone would be written; ids[2]'s downgrade refuses
    // the whole edit, the shared fields and ids[0] included.
    const refused = editRepas(
      ctx,
      ids[0],
      mealForm(
        {
          [ids[0]]: ['reaction', 'ras'],
          [ids[1]]: ['inconfort', 'ras'],
          [ids[2]]: ['inconfort', 'ras']
        },
        { notes: 'jamais enregistré', texture: 'lisse' }
      )
    );
    expect(refused).toEqual({
      ok: false,
      status: 409,
      errorKey: 'errorsLogReactionChanged',
      reactions: { [ids[0]]: 'inconfort', [ids[1]]: 'ras', [ids[2]]: 'reaction' }
    });
    expect(entryRows(child.id)).toEqual(before);
  });

  it('refuses an invalid meal edit and leaves every aliment unchanged', async () => {
    const { ctx, ids, child } = await meal(2);
    const before = entryRows(child.id);
    const cases: [FormData, Parameters<typeof expectRefusal>[2]][] = [
      [mealForm({}, { givenAt: '' }), 'errorsLogDateRequired'],
      [mealForm({}, { givenAt: '2099-01-01T10:00' }), 'errorsLogDateFuture'],
      [mealForm({}, { givenAt: '2023-06-01T10:00' }), 'errorsLogDateBeforeBirth'],
      [mealForm({}, { texture: 'pas-une-texture' }), 'errorsLogTextureInvalid'],
      [mealForm({}, { notes: 'x'.repeat(2001) }), 'errorsLogNoteTooLong'],
      [mealForm({ [ids[1]]: ['pas-une-reaction', 'ras'] }), 'errorsAuthBadInput'],
      [mealForm({ [ids[1]]: ['ras', 'pas-une-reaction'] }), 'errorsAuthBadInput']
    ];
    for (const [posted, errorKey] of cases) {
      expectRefusal(editRepas(ctx, ids[0], posted), 400, errorKey);
    }
    expect(entryRows(child.id)).toEqual(before);
  });
});
