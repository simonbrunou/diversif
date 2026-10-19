import { beforeEach, describe, expect, it } from 'bun:test';
import { resetTestDb } from '../../../../../test/db';
import { captureFlow, makeRouteEvent, safeUser, seedMembership } from '../../../../../test/route';
import { entryRow, form, ok, seedFood, seedRepasChild } from '../../../../../test/repas';
import { insertSymptom } from '#lib/server/db/symptoms.js';
import { logRepas } from '#lib/server/repas/index.js';
import { load, actions } from './+page.server';

// The repas rules live in src/lib/server/repas (tested there). These tests
// cover the route adapter: what the loader returns, how each action turns the
// module's result into a redirect, a fail() or a 404, and (#421) the
// load-then-submit round trip of the reaction the form loaded.

beforeEach(async () => {
  await resetTestDb();
});

async function setup(aliments = 1) {
  const seeded = await seedRepasChild();
  const membership = await seedMembership({ userId: seeded.user.id, childId: seeded.child.id });
  const extra = [];
  for (let i = 1; i < aliments; i++) extra.push((await seedFood({ name: `Ingrédient ${i}` })).id);
  const logged = ok(
    logRepas(
      seeded.ctx,
      form({
        foodId: [seeded.carotte.id, ...extra],
        givenAt: '2024-06-01T10:00:00.000Z',
        reaction: 'ras'
      }),
      null
    )
  );
  if (logged.replayed) throw new Error('a fresh key cannot replay');
  const ids = logged.entryIds;
  const event = (opts: Parameters<typeof makeRouteEvent>[0] & { entryId?: number } = {}) =>
    makeRouteEvent({
      user: safeUser(seeded.user),
      memberships: [membership],
      params: { id: String(seeded.child.id), entryId: String(opts.entryId ?? ids[0]) },
      url: `http://localhost/child/${seeded.child.id}/log/${opts.entryId ?? ids[0]}`,
      ...opts
    });
  return { ...seeded, ids, event };
}

type LoadEvent = Parameters<typeof load>[0];
type ActionEvent = Parameters<NonNullable<typeof actions.update>>[0];

const editFields = (foodId: number) => ({
  foodId: String(foodId),
  givenAt: '2024-06-02T10:00:00.000Z',
  reaction: 'ras',
  reactionLoaded: 'ras'
});

describe('child/[id]/log/[entryId] load', () => {
  it('errors 400 on an invalid entryId and 404 on another child’s entry', async () => {
    const { event, child } = await setup();
    const invalid = await captureFlow(() =>
      load(event({ params: { id: String(child.id), entryId: '0' } }) as unknown as LoadEvent)
    );
    const missing = await captureFlow(() =>
      load(event({ entryId: 999_999 }) as unknown as LoadEvent)
    );
    expect([invalid.kind, invalid.kind === 'error' && invalid.status]).toEqual(['error', 400]);
    expect([missing.kind, missing.kind === 'error' && missing.status]).toEqual(['error', 404]);
  });

  it('returns the entry with givenAt as a timestamp, the aliments and where to go back', async () => {
    const { event, ids, carotte, child } = await setup();
    const data = await load(
      event({
        url: `http://localhost/child/${child.id}/log/${ids[0]}?from=detail`
      }) as unknown as LoadEvent
    );
    expect(data.entry).toEqual({
      id: ids[0],
      foodId: carotte.id,
      givenAt: new Date('2024-06-01T10:00:00.000Z').getTime(),
      reaction: 'ras',
      texture: null,
      notes: null
    });
    expect(data.foods.map((f) => f.name)).toEqual(['Carotte']);
    expect(data.from).toBe('detail');
    expect(data.meal).toBeNull();
  });

  it('defaults where to go back to the carnet, and returns a meal’s aliments', async () => {
    const { event, ids, child } = await setup(2);
    const fromDashboard = await load(
      event({
        url: `http://localhost/child/${child.id}/log/${ids[0]}?from=dashboard`
      }) as unknown as LoadEvent
    );
    const data = await load(event() as unknown as LoadEvent);
    expect(fromDashboard.from).toBe('dashboard');
    expect(data.from).toBe('foods');
    expect(data.meal?.members.map((m) => m.id)).toEqual(ids);
  });
});

describe('child/[id]/log/[entryId] update action', () => {
  it('redirects to the carnet, the dashboard or the entry’s detail page', async () => {
    const { event, ids, child, carotte } = await setup();
    const update = (from?: string) =>
      captureFlow(() =>
        actions.update(
          event({
            formData: { ...editFields(carotte.id), ...(from ? { from } : {}) }
          }) as unknown as ActionEvent
        )
      );
    expect(await update()).toMatchObject({ status: 303, location: `/child/${child.id}/foods` });
    expect(await update('dashboard')).toMatchObject({ location: `/child/${child.id}` });
    expect(await update('detail')).toMatchObject({
      location: `/child/${child.id}/foods/${ids[0]}`
    });
  });

  it('returns a refusal as a fail(), and a missing entry as a 404 page', async () => {
    const { event, carotte } = await setup();
    const refused = await actions.update(
      event({
        formData: { ...editFields(carotte.id), givenAt: 'not-a-date' }
      }) as unknown as ActionEvent
    );
    expect(refused).toMatchObject({ status: 400, data: { errorKey: 'errorsLogDateInvalid' } });
    const missing = await captureFlow(() =>
      actions.update(
        event({ entryId: 999_999, formData: editFields(carotte.id) }) as unknown as ActionEvent
      )
    );
    expect(missing).toMatchObject({ kind: 'error', status: 404 });
  });
});

