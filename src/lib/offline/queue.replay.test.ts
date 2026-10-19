import { beforeEach, describe, expect, it, mock } from 'bun:test';
import 'fake-indexeddb/auto';

import { testDb, resetTestDb } from '../../test/db';
import { safeUser, seedChild, seedMembership, seedUser } from '../../test/route';

// Same bootstrap as the route-level action tests: point #lib/server/db at the
// in-process bun:sqlite instance before the action module (which imports it)
// loads.
mock.module('#lib/server/db/index.js', () => ({ db: testDb }));
mock.module('#lib/server/audit.js', () => ({ audit: mock() }));

import { eq } from 'drizzle-orm';
import { foodEntries, foods } from '#lib/server/db/schema.js';
import { inProcessTransport, type Identity } from '../../test/log-action-transport';
import type { Transport } from './wire';
import { clear, count, enqueue, flush, needsReauthCount } from './queue';

// Replays through the in-process adapter (src/test/log-action-transport.ts):
// every answer comes from the real log action and the real database, never
// from an envelope written to match our own assumptions.

async function setup() {
  const u = await seedUser();
  const c = await seedChild({ createdBy: u.id });
  const m = await seedMembership({ userId: u.id, childId: c.id, role: 'owner' });
  const [carotte, pomme] = await testDb
    .insert(foods)
    .values(
      ['Carotte', 'Pomme'].map((name) => ({
        name,
        category: 'legumes',
        isMajorAllergen: false,
        allergenType: null,
        suggestedAgeMonths: 4,
        notes: null,
        isCustom: false,
        customForChildId: null
      }))
    )
    .returning();
  const signedIn: Identity = { user: safeUser(u), memberships: [m] };
  return { u, c, m, carotte, pomme, transport: inProcessTransport(() => signedIn) };
}

function entriesOf(childId: number) {
  return testDb.select().from(foodEntries).where(eq(foodEntries.childId, childId)).all();
}

/** The first answer to each call number in `lost` never reaches the client. */
function losing(transport: Transport, lost: number[]): Transport {
  let calls = 0;
  return async (url, init) => {
    calls += 1;
    const response = await transport(url, init);
    if (lost.includes(calls)) throw new TypeError('Failed to fetch');
    return response;
  };
}

