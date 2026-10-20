import { afterEach, beforeEach, describe, expect, it, mock, setSystemTime } from 'bun:test';
import { testDb, resetTestDb } from '../../../test/db';
import { captureFlow, makeRouteEvent, safeUser, seedMembership } from '../../../test/route';
import { seedFood, seedRepasChild } from '../../../test/repas';

mock.module('#lib/server/db/index.js', () => ({ db: testDb }));

import { formatRelative } from '#lib/utils/dates.js';
import { actions as logActions } from './log/+page.server';
import { load as loadAujourdhui } from './+page.server';
import { load as loadCarnet } from './foods/+page.server';

// A repas logged just after midnight in Paris, followed through what the
// parent sees next: the Aujourd'hui feed and tiles, and the Carnet's bars.
// Each loader reads the clock once per request, so the fixed clock below is
// the whole seam. The host runs in UTC, as the production server does.

type LogEvent = Parameters<typeof logActions.default>[0];
type AujourdhuiEvent = Parameters<typeof loadAujourdhui>[0];
type CarnetEvent = Parameters<typeof loadCarnet>[0];

let hostZone: string | undefined;

beforeEach(async () => {
  hostZone = process.env.TZ;
  process.env.TZ = 'UTC';
  await resetTestDb();
});

afterEach(() => {
  setSystemTime();
  if (hostZone === undefined) delete process.env.TZ;
  else process.env.TZ = hostZone;
});

async function setup() {
  const seeded = await seedRepasChild();
  const pomme = await seedFood({ name: 'Pomme', category: 'fruits' });
  const membership = await seedMembership({ userId: seeded.user.id, childId: seeded.child.id });
  const event = (opts: Parameters<typeof makeRouteEvent>[0] = {}) =>
    makeRouteEvent({
      user: safeUser(seeded.user),
      memberships: [membership],
      params: { id: String(seeded.child.id) },
      parent: async () => ({
        child: { ...seeded.child, createdAt: seeded.child.createdAt.getTime() }
      }),
      ...opts
    });

  /** Logs a repas through the log form at `iso`, with the clock reading `iso`. */
  async function logAt(iso: string, foodId: number) {
    setSystemTime(new Date(iso));
    const r = await captureFlow(() =>
      logActions.default(
        event({
          formData: { foodId: String(foodId), givenAt: iso, reaction: 'ras' }
        }) as unknown as LogEvent
      )
    );
    expect(r.kind).toBe('redirect');
  }

  async function view(iso: string) {
    setSystemTime(new Date(iso));
    const aujourdhui = await loadAujourdhui(event() as unknown as AujourdhuiEvent);
    const carnet = await loadCarnet(
      event({
        url: `http://localhost/child/${seeded.child.id}/foods`
      }) as unknown as CarnetEvent
    );
    if (!('weeklyEntries' in carnet)) throw new Error('expected the Carnet tiles');
    return { aujourdhui, carnet, now: new Date(iso) };
  }

  return { ...seeded, pomme, logAt, view };
}

describe('a repas logged at 00:30 Paris', () => {
  it('is today in the Carnet and on Aujourd’hui; Régularité counts the UTC day', async () => {
    const { carotte, pomme, logAt, view } = await setup();
    await logAt('2026-06-01T18:00:00.000Z', carotte.id); // 20:00 Paris, Monday 1 June
    await logAt('2026-06-01T22:30:00.000Z', pomme.id); // 00:30 Paris, Tuesday 2 June

    const { aujourdhui, carnet, now } = await view('2026-06-01T22:35:00.000Z'); // 00:35 Paris

    // Carnet: one repas in today's bar, one in yesterday's, labelled 2 June.
    expect(carnet.weeklyEntries.counts).toEqual([0, 0, 0, 0, 0, 1, 1]);
    expect(carnet.weeklyEntries.anchorUtc).toBe(Date.UTC(2026, 5, 2));

    // Aujourd'hui: the feed reads both in Paris time.
    expect(aujourdhui.recent.map((e) => [e.foodName, formatRelative(e.givenAt, now)])).toEqual([
      ['Pomme', 'il y a 5 min'],
      ['Carotte', 'hier 20:00']
    ]);
    // Both foods are new this week, the Carnet's 7 days.
    expect(aujourdhui.stats).toEqual({ foodsIntroduced: 2, weekCount: 2 });
    // Régularité buckets by UTC day on purpose (buildStreak): 20:00 and 00:30
    // Paris both fall on UTC 1 June, so two Paris days count as one.
    expect(aujourdhui.streak).toEqual({ current: 1, record: 1 });
  });

  it('keeps the 25-hour fall-back day in one bar', async () => {
    const { carotte, logAt, view } = await setup();
    await logAt('2026-10-24T22:10:00.000Z', carotte.id); // 00:10 CEST, Sunday 25 October
    await logAt('2026-10-25T22:50:00.000Z', carotte.id); // 23:50 CET, still 25 October
    await logAt('2026-10-25T23:30:00.000Z', carotte.id); // 00:30 CET, Monday 26 October

    const { aujourdhui, carnet, now } = await view('2026-10-25T23:35:00.000Z'); // 00:35 Paris

    expect(carnet.weeklyEntries.counts).toEqual([0, 0, 0, 0, 0, 2, 1]);
    expect(carnet.weeklyEntries.anchorUtc).toBe(Date.UTC(2026, 9, 26));
    expect(aujourdhui.recent.map((e) => formatRelative(e.givenAt, now))).toEqual([
      'il y a 5 min',
      'il y a 45 min',
      'hier 00:10'
    ]);
  });
});
