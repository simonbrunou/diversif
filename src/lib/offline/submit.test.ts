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
import { stalledBody, untilAborted } from '../../test/stalled-reply';
import { clear, count, flush } from './queue';
import { submitRepas, type SubmitTarget } from './submit';
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

// A submit deadline short enough to wait out: Bun's runner can't advance
// setTimeout (see advanceTimersByTimeAsync in src/test/bun-test-utils.ts).
const SHORT_DEADLINE_MS = 50;

const stalls = [
  ['gets no answer', untilAborted],
  ['gets headers, then a body that never ends', stalledBody]
] as const;

/**
 * Submits a repas, with SHORT_DEADLINE_MS, to a server whose reply never
 * finishes on its own (`reply`, from src/test/stalled-reply.ts). Hands back
 * the outcome and, per request, the fields it carried, its signal and how long
 * after the submit started that signal aborted. The clock read comes before
 * submitRepas arms its timer, so a stall in between only makes that time
 * longer (#685).
 */
async function submitToStalledServer(
  reply: (signal: AbortSignal) => Promise<Response>,
  target: SubmitTarget
) {
  const requests: {
    fields: URLSearchParams;
    signal?: AbortSignal | null;
    abortedAfter?: number;
  }[] = [];
  let startedAt = 0;
  const transport: Transport = (_url, init) => {
    const request: (typeof requests)[number] = {
      fields: new URLSearchParams(String(init.body)),
      signal: init.signal
    };
    requests.push(request);
    // Without a signal nothing would ever end the reply: fail it at once.
    if (!init.signal) return Promise.reject(new TypeError('Failed to fetch'));
    init.signal.addEventListener('abort', () => (request.abortedAfter = Date.now() - startedAt), {
      once: true
    });
    return reply(init.signal);
  };
  startedAt = Date.now();
  const outcome = await submitRepas(
    form({ foodId: 1, givenAt: GIVEN_AT, reaction: 'ras' }),
    target,
    transport,
    SHORT_DEADLINE_MS
  );
  return { outcome, requests };
}

/** The one request was cancelled by the deadline, no sooner. */
function expectCancelledAtDeadline(
  requests: { signal?: AbortSignal | null; abortedAfter?: number }[]
) {
  expect(requests).toHaveLength(1);
  const [{ signal, abortedAfter }] = requests;
  expect(signal?.aborted).toBe(true);
  expect((signal?.reason as DOMException | undefined)?.name).toBe('TimeoutError');
  expect(abortedAfter).toBeGreaterThanOrEqual(SHORT_DEADLINE_MS - 1);
}

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

  // The online submit has a deadline, as the queue's replay does (#577); an
  // answer that beats it leaves the request's signal alone.
  it('sends the repas with a deadline that an answer in time does not trip', async () => {
    const { child, carotte, transport, action } = await setup();
    const signals: (AbortSignal | null | undefined)[] = [];
    const outcome = await submitRepas(
      form({ foodId: carotte.id, givenAt: GIVEN_AT, reaction: 'ras' }),
      { action, queueFor: child.id },
      (url, init) => {
        signals.push(init.signal);
        return transport(url, init);
      }
    );
    expect(outcome.kind).toBe('sent');
    expect(signals).toHaveLength(1);
    expect(signals[0]).toBeInstanceOf(AbortSignal);
    expect(signals[0]?.aborted).toBe(false);
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

  // A stalled request (a half-open mobile connection, a proxy that never
  // answers) kept the form busy until the browser gave up on it (#577).
  it.each(stalls)(
    'queues a submit whose request %s by the deadline, under the key the request carried',
    async (_, reply) => {
      const { child } = await setup();
      const { outcome, requests } = await submitToStalledServer(reply, {
        action: `http://localhost/child/${child.id}/log`,
        queueFor: child.id
      });

      expect(outcome).toEqual({ kind: 'queued' });
      expectCancelledAtDeadline(requests);
      const rows = (await rawRows()) as { key: string; childId: number }[];
      expect(rows).toHaveLength(1);
      expect(rows[0].childId).toBe(child.id);
      expect(rows[0].key).toBe(requests[0].fields.get('idempotencyKey')!);
    }
  );

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

    // A timeout can't tell whether the server saved the edit, so it is not a
    // failure: the form says the save may not have gone through (#577).
    it.each(stalls)(
      'times out, queueing nothing, when the request %s by the deadline',
      async (_, reply) => {
        const { child } = await setup();
        const { outcome, requests } = await submitToStalledServer(reply, {
          action: `http://localhost/child/${child.id}/log/1?/update`
        });

        expect(outcome).toEqual({ kind: 'timedOut' });
        expectCancelledAtDeadline(requests);
        expect(requests[0].fields.has('idempotencyKey')).toBe(false);
        expect(await count()).toBe(0);
      }
    );

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