/** Write a row straight into IndexedDB, the way an older client left it. */
async function putRaw(row: unknown): Promise<void> {
  const req = indexedDB.open('diversif-offline', 1);
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    req.onupgradeneeded = () => {
      const store = req.result.createObjectStore('log', { keyPath: 'key' });
      store.createIndex('queuedAt', 'queuedAt', { unique: false });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  await new Promise<void>((resolve, reject) => {
    const t = db.transaction('log', 'readwrite');
    t.objectStore('log').put(row);
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
  db.close();
}

describe('offline queue replay against the real log action', () => {
  beforeEach(async () => {
    await resetTestDb();
    await clear();
  });

  // Rows already sitting on parents' devices were written by the client
  // before the durable submit module: the current one (#325 onwards) copies
  // the key into formData.idempotencyKey, older ones only kept it as the row
  // key. Both must replay, and a replay whose answer was lost must not log
  // the repas twice.
  it('replays rows queued by earlier clients, once each, even when an answer is lost', async () => {
    const { c, carotte, pomme, transport } = await setup();
    const current = '6f9c1d1e-2b1a-4c47-9d0e-5a1f2f3b4c5d';
    await putRaw({
      key: current,
      childId: c.id,
      formData: {
        foodId: [String(carotte.id), String(pomme.id)],
        givenAt: '2026-05-07T10:00:00.000Z',
        reaction: 'ras',
        texture: 'lisse',
        notes: '',
        idempotencyKey: current
      },
      queuedAt: 1
    });
    await putRaw({
      key: 'b7e2a4d0-8c3f-4e1b-a5d6-0f9e8d7c6b5a',
      childId: c.id,
      formData: {
        foodId: String(carotte.id),
        givenAt: '2026-05-08T10:00:00.000Z',
        reaction: 'ras'
      },
      queuedAt: 2
    });

    const synced: unknown[] = [];
    const handler = (e: Event) => synced.push((e as CustomEvent).detail);
    window.addEventListener('queue:synced', handler);

    // Calls 1 and 3 are each row's first replay: the action runs, the
    // answer is lost, and the row is posted again on the next pass.
    const flaky = losing(transport, [1, 3]);
    await flush(flaky);
    expect(synced).toEqual([]);
    await flush(flaky);
    await flush(flaky);

    expect(await count()).toBe(0);
    const rows = entriesOf(c.id);
    expect(rows.map((r) => r.foodId).sort()).toEqual([carotte.id, carotte.id, pomme.id].sort());
    expect(rows.filter((r) => r.mealId !== null)).toHaveLength(2);
    // Each cached redirect keeps the milestone flags of its lost answer: the
    // first repas is still celebrated, the second has nothing to celebrate.
    expect(synced).toEqual([
      { queryStrings: [expect.stringContaining('first=1')] },
      { queryStrings: [expect.not.stringContaining('first=1')] }
    ]);
    window.removeEventListener('queue:synced', handler);
  });

  it('drains a queued entry: DB write, IDB clear, real redirect parsed', async () => {
    const { c, carotte, transport } = await setup();
    const synced: unknown[] = [];
    const handler = (e: Event) => synced.push((e as CustomEvent).detail);
    window.addEventListener('queue:synced', handler);

    await enqueue({
      key: 'replay-real-1',
      childId: c.id,
      formData: {
        foodId: String(carotte.id),
        givenAt: '2026-05-07T10:00:00.000Z',
        reaction: 'ras'
      },
      queuedAt: 1
    });
    await flush(transport);

    expect(await count()).toBe(0);
    // The child had no entries, so the real redirect carries the first-repas
    // flag the layout celebrates.
    expect(synced).toEqual([{ queryStrings: [expect.stringContaining('first=1')] }]);
    expect(entriesOf(c.id).map((r) => r.foodId)).toEqual([carotte.id]);
    window.removeEventListener('queue:synced', handler);
  });

  it('drops a queued entry the real action rejects (real fail(), not a fabricated 400)', async () => {
    const { c, transport } = await setup();
    const dropped: unknown[] = [];
    const handler = (e: Event) => dropped.push((e as CustomEvent).detail);
    window.addEventListener('queue:dropped', handler);

    await enqueue({
      key: 'replay-invalid-date',
      childId: c.id,
      formData: { givenAt: 'not-a-date', reaction: 'ras' }, // no foodId: a real refusal
      queuedAt: 1
    });
    await flush(transport);

    expect(await count()).toBe(0);
    expect(dropped).toEqual([{ reason: 'failure', status: 400 }]);
    expect(entriesOf(c.id)).toHaveLength(0);
    window.removeEventListener('queue:dropped', handler);
  });

  // #307: the real requireMembership guard answers 403 once this user's
  // membership on the child is gone, the "access revoked while the entry sat
  // offline" case.
  it('surfaces access-revoked (not the generic drop) when the real action 403s a removed membership', async () => {
    const { u, c, carotte } = await setup();
    const revoked: unknown[] = [];
    const dropped: string[] = [];
    const onRevoked = (e: Event) => revoked.push((e as CustomEvent).detail);
    const onDropped = () => dropped.push('dropped');
    window.addEventListener('queue:accessRevoked', onRevoked);
    window.addEventListener('queue:dropped', onDropped);

    await enqueue({
      key: 'revoked-1',
      childId: c.id,
      formData: {
        foodId: String(carotte.id),
        givenAt: '2026-05-07T10:00:00.000Z',
        reaction: 'ras'
      },
      queuedAt: 1
    });
    await flush(inProcessTransport(() => ({ user: safeUser(u), memberships: [] })));

    expect(await count()).toBe(0);
    expect(revoked).toEqual([{ status: 403 }]);
    expect(dropped).toEqual([]);
    expect(entriesOf(c.id)).toHaveLength(0);
    window.removeEventListener('queue:accessRevoked', onRevoked);
    window.removeEventListener('queue:dropped', onDropped);
  });

  // #308: requireUser answers a real localized redirect to /login when the
  // session expired. The row is retained, then cleared by a later replay
  // once the parent signed in again.
  it('retains the row on a real session-expiry redirect, then clears it once a later replay succeeds', async () => {
    const { u, c, m, carotte } = await setup();
    let identity: Identity = { user: null, memberships: [] };
    const transport = inProcessTransport(() => identity);
    const needsReauth: unknown[] = [];
    const onNeedsReauth = (e: Event) => needsReauth.push((e as CustomEvent).detail);
    window.addEventListener('queue:needsReauth', onNeedsReauth);

    await enqueue({
      key: 'reauth-real-1',
      childId: c.id,
      formData: {
        foodId: String(carotte.id),
        givenAt: '2026-05-07T10:00:00.000Z',
        reaction: 'ras'
      },
      queuedAt: 1
    });
    await flush(transport);

    expect(await count()).toBe(1);
    expect(await needsReauthCount()).toBe(1);
    expect(needsReauth).toEqual([{ key: 'reauth-real-1' }]);

    identity = { user: safeUser(u), memberships: [m] };
    await flush(transport);

    expect(await count()).toBe(0);
    expect(await needsReauthCount()).toBe(0);
    expect(entriesOf(c.id).map((r) => r.foodId)).toEqual([carotte.id]);
    window.removeEventListener('queue:needsReauth', onNeedsReauth);
  });
});