// #421: a co-parent's symptom promotes the row while this edit form is open.
// The form carries the reaction it loaded (`reactionLoaded`); the action must
// not write that stale value back over the promotion.
describe('child/[id]/log/[entryId] update vs a concurrent symptom promotion', () => {
  type Ctx = Awaited<ReturnType<typeof setup>>;

  async function loadForm(ctx: Ctx) {
    return (await load(ctx.event() as unknown as LoadEvent)).entry;
  }

  async function addSymptom(ctx: Ctx, label: 'rougeur' | 'gonflement') {
    const result = await insertSymptom({
      foodEntryId: ctx.ids[0],
      childId: ctx.child.id,
      observedAt: new Date('2024-06-01T11:00:00Z'),
      label,
      note: null,
      createdBy: ctx.user.id,
      currentReaction: 'ras'
    });
    return result.promotedTo;
  }

  function submit(ctx: Ctx, formData: Record<string, string>) {
    return captureFlow(() => actions.update(ctx.event({ formData }) as unknown as ActionEvent));
  }

  it('a stale edit of the time, aliment and notes keeps the promoted reaction', async () => {
    const ctx = await setup();
    const loaded = await loadForm(ctx);
    expect(loaded.reaction).toBe('ras');
    const pomme = await seedFood({ name: 'Pomme', category: 'fruits' });

    expect(await addSymptom(ctx, 'rougeur')).toBe('inconfort');

    // The parent fixes the time, aliment and notes; the picker still shows the
    // reaction the form loaded.
    const r = await submit(ctx, {
      foodId: String(pomme.id),
      givenAt: '2024-06-01T12:30:00.000Z',
      reaction: loaded.reaction,
      reactionLoaded: loaded.reaction,
      notes: 'heure corrigée',
      from: ''
    });
    expect(r.kind).toBe('redirect');

    expect(entryRow(ctx.ids[0])).toMatchObject({
      reaction: 'inconfort',
      foodId: pomme.id,
      givenAt: new Date('2024-06-01T12:30:00.000Z'),
      notes: 'heure corrigée'
    });
  });

  it('a deliberate reaction change that raced a promotion does not overwrite it', async () => {
    // The dirty-only check alone lets this write through (submitted 'inconfort'
    // differs from loaded 'ras'); only the WHERE guard on the loaded value
    // stops it from downgrading the severe promotion.
    const ctx = await setup();
    const loaded = await loadForm(ctx);
    expect(await addSymptom(ctx, 'gonflement')).toBe('reaction');

    const r = await submit(ctx, {
      foodId: String(ctx.carotte.id),
      givenAt: '2024-06-01T12:30:00.000Z',
      reaction: 'inconfort',
      reactionLoaded: loaded.reaction,
      notes: 'modifié'
    });
    expect(r.kind).toBe('redirect');

    expect(entryRow(ctx.ids[0])).toMatchObject({ reaction: 'reaction', notes: 'modifié' });
  });

  it('a deliberate reaction change on an up-to-date form still applies', async () => {
    const ctx = await setup();
    expect(await addSymptom(ctx, 'rougeur')).toBe('inconfort');
    // The form loads after the promotion, so it is not stale.
    const loaded = await loadForm(ctx);
    expect(loaded.reaction).toBe('inconfort');

    const r = await submit(ctx, {
      foodId: String(ctx.carotte.id),
      givenAt: '2024-06-01T10:00:00.000Z',
      reaction: 'ras',
      reactionLoaded: loaded.reaction
    });
    expect(r.kind).toBe('redirect');

    expect(entryRow(ctx.ids[0])?.reaction).toBe('ras');
  });
});

describe('child/[id]/log/[entryId] delete actions', () => {
  it('delete redirects to the carnet, even from the detail page it just removed', async () => {
    const { event, child } = await setup();
    const r = await captureFlow(() =>
      actions.delete(event({ formData: { from: 'detail' } }) as unknown as ActionEvent)
    );
    expect(r).toMatchObject({ status: 303, location: `/child/${child.id}/foods` });
  });

  it('deleteMeal redirects to the dashboard it came from, and refuses a standalone entry', async () => {
    const meal = await setup(2);
    const r = await captureFlow(() =>
      actions.deleteMeal(meal.event({ formData: { from: 'dashboard' } }) as unknown as ActionEvent)
    );
    expect(r).toMatchObject({ status: 303, location: `/child/${meal.child.id}` });

    await resetTestDb();
    const single = await setup();
    const refused = await actions.deleteMeal(
      single.event({ formData: {} }) as unknown as ActionEvent
    );
    expect(refused).toMatchObject({ status: 400, data: { errorKey: 'errorsLogMealNotFound' } });
  });

  it('removeIngredient redirects to the editor of a surviving entry, and refuses a standalone entry', async () => {
    const meal = await setup(3);
    const r = await captureFlow(() =>
      actions.removeIngredient(
        meal.event({ formData: { removeId: String(meal.ids[0]) } }) as unknown as ActionEvent
      )
    );
    expect(r).toMatchObject({
      status: 303,
      location: `/child/${meal.child.id}/log/${meal.ids[1]}`
    });

    await resetTestDb();
    const single = await setup();
    const refused = await actions.removeIngredient(
      single.event({ formData: { removeId: String(single.ids[0]) } }) as unknown as ActionEvent
    );
    expect(refused).toMatchObject({ status: 400, data: { errorKey: 'errorsLogInvalidRequest' } });
  });
});
