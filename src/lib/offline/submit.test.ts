import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from 'bun:test';
import 'fake-indexeddb/auto';

import { testDb, resetTestDb } from '../../test/db';

// Point #lib/server/db at the in-process bun:sqlite instance before the log
// action (behind the in-process transport) loads.
mock.module('#lib/server/db/index.js', () => ({ db: testDb }));
mock.module('#lib/server/audit.js', () => ({ audit: mock() }));

import { seedLogScene } from '../../test/log-action-transport';
import { rawRows } from '../../test/offline-db';
import { entryRows, form } from '../../test/repas';
import { clear, count, flush } from './queue';
import { submitRepas } from './submit';
import type { Transport } from './wire';

async function setup() {
  const scene = await seedLogScene();
  // Every request the module makes, with the fields it carried.
  const sent: URLSearchParams[] = [];
  const transport: Transport = async (url, init) => {
    sent.push(new URLSearchParams(String(init.body)));
    return scene.transport(url, init);
  };
  return { ...scene, transport, sent, action: `http://localhost/child/${scene.child.id}/log` };
}

/** The log form as the browser hands it over: a datetime-local meal date. */
const GIVEN_AT = '2026-05-07T12:30';

function goOffline(): void {
  Object.defineProperty(navigator, 'onLine', { get: () => false, configurable: true });
}

const unreachable: Transport = () => Promise.reject(new TypeError('Failed to fetch'));

// SvelteKit's answer when a hook throws before the action runs.
const hookCrashed: Transport = async () =>
  new Response(JSON.stringify({ status: 500, message: 'Internal Error', errorId: 'c0ffee00' }), {
    status: 500,
    headers: { 'content-type': 'application/json' }
  });

