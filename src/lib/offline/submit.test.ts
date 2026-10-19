import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from 'bun:test';
import 'fake-indexeddb/auto';

import { testDb, resetTestDb } from '../../test/db';
import { safeUser, seedChild, seedMembership, seedUser } from '../../test/route';

// Point #lib/server/db at the in-process bun:sqlite instance before the log
// action (behind the in-process transport) loads.
mock.module('#lib/server/db/index.js', () => ({ db: testDb }));
mock.module('#lib/server/audit.js', () => ({ audit: mock() }));

import { eq } from 'drizzle-orm';
import { foodEntries, foods } from '#lib/server/db/schema.js';
import { inProcessTransport } from '../../test/log-action-transport';
import { clear, count, flush } from './queue';
import { submitRepas } from './submit';
import type { Transport } from './wire';

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
  const server = inProcessTransport(() => ({ user: safeUser(u), memberships: [m] }));
  // Every request the module makes, with the fields it carried.
  const sent: URLSearchParams[] = [];
  const transport: Transport = async (url, init) => {
    sent.push(new URLSearchParams(String(init.body)));
    return server(url, init);
  };
  return { c, carotte, pomme, transport, sent, action: `http://localhost/child/${c.id}/log` };
}

/** The log form as the browser hands it over: datetime-local value, repeated foodId. */
function logForm(fields: Record<string, string | string[]>): FormData {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    for (const v of Array.isArray(value) ? value : [value]) form.append(key, v);
  }
  return form;
}

function entriesOf(childId: number) {
  return testDb.select().from(foodEntries).where(eq(foodEntries.childId, childId)).all();
}

function goOffline(): void {
  Object.defineProperty(navigator, 'onLine', { get: () => false, configurable: true });
}