describe('submitRepas', () => {
  beforeEach(async () => {
    await resetTestDb();
    await clear();
  });

  afterEach(() => {
    delete (navigator as { onLine?: boolean }).onLine;
  });

  it('sends the repas and hands back the action redirect', async () => {
    const { child, carotte, pomme, transport, action } = await setup();
    const outcome = await submitRepas(
      form({ foodId: [carotte.id, pomme.id], givenAt: GIVEN_AT, reaction: 'ras' }),
      { action, queueFor: child.id },
      transport
    );

    expect(outcome).toEqual({
      kind: 'sent',
      result: {
        type: 'redirect',
        status: 303,
        location: expect.stringContaining(`/child/${child.id}?logged=1`)
      }
    });
    const rows = entryRows(child.id);
    expect(rows.map((r) => r.foodId).sort()).toEqual([carotte.id, pomme.id].sort());
    expect(rows[0].mealId).not.toBeNull();
    expect(await count()).toBe(0);
  });

  it('turns the datetime-local meal date into an instant in the parent’s time zone', async () => {
    const { child, carotte, transport, action } = await setup();
    await submitRepas(
      form({ foodId: carotte.id, givenAt: GIVEN_AT, reaction: 'ras' }),
      { action, queueFor: child.id },
      transport
    );
    expect(entryRows(child.id)[0].givenAt.getTime()).toBe(new Date(GIVEN_AT).getTime());
  });

  it('hands back a refusal with its decoded errorKey, and queues nothing', async () => {
    const { child, transport, action } = await setup();
    const outcome = await submitRepas(
      form({ givenAt: GIVEN_AT, reaction: 'ras' }),
      { action, queueFor: child.id },
      transport
    );

    expect(outcome).toEqual({
      kind: 'sent',
      result: {
        type: 'failure',
        status: 400,
        location: `/child/${child.id}/log`,
        data: { errorKey: 'errorsLogNoFoodSelected' }
      }
    });
    expect(await count()).toBe(0);
  });

  it('hands back a server error with its HTTP status rather than queueing it', async () => {
    const { child, carotte, action } = await setup();
    const crashed: Transport = async () =>
      new Response(JSON.stringify({ type: 'error', error: { message: 'Internal Error' } }), {
        status: 500,
        headers: { 'content-type': 'application/json' }
      });
    const outcome = await submitRepas(
      form({ foodId: carotte.id, givenAt: GIVEN_AT, reaction: 'ras' }),
      { action, queueFor: child.id },
      crashed
    );

    expect(outcome).toEqual({
      kind: 'sent',
      result: { type: 'error', status: 500, error: { message: 'Internal Error' } }
    });
    expect(await count()).toBe(0);
  });

  it('queues without touching the network while the browser reports offline, in the stored row format', async () => {
    const { child, carotte, transport, sent, action } = await setup();
    goOffline();
    const outcome = await submitRepas(
      form({ foodId: [carotte.id], givenAt: GIVEN_AT, reaction: 'ras', notes: '' }),
      { action, queueFor: child.id },
      transport
    );

    expect(outcome).toEqual({ kind: 'queued' });
    expect(sent).toHaveLength(0);
    const [row] = (await rawRows()) as { key: string }[];
    expect(row).toEqual({
      key: expect.stringMatching(/^[0-9a-f-]{36}$/),
      childId: child.id,
      formData: {
        foodId: String(carotte.id),
        givenAt: new Date(GIVEN_AT).toISOString(),
        reaction: 'ras',
        notes: '',
        idempotencyKey: row.key
      },
      queuedAt: expect.any(Number)
    });
  });

  it('queues a submit whose answer never came back, under the key the server already saw', async () => {
    const { child, carotte, transport, action } = await setup();
    // The action runs and writes, then the answer is lost on the way back.
    const lostAnswer: Transport = async (url, init) => {
      await transport(url, init);
      throw new TypeError('Failed to fetch');
    };
    const outcome = await submitRepas(
      form({ foodId: carotte.id, givenAt: GIVEN_AT, reaction: 'ras' }),
      { action, queueFor: child.id },
      lostAnswer
    );
    expect(outcome).toEqual({ kind: 'queued' });

    await flush(transport);

    expect(await count()).toBe(0);
    expect(entryRows(child.id)).toHaveLength(1);
  });

  it('queues when something other than the app answers (a proxy or captive portal page)', async () => {
    const { child, carotte, action } = await setup();
    const answers = [
      new Response('<html>Bienvenue sur le wifi</html>', {
        status: 200,
        headers: { 'content-type': 'text/html' }
      }),
      // JSON, but neither an action result nor SvelteKit's error answer.
      new Response(JSON.stringify({ error: 'upstream timeout' }), {
        status: 504,
        headers: { 'content-type': 'application/json' }
      })
    ];
    for (const answer of answers) {
      const outcome = await submitRepas(
        form({ foodId: carotte.id, givenAt: GIVEN_AT, reaction: 'ras' }),
        { action, queueFor: child.id },
        async () => answer
      );
      expect(outcome).toEqual({ kind: 'queued' });
    }
    expect(await count()).toBe(2);
  });

  it('queues when a hook fails before the action ran: the replay may get through', async () => {
    const { child, carotte, action } = await setup();
    const outcome = await submitRepas(
      form({ foodId: carotte.id, givenAt: GIVEN_AT, reaction: 'ras' }),
      { action, queueFor: child.id },
      hookCrashed
    );

    expect(outcome).toEqual({ kind: 'queued' });
    expect(await count()).toBe(1);
  });

  it('fails when the repas can neither be sent nor queued', async () => {
    const { child, carotte, action } = await setup();
    spyOn(indexedDB, 'open').mockImplementation(() => {
      throw new DOMException('IndexedDB unavailable', 'UnknownError');
    });
    const outcome = await submitRepas(
      form({ foodId: carotte.id, givenAt: GIVEN_AT, reaction: 'ras' }),
      { action, queueFor: child.id },
      unreachable
    );

    expect(outcome).toEqual({ kind: 'failed' });
  });

  describe('without queueFor (the edit forms)', () => {
    it('sends the form as is, with no idempotency key', async () => {
      const { carotte, transport, sent, action } = await setup();
      const outcome = await submitRepas(
        form({ foodId: carotte.id, givenAt: GIVEN_AT, reaction: 'ras' }),
        { action },
        transport
      );

      expect(outcome.kind).toBe('sent');
      expect(sent[0].has('idempotencyKey')).toBe(false);
      expect(sent[0].get('givenAt')).toBe(new Date(GIVEN_AT).toISOString());
    });

    it('hands back the error a hook answered before the action ran, errorId included', async () => {
      const { carotte, action } = await setup();
      const outcome = await submitRepas(
        form({ foodId: carotte.id, givenAt: GIVEN_AT, reaction: 'ras' }),
        { action },
        hookCrashed
      );

      expect(outcome).toEqual({
        kind: 'sent',
        result: {
          type: 'error',
          status: 500,
          error: { status: 500, message: 'Internal Error', errorId: 'c0ffee00' }
        }
      });
      expect(await count()).toBe(0);
    });

    it('reads a hook error only from the app itself: no followed redirect, no stray errorId', async () => {
      const { carotte, action } = await setup();
      const submit = (answer: Response) =>
        submitRepas(
          form({ foodId: carotte.id, givenAt: GIVEN_AT, reaction: 'ras' }),
          { action },
          async () => answer
        );
      const appError = (body: unknown) =>
        new Response(JSON.stringify(body), {
          status: 500,
          headers: { 'content-type': 'application/json' }
        });

      const redirected = appError({ status: 500, message: 'Internal Error' });
      Object.defineProperty(redirected, 'redirected', { value: true });
      expect(await submit(redirected)).toEqual({ kind: 'failed' });

      expect(
        await submit(appError({ status: 500, message: 'Internal Error', errorId: 42 }))
      ).toEqual({
        kind: 'sent',
        result: { type: 'error', status: 500, error: { status: 500, message: 'Internal Error' } }
      });
    });

    it('fails, queueing nothing, when the server cannot be reached', async () => {
      const { carotte, action } = await setup();
      const outcome = await submitRepas(
        form({ foodId: carotte.id, givenAt: GIVEN_AT, reaction: 'ras' }),
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
        form({ foodId: carotte.id, givenAt: GIVEN_AT, reaction: 'ras' }),
        { action },
        transport
      );

      expect(outcome).toEqual({ kind: 'failed' });
      expect(sent).toHaveLength(0);
    });
  });
});