/** The rows as stored in IndexedDB: the format every client version replays. */
async function storedRows(): Promise<unknown[]> {
  const req = indexedDB.open('diversif-offline', 1);
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  const rows = await new Promise<unknown[]>((resolve, reject) => {
    const r = db.transaction('log', 'readonly').objectStore('log').getAll();
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
  db.close();
  return rows;
}

const unreachable: Transport = () => Promise.reject(new TypeError('Failed to fetch'));

describe('submitRepas', () => {
  beforeEach(async () => {
    await resetTestDb();
    await clear();
  });

  afterEach(() => {
    delete (navigator as { onLine?: boolean }).onLine;
  });

  it('sends the repas and hands back the action redirect', async () => {
    const { c, carotte, pomme, transport, action } = await setup();
    const outcome = await submitRepas(
      logForm({
        foodId: [String(carotte.id), String(pomme.id)],
        givenAt: '2026-05-07T12:30',
        reaction: 'ras'
      }),
      { action, queueFor: c.id },
      transport
    );

    expect(outcome).toEqual({
      kind: 'sent',
      result: {
        type: 'redirect',
        status: 303,
        location: expect.stringContaining(`/child/${c.id}?logged=1`)
      }
    });
    const rows = entriesOf(c.id);
    expect(rows.map((r) => r.foodId).sort()).toEqual([carotte.id, pomme.id].sort());
    expect(rows[0].mealId).not.toBeNull();
    expect(await count()).toBe(0);
  });

  it('turns the datetime-local meal date into an instant in the parent’s time zone', async () => {
    const { c, carotte, transport, action } = await setup();
    await submitRepas(
      logForm({ foodId: String(carotte.id), givenAt: '2026-05-07T12:30', reaction: 'ras' }),
      { action, queueFor: c.id },
      transport
    );
    expect(entriesOf(c.id)[0].givenAt.getTime()).toBe(new Date('2026-05-07T12:30').getTime());
  });

  it('hands back a refusal with its decoded errorKey, and queues nothing', async () => {
    const { c, transport, action } = await setup();
    const outcome = await submitRepas(
      logForm({ givenAt: '2026-05-07T12:30', reaction: 'ras' }),
      { action, queueFor: c.id },
      transport
    );

    expect(outcome).toEqual({
      kind: 'sent',
      result: { type: 'failure', status: 400, data: { errorKey: 'errorsLogNoFoodSelected' } }
    });
    expect(await count()).toBe(0);
  });

  it('hands back a server error with its HTTP status rather than queueing it', async () => {
    const { c, carotte, action } = await setup();
    const crashed: Transport = async () =>
      new Response(JSON.stringify({ type: 'error', error: { message: 'Internal Error' } }), {
        status: 500,
        headers: { 'content-type': 'application/json' }
      });
    const outcome = await submitRepas(
      logForm({ foodId: String(carotte.id), givenAt: '2026-05-07T12:30', reaction: 'ras' }),
      { action, queueFor: c.id },
      crashed
    );

    expect(outcome).toEqual({
      kind: 'sent',
      result: { type: 'error', status: 500, error: { message: 'Internal Error' } }
    });
    expect(await count()).toBe(0);
  });

  it('queues without touching the network while the browser reports offline, in the stored row format', async () => {
    const { c, carotte, transport, sent, action } = await setup();
    goOffline();
    const outcome = await submitRepas(
      logForm({
        foodId: [String(carotte.id)],
        givenAt: '2026-05-07T12:30',
        reaction: 'ras',
        notes: ''
      }),
      { action, queueFor: c.id },
      transport
    );

    expect(outcome).toEqual({ kind: 'queued' });
    expect(sent).toHaveLength(0);
    const [row] = (await storedRows()) as { key: string }[];
    expect(row).toEqual({
      key: expect.stringMatching(/^[0-9a-f-]{36}$/),
      childId: c.id,
      formData: {
        foodId: String(carotte.id),
        givenAt: new Date('2026-05-07T12:30').toISOString(),
        reaction: 'ras',
        notes: '',
        idempotencyKey: row.key
      },
      queuedAt: expect.any(Number)
    });
  });

  it('queues a submit whose answer never came back, under the key the server already saw', async () => {
    const { c, carotte, transport, action } = await setup();
    // The action runs and writes, then the answer is lost on the way back.
    const lostAnswer: Transport = async (url, init) => {
      await transport(url, init);
      throw new TypeError('Failed to fetch');
    };
    const outcome = await submitRepas(
      logForm({ foodId: String(carotte.id), givenAt: '2026-05-07T12:30', reaction: 'ras' }),
      { action, queueFor: c.id },
      lostAnswer
    );
    expect(outcome).toEqual({ kind: 'queued' });

    await flush(transport);

    expect(await count()).toBe(0);
    expect(entriesOf(c.id)).toHaveLength(1);
  });

  it('queues when the answer is not an action result (a proxy or captive portal page)', async () => {
    const { c, carotte, action } = await setup();
    const portal: Transport = async () =>
      new Response('<html>Bienvenue sur le wifi</html>', {
        status: 200,
        headers: { 'content-type': 'text/html' }
      });
    const outcome = await submitRepas(
      logForm({ foodId: String(carotte.id), givenAt: '2026-05-07T12:30', reaction: 'ras' }),
      { action, queueFor: c.id },
      portal
    );

    expect(outcome).toEqual({ kind: 'queued' });
    expect(await count()).toBe(1);
  });

  it('fails when the repas can neither be sent nor queued', async () => {
    const { c, carotte, action } = await setup();
    spyOn(indexedDB, 'open').mockImplementation(() => {
      throw new DOMException('IndexedDB unavailable', 'UnknownError');
    });
    const outcome = await submitRepas(
      logForm({ foodId: String(carotte.id), givenAt: '2026-05-07T12:30', reaction: 'ras' }),
      { action, queueFor: c.id },
      unreachable
    );

    expect(outcome).toEqual({ kind: 'failed' });
  });

  describe('without queueFor (the edit forms)', () => {
    it('sends the form as is, with no idempotency key', async () => {
      const { carotte, transport, sent, action } = await setup();
      const outcome = await submitRepas(
        logForm({ foodId: String(carotte.id), givenAt: '2026-05-07T12:30', reaction: 'ras' }),
        { action },
        transport
      );

      expect(outcome.kind).toBe('sent');
      expect(sent[0].has('idempotencyKey')).toBe(false);
      expect(sent[0].get('givenAt')).toBe(new Date('2026-05-07T12:30').toISOString());
    });

    it('fails, queueing nothing, when the server cannot be reached', async () => {
      const { carotte, action } = await setup();
      const outcome = await submitRepas(
        logForm({ foodId: String(carotte.id), givenAt: '2026-05-07T12:30', reaction: 'ras' }),
        { action },
        unreachable
      );

      expect(outcome).toEqual({ kind: 'failed' });
      expect(await count()).toBe(0);
    });

    it('fails without touching the network while the browser reports offline', async () => {
      const { carotte, transport, sent, action } = await setup();
      goOffline();
      const outcome = await submitRepas(
        logForm({ foodId: String(carotte.id), givenAt: '2026-05-07T12:30', reaction: 'ras' }),
        { action },
        transport
      );

      expect(outcome).toEqual({ kind: 'failed' });
      expect(sent).toHaveLength(0);
    });
  });
});
